import { useState, useRef, useEffect, useCallback, useMemo } from 'react'
import { useI18n } from '../i18n/I18nContext'
import { localizeGarmentName } from '../lib/clothingDictionary'
import { svgFallbackForCategory } from '../lib/demoWardrobe'
import type { Garment } from '../types'

interface Props {
  garments: Garment[]
  selectedIndex: number
  onSelect: (index: number) => void
  label: string
  isRTL: boolean
  compact?: boolean
  emptyMessage?: string
}

export default function GarmentCarousel({ garments, selectedIndex, onSelect, label, isRTL, compact, emptyMessage }: Props) {
  const { locale } = useI18n()
  const scrollRef = useRef<HTMLDivElement>(null)
  const [focused, setFocused] = useState(false)
  const holdTimer = useRef<ReturnType<typeof setInterval> | null>(null)
  const holdTimeout = useRef<ReturnType<typeof setTimeout> | null>(null)
  const isHolding = useRef(false)

  const count = garments.length

  const direction = isRTL ? -1 : 1

  const step = useCallback((delta: number) => {
    if (count === 0) return
    const next = (selectedIndex + delta * direction + count) % count
    onSelect(next)
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      try { navigator.vibrate(15) } catch { /* ignore */ }
    }
  }, [count, selectedIndex, onSelect, direction])

  const goPrev = useCallback(() => step(-1), [step])
  const goNext = useCallback(() => step(1), [step])

  // Scroll the container so the selected item is centered
  useEffect(() => {
    const container = scrollRef.current
    if (!container || count === 0) return
    const child = container.children[selectedIndex] as HTMLElement | undefined
    if (!child) return
    const target = child.offsetLeft - (container.offsetWidth - child.offsetWidth) / 2
    container.scrollTo({ left: target, behavior: 'smooth' })
  }, [selectedIndex, count])

  // Keyboard navigation when focused
  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'ArrowLeft') { e.preventDefault(); goPrev() }
    else if (e.key === 'ArrowRight') { e.preventDefault(); goNext() }
  }

  // Mouse wheel — vertical or horizontal wheel scrolls horizontally
  function handleWheel(e: React.WheelEvent) {
    if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
      e.preventDefault()
      const container = scrollRef.current
      if (container) container.scrollLeft += e.deltaY
    }
  }

  // Press-and-hold on arrow = continuous fast scroll
  function startHold(dir: 'prev' | 'next') {
    isHolding.current = true
    // immediate first step
    dir === 'prev' ? goPrev() : goNext()
    // start repeating after a short delay
    holdTimeout.current = setTimeout(() => {
      holdTimer.current = setInterval(() => {
        if (isHolding.current) {
          dir === 'prev' ? goPrev() : goNext()
        }
      }, 80)
    }, 300)
  }

  function stopHold() {
    isHolding.current = false
    if (holdTimer.current) { clearInterval(holdTimer.current); holdTimer.current = null }
    if (holdTimeout.current) { clearTimeout(holdTimeout.current); holdTimeout.current = null }
  }

  // Cleanup on unmount
  useEffect(() => stopHold, [])

  // Touch swipe support
  const touchStartX = useRef(0)
  const touchStartScroll = useRef(0)
  const [isSwiping, setIsSwiping] = useState(false)

  function handleTouchStart(e: React.TouchEvent) {
    touchStartX.current = e.touches[0].clientX
    touchStartScroll.current = scrollRef.current?.scrollLeft ?? 0
    setIsSwiping(true)
  }

  function handleTouchEnd(e: React.TouchEvent) {
    if (!isSwiping) return
    setIsSwiping(false)
    const delta = e.changedTouches[0].clientX - touchStartX.current
    const threshold = 40
    if (Math.abs(delta) > threshold) {
      // In RTL, swipe right = previous, swipe left = next (reversed)
      if (isRTL) {
        if (delta > threshold) goNext()
        else if (delta < -threshold) goPrev()
      } else {
        if (delta < -threshold) goNext()
        else if (delta > threshold) goPrev()
      }
    }
  }

  const arrowSize = compact ? 'w-8 h-8' : 'w-10 h-10'
  const iconSize = compact ? 'w-4 h-4' : 'w-[18px] h-[18px]'
  const itemSize = compact ? 'w-[76px] h-[76px]' : 'w-[108px] h-[140px]'
  const placeholderSize = compact ? 'w-[76px] h-[76px]' : 'w-[108px] h-[140px]'

  const counter = count > 0 ? `${selectedIndex + 1}/${count}` : '0/0'

  if (count === 0) {
    return (
      <div className="flex flex-col items-center">
        <div className="kicker mb-2">{label}</div>
        <div className={`flex items-center justify-center ${placeholderSize} rounded-2xl`}
          style={{ background: 'var(--surface-2)', border: '1.5px dashed var(--line-strong)' }}>
          <span className="text-[11px] font-sans text-center px-2" style={{ color: 'var(--ink-3)' }}>
            {emptyMessage || '—'}
          </span>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col items-center select-none">
      <div className="flex items-center justify-between w-full mb-2 px-1">
        <span className="kicker">{label}</span>
        <span className="text-[11px] font-sans num" style={{ color: 'var(--ink-3)' }}>{counter}</span>
      </div>
      <div className="flex items-center gap-2 w-full">
        {/* Left arrow — always visible */}
        <button
          onPointerDown={(e) => { e.preventDefault(); startHold('prev') }}
          onPointerUp={stopHold}
          onPointerLeave={stopHold}
          onPointerCancel={stopHold}
          aria-label="Previous"
          className={`${arrowSize} icon-btn flex-shrink-0`}
        >
          <svg viewBox="0 0 24 24" className={iconSize} fill="none" stroke="currentColor" strokeWidth={2.5}>
            <path d="M15 18l-6-6 6-6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>

        {/* Carousel viewport */}
        <div
          ref={scrollRef}
          tabIndex={0}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          onKeyDown={handleKeyDown}
          onWheel={handleWheel}
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
          className="flex-1 overflow-x-auto no-scrollbar flex items-center gap-2.5 py-2 px-1 rounded-2xl outline-none transition-all duration-150"
          style={{ boxShadow: focused ? '0 0 0 2px var(--tc-20)' : 'none' }}
        >
          {garments.map((g, i) => {
            const isSelected = i === selectedIndex
            return (
              <button
                key={g.id}
                onClick={() => onSelect(i)}
                className={`carousel-item ${itemSize} ${isSelected ? 'carousel-item-selected' : 'carousel-item-idle'} ${isSwiping ? 'pointer-events-none' : ''}`}
              >
                {g.photo_url ? (
                  <img
                    src={g.photo_url}
                    alt={g.name}
                    loading="lazy"
                    className="w-full h-full object-contain"
                    onError={(e) => {
                      const img = e.currentTarget
                      if (img.dataset.fallback) return
                      img.dataset.fallback = '1'
                      img.src = svgFallbackForCategory(g.category, g.color_primary)
                    }}
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <svg viewBox="0 0 24 24" className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth={1.5} style={{ color: 'var(--tc-20)' }}>
                      <path d="M8 3L4 6l2 4 2-1.5V21h12V8.5L18 10l2-4-4-3-2 2-2-2-2 2-2-2z" strokeLinejoin="round" />
                    </svg>
                  </div>
                )}
              </button>
            )
          })}
        </div>

        {/* Right arrow — always visible */}
        <button
          onPointerDown={(e) => { e.preventDefault(); startHold('next') }}
          onPointerUp={stopHold}
          onPointerLeave={stopHold}
          onPointerCancel={stopHold}
          aria-label="Next"
          className={`${arrowSize} icon-btn flex-shrink-0`}
        >
          <svg viewBox="0 0 24 24" className={iconSize} fill="none" stroke="currentColor" strokeWidth={2.5}>
            <path d="M9 18l6-6-6-6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      </div>
      {/* Selected garment name */}
      {garments[selectedIndex] && (
        <p className="text-[12px] font-sans font-medium mt-2 truncate max-w-[220px] text-center" style={{ color: 'var(--ink)' }}>
          {localizeGarmentName(garments[selectedIndex].name, locale)}
        </p>
      )}
    </div>
  )
}
