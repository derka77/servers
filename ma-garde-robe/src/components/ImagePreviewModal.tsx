import { useState, useRef, useEffect } from 'react'
import { useOverlayClick } from '../lib/useOverlayClick'
import { useI18n } from '../i18n/I18nContext'
import { localizeGarmentName } from '../lib/clothingDictionary'
import { supabase } from '../lib/supabase'
import { deletePhoto, fetchProfile } from '../lib/api'
import TryOnModal from './TryOnModal'
import type { Garment } from '../types'

interface Props {
  garment: Garment
  onClose: () => void
  onPhotoUpdated?: (garmentId: string, newUrl: string) => void
}

export default function ImagePreviewModal({ garment, onClose, onPhotoUpdated }: Props) {
  const { overlayProps } = useOverlayClick(onClose)
  const [showTryOn, setShowTryOn] = useState(false)
  const [avatarUrl, setAvatarUrl] = useState<string>('')
  const [avatarOptimizedUrl, setAvatarOptimizedUrl] = useState<string>('')
  const { t, locale } = useI18n()
  const [rotation, setRotation] = useState(0)
  const [flipped, setFlipped] = useState(false)
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState<string | null>(null)
  const imgRef = useRef<HTMLImageElement>(null)

  useEffect(() => {
    if (!toast) return
    const timer = setTimeout(() => setToast(null), 2000)
    return () => clearTimeout(timer)
  }, [toast])

  useEffect(() => {
    fetchProfile().then((p) => {
      setAvatarUrl(p?.avatar_url || '')
      setAvatarOptimizedUrl(p?.avatar_optimized_url || '')
    }).catch(() => {})
  }, [])

  if (!garment.photo_url) return null

  async function handleSave() {
    const img = imgRef.current
    if (!img) return
    try {
      setSaving(true)
      const canvas = document.createElement('canvas')
      canvas.width = img.naturalWidth
      canvas.height = img.naturalHeight
      const ctx = canvas.getContext('2d')
      if (!ctx) return
      ctx.save()
      ctx.translate(canvas.width / 2, canvas.height / 2)
      if (rotation % 360 !== 0) ctx.rotate((rotation * Math.PI) / 180)
      if (flipped) ctx.scale(-1, 1)
      ctx.drawImage(img, -canvas.width / 2, -canvas.height / 2)
      ctx.restore()
      const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'))
      if (!blob) throw new Error('Failed to export image')
      const filename = `${Date.now()}-edited.png`
      const { error: upErr } = await supabase.storage.from('garments').upload(filename, blob, { contentType: 'image/png' })
      if (upErr) throw upErr
      const { data } = supabase.storage.from('garments').getPublicUrl(filename)
      if (garment.photo_url) { try { await deletePhoto(garment.photo_url) } catch { /* ignore */ } }
      onPhotoUpdated?.(garment.id, data.publicUrl)
      setToast(t('formPhotoSaved'))
      setRotation(0)
      setFlipped(false)
    } catch {
      setToast(t('commonError'))
    } finally {
      setSaving(false)
    }
  }

  const transform = `rotate(${rotation}deg) scaleX(${flipped ? -1 : 1})`

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center" {...overlayProps} style={{ background: 'rgba(255,255,255,0.96)', backdropFilter: 'blur(12px)' }}>
      <div className="absolute top-4 right-4 z-10">
        <button onClick={onClose} className="w-10 h-10 rounded-full flex items-center justify-center transition-transform active:scale-90" style={{ background: 'rgba(0,0,0,0.06)', color: 'var(--tc)' }}>
          <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2}><path d="M6 6l12 12M6 18L18 6" /></svg>
        </button>
      </div>
      <div className="flex flex-col items-center max-w-full max-h-full p-4" onClick={(e) => e.stopPropagation()}>
        <img
          ref={imgRef}
          src={garment.photo_url}
          alt={garment.name}
          className="max-w-full max-h-[70vh] rounded-2xl object-contain animate-scale-in transition-transform duration-300"
          style={{ transform }}
          crossOrigin="anonymous"
        />
        <p className="mt-4 text-base font-sans font-medium animate-fade-up" style={{ color: 'var(--tc)' }}>{localizeGarmentName(garment.name, locale)}</p>

        {toast && (
          <div className="mt-3 px-4 py-2 rounded-xl text-sm font-sans font-medium animate-scale-in" style={{ background: 'rgba(31,120,82,0.95)', color: '#fff' }}>
            {toast}
          </div>
        )}

        <div className="mt-4 flex gap-2 flex-wrap justify-center">
          <button
            onClick={() => setShowTryOn(true)}
            disabled={garment.wardrobe === 'demo'}
            className="px-4 py-2.5 rounded-xl text-sm font-sans font-semibold transition-transform active:scale-95 flex items-center gap-2 disabled:opacity-40"
            style={{ background: 'var(--ok)', color: '#fff' }}
            title={garment.wardrobe === 'demo' ? t('demoTryOnDisabled') : undefined}
          >
            <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2}><path d="M12 2a4 4 0 0 1 4 4v2a4 4 0 0 1-8 0V6a4 4 0 0 1 4-4zM6 14v6M18 14v6M4 14h16l-2 8H6z" /></svg>
            {t('tryOnButton')}
          </button>
          <button
            onClick={() => setRotation((r) => (r + 90) % 360)}
            className="px-4 py-2.5 rounded-xl text-sm font-sans font-semibold transition-transform active:scale-95 flex items-center gap-2"
            style={{ background: 'var(--tc-07)', color: 'var(--tc)' }}
          >
            <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2}><path d="M21 12a9 9 0 1 1-3-6.7M21 3v5h-5" /></svg>
            {t('formRotate')}
          </button>
          <button
            onClick={() => setFlipped((f) => !f)}
            className="px-4 py-2.5 rounded-xl text-sm font-sans font-semibold transition-transform active:scale-95 flex items-center gap-2"
            style={{ background: 'var(--tc-07)', color: 'var(--tc)' }}
          >
            <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2}><path d="M12 4v16M8 8L4 12l4 4M16 8l4 4-4 4" /></svg>
            {t('formMirror')}
          </button>
          <button
            onClick={handleSave}
            disabled={saving || (rotation === 0 && !flipped)}
            className="px-4 py-2.5 rounded-xl text-sm font-sans font-semibold transition-transform active:scale-95 disabled:opacity-40 flex items-center gap-2"
            style={{ background: 'var(--accent)', color: 'var(--on-accent)' }}
          >
            <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2}><path d="M5 12l5 5L20 7" /></svg>
            {saving ? t('commonLoading') : t('formSavePhoto')}
          </button>
        </div>
      </div>
      {showTryOn && (() => {
        // Optimized avatar is the default for all categories.
        // The user can manually switch to the photo avatar inside the try-on modal.
        const defaultUseOptimized = !!avatarOptimizedUrl
        return (
          <TryOnModal
            garment={garment}
            avatarUrl={avatarUrl}
            avatarOptimizedUrl={avatarOptimizedUrl}
            defaultUseOptimized={defaultUseOptimized}
            onClose={() => setShowTryOn(false)}
          />
        )
      })()}
    </div>
  )
}
