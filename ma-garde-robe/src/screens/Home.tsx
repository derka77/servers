import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import { useI18n } from '../i18n/I18nContext'
import { fetchDailyOutfit, saveDailyOutfit } from '../lib/api'
import { isGarmentAvailable, generateScoredOutfit, isOutfitEmpty, type OutfitSlots, type ScoredOutfit, type OutfitMode } from '../lib/outfitEngine'
import WearLogModal from '../components/WearLogModal'
import Mannequin from '../components/Mannequin'
import type { Garment, Outfit, Profile, EventItem } from '../types'
import type { Tab } from '../App'
import type { Category, GarmentStatus } from '../types'
import colorData from '../lib/colorData.json'

interface ColorDef { hue: number | null; value: string; saturation: string; temperature: string; category: string }
const colorDataMap = colorData.colors as Record<string, ColorDef>

const COLOR_FILTER_GROUPS: { key: string; label: string; hex: string; match: (name: string, def: ColorDef) => boolean }[] = [
  { key: 'all', label: 'Tous', hex: '#cccccc', match: () => true },
  { key: 'black', label: 'Noir', hex: '#1a1a1a', match: (n) => n === 'Black' },
  { key: 'white', label: 'Blanc', hex: '#f5f5f5', match: (n) => n === 'White' || n === 'Cream' },
  { key: 'neutrals', label: 'Neutres', hex: '#c4a882', match: (n) => n === 'Beige' || n === 'Camel' || n === 'Brown' || n === 'Khaki' || n === 'Grey' },
  { key: 'navy', label: 'Bleu marine', hex: '#2b3a5e', match: (n) => n === 'Navy blue' },
  { key: 'blue', label: 'Bleu clair', hex: '#7fb3d5', match: (n) => n === 'Light blue' },
  { key: 'red', label: 'Rouge', hex: '#d64545', match: (n) => n === 'Red' || n === 'Burgundy' },
  { key: 'pink', label: 'Rose', hex: '#e8a0b0', match: (n) => n === 'Pink' || n === 'Blush pink' },
  { key: 'green', label: 'Vert', hex: '#4a9d5f', match: (n) => n === 'Green' || n === 'Emerald green' },
  { key: 'yellow', label: 'Jaune', hex: '#e8c44a', match: (n) => n === 'Yellow' || n === 'Mustard' },
  { key: 'orange', label: 'Orange', hex: '#e89540', match: (n) => n === 'Orange' },
  { key: 'purple', label: 'Violet', hex: '#8e6db5', match: (n) => n === 'Purple' || n === 'Lavender' },
  { key: 'gold', label: 'Or', hex: '#d4a849', match: (n) => n === 'Gold' },
  { key: 'silver', label: 'Argent', hex: '#b8b8c0', match: (n) => n === 'Silver' },
  { key: 'print', label: 'Imprimés', hex: '#9a8b7a', match: (_n, d) => d.category === 'print' || d.category === 'print_neutral' },
]

function getColorsForCategory(garments: Garment[], cat: Category): string[] {
  const colorSet = new Set<string>()
  for (const g of garments) {
    if (g.category !== cat || !isGarmentAvailable(g)) continue
    if (g.color_primary) colorSet.add(g.color_primary)
  }
  const groups = new Set<string>()
  for (const colorName of colorSet) {
    const def = colorDataMap[colorName]
    if (!def) continue
    for (const grp of COLOR_FILTER_GROUPS) {
      if (grp.key !== 'all' && grp.match(colorName, def)) { groups.add(grp.key); break }
    }
  }
  return ['all', ...COLOR_FILTER_GROUPS.filter((g) => g.key !== 'all' && groups.has(g.key)).map((g) => g.key)]
}

function garmentMatchesColorFilter(g: Garment, filterKey: string): boolean {
  if (filterKey === 'all') return true
  const grp = COLOR_FILTER_GROUPS.find((g) => g.key === filterKey)
  if (!grp) return true
  const def = colorDataMap[g.color_primary]
  if (!def) return false
  return grp.match(g.color_primary, def)
}

