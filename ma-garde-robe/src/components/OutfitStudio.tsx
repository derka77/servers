import { useMemo } from 'react'
import { useI18n } from '../i18n/I18nContext'
import { localizeGarmentName } from '../lib/clothingDictionary'
import { svgFallbackForCategory } from '../lib/demoWardrobe'
import Mannequin from './Mannequin'
import type { Garment, Profile, Category } from '../types'
import type { OutfitSlots } from '../lib/outfitEngine'

type SlotKey = keyof OutfitSlots

interface RailSlot {
  key: SlotKey
  cat: Category
  labelKey: string
  compact?: boolean
}

interface Props {
  mode: 'separates' | 'dress'
  slots: OutfitSlots
  profile: Profile | null
  rails: RailSlot[]
  pools: (cat: Category) => Garment[]
  indices: Record<string, number>
  onSelect: (slotKey: SlotKey, cat: Category, index: number) => void
}

const pieceClass: Record<SlotKey, string> = {
  top: 'studio-piece-top',
  bottom: 'studio-piece-bottom',
  outerwear: 'studio-piece-outerwear',
  dress: 'studio-piece-dress',
  shoes: 'studio-piece-shoes',
  bag: 'studio-piece-bag',
  accessory: 'studio-piece-accessory',
}

function handleImgError(e: React.SyntheticEvent<HTMLImageElement>, g: Garment) {
  const img = e.currentTarget
  if (img.dataset.fallback) return
  img.dataset.fallback = '1'
  img.src = svgFallbackForCategory(g.category, g.color_primary)
}

export default function OutfitStudio({ mode, slots, profile, rails, pools, indices, onSelect }: Props) {
  const { locale, t } = useI18n()

  const avatarUrl = profile?.avatar_optimized_url || profile?.avatar_url || ''

  const activePieces = useMemo(() => {
    const order: SlotKey[] = mode === 'dress'
      ? ['dress', 'shoes', 'bag', 'accessory']
      : ['outerwear', 'top', 'bottom', 'shoes', 'bag', 'accessory']
    return order
      .map((k) => ({ key: k, g: slots[k] }))
      .filter((p) => p.g) as { key: SlotKey; g: Garment }[]
  }, [slots, mode])

  return (
    <div className="studio-card">
      {/* Scène */}
      <div className="studio-canvas">
        <div className="studio-stage">
          {/* Avatar (photo) ou mannequin */}
          {avatarUrl ? (
            <img src={avatarUrl} alt="" className="studio-body-photo" />
          ) : (
            <Mannequin />
          )}

          {/* Pièces posées sur le corps */}
          {activePieces.map(({ key, g }) => {
            if (key === 'shoes' && g.photo_url) {
              return (
                <div key={g.id} className="studio-piece studio-piece-shoes studio-piece-enter">
                  <img src={g.photo_url} alt={g.name} className="shoe-left" onError={(e) => handleImgError(e, g)} />
                  <img src={g.photo_url} alt={g.name} className="shoe-right" onError={(e) => handleImgError(e, g)} />
                </div>
              )
            }
            return (
              <div key={g.id} className={`studio-piece ${pieceClass[key]} studio-piece-enter`}>
                {g.photo_url ? (
                  <img src={g.photo_url} alt={g.name} onError={(e) => handleImgError(e, g)} />
                ) : (
                  <span>{localizeGarmentName(g.name, locale).charAt(0)}</span>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* Rails de sélection */}
      <div className="studio-rail">
        {rails.map((sd) => {
          const pool = pools(sd.cat)
          const count = pool.length
          const idx = indices[sd.key] ?? 0
          const current = pool[idx]
          return (
            <div key={sd.key} className="studio-thumb-group">
              <span>{t(sd.labelKey)}</span>
              <div className="studio-thumb-control">
                <button
                  className="studio-thumb-arrow"
                  onClick={() => count > 0 && onSelect(sd.key, sd.cat, (idx - 1 + count) % count)}
                  aria-label="Previous"
                  disabled={count === 0}
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.25}>
                    <path d="M15 18l-6-6 6-6" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </button>
                <div className="studio-thumb">
                  {current?.photo_url ? (
                    <img src={current.photo_url} alt={current.name} onError={(e) => handleImgError(e, current)} />
                  ) : current ? (
                    <span>{localizeGarmentName(current.name, locale).charAt(0)}</span>
                  ) : (
                    <span>—</span>
                  )}
                  {count > 0 && (
                    <span className="studio-thumb-counter">{idx + 1}/{count}</span>
                  )}
                </div>
                <button
                  className="studio-thumb-arrow"
                  onClick={() => count > 0 && onSelect(sd.key, sd.cat, (idx + 1) % count)}
                  aria-label="Next"
                  disabled={count === 0}
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.25}>
                    <path d="M9 18l6-6-6-6" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </button>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
