import { useState, useRef, useCallback } from 'react'
import { useOverlayClick } from '../lib/useOverlayClick'
import { useI18n } from '../i18n/I18nContext'
import { compressImage } from '../lib/imageUtils'
import { supabase } from '../lib/supabase'
import { createGarment } from '../lib/api'
import { detectDominantColor, type ColorDetectionResult } from '../lib/colorDetection'
import type { Category } from '../types'

interface DraftItem {
  id: string
  file: File
  originalUrl: string
  compressedUrl: string
  bgStatus: 'pending' | 'processing' | 'done' | 'failed'
  finalUrl: string
  colorResult: ColorDetectionResult | null
  garmentId: string | null
}

interface Props {
  onClose: () => void
  onComplete: () => void
}

async function removeBackground(imageUrl: string): Promise<string> {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string
  const { data: sessionData } = await supabase.auth.getSession()
  const token = sessionData?.session?.access_token || import.meta.env.VITE_SUPABASE_ANON_KEY as string

  const isBase64 = imageUrl.startsWith('data:')
  const body = isBase64 ? { imageBase64: imageUrl } : { imageUrl }

  const resp = await fetch(`${supabaseUrl}/functions/v1/photoroom`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  })
  if (!resp.ok) {
    const errBody = await resp.json().catch(() => ({}))
    throw new Error(errBody.error || `HTTP ${resp.status}`)
  }
  const blob = await resp.blob()
  if (!blob || blob.size === 0) throw new Error('No image returned')

  const userId = sessionData?.session?.user?.id || 'anonymous'
  const filename = `${userId}/${Date.now()}-${Math.random().toString(36).slice(2, 9)}-bg.png`
  const { error: upErr } = await supabase.storage.from('garments').upload(filename, blob, { contentType: 'image/png' })
  if (upErr) throw upErr
  const { data } = supabase.storage.from('garments').getPublicUrl(filename)
  return data.publicUrl
}

async function uploadCompressed(file: File): Promise<string> {
  const { blob, contentType, ext } = await compressImage(file)
  const { data: sd } = await supabase.auth.getSession()
  const uid = sd?.session?.user?.id || 'anonymous'
  const filename = `${uid}/${Date.now()}-${Math.random().toString(36).slice(2, 9)}.${ext}`
  const { error } = await supabase.storage.from('garments').upload(filename, blob, { contentType })
  if (error) throw error
  const { data } = supabase.storage.from('garments').getPublicUrl(filename)
  return data.publicUrl
}

