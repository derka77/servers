import { createContext, useContext, useState, useEffect, ReactNode } from 'react'

export type ThemeName = 'noir' | 'rose' | 'nude'

interface ThemeContextValue {
  theme: ThemeName
  setTheme: (t: ThemeName) => void
}

const ThemeContext = createContext<ThemeContextValue | null>(null)

const STORAGE_KEY = 'wardrobe_theme'

function getInitialTheme(): ThemeName {
  if (typeof window === 'undefined') return 'noir'
  const stored = localStorage.getItem(STORAGE_KEY) as ThemeName | null
  if (stored && ['noir', 'rose', 'nude'].includes(stored)) return stored
  return 'noir'
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<ThemeName>(getInitialTheme)

  const setTheme = (t: ThemeName) => {
    setThemeState(t)
    localStorage.setItem(STORAGE_KEY, t)
  }

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
  }, [theme])

  return (
    <ThemeContext.Provider value={{ theme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme() {
  const ctx = useContext(ThemeContext)
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider')
  return ctx
}
