import { useI18n } from '../i18n/I18nContext'
import LanguageSwitcher from './LanguageSwitcher'

export default function TopBar() {
  const { t } = useI18n()

  return (
    <div className="sticky top-0 z-50 glass-nav px-5 h-14 flex items-center justify-between" style={{ borderBottom: '1px solid var(--line)' }}>
      {/* Monogramme + nom */}
      <div className="flex items-center gap-2.5">
        <div className="w-8 h-8 rounded-full flex items-center justify-center" style={{ background: 'var(--accent)', color: 'var(--on-accent)' }}>
          <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={1.75}>
            <path d="M8 3L4 6l2 4 2-1.5V21h12V8.5L18 10l2-4-4-3-2 2-2-2-2 2-2-2z" strokeLinejoin="round" />
          </svg>
        </div>
        <span className="text-[17px] title-display" style={{ color: 'var(--ink)' }}>{t('appName')}</span>
      </div>

      <LanguageSwitcher />
    </div>
  )
}
