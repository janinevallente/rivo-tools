import { createContext, useContext, useState, useEffect, useCallback } from 'react'

const ThemeContext = createContext(null)
const STORAGE_KEY = 'rivo-theme'

function getInitialTheme() {
  if (typeof window === 'undefined') return 'dark'
  const stored = window.localStorage.getItem(STORAGE_KEY)
  if (stored === 'light' || stored === 'dark') return stored
  // Rivo has always shipped as a dark-first app; only default to light
  // when the user's OS explicitly prefers light AND they haven't chosen yet.
  const prefersLight = window.matchMedia?.('(prefers-color-scheme: light)').matches
  return prefersLight ? 'light' : 'dark'
}

export function ThemeProvider({ children }) {
  const [themeMode, setThemeMode] = useState(getInitialTheme)

  useEffect(() => {
    document.documentElement.classList.toggle('dark', themeMode === 'dark')
    window.localStorage.setItem(STORAGE_KEY, themeMode)
  }, [themeMode])

  const toggleTheme = useCallback(() => {
    setThemeMode(mode => (mode === 'dark' ? 'light' : 'dark'))
  }, [])

  return (
    <ThemeContext.Provider value={{ themeMode, setThemeMode, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme() {
  const ctx = useContext(ThemeContext)
  if (!ctx) throw new Error('useTheme must be used within a ThemeProvider')
  return ctx
}
