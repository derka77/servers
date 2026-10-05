import { useState, useEffect, useRef, useCallback } from 'react'
import { useOverlayClick } from '../lib/useOverlayClick'
import { useI18n } from '../i18n/I18nContext'
import { runTryOn, pollTryOnStatus, fetchFashnCredits, saveTryOnResult, fetchTryOnResults, deleteTryOnResult, type TryOnResult } from '../lib/api'
import type { Garment } from '../types'

interface Props {
  garment: Garment
  avatarUrl: string
  avatarOptimizedUrl?: string
  defaultUseOptimized?: boolean
  onClose: () => void
}

export default function TryOnModal({ garment, avatarUrl, avatarOptimizedUrl, defaultUseOptimized, onClose }: Props) {
  const { overlayProps } = useOverlayClick(onClose)
  const { t } = useI18n()
  const [status, setStatus] = useState<'idle' | 'running' | 'polling' | 'done' | 'error'>('idle')
  const [resultUrl, setResultUrl] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [credits, setCredits] = useState<number | null>(null)
  const [history, setHistory] = useState<TryOnResult[]>([])
  const [modelName, setModelName] = useState<'tryon-v1.6' | 'tryon-max'>('tryon-max')
  const [useOptimized, setUseOptimized] = useState<boolean>(defaultUseOptimized ?? false)
  const pollRef = useRef<string | null>(null)

  const loadHistory = useCallback(async () => {
    try {
      const h = await fetchTryOnResults()
      setHistory(h.filter((r) => r.garment_id === garment.id))
    } catch { /* ignore */ }
  }, [garment.id])

  useEffect(() => {
    fetchFashnCredits().then((c) => setCredits(c.total)).catch(() => {})
    loadHistory()
  }, [loadHistory])

  useEffect(() => {
    return () => { pollRef.current = null }
  }, [])

  const effectiveAvatar = (useOptimized && avatarOptimizedUrl) ? avatarOptimizedUrl : avatarUrl

  async function handleRun() {
    if (!effectiveAvatar) { setError(t('tryOnNoAvatar')); return }
    setStatus('running'); setError(null); setResultUrl(null)
    try {
      const run = await runTryOn(effectiveAvatar, garment.photo_url, modelName)
      if (run.error) throw new Error(run.error)
      if (!run.id) throw new Error('No prediction ID returned')
      setStatus('polling')
      pollRef.current = run.id
      const maxAttempts = 60
      for (let i = 0; i < maxAttempts; i++) {
        await new Promise((r) => setTimeout(r, 3000))
        if (pollRef.current !== run.id) return
        const s = await pollTryOnStatus(run.id)
        if (s.status === 'completed' && s.output?.length > 0) {
          const url = s.output[0]
          setResultUrl(url)
          setStatus('done')
          await saveTryOnResult({
            garment_id: garment.id,
            garment_name: garment.name,
            garment_photo_url: garment.photo_url,
            avatar_url: effectiveAvatar,
            result_url: url,
            status: 'completed',
            error: null,
            credits_used: modelName === 'tryon-v1.6' ? 1 : 2,
          })
          fetchFashnCredits().then((c) => setCredits(c.total)).catch(() => {})
          loadHistory()
          return
        }
        if (s.status === 'failed') throw new Error(s.error || 'Generation failed')
      }
      throw new Error('Timed out waiting for result')
    } catch (e) {
      setStatus('error')
      setError((e as Error).message || t('tryOnError'))
    }
  }

  async function handleDeleteHistory(id: string) {
    try {
      await deleteTryOnResult(id)
      loadHistory()
    } catch { /* ignore */ }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.6)' }} {...overlayProps}>
      <div className="relative w-full max-w-md max-h-[90vh] overflow-y-auto rounded-2xl" style={{ background: 'var(--bg-card, #fff)' }} onClick={(e) => e.stopPropagation()}>
        <div className="sticky top-0 z-10 flex items-center justify-between px-5 py-4" style={{ background: 'inherit', borderBottom: '1px solid var(--line)' }}>
          <h2 className="text-base title-display" style={{ color: 'var(--tc)' }}>{t('tryOnTitle')}</h2>
          <button onClick={onClose} className="w-8 h-8 rounded-full flex items-center justify-center" style={{ background: 'var(--tc-07)' }}>
            <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} style={{ color: 'var(--tc)' }}><path d="M6 6l12 12M6 18L18 6" /></svg>
          </button>
        </div>

        <div className="p-5 space-y-4">
          {/* Credits */}
          {credits !== null && (
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-xs font-sans" style={{ color: 'var(--tc-45)' }}>
                <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2}><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg>
                {t('tryOnCredits')}: <span className="font-semibold" style={{ color: 'var(--tc)' }}>{credits}</span>
              </div>
              {credits < 10 && (
                <p className="text-[10px] font-sans px-2 py-1 rounded-lg" style={{ background: 'var(--brass-soft)', color: 'var(--warn)' }}>
                  {t('tryOnLowCredits').replace('{n}', String(credits))}
                </p>
              )}
            </div>
          )}

          {/* Model selector */}
          <div className="space-y-2">
            <label className="block text-xs font-sans font-medium" style={{ color: 'var(--tc-45)' }}>{t('tryOnModelLabel')}</label>
            <div className="grid grid-cols-2 gap-2">
              <button type="button" onClick={() => setModelName('tryon-v1.6')}
                className="py-2.5 rounded-lg text-xs font-sans font-semibold transition-transform active:scale-95"
                style={modelName === 'tryon-v1.6' ? { background: 'var(--tc)', color: '#fff' } : { background: 'var(--tc-07)', color: 'var(--tc)' }}>
                {t('tryOnFastMode')}
              </button>
              <button type="button" onClick={() => setModelName('tryon-max')}
                className="py-2.5 rounded-lg text-xs font-sans font-semibold transition-transform active:scale-95"
                style={modelName === 'tryon-max' ? { background: 'var(--tc)', color: '#fff' } : { background: 'var(--tc-07)', color: 'var(--tc)' }}>
                {t('tryOnMaxMode')}
              </button>
            </div>
          </div>

          {/* Avatar selector */}
          {avatarUrl && avatarOptimizedUrl && (
            <div className="space-y-2">
              <label className="block text-xs font-sans font-medium" style={{ color: 'var(--tc-45)' }}>{t('avatarTitle')}</label>
              <div className="grid grid-cols-2 gap-2">
                <button type="button" onClick={() => setUseOptimized(false)}
                  className="flex items-center gap-2 py-2 px-3 rounded-lg text-xs font-sans font-semibold transition-transform active:scale-95"
                  style={!useOptimized ? { background: 'var(--tc)', color: '#fff' } : { background: 'var(--tc-07)', color: 'var(--tc)' }}>
                  <div className="w-7 h-9 rounded overflow-hidden flex-shrink-0" style={{ background: 'var(--tc-04)' }}>
                    <img src={avatarUrl} alt="" className="w-full h-full object-cover" />
                  </div>
                  {t('tryOnAvatarSelectPhoto')}
                </button>
                <button type="button" onClick={() => setUseOptimized(true)}
                  className="flex items-center gap-2 py-2 px-3 rounded-lg text-xs font-sans font-semibold transition-transform active:scale-95"
                  style={useOptimized ? { background: 'var(--tc)', color: '#fff' } : { background: 'var(--tc-07)', color: 'var(--tc)' }}>
                  <div className="w-7 h-9 rounded overflow-hidden flex-shrink-0" style={{ background: 'var(--tc-04)' }}>
                    <img src={avatarOptimizedUrl} alt="" className="w-full h-full object-cover" />
                  </div>
                  {t('tryOnAvatarSelectOptimized')}
                </button>
              </div>
            </div>
          )}

          {/* Preview: garment + avatar */}
          <div className="grid grid-cols-2 gap-3">
            <div className="text-center">
              <div className="aspect-[3/4] rounded-xl overflow-hidden mb-1" style={{ background: 'var(--tc-04)' }}>
                <img src={garment.photo_url} alt={garment.name} className="w-full h-full object-contain" />
              </div>
              <p className="text-[10px] font-sans" style={{ color: 'var(--tc-45)' }}>{garment.name}</p>
            </div>
            <div className="text-center">
              <div className="aspect-[3/4] rounded-xl overflow-hidden mb-1" style={{ background: 'var(--tc-04)' }}>
                {effectiveAvatar ? (
                  <img src={effectiveAvatar} alt="Avatar" className="w-full h-full object-contain" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <p className="text-[10px] font-sans text-center px-2" style={{ color: 'var(--tc-30)' }}>{t('tryOnNoAvatar')}</p>
                  </div>
                )}
              </div>
              <p className="text-[10px] font-sans" style={{ color: 'var(--tc-45)' }}>{useOptimized ? t('tryOnAvatarSelectOptimized') : t('tryOnAvatarSelectPhoto')}</p>
            </div>
          </div>

          {/* Run button */}
          {(status === 'idle' || status === 'error') && (
            <div className="space-y-2">
              <button onClick={handleRun} disabled={!effectiveAvatar}
                className="btn-gold w-full disabled:opacity-50">
                {t('tryOnButton')}
              </button>
              <p className="text-[10px] font-sans text-center" style={{ color: 'var(--tc-45)' }}>{t('tryOnMaxModeHint')}</p>
              <p className="text-[10px] font-sans text-center" style={{ color: 'var(--tc-30)' }}>{t('tryOnDisclaimer')}</p>
            </div>
          )}

          {/* Loading state */}
          {(status === 'running' || status === 'polling') && (
            <div className="flex flex-col items-center gap-3 py-4">
              <div className="w-10 h-10 rounded-full border-2 border-white border-t-transparent animate-spin" style={{ borderColor: 'var(--tc-20)', borderTopColor: 'var(--tc)' }} />
              <p className="text-xs font-sans" style={{ color: 'var(--tc-45)' }}>{t('tryOnProcessing')}</p>
            </div>
          )}

          {/* Result */}
          {status === 'done' && resultUrl && (
            <div className="space-y-2">
              <p className="text-xs font-sans font-semibold" style={{ color: 'var(--tc)' }}>{t('tryOnResult')}</p>
              <div className="rounded-xl overflow-hidden" style={{ background: 'var(--tc-04)' }}>
                <img src={resultUrl} alt="Try-on result" className="w-full object-contain" />
              </div>
              <button onClick={handleRun} className="btn-outline w-full py-2.5 text-xs">{t('tryOnButton')}</button>
            </div>
          )}

          {/* Error */}
          {status === 'error' && error && (
            <p className="text-sm font-sans text-center" style={{ color: 'var(--danger)' }}>{error}</p>
          )}

          {/* History */}
          {history.length > 0 && (
            <div className="space-y-2 pt-2" style={{ borderTop: '1px solid var(--line)' }}>
              <p className="text-xs font-sans font-semibold" style={{ color: 'var(--tc)' }}>{t('tryOnHistory')}</p>
              {history.map((h) => (
                <div key={h.id} className="flex gap-2 items-center">
                  <div className="w-14 h-18 rounded-lg overflow-hidden flex-shrink-0" style={{ background: 'var(--tc-04)' }}>
                    <img src={h.result_url} alt="" className="w-full h-full object-contain" loading="lazy" />
                  </div>
                  <span className="text-[10px] font-sans flex-1" style={{ color: 'var(--tc-45)' }}>
                    {new Date(h.created_at).toLocaleDateString()}
                  </span>
                  <button onClick={() => handleDeleteHistory(h.id)} className="w-7 h-7 rounded-full flex items-center justify-center" style={{ background: 'var(--tc-07)' }}>
                    <svg viewBox="0 0 24 24" className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} style={{ color: 'var(--tc-45)' }}><path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14" /></svg>
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
