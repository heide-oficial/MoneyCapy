import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react'

// ── Types ──

type NestedRecord = { [key: string]: string | string[] | NestedRecord }

interface LanguageContextValue {
  language: string
  setLanguage: (lang: string) => void
  availableLanguages: { code: string; label: string }[]
  t: (key: string, params?: Record<string, string | number>) => string
}

// ── Load all locale JSON files at build time ──

const localeModules = import.meta.glob('../locales/*.json', { eager: true }) as Record<string, { default: NestedRecord }>

const locales: Record<string, NestedRecord> = {}
const availableLanguages: { code: string; label: string }[] = []

for (const path in localeModules) {
  const code = path.replace('../locales/', '').replace('.json', '')
  const data = localeModules[path].default
  locales[code] = data
  availableLanguages.push({ code, label: (data._label as string) || code })
}

// Sort so pt-BR comes first
availableLanguages.sort((a, b) => {
  if (a.code === 'pt-BR') return -1
  if (b.code === 'pt-BR') return 1
  return a.label.localeCompare(b.label)
})

// ── Helpers ──

function resolve(obj: NestedRecord, key: string): string | undefined {
  const parts = key.split('.')
  let current: any = obj
  for (const part of parts) {
    if (current == null || typeof current !== 'object') return undefined
    current = current[part]
  }
  if (typeof current === 'string') return current
  if (Array.isArray(current)) return current.join(', ')
  return undefined
}

function interpolate(template: string, params: Record<string, string | number>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, k) => String(params[k] ?? `{{${k}}}`))
}

// ── Context ──

const LanguageContext = createContext<LanguageContextValue | null>(null)

const DEFAULT_LANG = 'pt-BR'

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState(DEFAULT_LANG)
  const [ready, setReady] = useState(false)

  // Load persisted language on mount
  useEffect(() => {
    window.api.settings.get('language').then((saved: string | null) => {
      if (saved && locales[saved]) {
        setLanguageState(saved)
      }
      setReady(true)
    })
  }, [])

  const setLanguage = useCallback((lang: string) => {
    if (locales[lang]) {
      setLanguageState(lang)
      window.api.settings.set('language', lang)
    }
  }, [])

  const t = useCallback((key: string, params?: Record<string, string | number>): string => {
    // Try current language
    let value = resolve(locales[language] || {}, key)
    // Fallback to pt-BR
    if (value === undefined && language !== DEFAULT_LANG) {
      value = resolve(locales[DEFAULT_LANG] || {}, key)
    }
    // Fallback to key itself
    if (value === undefined) return key

    return params ? interpolate(value, params) : value
  }, [language])

  // Expose a helper to get arrays (months, weekdays)
  const contextValue: LanguageContextValue = { language, setLanguage, availableLanguages, t }

  if (!ready) return null

  return (
    <LanguageContext.Provider value={contextValue}>
      {children}
    </LanguageContext.Provider>
  )
}

export function useTranslation() {
  const ctx = useContext(LanguageContext)
  if (!ctx) throw new Error('useTranslation must be used within LanguageProvider')
  return ctx
}

/**
 * Get a locale array (e.g. months.full, weekdays.short).
 * Falls back to pt-BR then returns empty array.
 */
export function useLocaleArray(key: string): string[] {
  const { language } = useTranslation()

  const getRawArray = (lang: string): string[] | null => {
    const parts = key.split('.')
    let current: any = locales[lang] || {}
    for (const part of parts) {
      if (current == null || typeof current !== 'object') return null
      current = current[part]
    }
    return Array.isArray(current) ? current : null
  }

  return getRawArray(language) ?? getRawArray(DEFAULT_LANG) ?? []
}
