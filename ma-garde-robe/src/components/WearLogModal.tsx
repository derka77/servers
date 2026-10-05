import { useState, useEffect } from 'react'
import { useOverlayClick } from '../lib/useOverlayClick'
import { useI18n } from '../i18n/I18nContext'
import { createWearLog, fetchWearLogsForGarment, deleteWearLog, fetchDistinctCircles, type WearLogEntry } from '../lib/api'
import type { Occasion } from '../types'

interface Props {
  garmentId: string | null
  outfitId?: string | null
  outfitGarmentIds?: string[]
  onClose: () => void
  onLogged?: () => void
}

const OCCASIONS: Occasion[] = [
  'everyday', 'work', 'brunch', 'evening_out', 'wedding_guest', 'henna_party',
  'eid', 'ramadan_gathering', 'majlis', 'beach', 'travel', 'sport',
]

export default function WearLogModal({ garmentId, outfitId, outfitGarmentIds, onClose, onLogged }: Props) {
  const { overlayProps } = useOverlayClick(onClose)
  const { t, locale } = useI18n()
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10))
  const [occasion, setOccasion] = useState<Occasion | ''>('')
  const [eventName, setEventName] = useState('')
  const [circle, setCircle] = useState('')
  const [note, setNote] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [logs, setLogs] = useState<WearLogEntry[]>([])
  const [circleSuggestions, setCircleSuggestions] = useState<string[]>([])

  useEffect(() => {
    fetchDistinctCircles().then(setCircleSuggestions).catch(() => {})
    if (garmentId) {
      fetchWearLogsForGarment(garmentId).then(setLogs).catch(() => {})
    }
  }, [garmentId])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    try {
      setSaving(true); setError(null)
      if (outfitId && outfitGarmentIds && outfitGarmentIds.length > 0) {
        for (const gid of outfitGarmentIds) {
          await createWearLog({
            garment_id: gid,
            outfit_id: null,
            worn_date: date,
            occasion: occasion || null,
            event_name: eventName,
            circle,
            note,
          })
        }
      } else if (garmentId) {
        await createWearLog({
          garment_id: garmentId,
          outfit_id: null,
          worn_date: date,
          occasion: occasion || null,
          event_name: eventName,
          circle,
          note,
        })
      }
      if (garmentId) {
        fetchWearLogsForGarment(garmentId).then(setLogs).catch(() => {})
      }
      setDate(new Date().toISOString().slice(0, 10))
      setOccasion(''); setEventName(''); setCircle(''); setNote('')
      onLogged?.()
    } catch { setError(t('commonError')) } finally { setSaving(false) }
  }

  async function handleDeleteLog(id: string) {
    try {
      await deleteWearLog(id)
      if (garmentId) fetchWearLogsForGarment(garmentId).then(setLogs).catch(() => {})
      onLogged?.()
    } catch { setError(t('commonError')) }
  }

  function formatDate(d: string): string {
    try {
      return new Date(d).toLocaleDateString(locale === 'ar' ? 'ar' : locale, { year: 'numeric', month: 'short', day: 'numeric' })
    } catch { return d }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center glass-overlay" {...overlayProps}>
      <div className="glass-sheet w-full max-w-md max-h-[85vh] overflow-y-auto rounded-t-4xl sm:rounded-3xl animate-slide-up sm:animate-scale-in" onClick={(e) => e.stopPropagation()}>
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 rounded-full" style={{ background: 'var(--tc-20)' }} />
        </div>
        <div className="sticky top-0 glass-sheet px-5 py-3 flex items-center justify-between z-10" style={{ borderBottom: '1px solid var(--line)' }}>
          <h2 className="text-base title-display" style={{ color: 'var(--tc)' }}>
            {outfitId ? t('wearLogOutfitWorn') : t('wearLogWorn')}
          </h2>
          <button onClick={onClose} className="w-8 h-8 rounded-full flex items-center justify-center transition-transform active:scale-90" style={{ background: 'var(--tc-07)', color: 'var(--tc-45)' }}>
            <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2}><path d="M6 6l12 12M6 18L18 6" /></svg>
          </button>
        </div>

        <div className="p-5 space-y-4">
          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-3">
            <div>
              <label className="block text-sm font-sans font-semibold mb-2" style={{ color: 'var(--tc)' }}>{t('wearLogDate')}</label>
              <input type="date" className="input-field" style={{ fontSize: 16, minHeight: 52, fontWeight: 600 }} value={date} onChange={(e) => setDate(e.target.value)} required />
            </div>
            <div>
              <label className="block text-xs font-sans font-medium mb-1.5" style={{ color: 'var(--tc-45)' }}>{t('wearLogOccasion')}</label>
              <select className="input-field" value={occasion} onChange={(e) => setOccasion(e.target.value as Occasion | '')}>
                <option value="">{t('occasionSelectPlaceholder')}</option>
                {OCCASIONS.map((o) => (
                  <option key={o} value={o}>{t('occasion' + o.charAt(0).toUpperCase() + o.slice(1))}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-sans font-medium mb-1.5" style={{ color: 'var(--tc-45)' }}>{t('wearLogEvent')} <span style={{ color: 'var(--tc-30)' }}>({t('commonOptional')})</span></label>
              <input className="input-field" value={eventName} onChange={(e) => setEventName(e.target.value)} placeholder={locale === 'fr' ? 'Mariage de Fatima' : locale === 'ar' ? 'عرش فاطمة' : 'Fatima\'s wedding'} />
            </div>
            <div>
              <label className="block text-xs font-sans font-medium mb-1.5" style={{ color: 'var(--tc-45)' }}>{t('wearLogCircle')} <span style={{ color: 'var(--tc-30)' }}>({t('commonOptional')})</span></label>
              <input className="input-field" value={circle} onChange={(e) => setCircle(e.target.value)} list="circle-suggestions" placeholder={t('wearLogCirclePlaceholder')} />
              <datalist id="circle-suggestions">
                {circleSuggestions.map((c) => <option key={c} value={c} />)}
              </datalist>
            </div>
            <div>
              <label className="block text-xs font-sans font-medium mb-1.5" style={{ color: 'var(--tc-45)' }}>{t('wearLogNote')} <span style={{ color: 'var(--tc-30)' }}>({t('commonOptional')})</span></label>
              <textarea className="input-field" rows={2} value={note} onChange={(e) => setNote(e.target.value)} />
            </div>
            {error && <p className="text-sm font-sans" style={{ color: 'var(--danger)' }}>{error}</p>}
            <button type="submit" disabled={saving} className="btn-gold w-full py-3 disabled:opacity-50">
              {saving ? t('commonLoading') : t('wearLogAdd')}
            </button>
          </form>

          {/* History */}
          {garmentId && logs.length > 0 && (
            <div>
              <h3 className="text-xs font-sans font-semibold mb-2" style={{ color: 'var(--tc-45)' }}>{t('wearLogTitle')}</h3>
              <div className="space-y-2">
                {logs.map((log) => (
                  <div key={log.id} className="flex items-start justify-between p-3 rounded-xl" style={{ background: 'var(--tc-04)', border: '1px solid var(--line)' }}>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-sans font-medium" style={{ color: 'var(--tc)' }}>{formatDate(log.worn_date)}</p>
                      {log.occasion && <p className="text-[10px] font-sans" style={{ color: 'var(--tc-45)' }}>{t('occasion' + log.occasion.charAt(0).toUpperCase() + log.occasion.slice(1))}</p>}
                      {log.event_name && <p className="text-[10px] font-sans" style={{ color: 'var(--tc-45)' }}>{log.event_name}</p>}
                      {log.circle && <p className="text-[10px] font-sans" style={{ color: 'var(--tc-45)' }}>{log.circle}</p>}
                      {log.note && <p className="text-[10px] font-sans italic" style={{ color: 'var(--tc-30)' }}>{log.note}</p>}
                    </div>
                    <button onClick={() => handleDeleteLog(log.id)} className="ml-2 w-7 h-7 rounded-full flex items-center justify-center transition-transform active:scale-90 flex-shrink-0" style={{ background: 'var(--tc-07)' }}>
                      <svg viewBox="0 0 24 24" className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} style={{ color: 'var(--danger)' }}><path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6" /></svg>
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
          {garmentId && logs.length === 0 && (
            <p className="text-xs font-sans text-center" style={{ color: 'var(--tc-30)' }}>{t('wearLogEmpty')}</p>
          )}
        </div>
      </div>
    </div>
  )
}
