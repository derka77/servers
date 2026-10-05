import { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import { Locale, locales, dictionaries } from './dictionaries'

interface I18nContextValue {
  locale: Locale
  setLocale: (l: Locale) => void
  t: (key: string) => string
  dir: 'ltr' | 'rtl'
}

const I18nContext = createContext<I18nContextValue | null>(null)

const STORAGE_KEY = 'wardrobe_locale'

function getInitialLocale(): Locale {
  if (typeof window === 'undefined') return 'fr'
  const stored = localStorage.getItem(STORAGE_KEY) as Locale | null
  if (stored && locales[stored]) return stored
  const browser = navigator.language.slice(0, 2) as Locale
  if (locales[browser]) return browser
  return 'fr'
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(getInitialLocale)

  const setLocale = (l: Locale) => {
    setLocaleState(l)
    localStorage.setItem(STORAGE_KEY, l)
  }

  const dir = locales[locale].dir

  useEffect(() => {
    document.documentElement.lang = locale
    document.documentElement.dir = dir
  }, [locale, dir])

  const t = (key: string): string => {
    return dictionaries[locale][key] ?? key
  }

  return (
    <I18nContext.Provider value={{ locale, setLocale, t, dir }}>
      {children}
    </I18nContext.Provider>
  )
}

export function useI18n() {
  const ctx = useContext(I18nContext)
  if (!ctx) throw new Error('useI18n must be used within I18nProvider')
  return ctx
}
