import { useState, useRef, useEffect, useCallback } from 'react'
import { useI18n } from '../i18n/I18nContext'
import { localizeGarmentName } from '../lib/clothingDictionary'
import { svgFallbackForCategory } from '../lib/demoWardrobe'
import { useLabels } from '../lib/labels'
import type { Garment } from '../types'

interface Props {
  garments: Garment[]
  onSelect: (g: Garment) => void
  isRTL: boolean
}

export default function WardrobeCarousel({ garments, onSelect, isRTL }: Props) {
  const { locale } = useI18n()
  const { categoryLabel } = useLabels()
  const scrollRef = useRef<HTMLDivElement>(null)
  const [focused, setFocused] = useState(false)
  const [centerIndex, setCenterIndex] = useState(0)
  const holdTimer = useRef<ReturnType<typeof setInterval> | null>(null)
  const holdTimeout = useRef<ReturnType<typeof setTimeout> | null>(null)
  const isHolding = useRef(false)
  const isProgrammaticScroll = useRef(false)

  const count = garments.length
  const direction = isRTL ? -1 : 1

  // Track scroll position to find the centered item
  useEffect(() => {
    const container = scrollRef.current
    if (!container) return
    let raf = 0
    const onScroll = () => {
      if (isProgrammaticScroll.current) return
      cancelAnimationFrame(raf)
      raf = requestAnimationFrame(() => {
        const children = container.children
        const containerCenter = container.scrollLeft + container.offsetWidth / 2
        let bestIdx = 0
        let bestDist = Infinity
        for (let i = 0; i < children.length; i++) {
          const child = children[i] as HTMLElement
          const childCenter = child.offsetLeft + child.offsetWidth / 2
          const dist = Math.abs(childCenter - containerCenter)
          if (dist < bestDist) { bestDist = dist; bestIdx = i }
        }
        setCenterIndex(bestIdx)
      })
    }
    container.addEventListener('scroll', onScroll, { passive: true })
    return () => { container.removeEventListener('scroll', onScroll); cancelAnimationFrame(raf) }
  }, [])

  // Scroll to center a specific index
  const scrollToIndex = useCallback((idx: number) => {
    const container = scrollRef.current
    if (!container || count === 0) return
    const child = container.children[idx] as HTMLElement | undefined
    if (!child) return
    isProgrammaticScroll.current = true
    const target = child.offsetLeft - (container.offsetWidth - child.offsetWidth) / 2
    container.scrollTo({ left: target, behavior: 'smooth' })
    setCenterIndex(idx)
    setTimeout(() => { isProgrammaticScroll.current = false }, 400)
  }, [count])

  const step = useCallback((delta: number) => {
    if (count === 0) return
    const next = Math.max(0, Math.min(count - 1, centerIndex + delta * direction))
    scrollToIndex(next)
  }, [count, centerIndex, direction, scrollToIndex])

  const goPrev = useCallback(() => step(-1), [step])
  const goNext = useCallback(() => step(1), [step])

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'ArrowLeft') { e.preventDefault(); goPrev() }
    else if (e.key === 'ArrowRight') { e.preventDefault(); goNext() }
    else if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      if (garments[centerIndex]) onSelect(garments[centerIndex])
    }
  }

  function handleWheel(e: React.WheelEvent) {
    if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
      e.preventDefault()
      const container = scrollRef.current
      if (container) container.scrollLeft += e.deltaY
    }
  }

  function startHold(dir: 'prev' | 'next') {
    isHolding.current = true
    dir === 'prev' ? goPrev() : goNext()
    holdTimeout.current = setTimeout(() => {
      holdTimer.current = setInterval(() => {
        if (isHolding.current) {
          dir === 'prev' ? goPrev() : goNext()
        }
      }, 100)
    }, 300)
  }

  function stopHold() {
    isHolding.current = false
    if (holdTimer.current) { clearInterval(holdTimer.current); holdTimer.current = null }
    if (holdTimeout.current) { clearTimeout(holdTimeout.current); holdTimeout.current = null }
  }

  useEffect(() => stopHold, [])

  // Touch swipe
  const touchStartX = useRef(0)
  const [isSwiping, setIsSwiping] = useState(false)

  function handleTouchStart(e: React.TouchEvent) {
    touchStartX.current = e.touches[0].clientX
    setIsSwiping(true)
  }

  function handleTouchEnd(e: React.TouchEvent) {
    if (!isSwiping) return
    setIsSwiping(false)
    const delta = e.changedTouches[0].clientX - touchStartX.current
    const threshold = 50
    if (Math.abs(delta) > threshold) {
      if (isRTL) {
        if (delta > threshold) goNext()
        else if (delta < -threshold) goPrev()
      } else {
        if (delta < -threshold) goNext()
        else if (delta > threshold) goPrev()
      }
    }
  }

  const counter = count > 0 ? `${centerIndex + 1}/${count}` : '0/0'

  if (count === 0) return null

  return (
    <div className="flex flex-col select-none">
      <div className="flex items-center justify-between w-full mb-2 px-1">
        <span className="kicker">
          {count} {locale === 'fr' ? 'pièces' : locale === 'ar' ? 'قطعة' : 'items'}
        </span>
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
          className="icon-btn w-10 h-10 flex-shrink-0"
        >
          <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2.5}>
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
          className="flex-1 overflow-x-auto no-scrollbar flex items-center gap-3 py-3 px-1 rounded-2xl outline-none transition-all duration-150"
          style={{ boxShadow: focused ? '0 0 0 2px var(--tc-20)' : 'none' }}
        >
          {garments.map((g, i) => {
            const isCenter = i === centerIndex
            return (
              <button
                key={g.id}
                onClick={() => { if (!isSwiping) { scrollToIndex(i); onSelect(g) } }}
                className={`carousel-item w-[124px] h-[164px] ${isCenter ? 'carousel-item-selected' : 'carousel-item-idle'} ${isSwiping ? 'pointer-events-none' : ''}`}
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
          className="icon-btn w-10 h-10 flex-shrink-0"
        >
          <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2.5}>
            <path d="M9 18l6-6-6-6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      </div>
      {/* Centered garment info */}
      {garments[centerIndex] && (
        <div className="flex flex-col items-center mt-2">
          <p className="text-[15px] title-display truncate max-w-[240px] text-center" style={{ color: 'var(--ink)' }}>
            {localizeGarmentName(garments[centerIndex].name, locale)}
          </p>
          <p className="text-[11px] font-sans mt-0.5" style={{ color: 'var(--ink-3)' }}>
            {categoryLabel(garments[centerIndex].category)}
            {garments[centerIndex].brand ? ` · ${garments[centerIndex].brand}` : ''}
          </p>
        </div>
      )}
    </div>
  )
}
