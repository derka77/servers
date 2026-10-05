import { useI18n } from '../i18n/I18nContext'
import type { Tab } from '../App'

interface NavItem { id: Tab; labelKey: string }

const items: NavItem[] = [
  { id: 'wardrobe', labelKey: 'navWardrobe' },
  { id: 'stylist', labelKey: 'navStylist' },
  { id: 'events', labelKey: 'navEvents' },
  { id: 'profile', labelKey: 'navProfile' },
]

function NavIcon({ id, className, filled }: { id: Tab; className?: string; filled: boolean }) {
  const c = {
    className,
    fill: filled ? 'currentColor' : 'none',
    stroke: 'currentColor',
    strokeWidth: filled ? 1.25 : 1.6,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    viewBox: '0 0 24 24',
  }

  switch (id) {
    case 'wardrobe':
      return (
        <svg {...c}>
          <path d="M20.4 14.5L16 10a2 2 0 0 0-1.5-.7h-5a2 2 0 0 0-1.5.7L3.6 14.5a1 1 0 0 0 .6 1.7l1.8.2v4.1a1 1 0 0 0 1 1h9.5a1 1 0 0 0 1-1v-4.1l1.8-.2a1 1 0 0 0 .6-1.7z" />
          <path d="M9 6.5a3 3 0 0 1 6 0v2.8" fill="none" />
        </svg>
      )
    case 'stylist':
      return (
        <svg {...c}>
          <path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8L12 3z" />
          <path d="M19 14.5l.7 2 2 .7-2 .7-.7 2-.7-2-2-.7 2-.7.7-2z" />
        </svg>
      )
    case 'events':
      return (
        <svg {...c}>
          <rect x="3" y="5" width="18" height="16" rx="3" />
          <path d="M3 10h18M8 3v4M16 3v4" fill="none" stroke={filled ? 'var(--paper)' : 'currentColor'} />
        </svg>
      )
    case 'profile':
      return (
        <svg {...c}>
          <circle cx="12" cy="8" r="3.5" />
          <path d="M5.5 20c0-3.6 2.9-6.5 6.5-6.5s6.5 2.9 6.5 6.5" />
        </svg>
      )
    default:
      return null
  }
}

export default function BottomNav({ active, onChange }: { active: Tab; onChange: (t: Tab) => void }) {
  const { t } = useI18n()

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 pb-safe pointer-events-none">
      <div className="max-w-lg mx-auto px-4 pb-3">
        <div
          className="pointer-events-auto flex items-center justify-between px-2 py-1.5 rounded-[26px]"
          style={{
            background: 'rgba(255,255,255,0.88)',
            backdropFilter: 'saturate(160%) blur(20px)',
            WebkitBackdropFilter: 'saturate(160%) blur(20px)',
            border: '1px solid var(--line)',
            boxShadow: 'var(--shadow-lg)',
          }}
        >
          {items.map((item) => {
            const isActive = active === item.id
            return (
              <button
                key={item.id}
                onClick={() => onChange(item.id)}
                aria-current={isActive ? 'page' : undefined}
                className="relative flex-1 flex flex-col items-center gap-0.5 py-2 rounded-2xl transition-all duration-200"
                style={{
                  color: isActive ? 'var(--accent)' : 'var(--ink-3)',
                  background: isActive ? 'var(--tc-07)' : 'transparent',
                }}
              >
                <NavIcon id={item.id} className={`w-[22px] h-[22px] transition-transform duration-200 ${isActive ? '-translate-y-px' : ''}`} filled={isActive} />
                <span className="text-[10.5px] font-sans" style={{ fontWeight: isActive ? 600 : 500 }}>
                  {t(item.labelKey)}
                </span>
              </button>
            )
          })}
        </div>
      </div>
    </nav>
  )
}
