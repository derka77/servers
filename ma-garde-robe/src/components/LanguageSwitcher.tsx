import { useState } from 'react'
import { useI18n } from '../i18n/I18nContext'
import type { Locale } from '../i18n/dictionaries'
import { locales } from '../i18n/dictionaries'

export default function LanguageSwitcher() {
  const { locale, setLocale } = useI18n()
  const [isOpen, setIsOpen] = useState(false)

  function handleSelect(l: Locale) {
    setLocale(l)
    setIsOpen(false)
  }

  return (
    <>
      {/* Backdrop: z-40, sits behind the menu, closes on outside tap */}
      {isOpen && (
        <div
          style={{ position: 'fixed', inset: 0, zIndex: 40 }}
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* Container: z-50 so the menu is above the backdrop and stays clickable */}
      <div style={{ position: 'relative', zIndex: 50 }}>
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            padding: '6px 12px',
            borderRadius: '9999px',
            background: 'var(--tc-07)',
            border: '1px solid var(--line)',
            cursor: 'pointer',
          }}
        >
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth={1.5} style={{ color: 'var(--tc-45)' }}>
            <circle cx="12" cy="12" r="10" />
            <path d="M2 12h20M12 2a15 15 0 0 1 0 20M12 2a15 15 0 0 0 0 20" />
          </svg>
          <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--tc)' }}>{locales[locale].flag}</span>
          <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth={2} style={{ color: 'var(--tc-45)', transform: isOpen ? 'rotate(180deg)' : 'none' }}>
            <path d="M6 9l6 6 6-6" />
          </svg>
        </button>

        {isOpen && (
          <div
            style={{
              position: 'absolute',
              top: '100%',
              marginTop: '8px',
              insetInlineEnd: 0,
              minWidth: '140px',
              maxWidth: 'calc(100vw - 2rem)',
              padding: '4px',
              borderRadius: '12px',
              background: '#ffffff',
              border: '1px solid var(--line)',
              boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
              zIndex: 50,
            }}
          >
            {(Object.keys(locales) as Locale[]).map((l) => (
              <button
                key={l}
                type="button"
                onClick={() => handleSelect(l)}
                style={{
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '10px 16px',
                  borderRadius: '8px',
                  border: 'none',
                  background: locale === l ? 'var(--tc-07)' : 'transparent',
                  color: locale === l ? 'var(--tc)' : 'var(--tc-45)',
                  fontWeight: locale === l ? 600 : 400,
                  fontSize: '14px',
                  cursor: 'pointer',
                }}
              >
                <span>{locales[l].label}</span>
                {locale === l && (
                  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth={2} style={{ color: 'var(--tc)' }}>
                    <path d="M5 12l5 5L20 7" />
                  </svg>
                )}
              </button>
            ))}
          </div>
        )}
      </div>
    </>
  )
}
