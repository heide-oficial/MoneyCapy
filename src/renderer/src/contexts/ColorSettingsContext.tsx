import { createContext, useContext, useEffect, useState, ReactNode, CSSProperties } from 'react'

export type PageKey = 'dashboard' | 'items' | 'income' | 'accounts' | 'cards' | 'categories' | 'stores' | 'tags'
export type SectionKey = 'hero' | 'itens' | 'widgets'

const ALL_PAGES: PageKey[] = ['dashboard', 'items', 'income', 'accounts', 'cards', 'categories', 'stores', 'tags']

interface ColorSettings {
  gastos: string | null
  receitas: string | null
  saldo: string | null
}

type ColorKey = keyof ColorSettings

export type PageSections = Record<SectionKey, boolean>
export type ColorApplyAt = Record<ColorKey, Record<PageKey, PageSections>>

function makeDefaultPage(): PageSections {
  return { hero: true, itens: true, widgets: true }
}

function makeDefaultApply(): ColorApplyAt {
  const pages = {} as Record<PageKey, PageSections>
  for (const p of ALL_PAGES) pages[p] = makeDefaultPage()
  return {
    gastos: JSON.parse(JSON.stringify(pages)),
    receitas: JSON.parse(JSON.stringify(pages)),
    saldo: JSON.parse(JSON.stringify(pages))
  }
}

const DEFAULT_APPLY = makeDefaultApply()

interface ColorSettingsContextType {
  colors: ColorSettings
  applyAt: ColorApplyAt
  setColor: (key: ColorKey, value: string | null) => void
  setApplyAt: (next: ColorApplyAt) => void
  gastosStyle: (page: PageKey, section: SectionKey) => CSSProperties
  receitasStyle: (page: PageKey, section: SectionKey) => CSSProperties
  saldoStyle: (page: PageKey, section: SectionKey, value?: number) => CSSProperties
}

const ColorSettingsContext = createContext<ColorSettingsContextType | undefined>(undefined)

function applyToRoot(key: string, value: string | null) {
  const prop = `--color-${key}`
  if (value) {
    document.documentElement.style.setProperty(prop, value)
  } else {
    document.documentElement.style.removeProperty(prop)
  }
}

/** Migrate old format { dashboard, hero, itens } → per-page format */
function migrateOldApplyAt(old: any): ColorApplyAt {
  const result = makeDefaultApply()
  const colorKeys: ColorKey[] = ['gastos', 'receitas', 'saldo']
  for (const ck of colorKeys) {
    if (!old[ck]) continue
    const oldEntry = old[ck]
    // Old format had { dashboard: bool, hero: bool, itens: bool }
    if ('dashboard' in oldEntry && !('items' in oldEntry)) {
      const widgetsVal = oldEntry.dashboard ?? true
      const heroVal = oldEntry.hero ?? true
      const itensVal = oldEntry.itens ?? true
      for (const p of ALL_PAGES) {
        result[ck][p] = {
          widgets: widgetsVal,
          hero: heroVal,
          itens: itensVal
        }
      }
    } else {
      // Already new format
      for (const p of ALL_PAGES) {
        if (oldEntry[p]) {
          result[ck][p] = {
            hero: oldEntry[p].hero ?? true,
            itens: oldEntry[p].itens ?? true,
            widgets: oldEntry[p].widgets ?? true
          }
        }
      }
    }
  }
  return result
}

export function ColorSettingsProvider({ children }: { children: ReactNode }) {
  const [colors, setColors] = useState<ColorSettings>({ gastos: null, receitas: null, saldo: null })
  const [applyAt, setApplyAtState] = useState<ColorApplyAt>(DEFAULT_APPLY)

  useEffect(() => {
    window.api.settings.get('colorSettings').then((saved: string | null) => {
      if (saved) {
        const parsed = JSON.parse(saved)
        const c: ColorSettings = {
          gastos: parsed.gastos || null,
          receitas: parsed.receitas || null,
          saldo: parsed.saldo || null
        }
        setColors(c)
        applyToRoot('gastos', c.gastos)
        applyToRoot('receitas', c.receitas)
        applyToRoot('saldo', c.saldo)
        if (parsed.applyAt) {
          setApplyAtState(migrateOldApplyAt(parsed.applyAt))
        }
      }
    })
  }, [])

  const persist = (c: ColorSettings, a: ColorApplyAt) => {
    window.api.settings.set('colorSettings', JSON.stringify({ ...c, applyAt: a }))
  }

  const setColor = (key: ColorKey, value: string | null) => {
    const next = { ...colors, [key]: value }
    setColors(next)
    applyToRoot(key, value)
    persist(next, applyAt)
  }

  const setApplyAt = (next: ColorApplyAt) => {
    setApplyAtState(next)
    persist(colors, next)
  }

  const isEnabled = (colorKey: ColorKey, page: PageKey, section: SectionKey): boolean =>
    applyAt[colorKey]?.[page]?.[section] ?? true

  const gastosStyle = (page: PageKey, section: SectionKey): CSSProperties =>
    isEnabled('gastos', page, section) ? { color: 'var(--color-gastos)' } : {}

  const receitasStyle = (page: PageKey, section: SectionKey): CSSProperties =>
    isEnabled('receitas', page, section) ? { color: 'var(--color-receitas)' } : {}

  const saldoStyle = (page: PageKey, section: SectionKey, value?: number): CSSProperties => {
    if (!isEnabled('saldo', page, section)) return {}
    if (value !== undefined && value < 0 && !colors.saldo) {
      return { color: 'hsl(var(--destructive))' }
    }
    return { color: 'var(--color-saldo)' }
  }

  return (
    <ColorSettingsContext.Provider value={{ colors, applyAt, setColor, setApplyAt, gastosStyle, receitasStyle, saldoStyle }}>
      {children}
    </ColorSettingsContext.Provider>
  )
}

export function useColorSettings() {
  const context = useContext(ColorSettingsContext)
  if (!context) throw new Error('useColorSettings must be used within ColorSettingsProvider')
  return context
}
