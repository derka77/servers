import { useState, useMemo, useEffect, useRef } from 'react'
import { useI18n } from '../i18n/I18nContext'
import { useLabels, ALL_CATEGORIES, ALL_SEASONS, ALL_STYLES, ALL_STATUSES } from '../lib/labels'
import { toggleFavorite, deleteGarment, updateGarment, fetchWearCounts, fetchLastWornDates, fetchGarmentIdsWornBeforeCircle, fetchDistinctCircles } from '../lib/api'
import { isGarmentAvailable } from '../lib/outfitEngine'
import GarmentCard from '../components/GarmentCard'
import WardrobeCarousel from '../components/WardrobeCarousel'
import ImagePreviewModal from '../components/ImagePreviewModal'
import { StatusIcon } from '../components/StatusIcon'
import type { Garment, Category, Season, GarmentStyle, GarmentStatus } from '../types'

interface Props {
  garments: Garment[]
  onAdd: () => void
  onBatchAdd: () => void
  onEdit: (g: Garment) => void
  onRefresh: () => void
  onCompleteDrafts: () => void
  displayMode: 'simplified' | 'complete'
  initialCatFilter?: Category | 'all'
  initialStatusFilter?: GarmentStatus | 'all' | 'unavailable'
}

type SortMode = 'newest' | 'oldest' | 'name' | 'favorite'

const categoryIcons: Record<Category, string> = {
  tops: 'M16 3l4 3-2 4-2-1.5V21h-8V8.5L6 10 4 6l4-3 2 2 2-2 2 2 2-2z',
  bottoms: 'M8 3h8v18h-3v-7h-2v7H8V3z',
  dresses: 'M12 3l3 2-1 4h4l-2 12H8L6 9h4L9 5l3-2z',
  outerwear: 'M4 6l4-3 4 2 4-2 4 3-2 4-2-1.5V21h-8V8.5L6 10 4 6z',
  shoes: 'M3 15l6-2 3-6 3 6 6 2v3H3v-3z',
  accessories: 'M12 3l2 5h5l-4 3 1.5 5L12 13l-4.5 3L9 11l-4-3h5l2-5z',
  bags: 'M8 6h8l1 2h2v13H6V8h2l-0-2zM8 6V4h8v2',
  traditional: 'M12 3l4 4-2 14H10L8 7l4-4z',
}

