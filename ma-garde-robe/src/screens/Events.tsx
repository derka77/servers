import { useState, useMemo, useEffect } from 'react'
import { useOverlayClick } from '../lib/useOverlayClick'
import { useI18n } from '../i18n/I18nContext'
import { createEvent, updateEvent, deleteEvent, markEventAsWorn, createWearLogForOutfit, fetchDistinctCircles } from '../lib/api'
import type { Garment, Outfit, EventItem, Occasion, EventStatus } from '../types'

interface Props {
  events: EventItem[]
  garments: Garment[]
  outfits: Outfit[]
  onRefresh: () => void
  onPrepareOutfit: (event: EventItem) => void
}

const OCCASIONS: Occasion[] = [
  'everyday', 'work', 'brunch', 'evening_out', 'wedding_guest', 'henna_party',
  'eid', 'ramadan_gathering', 'majlis', 'beach', 'travel', 'sport',
]

function occasionLabelKey(o: Occasion): string {
  const cap = o.charAt(0).toUpperCase() + o.slice(1)
  return 'occasion' + cap
}

function todayStr(): string {
  return new Date().toISOString().slice(0, 10)
}

function daysUntil(dateStr: string): number {
  const today = new Date(todayStr())
  const target = new Date(dateStr)
  return Math.round((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
}

function formatDate(dateStr: string, locale: string): string {
  return new Date(dateStr).toLocaleDateString(locale === 'ar' ? 'ar' : locale, { day: 'numeric', month: 'long', year: 'numeric' })
}

function computeStatus(event: EventItem): EventStatus {
  if (event.status === 'worn') return 'worn'
  const d = daysUntil(event.date)
  return d < 0 ? 'past' : 'upcoming'
}

export default function EventsScreen({ events, garments, outfits, onRefresh, onPrepareOutfit }: Props) {
  const { t, locale } = useI18n()
  const [showForm, setShowForm] = useState(false)
  const [editingEvent, setEditingEvent] = useState<EventItem | null>(null)
  const [circleSuggestions, setCircleSuggestions] = useState<string[]>([])
  const [toast, setToast] = useState<string | null>(null)
  const [wornLoading, setWornLoading] = useState<string | null>(null)

  useEffect(() => {
    fetchDistinctCircles().then(setCircleSuggestions).catch(() => {})
  }, [])

  // Auto-update statuses
  useEffect(() => {
    const needsUpdate = events.some((e) => {
      const computed = computeStatus(e)
      return e.status !== computed && e.status !== 'worn'
    })
    if (needsUpdate) {
      events.forEach((e) => {
        const computed = computeStatus(e)
        if (e.status !== computed && e.status !== 'worn') {
          updateEvent(e.id, { status: computed }).catch(() => {})
        }
      })
    }
  }, [events])

  const sortedEvents = useMemo(() => {
    return [...events].sort((a, b) => {
      const sa = computeStatus(a)
      const sb = computeStatus(b)
      const order: Record<EventStatus, number> = { upcoming: 0, past: 1, worn: 2 }
      if (order[sa] !== order[sb]) return order[sa] - order[sb]
      return new Date(a.date).getTime() - new Date(b.date).getTime()
    })
  }, [events])

  const upcoming = sortedEvents.filter((e) => computeStatus(e) === 'upcoming')
  const past = sortedEvents.filter((e) => computeStatus(e) === 'past')
  const worn = sortedEvents.filter((e) => computeStatus(e) === 'worn')

  function showToast(msg: string) {
    setToast(msg)
    setTimeout(() => setToast(null), 2500)
  }

  async function handleMarkWorn(event: EventItem) {
    if (!event.outfit_id) return
    const outfit = outfits.find((o) => o.id === event.outfit_id)
    if (!outfit) return

    if (!confirm(t('eventsMarkWornConfirm'))) return

    setWornLoading(event.id)
    try {
      await createWearLogForOutfit(outfit.id, outfit.garment_ids, {
        worn_date: event.date,
        occasion: event.occasion,
        event_name: event.name,
        circle: event.circle,
        note: event.note || '',
      })
      await markEventAsWorn(event.id)
      onRefresh()
      showToast(t('eventsWornSuccess'))
    } catch {
      showToast(t('commonError'))
    } finally {
      setWornLoading(null)
    }
  }

  function outfitForEvent(event: EventItem): Outfit | undefined {
    return outfits.find((o) => o.id === event.outfit_id)
  }

  function garmentById(id: string): Garment | undefined {
    return garments.find((g) => g.id === id)
  }

  function renderEventCard(event: EventItem) {
    const status = computeStatus(event)
    const outfit = outfitForEvent(event)
    const d = daysUntil(event.date)

    return (
      <div key={event.id} className="glass-card p-4 mb-3 animate-fade-up">
        {/* Header */}
        <div className="flex items-start justify-between mb-2">
          <div className="flex-1 min-w-0">
            <h3 className="text-base title-display truncate" style={{ color: 'var(--tc)' }}>{event.name}</h3>
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              <span className="text-xs font-sans" style={{ color: 'var(--tc-45)' }}>{formatDate(event.date, locale)}</span>
              {status === 'upcoming' && d <= 3 && d >= 0 && (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-sans font-bold"
                  style={{ background: d === 0 ? 'var(--danger-soft)' : 'var(--brass-soft)', color: d === 0 ? 'var(--danger)' : 'var(--warn)' }}>
                  {d === 0 ? t('eventsToday') : d === 1 ? t('eventsTomorrow') : t('eventsInDays').replace('{n}', String(d))}
                </span>
              )}
            </div>
          </div>
          {/* Status badge */}
          <span className="px-2.5 py-1 rounded-full text-[10px] font-sans font-bold flex-shrink-0"
            style={status === 'upcoming'
              ? { background: 'var(--ok-soft)', color: 'var(--ok)' }
              : status === 'past'
                ? { background: 'var(--tc-07)', color: 'var(--tc-45)' }
                : { background: 'var(--accent)', color: 'var(--on-accent)' }}>
            {status === 'upcoming' ? t('eventsUpcoming') : status === 'past' ? t('eventsPast') : t('eventsWorn')}
          </span>
        </div>

        {/* Occasion + circle tags */}
        <div className="flex items-center gap-2 mb-3 flex-wrap">
          {event.occasion && (
            <span className="px-2 py-0.5 rounded-lg text-[10px] font-sans font-medium" style={{ background: 'var(--tc-04)', color: 'var(--tc-45)' }}>
              {t(occasionLabelKey(event.occasion))}
            </span>
          )}
          {event.circle && (
            <span className="px-2 py-0.5 rounded-lg text-[10px] font-sans font-medium" style={{ background: 'var(--tc-04)', color: 'var(--tc-45)' }}>
              {event.circle}
            </span>
          )}
        </div>

        {/* Outfit preview or actions */}
        {outfit ? (
          <div className="mb-3">
            <p className="text-[10px] font-sans font-semibold mb-1.5" style={{ color: 'var(--tc-30)' }}>{t('eventsOutfitLinked')}</p>
            <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
              {outfit.garment_ids.map((gid) => {
                const g = garmentById(gid)
                if (!g) return null
                return (
                  <div key={gid} className="flex-shrink-0 w-14 h-14 rounded-lg overflow-hidden" style={{ background: 'var(--tc-04)', border: '1px solid var(--line)' }}>
                    {g.photo_url ? (
                      <img src={g.photo_url} alt={g.name} className="w-full h-full object-contain" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-[10px] title-display" style={{ color: 'var(--tc-30)' }}>
                        {g.category.charAt(0).toUpperCase()}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        ) : (
          <div className="mb-3">
            <p className="text-[10px] font-sans" style={{ color: 'var(--tc-30)' }}>{t('eventsNoOutfit')}</p>
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-2">
          {status === 'upcoming' && (
            <button onClick={() => onPrepareOutfit(event)}
              className="flex-1 btn-gold py-2.5 text-xs flex items-center justify-center gap-1.5">
              <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2}><path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8L12 3z" /></svg>
              {outfit ? t('eventsPrepareOutfit') : t('eventsPrepareOutfit')}
            </button>
          )}
          {status === 'past' && !outfit && (
            <button onClick={() => onPrepareOutfit(event)}
              className="flex-1 btn-outline py-2.5 text-xs">
              {t('eventsChooseOutfitAfter')}
            </button>
          )}
          {status === 'past' && outfit && (
            <button onClick={() => handleMarkWorn(event)} disabled={wornLoading === event.id}
              className="flex-1 btn-gold py-2.5 text-xs flex items-center justify-center gap-1.5 disabled:opacity-50">
              {wornLoading === event.id ? (
                <div className="w-4 h-4 rounded-full border-2 animate-spin" style={{ borderColor: 'rgba(255,255,255,0.3)', borderTopColor: 'var(--on-accent)' }} />
              ) : (
                <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2}><path d="M20 6L9 17l-5-5" /></svg>
              )}
              {t('eventsMarkWorn')}
            </button>
          )}
          <button onClick={() => { setEditingEvent(event); setShowForm(true) }}
            className="px-3 py-2.5 rounded-xl transition-transform active:scale-95" style={{ background: 'var(--tc-07)', color: 'var(--tc-45)' }}>
            <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={1.5}><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7M18.5 2.5a2.1 2.1 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" /></svg>
          </button>
          <button onClick={async () => { if (confirm(t('eventsDeleteConfirm'))) { await deleteEvent(event.id); onRefresh() } }}
            className="px-3 py-2.5 rounded-xl transition-transform active:scale-95" style={{ background: 'var(--danger-soft)', color: 'var(--danger)' }}>
            <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={1.5}><path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /></svg>
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-lg mx-auto min-h-screen px-5 pt-4 pb-28">
      {/* Header */}
      <header className="mb-5 animate-fade-up">
        <div className="flex items-center justify-between">
          <div>
            <p className="tagline mb-1">✦ {t('navEvents')} ✦</p>
            <h1 className="text-2xl title-display" style={{ color: 'var(--tc)' }}>{t('eventsTitle')}</h1>
          </div>
          <button onClick={() => { setEditingEvent(null); setShowForm(true) }}
            className="w-10 h-10 rounded-full flex items-center justify-center transition-transform active:scale-90"
            style={{ background: 'var(--accent)', color: 'var(--on-accent)' }}>
            <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2}><path d="M12 5v14M5 12h14" /></svg>
          </button>
        </div>
      </header>

      {/* Event lists */}
      {events.length === 0 ? (
        <div className="glass-card p-8 text-center animate-fade-up">
          <div className="w-14 h-14 mx-auto mb-3 rounded-full flex items-center justify-center" style={{ background: 'var(--tc-07)' }}>
            <svg viewBox="0 0 24 24" className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth={1.5} style={{ color: 'var(--tc-45)' }}>
              <rect x="3" y="5" width="18" height="16" rx="2" /><path d="M3 10h18M8 3v4M16 3v4" />
            </svg>
          </div>
          <p className="text-sm font-sans mb-1" style={{ color: 'var(--tc)' }}>{t('eventsEmpty')}</p>
          <p className="text-xs font-sans" style={{ color: 'var(--tc-45)' }}>{t('eventsEmptyHint')}</p>
        </div>
      ) : (
        <>
          {upcoming.length > 0 && (
            <section className="mb-5">
              <h2 className="text-sm font-sans font-bold mb-2" style={{ color: 'var(--tc-45)' }}>{t('eventsUpcoming')}</h2>
              {upcoming.map(renderEventCard)}
            </section>
          )}
          {past.length > 0 && (
            <section className="mb-5">
              <h2 className="text-sm font-sans font-bold mb-2" style={{ color: 'var(--tc-45)' }}>{t('eventsPast')}</h2>
              {past.map(renderEventCard)}
            </section>
          )}
          {worn.length > 0 && (
            <section className="mb-5">
              <h2 className="text-sm font-sans font-bold mb-2" style={{ color: 'var(--tc-45)' }}>{t('eventsWorn')}</h2>
              {worn.map(renderEventCard)}
            </section>
          )}
        </>
      )}

      {/* Event form modal */}
      {showForm && (
        <EventForm
          event={editingEvent}
          circleSuggestions={circleSuggestions}
          onClose={() => { setShowForm(false); setEditingEvent(null) }}
          onSaved={() => { setShowForm(false); setEditingEvent(null); onRefresh() }}
        />
      )}

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-50 px-4 py-2.5 rounded-xl text-sm font-sans font-medium animate-slide-up"
          style={{ background: 'var(--tc)', color: '#fff', boxShadow: '0 4px 20px rgba(0,0,0,0.15)' }}>
          {toast}
        </div>
      )}
    </div>
  )
}

// --- Event Form ---

function EventForm({ event, circleSuggestions, onClose, onSaved }: {
  event: EventItem | null
  circleSuggestions: string[]
  onClose: () => void
  onSaved: () => void
}) {
  const { overlayProps } = useOverlayClick(onClose)
  const { t } = useI18n()
  const [name, setName] = useState(event?.name || '')
  const [date, setDate] = useState(event?.date || todayStr())
  const [occasion, setOccasion] = useState<Occasion | ''>(event?.occasion || '')
  const [circle, setCircle] = useState(event?.circle || '')
  const [note, setNote] = useState(event?.note || '')
  const [saving, setSaving] = useState(false)

  async function handleSave() {
    if (!name.trim() || !date) return
    setSaving(true)
    try {
      if (event) {
        await updateEvent(event.id, {
          name: name.trim(),
          date,
          occasion: occasion || null,
          circle: circle.trim(),
          note: note.trim(),
        })
      } else {
        await createEvent({
          name: name.trim(),
          date,
          occasion: occasion || null,
          circle: circle.trim(),
          note: note.trim(),
          outfit_id: null,
          status: 'upcoming',
        })
      }
      onSaved()
    } catch {
      /* ignore */
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center glass-overlay" {...overlayProps}>
      <div className="glass-sheet w-full max-w-lg max-h-[92vh] overflow-y-auto rounded-t-4xl sm:rounded-3xl animate-slide-up sm:animate-scale-in" onClick={(e) => e.stopPropagation()}>
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 rounded-full" style={{ background: 'var(--tc-20)' }} />
        </div>

        <div className="sticky top-0 glass-sheet px-5 py-3 flex items-center justify-between z-10" style={{ borderBottom: '1px solid var(--line)' }}>
          <h2 className="text-lg title-display" style={{ color: 'var(--tc)' }}>{event ? t('editItem') : t('eventsAdd')}</h2>
          <button onClick={onClose} className="w-8 h-8 rounded-full flex items-center justify-center transition-transform active:scale-90" style={{ background: 'var(--tc-07)', color: 'var(--tc-45)' }}>
            <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2}><path d="M6 6l12 12M6 18L18 6" /></svg>
          </button>
        </div>

        <div className="p-5 space-y-4">
          {/* Name */}
          <div>
            <label className="block text-xs font-sans font-semibold mb-2" style={{ color: 'var(--tc-45)' }}>{t('eventsName')}</label>
            <input className="input-field" value={name} onChange={(e) => setName(e.target.value)} placeholder={t('eventsNamePlaceholder')} />
          </div>

          {/* Date */}
          <div>
            <label className="block text-xs font-sans font-semibold mb-2" style={{ color: 'var(--tc-45)' }}>{t('eventsDate')}</label>
            <input type="date" className="input-field" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>

          {/* Occasion */}
          <div>
            <label className="block text-xs font-sans font-semibold mb-2" style={{ color: 'var(--tc-45)' }}>{t('eventsOccasion')}</label>
            <div className="flex gap-2 flex-wrap">
              {OCCASIONS.map((o) => (
                <button key={o} type="button" onClick={() => setOccasion(o)}
                  className={`pill ${occasion === o ? 'pill-active' : 'pill-idle'}`}>
                  {t(occasionLabelKey(o))}
                </button>
              ))}
            </div>
          </div>

          {/* Circle */}
          <div>
            <label className="block text-xs font-sans font-semibold mb-2" style={{ color: 'var(--tc-45)' }}>{t('eventsCircle')}</label>
            <input className="input-field" value={circle} onChange={(e) => setCircle(e.target.value)} placeholder={t('eventsCirclePlaceholder')} list="circle-suggestions" />
            <datalist id="circle-suggestions">
              {circleSuggestions.map((c) => <option key={c} value={c} />)}
            </datalist>
          </div>

          {/* Note */}
          <div>
            <label className="block text-xs font-sans font-semibold mb-2" style={{ color: 'var(--tc-45)' }}>{t('eventsNote')}</label>
            <textarea className="input-field min-h-[60px] resize-none" value={note} onChange={(e) => setNote(e.target.value)} />
          </div>

          {/* Actions */}
          <div className="flex gap-2 pt-2">
            <button onClick={onClose} className="flex-1 btn-outline py-3">{t('formCancel')}</button>
            <button onClick={handleSave} disabled={saving || !name.trim() || !date} className="flex-1 btn-gold py-3 disabled:opacity-50">
              {saving ? t('commonLoading') : t('formSave')}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