const categoryMonograms: Record<Category, string> = {
  tops: 'H',
  bottoms: 'B',
  dresses: 'R',
  outerwear: 'V',
  shoes: 'C',
  accessories: 'A',
  bags: 'S',
  traditional: 'T',
}

const SLOT_ORDER: { key: keyof OutfitSlots; cat: Category | null; labelKey: string }[] = [
  { key: 'dress', cat: 'dresses', labelKey: 'composerSlotDress' },
  { key: 'top', cat: 'tops', labelKey: 'composerSlotTop' },
  { key: 'bag', cat: 'bags', labelKey: 'composerSlotBag' },
  { key: 'bottom', cat: 'bottoms', labelKey: 'composerSlotBottom' },
  { key: 'outerwear', cat: 'outerwear', labelKey: 'composerSlotOuterwear' },
  { key: 'shoes', cat: 'shoes', labelKey: 'composerSlotShoes' },
  { key: 'accessory', cat: 'accessories', labelKey: 'composerSlotAccessory' },
]

function todayStr(): string {
  return new Date().toISOString().slice(0, 10)
}

function loadCachedOutfit(): Promise<{ date: string; slots: OutfitSlots; score: number; rating: string; garmentIds: string[] } | null> {
  return fetchDailyOutfit(todayStr()).then((data) => {
    if (!data || !data.slots_jsonb) return null
    const parsed = data.slots_jsonb as { date?: string; slots?: OutfitSlots; score?: number; rating?: string; garmentIds?: string[] }
    if (!parsed.slots || !parsed.garmentIds) return null
    return { date: data.date, slots: parsed.slots, score: parsed.score || 0, rating: parsed.rating || 'fair', garmentIds: parsed.garmentIds }
  }).catch(() => null)
}

function saveCachedOutfit(data: { date: string; slots: OutfitSlots; score: number; rating: string; garmentIds: string[] }) {
  saveDailyOutfit(data.date, data as unknown as Record<string, unknown>).catch(() => {})
}

function slotsToGarmentIds(slots: OutfitSlots): string[] {
  return (Object.values(slots).filter(Boolean) as Garment[]).map((g) => g.id)
}

function pickMode(garments: Garment[]): OutfitMode {
  const dresses = garments.filter((g) => g.category === 'dresses' && isGarmentAvailable(g))
  const tops = garments.filter((g) => g.category === 'tops' && isGarmentAvailable(g))
  const bottoms = garments.filter((g) => g.category === 'bottoms' && isGarmentAvailable(g))
  if (dresses.length > 0 && (tops.length === 0 || bottoms.length === 0)) return 'dress'
  if (tops.length > 0 && bottoms.length > 0) return 'separates'
  if (dresses.length > 0) return 'dress'
  return 'separates'
}

interface Props {
  garments: Garment[]
  outfits: Outfit[]
  profile: Profile | null
  events: EventItem[]
  onNavigate: (t: Tab) => void
  onAdd: () => void
  onEditItem: (g: Garment) => void
  displayMode: 'simplified' | 'complete'
  onFilterWardrobe?: (cat: Category, status: GarmentStatus | 'all' | 'unavailable') => void
  onPrepareEventOutfit?: (event: EventItem) => void
}

type SlotKey = keyof OutfitSlots

