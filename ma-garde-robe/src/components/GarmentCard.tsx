import { useState, useRef, useEffect } from 'react'
import { useI18n } from '../i18n/I18nContext'
import { useLabels, ALL_STATUSES } from '../lib/labels'
import { updateGarmentStatus } from '../lib/api'
import { localizeGarmentName } from '../lib/clothingDictionary'
import { svgFallbackForCategory } from '../lib/demoWardrobe'
import { formatRecency, daysSince } from '../lib/recency'
import { StatusIcon, STATUS_COLORS } from './StatusIcon'
import type { Garment, GarmentStatus } from '../types'

interface Props {
  garment: Garment
  onClick?: () => void
  onFavorite?: () => void
  onStatusChanged?: () => void
  onZoomPhoto?: () => void
  compact?: boolean
  wearCount?: number
  lastWornDate?: string | null
  displayMode?: 'simplified' | 'complete'
}

/* Petit badge flottant sur la photo (statut, favori, zoom, récence…) */
const chipStyle: React.CSSProperties = {
  background: 'rgba(255,255,255,0.92)',
  backdropFilter: 'blur(8px)',
  WebkitBackdropFilter: 'blur(8px)',
  boxShadow: 'var(--shadow-xs)',
}

export default function GarmentCard({ garment, onClick, onFavorite, onStatusChanged, onZoomPhoto, compact, wearCount, lastWornDate, displayMode = 'complete' }: Props) {
  const isSimplified = displayMode === 'simplified'
  const { t, locale } = useI18n()
  const { categoryLabel, statusLabel } = useLabels()
  const [showStatusPopover, setShowStatusPopover] = useState(false)
  const [statusUpdating, setStatusUpdating] = useState(false)
  const popoverRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!showStatusPopover) return
    function handle(e: MouseEvent) {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) setShowStatusPopover(false)
    }
    document.addEventListener('mousedown', handle)
    return () => document.removeEventListener('mousedown', handle)
  }, [showStatusPopover])

  async function handleStatusChange(s: GarmentStatus) {
    if (s === garment.status) { setShowStatusPopover(false); return }
    try {
      setStatusUpdating(true)
      await updateGarmentStatus(garment.id, s)
      onStatusChanged?.()
    } catch { /* ignore */ } finally { setStatusUpdating(false); setShowStatusPopover(false) }
  }

  const status = garment.status || 'available'

  return (
    <div
      onClick={onClick}
      className="card-lift relative glass-card overflow-hidden cursor-pointer group"
      style={{ borderRadius: 18 }}
    >
      {/* Photo — le vêtement "flotte" sur un fond tonal, avec une marge */}
      <div className={`relative ${compact ? 'aspect-square' : 'aspect-[3/4]'} overflow-hidden`} style={{ background: 'var(--surface-2)' }}>
        {garment.photo_url ? (
          <img src={garment.photo_url} alt={garment.name} className="w-full h-full object-contain p-3" loading="lazy"
            style={{ filter: 'drop-shadow(0 6px 10px rgba(23,20,15,0.10))' }}
            onError={(e) => {
              const img = e.currentTarget
              if (img.dataset.fallback) return
              console.warn('[GarmentCard] Image failed to load, falling back to SVG:', img.src)
              img.dataset.fallback = '1'
              img.src = svgFallbackForCategory(garment.category, garment.color_primary)
            }}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <svg viewBox="0 0 24 24" className="w-10 h-10" fill="none" stroke="currentColor" strokeWidth={1.25} style={{ color: 'var(--tc-20)' }}>
              <path d="M8 3L4 6l2 4 2-1.5V21h12V8.5L18 10l2-4-4-3-2 2-2-2-2 2-2-2z" strokeLinejoin="round" />
            </svg>
          </div>
        )}

        {/* Statut — toujours visible */}
        <div className="absolute bottom-2 left-2" ref={popoverRef}>
          <button
            onClick={(e) => { e.stopPropagation(); setShowStatusPopover(!showStatusPopover) }}
            disabled={statusUpdating}
            className="flex items-center justify-center w-7 h-7 rounded-full transition-transform active:scale-90"
            style={chipStyle}
          >
            <StatusIcon status={status} className="w-3.5 h-3.5" />
          </button>
          {showStatusPopover && (
            <div
              className="absolute bottom-full left-0 mb-2 py-1 rounded-2xl z-30 animate-scale-in min-w-[150px]"
              style={{ background: 'var(--surface)', border: '1px solid var(--line)', boxShadow: 'var(--shadow-lg)' }}
              onClick={(e) => e.stopPropagation()}
            >
              {ALL_STATUSES.map((s) => (
                <button
                  key={s}
                  onClick={() => handleStatusChange(s)}
                  className="w-full flex items-center gap-2 px-3 py-2 transition-all duration-100 hover:bg-black/5"
                  style={{ color: s === status ? STATUS_COLORS[s] : 'var(--ink)' }}
                >
                  <StatusIcon status={s} className="w-4 h-4" />
                  <span className="text-xs font-sans font-medium">{statusLabel(s)}</span>
                  {s === status && (
                    <svg viewBox="0 0 24 24" className="w-3.5 h-3.5 ml-auto" fill="none" stroke="currentColor" strokeWidth={2.5}>
                      <path d="M5 12l5 5L20 7" />
                    </svg>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>

        {garment.favorite && (
          <div className="absolute top-2 right-2 w-7 h-7 rounded-full flex items-center justify-center" style={chipStyle}>
            <svg viewBox="0 0 24 24" className="w-3.5 h-3.5" fill="currentColor" style={{ color: 'var(--accent)' }}>
              <path d="M12 21s-7-4.5-9.5-9C1 9 2.5 5 6 5c2 0 3.5 1 4 2.5h2C12.5 6 14 5 16 5c3.5 0 5 4 3.5 7-2.5 4.5-9.5 9-9.5 9z" />
            </svg>
          </div>
        )}

        {lastWornDate ? (
          <div className="absolute bottom-2 right-2 px-2 py-0.5 rounded-full text-[9px] font-sans font-medium max-w-[70%] truncate"
            style={{ ...chipStyle, color: 'var(--ink-2)' }}>
            {formatRecency(daysSince(lastWornDate), locale)}
          </div>
        ) : (!isSimplified && wearCount !== undefined && wearCount === 0) && (
          <div className="absolute bottom-2 right-2 px-2 py-0.5 rounded-full text-[9px] font-sans font-medium"
            style={{ ...chipStyle, color: 'var(--ink-3)' }}>
            {t('neverWorn')}
          </div>
        )}

        {garment.is_demo && (
          <div className="absolute top-2 left-2 px-2 py-0.5 rounded-full text-[9px] font-sans font-semibold tracking-wide"
            style={{ background: 'var(--ok)', color: '#fff' }}>
            {locale === 'fr' ? 'Démo' : locale === 'ar' ? 'تجريبي' : 'Demo'}
          </div>
        )}

        {garment.photo_url && onZoomPhoto && (
          <button
            onClick={(e) => { e.stopPropagation(); onZoomPhoto() }}
            className={`absolute top-2 w-7 h-7 rounded-full flex items-center justify-center transition-transform active:scale-90 ${garment.is_demo ? 'right-2' : 'left-2'}`}
            style={chipStyle}
            title="Agrandir"
          >
            <svg viewBox="0 0 24 24" className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} style={{ color: 'var(--ink)' }}>
              <circle cx="11" cy="11" r="7" /><path d="M21 21l-4.3-4.3M11 8v6M8 11h6" />
            </svg>
          </button>
        )}

        {onFavorite && (
          <button
            onClick={(e) => { e.stopPropagation(); onFavorite() }}
            className={`absolute top-2 w-7 h-7 rounded-full flex items-center justify-center transition-all duration-200 ${garment.favorite ? 'opacity-100' : 'opacity-0 group-active:opacity-100'}`}
            style={{ ...chipStyle, right: garment.favorite ? '2.5rem' : '0.5rem' }}
          >
            <svg viewBox="0 0 24 24" className="w-3.5 h-3.5" fill={garment.favorite ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth={2} style={{ color: garment.favorite ? 'var(--accent)' : 'var(--ink-3)' }}>
              <path d="M12 21s-7-4.5-9.5-9C1 9 2.5 5 6 5c2 0 3.5 1 4 2.5h2C12.5 6 14 5 16 5c3.5 0 5 4 3.5 7-2.5 4.5-9.5 9-9.5 9z" />
            </svg>
          </button>
        )}
      </div>

      {/* Légende */}
      <div className="px-3 pt-2.5 pb-3">
        <h3 className="text-[13px] font-sans font-medium truncate leading-tight" style={{ color: 'var(--ink)' }}>{localizeGarmentName(garment.name, locale) || t('commonNone')}</h3>
        <div className="flex items-center gap-1.5 mt-1">
          <span className="text-[11px] font-sans" style={{ color: 'var(--ink-3)' }}>{categoryLabel(garment.category)}</span>
          {garment.size && (
            <>
              <span style={{ color: 'var(--line-strong)' }}>·</span>
              <span className="text-[11px] font-sans num" style={{ color: 'var(--ink-3)' }}>{garment.size}</span>
            </>
          )}
        </div>
        {!isSimplified && garment.purchase_price && garment.purchase_price > 0 && wearCount !== undefined && wearCount > 0 && (() => {
          const price = garment.purchase_price
          const cpw = price / wearCount
          const currency = locale === 'ar' ? t('currencyQARAr') : t('currencyQAR')
          const isWellWorn = cpw < 100
          const isGood = cpw < 500
          const label = isWellWorn ? t('costPerWearWellWorn') : isGood ? t('costPerWearGood') : t('costPerWearNew')
          const labelColor = isWellWorn ? 'var(--ok)' : isGood ? 'var(--warn)' : 'var(--ink-3)'
          return (
            <div className="mt-2 px-2 py-1.5 rounded-lg" style={{ background: isWellWorn ? 'var(--ok-soft)' : 'var(--surface-2)' }}>
              <p className="text-[10px] font-sans num" style={{ color: 'var(--ink-2)' }}>
                {t('costPerWear').replace('{price}', String(Math.round(price))).replace('{count}', String(wearCount)).replace('{cpw}', String(Math.round(cpw))).replace('QAR', currency)}
              </p>
              <p className="text-[10px] font-sans font-semibold mt-0.5" style={{ color: labelColor }}>{label}</p>
            </div>
          )
        })()}
      </div>
    </div>
  )
}
