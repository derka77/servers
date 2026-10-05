import { useState, useRef, useEffect, useMemo } from 'react'

export interface DropdownOption {
  value: string
  label: string
}

interface Props {
  value: string
  options: DropdownOption[]
  onChange: (value: string) => void
  placeholder?: string
}

export default function Dropdown({ value, options, onChange, placeholder = '—' }: Props) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [highlightIdx, setHighlightIdx] = useState(0)
  const containerRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)

  const selectedLabel = useMemo(() => {
    const opt = options.find((o) => o.value === value)
    return opt ? opt.label : ''
  }, [options, value])

  const filtered = useMemo(() => {
    if (!query.trim()) return options
    const q = query.toLowerCase()
    return options.filter((o) => o.label.toLowerCase().includes(q))
  }, [options, query])

  useEffect(() => {
    if (open) {
      setQuery('')
      setHighlightIdx(0)
      setTimeout(() => inputRef.current?.focus(), 50)
    }
  }, [open])

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    if (open) document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [open])

  useEffect(() => {
    if (!open || !listRef.current) return
    const el = listRef.current.children[highlightIdx] as HTMLElement
    el?.scrollIntoView({ block: 'nearest' })
  }, [highlightIdx, open])

  function selectOption(val: string) {
    onChange(val)
    setOpen(false)
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setHighlightIdx((i) => Math.min(i + 1, filtered.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setHighlightIdx((i) => Math.max(i - 1, 0))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      if (filtered[highlightIdx]) selectOption(filtered[highlightIdx].value)
    } else if (e.key === 'Escape') {
      e.preventDefault()
      setOpen(false)
    }
  }

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="input-field text-left flex items-center justify-between"
        style={{ cursor: 'pointer' }}
      >
        <span style={{ color: selectedLabel ? 'var(--ink)' : 'var(--ink-3)' }}>
          {selectedLabel || placeholder}
        </span>
        <svg
          viewBox="0 0 24 24"
          className={`w-4 h-4 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          style={{ color: 'var(--tc-30)' }}
        >
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>

      {open && (
        <div
          className="absolute left-0 right-0 mt-1 rounded-xl shadow-lg z-30 overflow-hidden animate-scale-in"
          style={{
            background: 'rgba(255,255,255,0.98)',
            backdropFilter: 'blur(16px)',
            border: '1px solid var(--line)',
          }}
        >
          <div className="p-2" style={{ borderBottom: '1px solid var(--line)' }}>
            <input
              ref={inputRef}
              value={query}
              onChange={(e) => { setQuery(e.target.value); setHighlightIdx(0) }}
              onKeyDown={handleKeyDown}
              placeholder="Rechercher..."
              className="w-full px-3 py-1.5 rounded-lg text-sm font-sans"
              style={{
                background: 'var(--tc-04)',
                border: '1px solid var(--line)',
                color: 'var(--tc)',
                outline: 'none',
              }}
            />
          </div>
          <div ref={listRef} className="max-h-60 overflow-y-auto py-1">
            {filtered.length === 0 ? (
              <p className="text-sm font-sans px-4 py-2.5" style={{ color: 'var(--tc-30)' }}>
                Aucun résultat
              </p>
            ) : (
              filtered.map((opt, i) => {
                const isSelected = opt.value === value
                const isHighlighted = i === highlightIdx
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => selectOption(opt.value)}
                    onMouseEnter={() => setHighlightIdx(i)}
                    className="w-full text-left px-4 py-2.5 transition-all duration-100"
                    style={{
                      color: 'var(--tc)',
                      background: isSelected
                        ? 'var(--tc-07)'
                        : isHighlighted
                          ? 'var(--tc-04)'
                          : 'transparent',
                      fontWeight: isSelected ? 600 : 400,
                    }}
                  >
                    <span className="text-sm font-sans">{opt.label}</span>
                    {isSelected && (
                      <svg
                        viewBox="0 0 24 24"
                        className="w-3.5 h-3.5 inline-block ml-2"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth={2.5}
                        style={{ color: 'var(--tc)' }}
                      >
                        <path d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </button>
                )
              })
            )}
          </div>
        </div>
      )}
    </div>
  )
}
