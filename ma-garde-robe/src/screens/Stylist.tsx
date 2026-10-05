import { useState, useMemo, useEffect, useRef } from 'react'
import { useOverlayClick } from '../lib/useOverlayClick'
import { useI18n } from '../i18n/I18nContext'
import { useLabels } from '../lib/labels'
import { createOutfit, deleteOutfit, fetchGarmentIdsWornBeforeCircle, fetchDistinctCircles, fetchAllWearLogs, deleteWearLog, type WearLogEntry } from '../lib/api'
import { localizeGarmentName, colorDictionary, localize, findEntryByValue, toEnglishKey } from '../lib/clothingDictionary'
import { filterBySize, filterShoesBySize, generateScoredOutfit, isOutfitEmpty, emptySlots, scoreOutfit, isGarmentAvailable, type OutfitSlots, type OutfitMode, type OutfitScoreResult } from '../lib/outfitEngine'
import GarmentPicker from '../components/GarmentPicker'
import GarmentCarousel from '../components/GarmentCarousel'
import OutfitStudio from '../components/OutfitStudio'
import type { Garment, Outfit, Category, Profile, Occasion } from '../types'

interface Props {
  garments: Garment[]
  outfits: Outfit[]
  profile: Profile | null
  onOutfitsChanged: () => void
  displayMode: 'simplified' | 'complete'
  eventContext?: { eventId: string; occasion: Occasion; circle: string } | null
  onOutfitSavedForEvent?: (outfitId: string) => void
  onClearEventContext?: () => void
}

type SlotKey = keyof OutfitSlots
type Theme = 'casual' | 'formal' | 'sport' | 'goingOut' | 'work' | 'weekend'

const slotOrderSeparates: { key: SlotKey; cat: Category | null; labelKey: string }[] = [
  { key: 'top', cat: 'tops', labelKey: 'composerSlotTop' },
  { key: 'outerwear', cat: 'outerwear', labelKey: 'composerSlotOuterwear' },
  { key: 'bottom', cat: 'bottoms', labelKey: 'composerSlotBottom' },
  { key: 'shoes', cat: 'shoes', labelKey: 'composerSlotShoes' },
  { key: 'bag', cat: 'bags', labelKey: 'composerSlotBag' },
  { key: 'accessory', cat: 'accessories', labelKey: 'composerSlotAccessory' },
]

const slotOrderDress: { key: SlotKey; cat: Category | null; labelKey: string }[] = [
  { key: 'dress', cat: 'dresses', labelKey: 'composerSlotDress' },
  { key: 'shoes', cat: 'shoes', labelKey: 'composerSlotShoes' },
  { key: 'bag', cat: 'bags', labelKey: 'composerSlotBag' },
  { key: 'accessory', cat: 'accessories', labelKey: 'composerSlotAccessory' },
]

const themes: Theme[] = ['casual', 'formal', 'sport', 'goingOut', 'work', 'weekend']