export default function BatchUploadModal({ onClose, onComplete }: Props) {
  const { overlayProps } = useOverlayClick(onClose)
  const { t } = useI18n()
  const [drafts, setDrafts] = useState<DraftItem[]>([])
  const [uploading, setUploading] = useState(false)
  const [creating, setCreating] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const processingRef = useRef(false)

  const updateDraft = useCallback((id: string, updates: Partial<DraftItem>) => {
    setDrafts((prev) => prev.map((d) => (d.id === id ? { ...d, ...updates } : d)))
  }, [])

  const processQueue = useCallback(async (items: DraftItem[]) => {
    if (processingRef.current) return
    processingRef.current = true

    for (const item of items) {
      if (item.bgStatus !== 'pending') continue
      updateDraft(item.id, { bgStatus: 'processing' })

      try {
        const bgUrl = await removeBackground(item.compressedUrl)
        updateDraft(item.id, { bgStatus: 'done', finalUrl: bgUrl })

        const colorResult = await detectDominantColor(bgUrl)
        updateDraft(item.id, { colorResult })
      } catch {
        updateDraft(item.id, { bgStatus: 'failed', finalUrl: item.compressedUrl })
        const colorResult = await detectDominantColor(item.compressedUrl)
        updateDraft(item.id, { colorResult })
      }
    }

    processingRef.current = false
  }, [updateDraft])

  const handleFileSelect = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])
    if (files.length === 0) return

    setUploading(true)
    const newDrafts: DraftItem[] = []

    for (const file of files) {
      const id = `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
      try {
        const compressedUrl = await uploadCompressed(file)
        newDrafts.push({
          id,
          file,
          originalUrl: URL.createObjectURL(file),
          compressedUrl,
          bgStatus: 'pending',
          finalUrl: compressedUrl,
          colorResult: null,
          garmentId: null,
        })
      } catch {
        // skip failed uploads
      }
    }

    setDrafts((prev) => [...prev, ...newDrafts])
    setUploading(false)

    // Start background processing queue
    processQueue(newDrafts)

    // Reset input
    if (fileRef.current) fileRef.current.value = ''
  }, [processQueue])

  const handleRetry = useCallback(async (id: string) => {
    const draft = drafts.find((d) => d.id === id)
    if (!draft || draft.bgStatus === 'processing') return
    updateDraft(id, { bgStatus: 'processing' })

    try {
      const bgUrl = await removeBackground(draft.compressedUrl)
      updateDraft(id, { bgStatus: 'done', finalUrl: bgUrl })
      const colorResult = await detectDominantColor(bgUrl)
      updateDraft(id, { colorResult })
    } catch {
      updateDraft(id, { bgStatus: 'failed' })
    }
  }, [drafts, updateDraft])

  const handleCreateDrafts = useCallback(async () => {
    setCreating(true)
    let created = 0

    for (const draft of drafts) {
      try {
        const colorKey = draft.colorResult?.colorKey || ''
        const garment = await createGarment({
          name: '',
          description: '',
          category: 'tops' as Category,
          size: '',
          color_primary: colorKey,
          color_secondary: '',
          styles: [],
          season: 'all',
          brand: '',
          notes: '',
          favorite: false,
          photo_url: draft.finalUrl,
          material: '',
          status: 'available',
          wardrobe: 'personal',
          is_demo: false,
          is_draft: true,
          modesty: null,
          formality: null,
          pattern: 'solid',
          metallic: 'none',
          occasion_tags: [],
          purchase_price: null,
        })
        updateDraft(draft.id, { garmentId: garment.id })
        created++
      } catch {
        // skip failed
      }
    }

    setCreating(false)
    onComplete()
  }, [drafts, updateDraft, onComplete])

  const allProcessed = drafts.length > 0 && drafts.every((d) => d.bgStatus === 'done' || d.bgStatus === 'failed')
  const pendingCount = drafts.filter((d) => d.bgStatus === 'pending' || d.bgStatus === 'processing').length
  const doneCount = drafts.filter((d) => d.bgStatus === 'done').length
  const failedCount = drafts.filter((d) => d.bgStatus === 'failed').length

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center glass-overlay" {...overlayProps}>
      <div className="glass-sheet w-full max-w-lg max-h-[92vh] overflow-y-auto rounded-t-4xl sm:rounded-3xl animate-slide-up sm:animate-scale-in" onClick={(e) => e.stopPropagation()}>
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 rounded-full" style={{ background: 'var(--tc-20)' }} />
        </div>

        <div className="sticky top-0 glass-sheet px-5 py-3 flex items-center justify-between z-10" style={{ borderBottom: '1px solid var(--line)' }}>
          <h2 className="text-lg title-display" style={{ color: 'var(--tc)' }}>{t('batchAddBurst')}</h2>
          <button onClick={onClose} className="w-8 h-8 rounded-full flex items-center justify-center transition-transform active:scale-90" style={{ background: 'var(--tc-07)', color: 'var(--tc-45)' }}>
            <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2}><path d="M6 6l12 12M6 18L18 6" /></svg>
          </button>
        </div>

        <div className="p-5 space-y-4">
          {drafts.length === 0 ? (
            <button
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
              className="w-full aspect-[3/2] rounded-2xl flex flex-col items-center justify-center gap-3 transition-transform active:scale-[0.98]"
              style={{ border: '2px dashed var(--tc-20)', color: 'var(--tc-30)' }}
            >
              {uploading ? (
                <><div className="w-10 h-10 rounded-full border-2 animate-spin" style={{ borderColor: 'var(--tc-20)', borderTopColor: 'var(--tc)' }} /><span className="text-sm font-sans">{t('commonLoading')}</span></>
              ) : (
                <>
                  <svg viewBox="0 0 24 24" className="w-12 h-12" fill="none" stroke="currentColor" strokeWidth={1.5}>
                    <rect x="3" y="5" width="18" height="14" rx="2" />
                    <circle cx="9" cy="11" r="2" />
                    <path d="M3 17l5-5 4 4 3-3 6 6" strokeLinejoin="round" />
                  </svg>
                  <span className="text-sm font-sans font-medium">{t('batchSelectPhotos')}</span>
                  <span className="text-xs font-sans" style={{ color: 'var(--tc-30)' }}>{t('batchHint')}</span>
                </>
              )}
            </button>
          ) : (
            <>
              {/* Summary bar */}
              <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-sans" style={{ background: 'var(--tc-04)' }}>
                <span style={{ color: 'var(--tc)' }}>{drafts.length} {t('batchUploaded').replace('{n}', String(drafts.length))}</span>
                {pendingCount > 0 && (
                  <span className="flex items-center gap-1" style={{ color: 'var(--tc-45)' }}>
                    <div className="w-3 h-3 rounded-full border animate-spin" style={{ borderColor: 'var(--tc-20)', borderTopColor: 'var(--tc)' }} />
                    {pendingCount} {t('batchProcessing')}
                  </span>
                )}
                {doneCount > 0 && <span style={{ color: '#1f7852' }}>{doneCount} {t('batchReady')}</span>}
                {failedCount > 0 && <span style={{ color: 'var(--danger)' }}>{failedCount} {t('batchFailed')}</span>}
              </div>

              {/* Photo grid */}
              <div className="grid grid-cols-3 gap-2.5">
                {drafts.map((draft) => (
                  <div key={draft.id} className="relative aspect-[3/4] rounded-xl overflow-hidden" style={{ background: 'var(--tc-04)' }}>
                    <img src={draft.finalUrl || draft.compressedUrl} alt="" className="w-full h-full object-contain" />
                    {/* Status overlay */}
                    {(draft.bgStatus === 'pending' || draft.bgStatus === 'processing') && (
                      <div className="absolute inset-0 flex flex-col items-center justify-center gap-1.5" style={{ background: 'rgba(255,255,255,0.75)', backdropFilter: 'blur(4px)' }}>
                        <div className="w-6 h-6 rounded-full border-2 animate-spin" style={{ borderColor: 'var(--tc-20)', borderTopColor: 'var(--tc)' }} />
                        <span className="text-[9px] font-sans font-semibold text-center px-1" style={{ color: 'var(--tc)' }}>{t('batchProcessingBg')}</span>
                      </div>
                    )}
                    {draft.bgStatus === 'failed' && (
                      <div className="absolute inset-0 flex flex-col items-center justify-center gap-1" style={{ background: 'rgba(255,255,255,0.85)' }}>
                        <span className="text-[9px] font-sans font-bold" style={{ color: 'var(--danger)' }}>{t('batchFailed')}</span>
                        <button onClick={() => handleRetry(draft.id)} className="px-2 py-1 rounded-lg text-[9px] font-sans font-semibold" style={{ background: 'var(--tc-07)', color: 'var(--tc)' }}>{t('batchRetry')}</button>
                      </div>
                    )}
                    {draft.bgStatus === 'done' && draft.colorResult && (
                      <div className="absolute bottom-0 left-0 right-0 px-1.5 py-1 flex items-center justify-between" style={{ background: 'rgba(255,255,255,0.9)' }}>
                        <span className="text-[8px] font-sans font-semibold" style={{ color: 'var(--tc)' }}>{draft.colorResult.colorKey}</span>
                        <span className="text-[8px] font-sans" style={{ color: 'var(--tc-45)' }}>{draft.colorResult.confidence}%</span>
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {/* Add more photos */}
              <button
                onClick={() => fileRef.current?.click()}
                disabled={uploading}
                className="w-full py-2.5 rounded-xl text-xs font-sans font-semibold transition-transform active:scale-95"
                style={{ background: 'var(--tc-07)', color: 'var(--tc)' }}
              >
                + {t('batchSelectPhotos')}
              </button>

              {/* Create drafts button */}
              <button
                onClick={handleCreateDrafts}
                disabled={creating || uploading || pendingCount > 0}
                className="w-full btn-gold py-3 disabled:opacity-50"
              >
                {creating ? t('batchCreating') : t('formSave')}
              </button>
            </>
          )}

          <input ref={fileRef} type="file" accept="image/*" multiple className="hidden" onChange={handleFileSelect} />
        </div>
      </div>
    </div>
  )
}
