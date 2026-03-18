import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react'

export interface GastosFieldVisibility {
  type: boolean
  billingDay: boolean
  dueDay: boolean
  card: boolean
  store: boolean
  category: boolean
  interestRate: boolean
  installments: boolean
}

export interface ReceitasFieldVisibility {
  type: boolean
  dueDay: boolean
}

interface PageFields {
  gastos: GastosFieldVisibility
  receitas: ReceitasFieldVisibility
}

const DEFAULT_GASTOS: GastosFieldVisibility = {
  type: true, billingDay: true, dueDay: true, card: true,
  store: true, category: true, interestRate: true, installments: true
}

const DEFAULT_RECEITAS: ReceitasFieldVisibility = {
  type: true, dueDay: true
}

const DEFAULT_PAGE: PageFields = { gastos: DEFAULT_GASTOS, receitas: DEFAULT_RECEITAS }

type AllPages = Record<string, PageFields>

interface TileFieldsContextType {
  getGastosFields: (page: string) => GastosFieldVisibility
  getReceitasFields: (page: string) => ReceitasFieldVisibility
  setGastosField: (page: string, key: keyof GastosFieldVisibility, val: boolean) => void
  setReceitasField: (page: string, key: keyof ReceitasFieldVisibility, val: boolean) => void
}

const TileFieldsContext = createContext<TileFieldsContextType>({
  getGastosFields: () => DEFAULT_GASTOS,
  getReceitasFields: () => DEFAULT_RECEITAS,
  setGastosField: () => {},
  setReceitasField: () => {}
})

const SETTINGS_KEY = 'tileFieldsVisibility_v2'

export function TileFieldsProvider({ children }: { children: ReactNode }) {
  const [pages, setPages] = useState<AllPages>({})

  useEffect(() => {
    window.api.settings.get(SETTINGS_KEY).then((val: string | null) => {
      if (!val) return
      try {
        const parsed = JSON.parse(val) as AllPages
        const hydrated: AllPages = {}
        for (const [page, fields] of Object.entries(parsed)) {
          hydrated[page] = {
            gastos: { ...DEFAULT_GASTOS, ...(fields.gastos || {}) },
            receitas: { ...DEFAULT_RECEITAS, ...(fields.receitas || {}) }
          }
        }
        setPages(hydrated)
      } catch { /* ignore */ }
    })
  }, [])

  const persist = useCallback((next: AllPages) => {
    window.api.settings.set(SETTINGS_KEY, JSON.stringify(next))
  }, [])

  const getGastosFields = useCallback((page: string) => {
    return pages[page]?.gastos ?? DEFAULT_GASTOS
  }, [pages])

  const getReceitasFields = useCallback((page: string) => {
    return pages[page]?.receitas ?? DEFAULT_RECEITAS
  }, [pages])

  const setGastosField = useCallback((page: string, key: keyof GastosFieldVisibility, val: boolean) => {
    setPages(prev => {
      const pf = prev[page] || { ...DEFAULT_PAGE, gastos: { ...DEFAULT_GASTOS }, receitas: { ...DEFAULT_RECEITAS } }
      const next = { ...prev, [page]: { ...pf, gastos: { ...pf.gastos, [key]: val } } }
      persist(next)
      return next
    })
  }, [persist])

  const setReceitasField = useCallback((page: string, key: keyof ReceitasFieldVisibility, val: boolean) => {
    setPages(prev => {
      const pf = prev[page] || { ...DEFAULT_PAGE, gastos: { ...DEFAULT_GASTOS }, receitas: { ...DEFAULT_RECEITAS } }
      const next = { ...prev, [page]: { ...pf, receitas: { ...pf.receitas, [key]: val } } }
      persist(next)
      return next
    })
  }, [persist])

  return (
    <TileFieldsContext.Provider value={{ getGastosFields, getReceitasFields, setGastosField, setReceitasField }}>
      {children}
    </TileFieldsContext.Provider>
  )
}

export function useTileFields(page: string) {
  const { getGastosFields, getReceitasFields, setGastosField, setReceitasField } = useContext(TileFieldsContext)
  return {
    gastosFields: getGastosFields(page),
    receitasFields: getReceitasFields(page),
    setGastosField: (key: keyof GastosFieldVisibility, val: boolean) => setGastosField(page, key, val),
    setReceitasField: (key: keyof ReceitasFieldVisibility, val: boolean) => setReceitasField(page, key, val)
  }
}