export default function Stylist({ garments, outfits, profile, onOutfitsChanged, displayMode, eventContext, onOutfitSavedForEvent, onClearEventContext }: Props) {
  const styleRequestOverlay = useOverlayClick(() => setShowStyleRequest(false))
  const isSimplified = displayMode === 'simplified'
  const { t, locale } = useI18n()
  const { categoryLabel } = useLabels()
  const [mode, setMode] = useState<OutfitMode>('separates')
  const [viewMode, setViewMode] = useState<'plateau' | 'mixmatch'>('mixmatch')
  const [slots, setSlots] = useState<OutfitSlots>(emptySlots())
  const [pickerSlot, setPickerSlot] = useState<SlotKey | null>(null)
  const [outfitName, setOutfitName] = useState('')
  const [outfitTheme, setOutfitTheme] = useState<Theme>('casual')
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState<string | null>(null)
  const [showGallery, setShowGallery] = useState(false)
  const [galleryTab, setGalleryTab] = useState<'outfits' | 'history'>('outfits')
  const [wearLogs, setWearLogs] = useState<WearLogEntry[]>([])
  const [showStyleRequest, setShowStyleRequest] = useState(false)
  const [styleTheme, setStyleTheme] = useState<Theme>('casual')
  const [styleColor, setStyleColor] = useState('')
  const [styleAvoidRecent, setStyleAvoidRecent] = useState(true)
  const [recentGarmentIds, setRecentGarmentIds] = useState<string[]>([])
  const [noMatchMsg, setNoMatchMsg] = useState(false)
  const [scoreResult, setScoreResult] = useState<OutfitScoreResult | null>(null)
  const [mixIndices, setMixIndices] = useState<Record<string, number>>({})
  const [composerCircle, setComposerCircle] = useState('')
  const [wornBeforeIds, setWornBeforeIds] = useState<Set<string>>(new Set())
  const [circleSuggestions, setCircleSuggestions] = useState<string[]>([])
  const [styleOccasion, setStyleOccasion] = useState<Occasion | ''>('')
  const [eventBanner, setEventBanner] = useState<string | null>(null)
  const [showConfetti, setShowConfetti] = useState(false)
  const [showScoreTips, setShowScoreTips] = useState(false)
  const prevScoreRef = useRef<number>(0)

  // Apply event context when arriving from Events screen
  useEffect(() => {
    if (eventContext) {
      setComposerCircle(eventContext.circle)
      setStyleOccasion(eventContext.occasion)
      setEventBanner(eventContext.circle)
    } else {
      setEventBanner(null)
    }
  }, [eventContext])

  // Confetti animation: trigger only when score crosses the "excellent" threshold (≥82)
  useEffect(() => {
    const currentScore = scoreResult?.score ?? 0
    const wasBelow = prevScoreRef.current < 82
    const isNowExcellent = currentScore >= 82 && scoreResult?.rating === 'excellent'
    if (wasBelow && isNowExcellent) {
      setShowConfetti(true)
      const timer = setTimeout(() => setShowConfetti(false), 1000)
      prevScoreRef.current = currentScore
      return () => clearTimeout(timer)
    }
    prevScoreRef.current = currentScore
  }, [scoreResult])

  // Load circle suggestions on mount
  useEffect(() => {
    fetchDistinctCircles().then(setCircleSuggestions).catch(() => {})
  }, [])

  // Load wear logs when history tab is opened
  useEffect(() => {
    if (showGallery && galleryTab === 'history') {
      fetchAllWearLogs().then(setWearLogs).catch(() => {})
    }
  }, [showGallery, galleryTab])

  // When composer circle changes, fetch garment IDs already worn before that circle
  useEffect(() => {
    if (composerCircle.trim()) {
      fetchGarmentIdsWornBeforeCircle(composerCircle.trim()).then(setWornBeforeIds).catch(() => setWornBeforeIds(new Set()))
    } else {
      setWornBeforeIds(new Set())
    }
  }, [composerCircle])

  const slotOrder = mode === 'dress' ? slotOrderDress : slotOrderSeparates

  // Auto-generate an outfit when the Stylist tab mounts or mode changes.
  useEffect(() => {
    const result = generateScoredOutfit({ garments, profile, mode, styleTheme: outfitTheme })
    setSlots(result.slots)
    setScoreResult(result.scoreResult)
  }, [mode])

  const sizedResult = useMemo(() => filterBySize(garments, profile), [garments, profile])
  const shoesResult = useMemo(() => filterShoesBySize(garments.filter((g) => g.category === 'shoes'), profile), [garments, profile])
  const hasDresses = useMemo(() => garments.some((g) => g.category === 'dresses'), [garments])

  function getPickerGarments(cat: Category | null): { garments: Garment[]; sizeActive: boolean } {
    if (!cat) return { garments: [], sizeActive: false }
    if (cat === 'shoes') return { garments: shoesResult.garments, sizeActive: shoesResult.sizeActive }
    return { garments: sizedResult.garments.filter((g) => g.category === cat), sizeActive: sizedResult.sizeActive }
  }

  // --- Mix & Match pools: same filters as plateau (size + available) ---
  const mixPools = useMemo(() => {
    const available = garments.filter(isGarmentAvailable)
    const sized = filterBySize(available, profile)
    const sizedShoes = filterShoesBySize(available.filter((g) => g.category === 'shoes'), profile)
    const poolFor = (cat: Category): Garment[] => {
      if (cat === 'shoes') return sizedShoes.garments
      return sized.garments.filter((g) => g.category === cat)
    }
    return poolFor
  }, [garments, profile])

  const mixSlotCats: { key: SlotKey; cat: Category; labelKey: string; compact?: boolean }[] = mode === 'dress'
    ? [
        { key: 'dress', cat: 'dresses', labelKey: 'composerSlotDress' },
        { key: 'shoes', cat: 'shoes', labelKey: 'composerSlotShoes' },
        { key: 'bag', cat: 'bags', labelKey: 'composerSlotBag', compact: true },
        { key: 'accessory', cat: 'accessories', labelKey: 'composerSlotAccessory', compact: true },
      ]
    : [
        { key: 'top', cat: 'tops', labelKey: 'composerSlotTop' },
        { key: 'bottom', cat: 'bottoms', labelKey: 'composerSlotBottom' },
        { key: 'shoes', cat: 'shoes', labelKey: 'composerSlotShoes' },
        { key: 'bag', cat: 'bags', labelKey: 'composerSlotBag', compact: true },
        { key: 'accessory', cat: 'accessories', labelKey: 'composerSlotAccessory', compact: true },
      ]

  function handleMixSelect(slotKey: SlotKey, cat: Category, index: number) {
    const pool = mixPools(cat)
    const g = pool[index]
    if (!g) return
    setMixIndices((prev) => ({ ...prev, [slotKey]: index }))
    setSlots((s) => {
      const newSlots = { ...s, [slotKey]: g }
      setScoreResult(scoreOutfit(newSlots))
      return newSlots
    })
  }

  function syncMixIndicesFromSlots() {
    const indices: Record<string, number> = {}
    for (const sd of mixSlotCats) {
      const pool = mixPools(sd.cat)
      const g = slots[sd.key]
      if (g) {
        const idx = pool.findIndex((p) => p.id === g.id)
        if (idx >= 0) indices[sd.key] = idx
      }
    }
    setMixIndices(indices)
  }

  // Sync mix indices when slots change externally (e.g. random, mode change)
  useEffect(() => {
    if (viewMode === 'mixmatch') syncMixIndicesFromSlots()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewMode, mode, slots])

  function handlePick(g: Garment) {
    if (pickerSlot) {
      setSlots((s) => {
        const newSlots = { ...s, [pickerSlot]: g }
        setScoreResult(scoreOutfit(newSlots))
        return newSlots
      })
      setPickerSlot(null)
    }
  }

  function clearSlot(key: SlotKey) {
    setSlots((s) => {
      const newSlots = { ...s, [key]: null }
      setScoreResult(isOutfitEmpty(newSlots) ? null : scoreOutfit(newSlots))
      return newSlots
    })
  }

  function clearAll() {
    setSlots(emptySlots())
    setOutfitName('')
    setScoreResult(null)
  }

  function handleRandom() {
    const result = generateScoredOutfit({
      garments,
      profile,
      mode,
      styleTheme: outfitTheme,
      occasion: styleOccasion || undefined,
    })
    setSlots(result.slots)
    setScoreResult(result.scoreResult)
    setNoMatchMsg(false)
  }

  function handleStyleRequest() {
    const colorEnglish = styleColor ? toEnglishKey(colorDictionary, styleColor) : ''
    const excludeIds = styleAvoidRecent && recentGarmentIds.length > 0 ? recentGarmentIds : undefined

    const result = generateScoredOutfit({
      garments,
      profile,
      mode,
      styleTheme,
      dominantColor: colorEnglish || undefined,
      excludeIds,
      occasion: styleOccasion || undefined,
    })

    if (isOutfitEmpty(result.slots)) {
      setNoMatchMsg(true)
    } else {
      setNoMatchMsg(false)
      setOutfitTheme(styleTheme)
      const filledIds = Object.values(result.slots).filter(Boolean).map((g) => (g as Garment).id)
      setRecentGarmentIds((prev) => [...filledIds, ...prev].slice(0, 20))
    }
    setSlots(result.slots)
    setScoreResult(result.scoreResult)
    setShowStyleRequest(false)
  }

  const filledSlots = Object.values(slots).filter(Boolean)

  async function handleSave() {
    if (filledSlots.length === 0) { setToast(t('composerNoSlots')); setTimeout(() => setToast(null), 2000); return }
    try {
      setSaving(true)
      const ids = filledSlots.map((g) => (g as Garment).id)
      const created = await createOutfit({
        name: outfitName.trim() || t('composerOutfitNamePlaceholder'),
        theme: outfitTheme,
        garment_ids: ids,
        notes: '',
      })
      if (eventContext && onOutfitSavedForEvent) {
        onOutfitSavedForEvent(created.id)
        setToast(t('eventsSaveOutfitAndLink'))
      } else {
        setToast(t('composerSaved'))
      }
      setTimeout(() => setToast(null), 2000)
      setOutfitName(''); onOutfitsChanged()
    } catch { setToast(t('commonError')); setTimeout(() => setToast(null), 2000) } finally { setSaving(false) }
  }

  async function handleDeleteOutfit(id: string) {
    if (!confirm(t('formDeleteConfirmOutfit'))) return
    try { await deleteOutfit(id); onOutfitsChanged() } catch { /* ignore */ }
  }

  async function handleDeleteWearLog(id: string) {
    try {
      await deleteWearLog(id)
      setWearLogs((prev) => prev.filter((l) => l.id !== id))
    } catch { /* ignore */ }
  }

  const garmentById = (id: string) => garments.find((g) => g.id === id)

  function renderSlot(slotDef: { key: SlotKey; cat: Category | null; labelKey: string }) {
    const g = slots[slotDef.key]
    const isOptional = slotDef.key === 'accessory' || slotDef.key === 'outerwear'
    return (
      <div key={slotDef.key} className="flex flex-col items-center">
        <div className="text-xs font-sans font-medium mb-1.5" style={{ color: 'var(--tc-45)' }}>
          {t(slotDef.labelKey)}
          {isOptional && <span className="text-[10px]" style={{ color: 'var(--tc-30)' }}> · {t('commonOptional')}</span>}
        </div>
        <button
          onClick={() => setPickerSlot(slotDef.key)}
          className="relative w-full aspect-[3/4] rounded-2xl overflow-hidden transition-all duration-200 active:scale-[0.98]"
          style={g
            ? { background: 'var(--tc-04)', border: '1px solid var(--line)' }
            : { background: 'var(--tc-04)', border: '2px dashed var(--tc-20)' }}
        >
          {g ? (
            <>
              {g.photo_url ? (
                <img src={g.photo_url} alt={g.name} className="w-full h-full object-contain" />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <svg viewBox="0 0 24 24" className="w-10 h-10" fill="none" stroke="currentColor" strokeWidth={1.5} style={{ color: 'var(--tc-20)' }}>
                    <path d="M8 3L4 6l2 4 2-1.5V21h12V8.5L18 10l2-4-4-3-2 2-2-2-2 2-2-2z" strokeLinejoin="round" />
                  </svg>
                </div>
              )}
              <button
                onClick={(e) => { e.stopPropagation(); clearSlot(slotDef.key) }}
                className="absolute top-1.5 right-1.5 w-7 h-7 rounded-full flex items-center justify-center shadow-sm transition-transform active:scale-90"
                style={{ background: 'rgba(255,255,255,0.95)', backdropFilter: 'blur(8px)' }}
              >
                <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} style={{ color: 'var(--danger)' }}>
                  <path d="M6 6l12 12M6 18L18 6" />
                </svg>
              </button>
              <div className="absolute bottom-0 left-0 right-0 px-2 py-1.5" style={{ background: 'linear-gradient(transparent, rgba(0,0,0,0.5))' }}>
                <p className="text-[10px] font-sans font-medium text-white truncate">{localizeGarmentName(g.name, locale)}</p>
              </div>
            </>
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center gap-1.5">
              <svg viewBox="0 0 24 24" className="w-8 h-8" fill="none" stroke="currentColor" strokeWidth={1.5} style={{ color: 'var(--tc-20)' }}>
                <path d="M12 5v14M5 12h14" />
              </svg>
              <span className="text-[10px] font-sans" style={{ color: 'var(--tc-30)' }}>{t('composerTapToSelect')}</span>
            </div>
          )}
        </button>
      </div>
    )
  }

  return (
    <div className="max-w-lg mx-auto min-h-screen">
      <header className="px-5 pt-6 pb-5 animate-fade-up">
        <p className="kicker mb-1.5">{t('composerSubtitle')}</p>
        <h1 className="text-[30px] title-display" style={{ color: 'var(--ink)' }}>{t('composerTitle')}</h1>
      </header>

      {/* Event context banner */}
      {eventBanner && eventContext && (
        <div className="px-5 mb-3 animate-fade-up">
          <div className="flex items-center justify-between px-4 py-3 rounded-2xl"
            style={{ background: 'var(--brass-soft)' }}>
            <div className="flex items-center gap-2.5">
              <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.5} style={{ color: 'var(--warn)' }}>
                <rect x="3" y="5" width="18" height="16" rx="2" /><path d="M3 10h18M8 3v4M16 3v4" />
              </svg>
              <div>
                <p className="text-xs font-sans font-semibold" style={{ color: 'var(--warn)' }}>{t('eventsPrepareOutfit')}</p>
                <p className="text-[11px] font-sans" style={{ color: 'var(--ink-3)' }}>
                  {eventContext.occasion ? t('occasion' + eventContext.occasion.charAt(0).toUpperCase() + eventContext.occasion.slice(1)) : ''}{eventContext.circle ? ' · ' + eventContext.circle : ''}
                </p>
              </div>
            </div>
            <button onClick={() => onClearEventContext?.()} className="w-7 h-7 rounded-full flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.05)' }}>
              <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} style={{ color: 'var(--tc-45)' }}><path d="M6 6l12 12M6 18L18 6" /></svg>
            </button>
          </div>
        </div>
      )}

      {/* Confetti animation for excellent score */}
      {showConfetti && (
        <div className="fixed inset-0 z-50 pointer-events-none flex items-center justify-center">
          <div className="absolute" style={{ animation: 'confetti-burst 1s ease-out forwards' }}>
            <svg viewBox="0 0 24 24" className="w-16 h-16" fill="currentColor" style={{ color: 'var(--brass)', filter: 'drop-shadow(0 0 8px rgba(176,141,87,0.6))' }}>
              <path d="M12 2l2.4 7.4H22l-6 4.6 2.3 7.4-6.3-4.6-6.3 4.6L7 14 1 9.4h7.6z" />
            </svg>
          </div>
          {Array.from({ length: 12 }).map((_, i) => (
            <div key={i} className="absolute" style={{
              animation: `confetti-particle-${i} 1s ease-out forwards`,
              left: '50%', top: '50%',
            }}>
              <div style={{
                width: '6px', height: '6px', borderRadius: '50%',
                background: ['var(--brass)', 'var(--brass)', 'var(--danger)', 'var(--ok)'][i % 4],
              }} />
            </div>
          ))}
        </div>
      )}

      {/* View toggle + Mode toggle (compact) */}
      <div className="px-5 mb-4 animate-fade-up delay-1 space-y-2">
        <div className="seg">
          <button onClick={() => setViewMode('plateau')} className={`seg-btn ${viewMode === 'plateau' ? 'seg-btn-active' : ''}`}>
            {t('composerViewPlateau')}
          </button>
          <button onClick={() => setViewMode('mixmatch')} className={`seg-btn ${viewMode === 'mixmatch' ? 'seg-btn-active' : ''}`}>
            {t('composerViewMixMatch')}
          </button>
        </div>
        {hasDresses && (
          <div className="flex items-center justify-center gap-2.5 pt-1">
            <span className="text-[12px] font-sans" style={{ color: mode === 'dress' ? 'var(--ink-3)' : 'var(--ink)', fontWeight: mode === 'dress' ? 400 : 600 }}>{t('composerModeSeparates')}</span>
            <button
              onClick={() => setMode(mode === 'dress' ? 'separates' : 'dress')}
              className={`switch ${mode === 'dress' ? 'switch-on' : ''}`}
              aria-label={mode === 'dress' ? t('composerModeDress') : t('composerModeSeparates')}
            >
              <span className="switch-knob" />
            </button>
            <span className="text-[12px] font-sans" style={{ color: mode === 'dress' ? 'var(--ink)' : 'var(--ink-3)', fontWeight: mode === 'dress' ? 600 : 400 }}>{t('composerModeDress')}</span>
          </div>
        )}
      </div>

      {/* Score badge — sticky so it stays visible while editing */}
      <div className="sticky top-14 z-30 px-5 py-2.5 mb-1 animate-fade-up delay-2 glass-nav" style={{ borderBottom: '1px solid var(--line)' }}>
        {scoreResult ? (
          <div className="flex items-center gap-2">
            <button
              onClick={() => { if (isSimplified) setShowScoreTips(!showScoreTips) }}
              className="studio-rating"
              style={scoreResult.rating === 'excellent' ? { background: 'var(--brass-soft)', color: 'var(--warn)' }
                : scoreResult.rating === 'good' ? { background: 'var(--ok-soft)', color: 'var(--ok)' }
                : scoreResult.rating === 'fair' ? { background: 'var(--surface-2)', color: 'var(--ink-2)' }
                : { background: 'var(--danger-soft)', color: 'var(--danger)' }}>
              {scoreResult.rating === 'excellent' && (
                <svg viewBox="0 0 24 24" className="w-3 h-3" fill="currentColor"><path d="M12 2l2.4 7.4H22l-6 4.6 2.3 7.4-6.3-4.6-6.3 4.6L7 14 1 9.4h7.6z" /></svg>
              )}
              {t('outfit' + scoreResult.rating.charAt(0).toUpperCase() + scoreResult.rating.slice(1))}{!isSimplified && ' · ' + scoreResult.score + '/100'}
            </button>
            {(!isSimplified || showScoreTips) && scoreResult.advice && (
              <span className="text-[11px] font-sans animate-fade-in" style={{ color: 'var(--ink-3)' }}>
                {t(scoreResult.advice === 'addNeutral' ? 'outfitAdviceAddNeutral' : 'outfitAdviceMoveVivid')}
              </span>
            )}
          </div>
        ) : (
          <p className="text-[12px] font-sans" style={{ color: 'var(--ink-3)' }}>{t('composerTapToSelect')}</p>
        )}
      </div>

      {/* Anti-duplicate: circle input + warnings (normal flow, not sticky) */}
      <div className="px-5 mb-2 animate-fade-up delay-2">
        <div className="flex items-center gap-2">
          <svg viewBox="0 0 24 24" className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" strokeWidth={1.5} style={{ color: 'var(--tc-45)' }}>
            <path d="M12 2C8 2 5 5 5 9c0 5 7 13 7 13s7-8 7-13c0-4-3-7-7-7z" /><circle cx="12" cy="9" r="2.5" />
          </svg>
          <input
            value={composerCircle}
            onChange={(e) => setComposerCircle(e.target.value)}
            list="composer-circle-suggestions"
            placeholder={t('composerForEvent') + ' (' + t('composerCircle').toLowerCase() + ')'}
            className="flex-1 input-field text-xs py-2"
          />
          <datalist id="composer-circle-suggestions">
            {circleSuggestions.map((c) => <option key={c} value={c} />)}
          </datalist>
        </div>
        {/* Warnings for pieces already worn before this circle */}
        {composerCircle.trim() && wornBeforeIds.size > 0 && (
          <div className="mt-2 space-y-1">
            {Object.entries(slots).filter(([, g]) => g && wornBeforeIds.has(g.id)).map(([key, g]) => (
              <div key={key} className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-[11px] font-sans"
                style={{ background: 'var(--brass-soft)', color: 'var(--warn)' }}>
                <svg viewBox="0 0 24 24" className="w-3.5 h-3.5 flex-shrink-0" fill="none" stroke="currentColor" strokeWidth={2}>
                  <path d="M12 9v4M12 17h.01M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                </svg>
                <span><strong>{localizeGarmentName((g as Garment).name, locale)}</strong> — {t('alreadyWornBefore')} "{composerCircle.trim()}"</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Outfit board — Studio (mannequin) or Mix & Match (carousels) */}
      <div className="px-5 mb-4 animate-fade-up delay-2">
        {viewMode === 'plateau' ? (
          <OutfitStudio
            mode={mode}
            slots={slots}
            profile={profile}
            rails={mixSlotCats}
            pools={mixPools}
            indices={mixIndices}
            onSelect={handleMixSelect}
          />
        ) : (
          <div className="glass-card p-4 space-y-5">
            {/* Main carousels */}
            {(mode === 'dress'
              ? mixSlotCats.filter((s) => !s.compact)
              : mixSlotCats.filter((s) => !s.compact)
            ).map((sd) => {
              const pool = mixPools(sd.cat)
              return (
                <GarmentCarousel
                  key={sd.key}
                  garments={pool}
                  selectedIndex={mixIndices[sd.key] ?? 0}
                  onSelect={(i) => handleMixSelect(sd.key, sd.cat, i)}
                  label={t(sd.labelKey)}
                  isRTL={locale === 'ar'}
                  emptyMessage={t('composerMixEmpty')}
                />
              )
            })}
            {/* Compact row: Bag + Accessory side by side */}
            <div className="grid grid-cols-2 gap-3">
              {mixSlotCats.filter((s) => s.compact).map((sd) => {
                const pool = mixPools(sd.cat)
                return (
                  <GarmentCarousel
                    key={sd.key}
                    garments={pool}
                    selectedIndex={mixIndices[sd.key] ?? 0}
                    onSelect={(i) => handleMixSelect(sd.key, sd.cat, i)}
                    label={t(sd.labelKey)}
                    isRTL={locale === 'ar'}
                    compact
                    emptyMessage={t('composerMixEmpty')}
                  />
                )
              })}
            </div>
          </div>
        )}
      </div>

      {/* Theme selector */}
      <div className="px-5 mb-3 animate-fade-up delay-2">
        <p className="kicker mb-2.5">{t('composerOutfitTheme')}</p>
        <div className="flex gap-2 flex-wrap">
          {themes.map((th) => (
            <button key={th} onClick={() => setOutfitTheme(th)} className={`pill flex-shrink-0 ${outfitTheme === th ? 'pill-active' : 'pill-idle'}`}>
              {t(`stylistTheme${th.charAt(0).toUpperCase()}${th.slice(1)}`)}
            </button>
          ))}
        </div>
      </div>

      {/* Action buttons */}
      <div className="px-5 mb-4 animate-fade-up delay-3 space-y-2">
        <div className="flex gap-2">
          <button onClick={handleRandom} className="flex-1 btn-gold">
            <svg viewBox="0 0 24 24" className="w-[18px] h-[18px]" fill="none" stroke="currentColor" strokeWidth={1.75}><path d="M12 3l1.5 4.5L18 9l-4.5 1.5L12 15l-1.5-4.5L6 9l4.5-1.5L12 3z" strokeLinejoin="round" /></svg>
            {t('composerRandom')}
          </button>
          <button onClick={() => setShowStyleRequest(true)} className="flex-1 btn-outline">
            <svg viewBox="0 0 24 24" className="w-[18px] h-[18px]" fill="none" stroke="currentColor" strokeWidth={1.75}><path d="M9.5 3A6.5 6.5 0 0 1 16 9.5c0 1.61-.59 3.09-1.56 4.23l.27.27H16l5 5-1.5 1.5-5-5v-1.29l-.27-.27A6.5 6.5 0 0 1 9.5 16 6.5 6.5 0 0 1 3 9.5 6.5 6.5 0 0 1 9.5 3z" /></svg>
            {t('stylistStyleRequest')}
          </button>
          <button onClick={clearAll} className="btn-outline px-4" aria-label={t('composerClear')} title={t('composerClear')}>
            <svg viewBox="0 0 24 24" className="w-[18px] h-[18px]" fill="none" stroke="currentColor" strokeWidth={1.75}><path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6" strokeLinecap="round" strokeLinejoin="round" /></svg>
          </button>
        </div>
        {noMatchMsg && (
          <div className="glass-card p-4 text-center">
            <p className="text-sm font-sans" style={{ color: 'var(--danger)' }}>{t('stylistNoMatch')}</p>
          </div>
        )}
      </div>

      {/* Save section */}
      <div className="px-5 mb-6 animate-fade-up delay-3">
        <div className="glass-card p-3">
          <div className="flex gap-2">
            <input value={outfitName} onChange={(e) => setOutfitName(e.target.value)} placeholder={t('composerOutfitNamePlaceholder')} className="flex-1 input-field" />
            <button onClick={handleSave} disabled={saving} className="btn-dark px-5 disabled:opacity-50">{t('composerSaveOutfit')}</button>
          </div>
        </div>
      </div>

      {/* Gallery toggle */}
      <div className="px-5 mb-3 animate-fade-up delay-4">
        <button onClick={() => setShowGallery(!showGallery)} className="flex items-center justify-between w-full py-3">
          <h2 className="text-[20px] title-display" style={{ color: 'var(--ink)' }}>{galleryTab === 'outfits' ? t('outfitsTab') : t('historyTab')}</h2>
          <div className="flex items-center gap-2">
            <span className="text-xs font-sans num px-2 py-0.5 rounded-full" style={{ color: 'var(--ink-2)', background: 'var(--surface-2)' }}>{galleryTab === 'outfits' ? outfits.length : wearLogs.length}</span>
            <svg viewBox="0 0 24 24" className={`w-5 h-5 transition-transform ${showGallery ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" strokeWidth={2} style={{ color: 'var(--tc-45)' }}>
              <path d="M6 9l6 6 6-6" />
            </svg>
          </div>
        </button>
      </div>

      {/* Saved outfits gallery + History */}
      {showGallery && (
        <div className="px-5 mb-6 animate-fade-in">
          {/* Sub-tab toggle */}
          <div className="seg mb-3">
            <button onClick={() => setGalleryTab('outfits')} className={`seg-btn ${galleryTab === 'outfits' ? 'seg-btn-active' : ''}`}>
              {t('outfitsTab')}
            </button>
            <button onClick={() => setGalleryTab('history')} className={`seg-btn ${galleryTab === 'history' ? 'seg-btn-active' : ''}`}>
              {t('historyTab')}
            </button>
          </div>

          {galleryTab === 'outfits' ? (
            outfits.length === 0 ? (
              <div className="glass-card p-6 text-center">
                <p className="text-sm font-sans" style={{ color: 'var(--tc-45)' }}>{t('composerNoOutfits')}</p>
              </div>
            ) : (
              <div className="space-y-3">
                {outfits.map((o) => (
                  <div key={o.id} className="glass-card p-4">
                    <div className="flex items-center justify-between mb-3">
                      <div>
                        <h3 className="text-sm font-sans font-medium" style={{ color: 'var(--tc)' }}>{o.name}</h3>
                        <p className="text-[10px] font-sans" style={{ color: 'var(--tc-45)' }}>{t(`stylistTheme${o.theme.charAt(0).toUpperCase()}${o.theme.slice(1)}`)}</p>
                      </div>
                      <button onClick={() => handleDeleteOutfit(o.id)} className="w-8 h-8 rounded-full flex items-center justify-center transition-transform active:scale-90" style={{ background: 'var(--tc-07)', color: 'var(--tc-45)' }}>
                        <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2}><path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6" /></svg>
                      </button>
                    </div>
                    <div className="flex gap-2 overflow-x-auto no-scrollbar">
                      {o.garment_ids.map((id) => {
                        const g = garmentById(id)
                        if (!g) return null
                        return (
                          <div key={id} className="flex-shrink-0 w-16">
                            <div className="aspect-square rounded-xl overflow-hidden" style={{ background: 'var(--surface-2)' }}>
                              {g.photo_url ? <img src={g.photo_url} alt="" className="w-full h-full object-contain" /> : (
                                <div className="w-full h-full flex items-center justify-center">
                                  <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.5} style={{ color: 'var(--tc-20)' }}>
                                    <path d="M8 3L4 6l2 4 2-1.5V21h12V8.5L18 10l2-4-4-3-2 2-2-2-2 2-2-2z" strokeLinejoin="round" />
                                  </svg>
                                </div>
                              )}
                            </div>
                            <p className="text-[9px] font-sans mt-1 truncate" style={{ color: 'var(--tc-45)' }}>{localizeGarmentName(g.name, locale)}</p>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )
          ) : (
            wearLogs.length === 0 ? (
              <div className="glass-card p-6 text-center">
                <p className="text-sm font-sans" style={{ color: 'var(--tc-45)' }}>{t('historyEmpty')}</p>
              </div>
            ) : (
              <div className="space-y-4">
                {(() => {
                  // Group by worn_date
                  const groups: Record<string, WearLogEntry[]> = {}
                  for (const log of wearLogs) {
                    const key = log.worn_date
                    if (!groups[key]) groups[key] = []
                    groups[key].push(log)
                  }
                  const sortedDates = Object.keys(groups).sort((a, b) => b.localeCompare(a))
                  return sortedDates.map((date) => (
                    <div key={date}>
                      <p className="kicker mb-2">
                        {new Date(date).toLocaleDateString(locale === 'ar' ? 'ar' : locale, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
                      </p>
                      <div className="space-y-2">
                        {groups[date].map((log) => {
                          // Find garment(s) for this log entry
                          const g = log.garment_id ? garmentById(log.garment_id) : null
                          return (
                            <div key={log.id} className="glass-card p-3 flex items-start gap-3">
                              {/* Thumbnail */}
                              {g && (
                                <div className="flex-shrink-0 w-12 h-12 rounded-lg overflow-hidden" style={{ background: 'var(--tc-04)' }}>
                                  {g.photo_url ? (
                                    <img src={g.photo_url} alt="" className="w-full h-full object-contain" />
                                  ) : (
                                    <div className="w-full h-full flex items-center justify-center">
                                      <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.5} style={{ color: 'var(--tc-20)' }}>
                                        <path d="M8 3L4 6l2 4 2-1.5V21h12V8.5L18 10l2-4-4-3-2 2-2-2-2 2-2-2z" strokeLinejoin="round" />
                                      </svg>
                                    </div>
                                  )}
                                </div>
                              )}
                              <div className="flex-1 min-w-0">
                                {g && <p className="text-xs font-sans font-medium truncate" style={{ color: 'var(--tc)' }}>{localizeGarmentName(g.name, locale)}</p>}
                                {log.occasion && <p className="text-[10px] font-sans" style={{ color: 'var(--tc-45)' }}>{t('occasion' + log.occasion.charAt(0).toUpperCase() + log.occasion.slice(1))}</p>}
                                {log.event_name && <p className="text-[10px] font-sans" style={{ color: 'var(--tc-45)' }}>{log.event_name}</p>}
                                {log.circle && <p className="text-[10px] font-sans" style={{ color: 'var(--tc-45)' }}>{log.circle}</p>}
                                {log.note && <p className="text-[10px] font-sans italic" style={{ color: 'var(--tc-30)' }}>{log.note}</p>}
                              </div>
                              <button onClick={() => handleDeleteWearLog(log.id)} className="ml-1 w-7 h-7 rounded-full flex items-center justify-center transition-transform active:scale-90 flex-shrink-0" style={{ background: 'var(--tc-07)' }}>
                                <svg viewBox="0 0 24 24" className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} style={{ color: 'var(--danger)' }}><path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6" /></svg>
                              </button>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  ))
                })()}
              </div>
            )
          )}
        </div>
      )}

      {/* Picker modal */}
      {pickerSlot && (() => {
        const slotDef = slotOrder.find((s) => s.key === pickerSlot)
        const cat = slotDef?.cat || null
        if (!cat) return null
        const pickerData = getPickerGarments(cat)
        return (
          <GarmentPicker
            category={cat}
            garments={pickerData.garments}
            sizeActive={pickerData.sizeActive}
            onPick={handlePick}
            onClose={() => setPickerSlot(null)}
          />
        )
      })()}

      {/* Style request modal */}
      {showStyleRequest && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center glass-overlay" {...styleRequestOverlay.overlayProps}>
          <div className="glass-sheet w-full max-w-lg max-h-[80vh] overflow-y-auto rounded-t-4xl sm:rounded-3xl animate-slide-up sm:animate-scale-in" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-center pt-3 pb-1">
              <div className="w-10 h-1 rounded-full" style={{ background: 'var(--tc-20)' }} />
            </div>
            <div className="sticky top-0 glass-sheet px-5 py-3 flex items-center justify-between z-10" style={{ borderBottom: '1px solid var(--line)' }}>
              <h2 className="text-[22px] title-display" style={{ color: 'var(--ink)' }}>{t('stylistStyleRequestTitle')}</h2>
              <button onClick={() => setShowStyleRequest(false)} className="icon-btn w-8 h-8">
                <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2}><path d="M6 6l12 12M6 18L18 6" /></svg>
              </button>
            </div>
            <div className="p-5 space-y-5">
              {/* Occasion selector */}
              <div>
                <label className="block text-xs font-sans font-medium mb-2" style={{ color: 'var(--tc-45)' }}>{t('formOccasionTags')}</label>
                <div className="flex gap-1.5 flex-wrap">
                  <button type="button" onClick={() => setStyleOccasion('')} className={`pill flex-shrink-0 ${styleOccasion === '' ? 'pill-active' : 'pill-idle'}`}>
                    {t('occasionSelectPlaceholder')}
                  </button>
                  {(['everyday', 'work', 'brunch', 'evening_out', 'wedding_guest', 'henna_party', 'eid', 'ramadan_gathering', 'majlis', 'beach', 'travel', 'sport'] as Occasion[]).map((o) => (
                    <button key={o} type="button" onClick={() => setStyleOccasion(o)} className={`pill flex-shrink-0 ${styleOccasion === o ? 'pill-active' : 'pill-idle'}`}>
                      {t('occasion' + o.charAt(0).toUpperCase() + o.slice(1))}
                    </button>
                  ))}
                </div>
              </div>

              {/* Occasion / theme */}
              <div>
                <label className="block text-xs font-sans font-medium mb-2" style={{ color: 'var(--tc-45)' }}>{t('stylistStyleRequestOccasion')}</label>
                <div className="flex gap-1.5 flex-wrap">
                  {themes.map((th) => (
                    <button key={th} type="button" onClick={() => setStyleTheme(th)} className={`pill flex-shrink-0 ${styleTheme === th ? 'pill-active' : 'pill-idle'}`}>
                      {t(`stylistTheme${th.charAt(0).toUpperCase()}${th.slice(1)}`)}
                    </button>
                  ))}
                </div>
              </div>

              {/* Dominant color */}
              <div>
                <label className="block text-xs font-sans font-medium mb-2" style={{ color: 'var(--tc-45)' }}>{t('stylistStyleRequestColor')}</label>
                <div className="flex gap-1.5 flex-wrap">
                  <button type="button" onClick={() => setStyleColor('')} className={`pill flex-shrink-0 ${styleColor === '' ? 'pill-active' : 'pill-idle'}`}>
                    {t('stylistStyleRequestColorPlaceholder')}
                  </button>
                  {colorDictionary.map((c) => {
                    const cEn = c.en
                    return (
                      <button key={cEn} type="button" onClick={() => setStyleColor(cEn)} className={`pill flex-shrink-0 ${styleColor === cEn ? 'pill-active' : 'pill-idle'}`}>
                        {localize(c, locale)}
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Avoid recent */}
              <label className="flex items-center gap-3 cursor-pointer">
                <button type="button" role="switch" aria-checked={styleAvoidRecent} onClick={() => setStyleAvoidRecent(!styleAvoidRecent)}
                  className={`switch ${styleAvoidRecent ? 'switch-on' : ''}`}>
                  <span className="switch-knob" />
                </button>
                <span className="text-xs font-sans" style={{ color: 'var(--tc-45)' }}>{t('stylistStyleRequestAvoidRecent')}</span>
              </label>

              {/* Actions */}
              <div className="flex gap-2 pt-2">
                <button type="button" onClick={() => setShowStyleRequest(false)} className="flex-1 btn-outline py-3">{t('stylistStyleRequestCancel')}</button>
                <button type="button" onClick={handleStyleRequest} className="flex-1 btn-gold py-3">{t('stylistStyleRequestSubmit')}</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {toast && (
        <div className="fixed bottom-28 left-1/2 -translate-x-1/2 z-50 px-5 py-2.5 rounded-full text-sm font-sans font-medium animate-fade-in" style={{ background: 'var(--ink)', color: '#fff', boxShadow: 'var(--shadow-lg)' }}>
          {toast}
        </div>
      )}
    </div>
  )
}