export default function Home({ garments, outfits, profile, events, onNavigate, onAdd, displayMode, onPrepareEventOutfit }: Props) {
  const isSimplified = displayMode === 'simplified'
  const { t } = useI18n()
  const [showWearLog, setShowWearLog] = useState(false)
  const avatarUrl = profile?.avatar_optimized_url || profile?.avatar_url || ''

  const upcomingEvent = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10)
    return events
      .filter((e) => e.status !== 'worn')
      .filter((e) => {
        const d = Math.round((new Date(e.date).getTime() - new Date(today).getTime()) / (1000 * 60 * 60 * 24))
        return d >= 0 && d <= 3
      })
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())[0]
  }, [events])

  const eventOutfit = useMemo(() => upcomingEvent?.outfit_id ? outfits.find((o) => o.id === upcomingEvent.outfit_id) : undefined, [upcomingEvent, outfits])

  function eventDateLabel(dateStr: string): string {
    const today = new Date().toISOString().slice(0, 10)
    const diff = Math.round((new Date(dateStr).getTime() - new Date(today).getTime()) / (1000 * 60 * 60 * 24))
    if (diff === 0) return t('eventsToday')
    if (diff === 1) return t('eventsTomorrow')
    return t('eventsInDays').replace('{n}', String(diff))
  }

  const canCompose = useMemo(() => {
    const available = garments.filter(isGarmentAvailable)
    const hasTops = available.some((g) => g.category === 'tops')
    const hasBottoms = available.some((g) => g.category === 'bottoms')
    const hasDresses = available.some((g) => g.category === 'dresses')
    const hasShoes = available.some((g) => g.category === 'shoes')
    return ((hasTops && hasBottoms) || hasDresses) && hasShoes
  }, [garments])

  const [dailyOutfit, setDailyOutfit] = useState<{ slots: OutfitSlots; score: number; rating: string; garmentIds: string[] } | null>(null)
  const [outfitMode, setOutfitMode] = useState<OutfitMode>('separates')

  useEffect(() => {
    if (canCompose) setOutfitMode(pickMode(garments))
  }, [canCompose, garments])

  const generateOutfit = useCallback((requestedMode: OutfitMode = outfitMode): { slots: OutfitSlots; score: number; rating: string; garmentIds: string[] } | null => {
    if (!canCompose) return null
    const mode = requestedMode
    const result: ScoredOutfit = generateScoredOutfit({ garments, profile, mode, styleTheme: 'casual' })
    if (isOutfitEmpty(result.slots)) return null
    const ids = slotsToGarmentIds(result.slots)
    const data = { date: todayStr(), slots: result.slots, score: result.scoreResult.score, rating: result.scoreResult.rating, garmentIds: ids }
    saveCachedOutfit(data)
    return { slots: result.slots, score: result.scoreResult.score, rating: result.scoreResult.rating, garmentIds: ids }
  }, [canCompose, garments, profile])

  useEffect(() => {
    if (!canCompose) { setDailyOutfit(null); return }
    loadCachedOutfit().then((cached) => {
      if (cached) {
        const validIds = cached.garmentIds.filter((id) => garments.some((g) => g.id === id))
        if (validIds.length > 0 && validIds.length === cached.garmentIds.length) {
          setDailyOutfit({ slots: cached.slots, score: cached.score, rating: cached.rating, garmentIds: cached.garmentIds })
          return
        }
      }
      const fresh = generateOutfit()
      if (fresh) setDailyOutfit(fresh)
    })
  }, [canCompose, garments, generateOutfit])

  function handleAnother() {
    const fresh = generateOutfit()
    if (fresh) setDailyOutfit(fresh)
  }

  function handleModeChange() {
    const nextMode: OutfitMode = outfitMode === 'dress' ? 'separates' : 'dress'
    setOutfitMode(nextMode)
    const fresh = generateOutfit(nextMode)
    if (fresh) setDailyOutfit(fresh)
  }

  const [slotIndices, setSlotIndices] = useState<Partial<Record<SlotKey, number>>>({})
  const [colorFilters, setColorFilters] = useState<Partial<Record<SlotKey, string>>>({})

  const slotAlternatives = useMemo(() => {
    const map: Partial<Record<SlotKey, Garment[]>> = {}
    for (const s of SLOT_ORDER) {
      if (!s.cat) continue
      const colorFilter = colorFilters[s.key] || 'all'
      const alts = garments.filter((g) =>
        g.category === s.cat &&
        isGarmentAvailable(g) &&
        garmentMatchesColorFilter(g, colorFilter)
      )
      if (alts.length > 0) map[s.key] = alts
    }
    return map
  }, [garments, colorFilters])

  useEffect(() => {
    if (!dailyOutfit) return
    const newIndices: Partial<Record<SlotKey, number>> = {}
    for (const s of SLOT_ORDER) {
      const g = dailyOutfit.slots[s.key]
      if (!g) continue
      const alts = slotAlternatives[s.key]
      if (!alts) continue
      const idx = alts.findIndex((a) => a.id === g.id)
      newIndices[s.key] = idx >= 0 ? idx : 0
    }
    setSlotIndices(newIndices)
  }, [dailyOutfit, slotAlternatives])

  const activeSlots = useMemo(() => {
    const result: Partial<Record<SlotKey, Garment>> = {}
    for (const s of SLOT_ORDER) {
      if (!dailyOutfit?.slots[s.key]) continue
      const alts = slotAlternatives[s.key]
      if (!alts || alts.length === 0) continue
      const idx = slotIndices[s.key] ?? 0
      result[s.key] = alts[idx % alts.length]
    }
    return result
  }, [dailyOutfit, slotAlternatives, slotIndices])

  function cycleSlot(key: SlotKey, dir: 1 | -1) {
    const alts = slotAlternatives[key]
    if (!alts || alts.length <= 1) return
    setSlotIndices((prev) => {
      const cur = prev[key] ?? 0
      const next = (cur + dir + alts.length) % alts.length
      return { ...prev, [key]: next }
    })
  }

  const touchStartX = useRef<Partial<Record<SlotKey, number>>>({})

  function handleTouchStart(key: SlotKey, e: React.TouchEvent) {
    touchStartX.current[key] = e.touches[0].clientX
  }

  function handleTouchEnd(key: SlotKey, e: React.TouchEvent) {
    const startX = touchStartX.current[key]
    if (startX === undefined) return
    const endX = e.changedTouches[0].clientX
    const diff = startX - endX
    if (Math.abs(diff) > 25) {
      cycleSlot(key, diff > 0 ? 1 : -1)
    }
    delete touchStartX.current[key]
  }

  const activeSlotKeys = SLOT_ORDER.filter((s) => activeSlots[s.key])

  const ratingColors: Record<string, { background: string; color: string }> = {
    excellent: { background: 'var(--brass-soft)', color: 'var(--warn)' },
    good: { background: 'var(--ok-soft)', color: 'var(--ok)' },
    fair: { background: 'var(--surface-2)', color: 'var(--ink-2)' },
    poor: { background: 'var(--danger-soft)', color: 'var(--danger)' },
  }

  return (
    <div className="max-w-lg mx-auto">
      {/* Outfit studio — mannequin silhouette with pieces in their zones */}
      {canCompose && activeSlotKeys.length > 0 ? (
        <div className="studio-card mx-5 mt-4 mb-4 animate-fade-up">
          {/* Header with avatar + rating */}
          <div className="flex items-center justify-between px-4 pt-4 pb-3">
            <div className="flex items-center gap-3">
              {avatarUrl ? (
                <div className="studio-avatar">
                  <img src={avatarUrl} alt="" />
                </div>
              ) : (
                <div className="studio-avatar studio-avatar-placeholder">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} style={{ color: 'var(--tc-30)' }}>
                    <circle cx="12" cy="8" r="3.5" />
                    <path d="M5.5 20c0-3.6 2.9-6.5 6.5-6.5s6.5 2.9 6.5 6.5" />
                  </svg>
                </div>
              )}
              <div>
                <p className="studio-kicker">{t('homeOutfitSubtitle')}</p>
                <h2 className="text-lg title-display" style={{ color: 'var(--tc)' }}>{t('homeOutfitTitle')}</h2>
              </div>
            </div>
            {garments.some((g) => g.category === 'dresses' && isGarmentAvailable(g)) && (
              <button
                type="button"
                onClick={handleModeChange}
                className="flex items-center gap-2 rounded-full pl-3 pr-1.5 py-1"
                style={{ background: 'var(--surface-2)', color: 'var(--ink-2)' }}
                aria-label={outfitMode === 'dress' ? t('composerModeDress') : t('composerModeSeparates')}
              >
                <span className="text-[11px] font-sans font-medium">{outfitMode === 'dress' ? t('composerModeDress') : t('composerModeSeparates')}</span>
                <span className={`switch ${outfitMode === 'dress' ? 'switch-on' : ''}`} style={{ width: 32, height: 18 }}>
                  <span className="switch-knob" style={{ width: 12, height: 12, transform: outfitMode === 'dress' ? 'translateX(14px)' : 'none' }} />
                </span>
              </button>
            )}
            {dailyOutfit && (
              <span className="studio-rating" style={ratingColors[dailyOutfit.rating] || ratingColors.poor}>
                {t('outfit' + dailyOutfit.rating.charAt(0).toUpperCase() + dailyOutfit.rating.slice(1))}{!isSimplified && ' · ' + dailyOutfit.score + '/100'}
              </span>
            )}
          </div>

          <div className="studio-canvas-row">
            <div className="studio-canvas">
              <div className="studio-stage">
                {avatarUrl ? (
                  <img src={avatarUrl} alt="" className="studio-body-photo" />
                ) : (
                  <Mannequin />
                )}
                {activeSlotKeys.map((s) => {
                  const g = activeSlots[s.key] as Garment
                  return (
                    <div key={`${s.key}-${g.id}`} className="studio-piece-wrapper">
                      <StudioPiece slotKey={s.key} garment={g} />
                    </div>
                  )
                })}
              </div>
            </div>

            <div className="studio-side-rail">
              {activeSlotKeys.map((s) => {
                const g = activeSlots[s.key] as Garment
                const alts = slotAlternatives[s.key] || []
                const idx = slotIndices[s.key] ?? 0
                const canSwipe = alts.length > 1
                const availableColors = s.cat ? getColorsForCategory(garments, s.cat) : ['all']
                const activeColorFilter = colorFilters[s.key] || 'all'
                return (
                  <div key={s.key} className="studio-thumb-group">
                    <span>{t(s.labelKey)}</span>
                    {availableColors.length > 1 && (
                      <div className="studio-color-dots">
                        {availableColors.map((ck) => {
                          const grp = COLOR_FILTER_GROUPS.find((g) => g.key === ck)
                          if (!grp) return null
                          const isActive = activeColorFilter === ck
                          return (
                            <button
                              key={ck}
                              type="button"
                              className={`studio-color-dot ${isActive ? 'studio-color-dot-active' : ''}`}
                              style={{ background: grp.hex }}
                              onClick={() => setColorFilters((prev) => ({ ...prev, [s.key]: ck === 'all' ? undefined : ck }))}
                              aria-label={grp.label}
                            />
                          )
                        })}
                      </div>
                    )}
                    <div className="studio-thumb-control">
                      <button
                        type="button"
                        className="studio-thumb-arrow"
                        aria-label="Article précédent"
                        onClick={() => cycleSlot(s.key, -1)}
                        disabled={!canSwipe}
                      >
                        <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M14.5 5 7.5 12l7 7" /></svg>
                      </button>
                      <div
                        className="studio-thumb"
                        onTouchStart={canSwipe ? (e) => handleTouchStart(s.key, e) : undefined}
                        onTouchEnd={canSwipe ? (e) => handleTouchEnd(s.key, e) : undefined}
                      >
                        <div className="studio-thumb-track" style={{ transform: `translateX(-${idx * 100}%)` }}>
                          {alts.length > 0 ? alts.map((alt) => (
                            <div key={alt.id} className="studio-thumb-slide">
                              {alt.photo_url ? (
                                <img src={alt.photo_url} alt={alt.name} loading="lazy" />
                              ) : (
                                <span>{categoryMonograms[alt.category]}</span>
                              )}
                            </div>
                          )) : (
                            <div className="studio-thumb-slide"><span>—</span></div>
                          )}
                        </div>
                        {canSwipe && (
                          <div className="studio-thumb-counter">{idx + 1}/{alts.length}</div>
                        )}
                      </div>
                      <button
                        type="button"
                        className="studio-thumb-arrow"
                        aria-label="Article suivant"
                        onClick={() => cycleSlot(s.key, 1)}
                        disabled={!canSwipe}
                      >
                        <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="m9.5 5 7 7-7 7" /></svg>
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          <div className="flex gap-2 px-4 py-4" style={{ borderTop: '1px solid var(--line)' }}>
            <button onClick={handleAnother} className="flex-1 btn-outline text-sm">
              <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={1.75}><path d="M4 12a8 8 0 0 1 13.6-5.7L20 8M20 4v4h-4M20 12a8 8 0 0 1-13.6 5.7L4 16M4 20v-4h4" strokeLinecap="round" strokeLinejoin="round" /></svg>
              {t('homeOutfitAnother')}
            </button>
            <button onClick={() => setShowWearLog(true)} className="flex-1 btn-gold text-sm">
              {t('homeOutfitWearIt')}
            </button>
          </div>
        </div>
      ) : (
        <div className="glass-card p-7 mx-5 mt-4 mb-4 text-center animate-fade-up">
          <div className="w-14 h-14 mx-auto mb-3 rounded-full flex items-center justify-center" style={{ background: 'var(--surface-2)' }}>
            <svg viewBox="0 0 24 24" className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth={1.5} style={{ color: 'var(--tc-45)' }}>
              <path d="M8 3L4 6l2 4 2-1.5V21h12V8.5L18 10l2-4-4-3-2 2-2-2-2 2-2-2z" strokeLinejoin="round" />
            </svg>
          </div>
          <p className="text-sm font-sans mb-3" style={{ color: 'var(--tc-45)' }}>{t('homeOutfitEmpty')}</p>
          <button onClick={onAdd} className="btn-gold px-5 py-2.5 text-sm inline-flex items-center gap-2">
            <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2}><path d="M12 5v14M5 12h14" /></svg>
            {t('homeOutfitEmptyAdd')}
          </button>
        </div>
      )}

      {/* Upcoming event card */}
      {upcomingEvent && (
        <div className="glass-card p-4 mx-5 mb-4 animate-fade-up delay-1">
          <div className="flex items-start justify-between mb-2">
            <div>
              <p className="kicker mb-0.5">{t('eventsUpcomingCard')}</p>
              <h3 className="text-base title-display" style={{ color: 'var(--tc)' }}>{upcomingEvent.name}</h3>
              <p className="text-xs font-sans mt-0.5" style={{ color: 'var(--tc-45)' }}>
                {eventDateLabel(upcomingEvent.date)}
                {upcomingEvent.circle ? ' · ' + upcomingEvent.circle : ''}
              </p>
            </div>
            <span className="px-2.5 py-1 rounded-full text-[11px] font-sans font-semibold flex-shrink-0"
              style={{ background: 'var(--brass-soft)', color: 'var(--warn)' }}>
              {eventDateLabel(upcomingEvent.date)}
            </span>
          </div>

          {eventOutfit ? (
            <div>
              <p className="text-[10px] font-sans font-semibold mb-1.5" style={{ color: 'var(--tc-30)' }}>{t('eventsOutfitPrepared')}</p>
              <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
                {eventOutfit.garment_ids.map((gid) => {
                  const g = garments.find((gm) => gm.id === gid)
                  if (!g) return null
                  return (
                    <div key={gid} className="flex-shrink-0 w-14 h-14 rounded-xl overflow-hidden" style={{ background: 'var(--surface-2)' }}>
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
            <button onClick={() => onPrepareEventOutfit?.(upcomingEvent)}
              className="w-full btn-gold py-2.5 text-xs flex items-center justify-center gap-1.5 mt-1">
              <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2}><path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8L12 3z" /></svg>
              {t('eventsPrepareOutfit')}
            </button>
          )}
        </div>
      )}

      {showWearLog && dailyOutfit && (
        <WearLogModal
          garmentId={null}
          outfitId={null}
          outfitGarmentIds={dailyOutfit.garmentIds}
          onClose={() => setShowWearLog(false)}
          onLogged={() => setShowWearLog(false)}
        />
      )}

    </div>
  )
}

function StudioPiece({ slotKey, garment }: { slotKey: SlotKey; garment: Garment }) {
  if (slotKey === 'shoes' && garment.photo_url) {
    return (
      <div className="studio-piece studio-piece-shoes studio-piece-enter">
        <img src={garment.photo_url} alt={garment.name} loading="lazy" className="shoe-left" />
        <img src={garment.photo_url} alt={garment.name} loading="lazy" className="shoe-right" />
      </div>
    )
  }
  return (
    <div className={`studio-piece studio-piece-${slotKey} studio-piece-enter`}>
      {garment.photo_url ? (
        <img src={garment.photo_url} alt={garment.name} loading="lazy" />
      ) : (
        <span>{categoryMonograms[garment.category]}</span>
      )}
    </div>
  )
}
