import { useState, useMemo } from 'react'
import { useOverlayClick } from '../lib/useOverlayClick'
import { useI18n } from '../i18n/I18nContext'
import { useLabels, ALL_SEASONS, ALL_STYLES } from '../lib/labels'
import { colorDictionary, localize, localizeGarmentName, localizeKey, sortDictionaryByLocale } from '../lib/clothingDictionary'
import { isGarmentAvailable } from '../lib/outfitEngine'
import { StatusIcon } from './StatusIcon'
import type { Garment, Category, Season, GarmentStyle } from '../types'

interface Props {
  category: Category
  garments: Garment[]
  sizeActive: boolean
  onPick: (g: Garment) => void
  onClose: () => void
}

export default function GarmentPicker({ category, garments, sizeActive, onPick, onClose }: Props) {
  const { overlayProps } = useOverlayClick(onClose)
  const { t, locale } = useI18n()
  const { categoryLabel, seasonLabel, styleLabel } = useLabels()
  const [colorFilter, setColorFilter] = useState<string>('all')
  const [styleFilter, setStyleFilter] = useState<GarmentStyle | 'all'>('all')
  const [seasonFilter, setSeasonFilter] = useState<Season | 'all'>('all')
  const [includeUnavailable, setIncludeUnavailable] = useState(false)

  const pool = useMemo(() => garments.filter((g) => g.category === category), [garments, category])

  const visiblePool = useMemo(() => {
    if (includeUnavailable) return pool
    return pool.filter(isGarmentAvailable)
  }, [pool, includeUnavailable])

  const filtered = useMemo(() => {
    let r = [...visiblePool]
    if (colorFilter !== 'all') {
      r = r.filter((g) => g.color_primary === colorFilter || g.color_secondary === colorFilter)
    }
    if (styleFilter !== 'all') r = r.filter((g) => g.styles.includes(styleFilter))
    if (seasonFilter !== 'all') r = r.filter((g) => g.season === seasonFilter)
    return r
  }, [visiblePool, colorFilter, styleFilter, seasonFilter])

  const availableColors = useMemo(() => {
    const set = new Set<string>()
    visiblePool.forEach((g) => { if (g.color_primary) set.add(g.color_primary); if (g.color_secondary) set.add(g.color_secondary) })
    return sortDictionaryByLocale(colorDictionary.filter((c) => set.has(c.en)), locale)
  }, [visiblePool])

  const unavailableCount = pool.filter((g) => !isGarmentAvailable(g)).length

  return (
    <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center glass-overlay" {...overlayProps}>
      <div className="glass-sheet w-full max-w-lg max-h-[85vh] overflow-y-auto rounded-t-4xl sm:rounded-3xl animate-slide-up sm:animate-scale-in" onClick={(e) => e.stopPropagation()}>
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 rounded-full" style={{ background: 'var(--tc-20)' }} />
        </div>

        <div className="sticky top-0 glass-sheet px-5 py-3 flex items-center justify-between z-10" style={{ borderBottom: '1px solid var(--line)' }}>
          <div>
            <h2 className="text-base title-display" style={{ color: 'var(--tc)' }}>{t('composerPickerTitle')}</h2>
            <p className="text-xs font-sans" style={{ color: 'var(--tc-45)' }}>
              {categoryLabel(category)} · {sizeActive ? t('composerPickerSizeFilter') : t('composerPickerAllSizes')}
            </p>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-full flex items-center justify-center transition-transform active:scale-90" style={{ background: 'var(--tc-07)', color: 'var(--tc-45)' }}>
            <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2}><path d="M6 6l12 12M6 18L18 6" /></svg>
          </button>
        </div>

        <div className="p-5">
          {/* Include unavailable toggle */}
          {unavailableCount > 0 && (
            <button
              onClick={() => setIncludeUnavailable(!includeUnavailable)}
              className="flex items-center gap-2 mb-3 px-3 py-2 rounded-xl transition-all duration-200 w-full"
              style={includeUnavailable
                ? { background: 'var(--tc-07)', border: '1.5px solid var(--tc-30)' }
                : { background: 'var(--tc-04)', border: '1px solid var(--line)' }}
            >
              <div className="w-9 h-5 rounded-full transition-all duration-200 relative flex-shrink-0" style={{ background: includeUnavailable ? 'var(--tc)' : 'var(--tc-20)' }}>
                <div className="absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all duration-200" style={{ left: includeUnavailable ? '1.125rem' : '0.125rem' }} />
              </div>
              <span className="text-xs font-sans font-medium" style={{ color: 'var(--tc)' }}>{t('composerIncludeUnavailable')}</span>
              <span className="text-[10px] font-sans ml-auto" style={{ color: 'var(--tc-45)' }}>{unavailableCount}</span>
            </button>
          )}

          {/* Filters — wrap layout */}
          <div className="space-y-2 mb-4">
            {availableColors.length > 0 && (
              <div className="flex gap-1.5 flex-wrap">
                <button onClick={() => setColorFilter('all')} className={`pill ${colorFilter === 'all' ? 'pill-active' : 'pill-idle'}`}>{t('composerFilterAll')}</button>
                {availableColors.map((c, i) => {
                  return (
                    <button key={i} onClick={() => setColorFilter(c.en)} className={`pill ${colorFilter === c.en ? 'pill-active' : 'pill-idle'}`}>{localize(c, locale)}</button>
                  )
                })}
              </div>
            )}
            <div className="flex gap-1.5 flex-wrap">
              <button onClick={() => setStyleFilter('all')} className={`pill ${styleFilter === 'all' ? 'pill-active' : 'pill-idle'}`}>{t('composerFilterAll')}</button>
              {ALL_STYLES.map((s) => (
                <button key={s} onClick={() => setStyleFilter(s)} className={`pill ${styleFilter === s ? 'pill-active' : 'pill-idle'}`}>{styleLabel(s)}</button>
              ))}
            </div>
            <div className="flex gap-1.5 flex-wrap">
              <button onClick={() => setSeasonFilter('all')} className={`pill ${seasonFilter === 'all' ? 'pill-active' : 'pill-idle'}`}>{t('composerFilterAll')}</button>
              {ALL_SEASONS.map((s) => (
                <button key={s} onClick={() => setSeasonFilter(s)} className={`pill ${seasonFilter === s ? 'pill-active' : 'pill-idle'}`}>{seasonLabel(s)}</button>
              ))}
            </div>
          </div>

          {/* Garment grid */}
          {visiblePool.length === 0 ? (
            <div className="py-12 text-center">
              <p className="text-sm font-sans" style={{ color: 'var(--tc-45)' }}>{t('composerPickerEmpty')}</p>
            </div>
          ) : filtered.length === 0 ? (
            <div className="py-12 text-center">
              <p className="text-sm font-sans" style={{ color: 'var(--tc-45)' }}>{t('composerNoMatch')}</p>
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-2">
              {filtered.map((g) => {
                const available = isGarmentAvailable(g)
                return (
                  <button
                    key={g.id}
                    onClick={() => onPick(g)}
                    className="text-left card-lift glass-card overflow-hidden relative"
                    style={available ? {} : { opacity: 0.45 }}
                  >
                    <div className="aspect-[3/4] overflow-hidden flex items-center justify-center relative" style={{ background: 'var(--tc-04)' }}>
                      {g.photo_url ? (
                        <img src={g.photo_url} alt={g.name} className="w-full h-full object-contain" loading="lazy" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <svg viewBox="0 0 24 24" className="w-8 h-8" fill="none" stroke="currentColor" strokeWidth={1.5} style={{ color: 'var(--tc-20)' }}>
                            <path d="M8 3L4 6l2 4 2-1.5V21h12V8.5L18 10l2-4-4-3-2 2-2-2-2 2-2-2z" strokeLinejoin="round" />
                          </svg>
                        </div>
                      )}
                      {!available && (
                        <div className="absolute bottom-1 right-1">
                          <StatusIcon status={g.status || 'available'} className="w-4 h-4" />
                        </div>
                      )}
                    </div>
                    <div className="p-1.5">
                      <p className="text-[11px] font-sans font-medium truncate" style={{ color: 'var(--tc)' }}>{localizeGarmentName(g.name, locale)}</p>
                      {g.color_primary && <p className="text-[9px] font-sans truncate" style={{ color: 'var(--tc-45)' }}>{localizeKey(colorDictionary, g.color_primary, locale)}</p>}
                    </div>
                  </button>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
