import type { GarmentStatus } from '../types'

export const STATUS_COLORS: Record<GarmentStatus, string> = {
  available: '#2d8a4e',
  needs_ironing: '#d4920a',
  at_cleaning: '#2c6fb5',
  in_alteration: '#7b3fa0',
}

export function StatusIcon({ status, className }: { status: GarmentStatus; className?: string }) {
  const stroke = STATUS_COLORS[status]
  switch (status) {
    case 'available':
      return (
        <svg viewBox="0 0 24 24" className={className} fill="none" stroke={stroke} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
          <path d="M5 12l5 5L20 7" />
        </svg>
      )
    case 'needs_ironing':
      return (
        <svg viewBox="0 0 24 24" className={className} fill="none" stroke={stroke} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
          <path d="M3 18h18M5 18l2-8h10l4 8M9 10V7h4v3" />
          <path d="M3 21h18" />
        </svg>
      )
    case 'at_cleaning':
      return (
        <svg viewBox="0 0 24 24" className={className} fill="none" stroke={stroke} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
          <path d="M3 8c2 0 2 2 4 2s2-2 4-2 2 2 4 2 2-2 4-2v12H3V8z" />
          <path d="M7 5c1-1 3-1 4 0s3 1 4 0" opacity={0.6} />
        </svg>
      )
    case 'in_alteration':
      return (
        <svg viewBox="0 0 24 24" className={className} fill="none" stroke={stroke} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
          <circle cx="6" cy="6" r="3" />
          <circle cx="6" cy="18" r="3" />
          <path d="M8.5 7.5L20 17M8.5 16.5L20 7" />
        </svg>
      )
  }
}