export default function Wardrobe({ garments, onAdd, onBatchAdd, onEdit, onRefresh, onCompleteDrafts, displayMode, initialCatFilter, initialStatusFilter }: Props) {
  const isSimplified = displayMode === 'simplified'
  const { t, locale } = useI18n()
  const { categoryLabel, seasonLabel, styleLabel, statusLabel } = useLabels()

  const [search, setSearch] = useState('')
  const [catFilter, setCatFilter] = useState<Category | 'all'>(initialCatFilter ?? 'all')
  const [seasonFilter, setSeasonFilter] = useState<Season | 'all'>('all')
  const [styleFilter, setStyleFilter] = useState<GarmentStyle | 'all'>('all')
  const [statusFilter, setStatusFilter] = useState<GarmentStatus | 'all' | 'unavailable'>(initialStatusFilter ?? 'all')
  const [favOnly, setFavOnly] = useState(false)
  const [sort, setSort] = useState<SortMode>('newest')
  const [showFilters, setShowFilters] = useState(false)
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false)
  const [editMode, setEditMode] = useState(false)
  const [zoomGarment, setZoomGarment] = useState<Garment | null>(null)
  const [addMenuOpen, setAddMenuOpen] = useState(false)
  const addMenuRef = useRef<HTMLDivElement>(null)
  const [viewMode, setViewMode] = useState<'grid' | 'carousel'>('carousel')
  const [wearCounts, setWearCounts] = useState<Record<string, number>>({})
  const [lastWornDates, setLastWornDates] = useState<Record<string, string>>({})
  const [neverSeenCircle, setNeverSeenCircle] = useState('')
  const [wornBeforeIds, setWornBeforeIds] = useState<Set<string>>(new Set())
  const [circleSuggestions, setCircleSuggestions] = useState<string[]>([])

  const draftCount = useMemo(() => garments.filter((g) => g.is_draft).length, [garments])

  useEffect(() => {
    if (!addMenuOpen) return
    const handler = () => setAddMenuOpen(false)
    window.addEventListener('click', handler)
    return () => window.removeEventListener('click', handler)
  }, [addMenuOpen])

  const filtered = useMemo(() => {
    let result = [...garments]
    if (search.trim()) {
      const q = search.toLowerCase()
      result = result.filter((g) => g.name.toLowerCase().includes(q) || g.brand.toLowerCase().includes(q) || g.color_primary.toLowerCase().includes(q) || g.notes.toLowerCase().includes(q))
    }
    if (catFilter !== 'all') result = result.filter((g) => g.category === catFilter)
    if (seasonFilter !== 'all') result = result.filter((g) => g.season === seasonFilter)
    if (styleFilter !== 'all') result = result.filter((g) => g.styles.includes(styleFilter))
    if (statusFilter === 'unavailable') result = result.filter((g) => !isGarmentAvailable(g))
    else if (statusFilter !== 'all') result = result.filter((g) => (g.status || 'available') === statusFilter)
    if (favOnly) result = result.filter((g) => g.favorite)
    if (neverSeenCircle.trim() && wornBeforeIds.size > 0) result = result.filter((g) => !wornBeforeIds.has(g.id))
    switch (sort) {
      case 'newest': result.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()); break
      case 'oldest': result.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()); break
      case 'name': result.sort((a, b) => a.name.localeCompare(b.name)); break
      case 'favorite': result.sort((a, b) => Number(b.favorite) - Number(a.favorite)); break
    }
    return result
  }, [garments, search, catFilter, seasonFilter, styleFilter, statusFilter, favOnly, sort, neverSeenCircle, wornBeforeIds])

  async function handlePhotoUpdated(garmentId: string, newUrl: string) {
    try { await updateGarment(garmentId, { photo_url: newUrl }); onRefresh() } catch { /* ignore */ }
  }

  async function handleFav(g: Garment) { try { await toggleFavorite(g.id, g.favorite); onRefresh() } catch { /* ignore */ } }
  async function handleDelete(g: Garment) { if (!confirm(t('formDeleteConfirm'))) return; try { await deleteGarment(g.id); onRefresh() } catch { /* ignore */ } }

  useEffect(() => {
    fetchWearCounts().then(setWearCounts).catch(() => {})
    fetchLastWornDates().then(setLastWornDates).catch(() => {})
    fetchDistinctCircles().then(setCircleSuggestions).catch(() => {})
  }, [garments])

  useEffect(() => {
    if (neverSeenCircle.trim()) {
      fetchGarmentIdsWornBeforeCircle(neverSeenCircle.trim()).then(setWornBeforeIds).catch(() => setWornBeforeIds(new Set()))
    } else {
      setWornBeforeIds(new Set())
    }
  }, [neverSeenCircle])

  const activeFilterCount = [seasonFilter !== 'all', styleFilter !== 'all', statusFilter !== 'all', favOnly, !!neverSeenCircle.trim()].filter(Boolean).length

  return (
    <div className="max-w-lg mx-auto min-h-screen">
      <header className="px-5 pt-6 pb-4">
        <div className="flex items-end justify-between mb-5">
          <div>
            <p className="kicker mb-1.5">{t('appTagline')}</p>
            <h1 className="text-[30px] title-display" style={{ color: 'var(--ink)' }}>{t('wardrobeTitle')}</h1>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => setEditMode(!editMode)}
              className={`pill ${editMode ? 'pill-active' : 'pill-idle'}`}>
              {editMode ? t('commonConfirm') : t('editItem')}
            </button>
            <div className="relative" ref={addMenuRef}>
              <button onClick={(e) => { e.stopPropagation(); setAddMenuOpen(!addMenuOpen) }} className="w-10 h-10 rounded-full flex items-center justify-center transition-transform active:scale-90" style={{ background: 'var(--accent)', color: 'var(--on-accent)', boxShadow: 'var(--shadow-sm)' }} aria-label={t('formAdd')}>
                <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2}><path d="M12 5v14M5 12h14" strokeLinecap="round" /></svg>
              </button>
              {addMenuOpen && (
                <div className="absolute right-0 top-12 z-30 py-1 rounded-2xl animate-scale-in overflow-hidden" style={{ background: 'var(--surface)', border: '1px solid var(--line)', boxShadow: 'var(--shadow-lg)', minWidth: '190px' }}>
                  <button onClick={(e) => { e.stopPropagation(); setAddMenuOpen(false); onAdd() }}
                    className="w-full text-left px-4 py-3 flex items-center gap-2.5 transition-all duration-150 hover:bg-tc-04"
                    style={{ color: 'var(--tc)' }}>
                    <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={1.5}><path d="M12 5v14M5 12h14" /></svg>
                    <span className="text-sm font-sans font-medium">{t('batchAddSingle')}</span>
                  </button>
                  <button onClick={(e) => { e.stopPropagation(); setAddMenuOpen(false); onBatchAdd() }}
                    className="w-full text-left px-4 py-3 flex items-center gap-2.5 transition-all duration-150"
                    style={{ color: 'var(--tc)', borderTop: '1px solid var(--line)' }}>
                    <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={1.5}><rect x="3" y="5" width="18" height="14" rx="2" /><circle cx="9" cy="11" r="2" /><path d="M3 17l5-5 4 4 3-3 6 6" strokeLinejoin="round" /></svg>
                    <span className="text-sm font-sans font-medium">{t('batchAddBurst')}</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Search */}
        <div className="relative mb-3">
          <svg viewBox="0 0 24 24" className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none z-10" fill="none" stroke="currentColor" strokeWidth={1.75} style={{ color: 'var(--ink-3)' }}>
            <circle cx="11" cy="11" r="7" /><path d="M21 21l-4-4" />
          </svg>
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t('searchPlaceholder')}
            className="input-field pl-10" style={{ paddingLeft: 40 }} />
        </div>

        {/* Category grid — pastel thumbnails with representative photos */}
        <div className="flex gap-2.5 overflow-x-auto no-scrollbar -mx-5 px-5 mb-4 pb-1">
          <button onClick={() => setCatFilter('all')}
            className="flex-shrink-0 flex flex-col items-center gap-1.5 w-[72px] py-2.5 rounded-2xl transition-all duration-200"
            style={catFilter === 'all'
              ? { background: 'var(--accent)', color: 'var(--on-accent)' }
              : { background: 'var(--surface)', color: 'var(--ink-2)', border: '1px solid var(--line)' }}>
            <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: catFilter === 'all' ? 'rgba(255,255,255,0.12)' : 'var(--surface-2)' }}>
              <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.5}>
                <rect x="3" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="3" width="7" height="7" rx="1.5" />
                <rect x="3" y="14" width="7" height="7" rx="1.5" /><rect x="14" y="14" width="7" height="7" rx="1.5" />
              </svg>
            </div>
            <span className="text-[10.5px] font-sans font-medium">{t('filterAll')}</span>
          </button>
          {ALL_CATEGORIES.map((c) => {
            const repPhoto = garments.find((g) => g.category === c && g.photo_url)
            const isActive = catFilter === c
            return (
              <button key={c} onClick={() => setCatFilter(c)}
                className="flex-shrink-0 flex flex-col items-center gap-1.5 w-[72px] py-2.5 rounded-2xl transition-all duration-200"
                style={isActive
                  ? { background: 'var(--accent)', color: 'var(--on-accent)' }
                  : { background: 'var(--surface)', color: 'var(--ink-2)', border: '1px solid var(--line)' }}>
                <div className="w-10 h-10 rounded-xl overflow-hidden flex items-center justify-center" style={{ background: isActive ? 'rgba(255,255,255,0.12)' : 'var(--surface-2)' }}>
                  {repPhoto ? (
                    <img src={repPhoto.photo_url} alt="" className="w-full h-full object-contain p-1" loading="lazy" />
                  ) : (
                    <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.5}>
                      <path d={categoryIcons[c]} strokeLinejoin="round" />
                    </svg>
                  )}
                </div>
                <span className="text-[10.5px] font-sans font-medium text-center leading-tight truncate w-full px-1">{categoryLabel(c)}</span>
              </button>
            )
          })}
        </div>

        {/* Secondary filters row */}
        <div className="flex items-center gap-2 flex-wrap">
          <button onClick={() => setFavOnly(!favOnly)} className={`pill flex items-center gap-1.5 ${favOnly ? 'pill-active' : 'pill-idle'}`}>
            <svg viewBox="0 0 24 24" className="w-3.5 h-3.5" fill={favOnly ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth={2}><path d="M12 21s-7-4.5-9.5-9C1 9 2.5 5 6 5c2 0 3.5 1 4 2.5h2C12.5 6 14 5 16 5c3.5 0 5 4 3.5 7-2.5 4.5-9.5 9-9.5 9z" /></svg>
            {t('filterFavorite')}
          </button>
          <button onClick={() => setShowAdvancedFilters(!showAdvancedFilters)} className={`pill flex items-center gap-1.5 ${showAdvancedFilters || activeFilterCount > 0 ? 'pill-active' : 'pill-idle'}`}>
            <svg viewBox="0 0 24 24" className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2}><path d="M3 5h18M6 12h12M10 19h4" /></svg>
            {t('filterCategory')}
            {activeFilterCount > 0 && <span className="ml-0.5 w-4 h-4 rounded-full text-[9px] num flex items-center justify-center" style={{ background: 'var(--on-accent)', color: 'var(--accent)' }}>{activeFilterCount}</span>}
          </button>
          <select value={sort} onChange={(e) => setSort(e.target.value as SortMode)} className="pill pill-idle cursor-pointer appearance-none">
            <option value="newest">{t('sortNewest')}</option>
            <option value="oldest">{t('sortOldest')}</option>
            <option value="name">{t('sortName')}</option>
            <option value="favorite">{t('sortFavorite')}</option>
          </select>
          {/* View toggle: Grid / Carousel */}
          <div className="seg ml-auto" style={{ padding: 2 }}>
            <button onClick={() => setViewMode('grid')} className={`seg-btn ${viewMode === 'grid' ? 'seg-btn-active' : ''}`} style={{ padding: '5px 10px', fontSize: 11 }}>
              {t('wardrobeViewGrid')}
            </button>
            <button onClick={() => setViewMode('carousel')} className={`seg-btn ${viewMode === 'carousel' ? 'seg-btn-active' : ''}`} style={{ padding: '5px 10px', fontSize: 11 }}>
              {t('wardrobeViewCarousel')}
            </button>
          </div>
        </div>

        {/* Collapsible advanced filters — includes never-seen-by in simplified mode */}
        {showAdvancedFilters && (
          <div className="mt-3 space-y-2 animate-fade-in">
            <div className="flex gap-2 flex-wrap">
              <button onClick={() => setSeasonFilter('all')} className={`pill ${seasonFilter === 'all' ? 'pill-active' : 'pill-idle'}`}>{t('filterAll')}</button>
              {ALL_SEASONS.map((s) => <button key={s} onClick={() => setSeasonFilter(s)} className={`pill ${seasonFilter === s ? 'pill-active' : 'pill-idle'}`}>{seasonLabel(s)}</button>)}
            </div>
            <div className="flex gap-2 flex-wrap">
              <button onClick={() => setStyleFilter('all')} className={`pill ${styleFilter === 'all' ? 'pill-active' : 'pill-idle'}`}>{t('filterAll')}</button>
              {ALL_STYLES.map((s) => <button key={s} onClick={() => setStyleFilter(s)} className={`pill ${styleFilter === s ? 'pill-active' : 'pill-idle'}`}>{styleLabel(s)}</button>)}
            </div>
            <div className="flex gap-2 flex-wrap items-center">
              <button onClick={() => setStatusFilter('all')} className={`pill ${statusFilter === 'all' ? 'pill-active' : 'pill-idle'}`}>{t('filterAll')}</button>
              {ALL_STATUSES.map((s) => (
                <button key={s} onClick={() => setStatusFilter(s)} className={`pill flex items-center gap-1 ${statusFilter === s ? 'pill-active' : 'pill-idle'}`}>
                  <StatusIcon status={s} className="w-3.5 h-3.5" />
                  {statusLabel(s)}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-1.5">
              <svg viewBox="0 0 24 24" className="w-3.5 h-3.5 flex-shrink-0" fill="none" stroke="currentColor" strokeWidth={1.5} style={{ color: neverSeenCircle.trim() ? 'var(--tc)' : 'var(--tc-30)' }}>
                <path d="M12 2C8 2 5 5 5 9c0 5 7 13 7 13s7-8 7-13c0-4-3-7-7-7z" /><circle cx="12" cy="9" r="2.5" />
              </svg>
              <input
                value={neverSeenCircle}
                onChange={(e) => setNeverSeenCircle(e.target.value)}
                list="wardrobe-circle-suggestions"
                placeholder={t('filterNeverSeenBy')}
                className={`pill ${neverSeenCircle.trim() ? 'pill-active' : 'pill-idle'} text-[10px] py-1.5 max-w-[140px]`}
              />
              <datalist id="wardrobe-circle-suggestions">
                {circleSuggestions.map((c) => <option key={c} value={c} />)}
              </datalist>
            </div>
          </div>
        )}
      </header>

      {/* Grid or Carousel */}
      <div className="px-5 pb-4">
        {draftCount > 0 && (
          <button onClick={onCompleteDrafts}
            className="w-full flex items-center justify-between px-4 py-3 rounded-2xl mb-3 transition-all duration-200 animate-fade-up"
            style={{ background: 'var(--brass-soft)', color: 'var(--warn)' }}>
            <span className="flex items-center gap-2 text-sm font-sans font-semibold">
              <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.5}>
                <path d="M9 11l3 3L22 4M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              {t('draftCompleteAll').replace('{n}', String(draftCount))}
            </span>
            <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2}><path d="M9 18l6-6-6-6" strokeLinecap="round" strokeLinejoin="round" /></svg>
          </button>
        )}
        {garments.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center animate-fade-up">
            <div className="w-20 h-20 rounded-full flex items-center justify-center mb-4" style={{ background: 'var(--surface-2)' }}>
              <svg viewBox="0 0 24 24" className="w-10 h-10" fill="none" stroke="currentColor" strokeWidth={1.5} style={{ color: 'var(--tc-20)' }}>
                <path d="M8 3L4 6l2 4 2-1.5V21h12V8.5L18 10l2-4-4-3-2 2-2-2-2 2-2-2z" strokeLinejoin="round" />
              </svg>
            </div>
            <p className="text-base font-sans font-medium mb-1" style={{ color: 'var(--tc)' }}>{t('wardrobeEmpty')}</p>
            <p className="text-sm font-sans" style={{ color: 'var(--tc-30)' }}>{t('wardrobeEmptyHint')}</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center animate-fade-up">
            <div className="w-16 h-16 rounded-full flex items-center justify-center mb-3" style={{ background: 'var(--surface-2)' }}>
              <svg viewBox="0 0 24 24" className="w-8 h-8" fill="none" stroke="currentColor" strokeWidth={1.5} style={{ color: 'var(--tc-20)' }}>
                <path d="M8 3L4 6l2 4 2-1.5V21h12V8.5L18 10l2-4-4-3-2 2-2-2-2 2-2-2z" strokeLinejoin="round" />
              </svg>
            </div>
            <p className="text-sm font-sans mb-3" style={{ color: 'var(--tc-45)' }}>
              {locale === 'fr' ? 'Aucune pièce ici pour l\'instant — ajoutez les vôtres' : locale === 'ar' ? 'لا توجد قطع هنا بعد — أضيفي قطعك' : 'No pieces here yet — add your own'}
            </p>
            <button onClick={onAdd} className="btn-gold px-6 py-2.5 text-xs font-sans">{t('formAdd')}</button>
          </div>
        ) : viewMode === 'carousel' ? (
          <div className="glass-card p-4 animate-fade-up">
            <WardrobeCarousel
              garments={filtered}
              onSelect={(g) => onEdit(g)}
              isRTL={locale === 'ar'}
            />
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {filtered.map((g, i) => (
              <div key={g.id} className="relative animate-fade-up" style={{ animationDelay: `${i * 0.03}s` }}>
                {g.is_draft && (
                  <div className="absolute top-2 right-2 z-10 px-2 py-0.5 rounded-full text-[9px] font-sans font-semibold" style={{ background: 'var(--brass)', color: '#fff' }}>
                    {t('draftBadge')}
                  </div>
                )}
                <GarmentCard garment={g}
                  onClick={() => editMode ? onEdit(g) : onEdit(g)}
                  onFavorite={() => handleFav(g)}
                  onZoomPhoto={() => setZoomGarment(g)}
                  onStatusChanged={onRefresh}
                  wearCount={wearCounts[g.id]}
                  lastWornDate={lastWornDates[g.id] || null}
                  displayMode={displayMode} />
                {editMode && (
                  <div className="absolute top-2 left-2 flex gap-1.5 z-10">
                    <button onClick={(e) => { e.stopPropagation(); onEdit(g) }}
                      className="w-8 h-8 rounded-full flex items-center justify-center shadow-sm transition-transform active:scale-90"
                      style={{ background: 'rgba(255,255,255,0.95)', backdropFilter: 'blur(8px)' }}>
                      <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} style={{ color: 'var(--tc)' }}>
                        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                        <path d="M18.5 2.5a2.12 2.12 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                      </svg>
                    </button>
                    <button onClick={(e) => { e.stopPropagation(); handleDelete(g) }}
                      className="w-8 h-8 rounded-full flex items-center justify-center shadow-sm transition-transform active:scale-90"
                      style={{ background: 'rgba(255,255,255,0.95)', backdropFilter: 'blur(8px)' }}>
                      <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} style={{ color: 'var(--danger)' }}>
                        <path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6" />
                      </svg>
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {zoomGarment && (
        <ImagePreviewModal garment={zoomGarment} onClose={() => setZoomGarment(null)} onPhotoUpdated={handlePhotoUpdated} />
      )}
    </div>
  )
}
