import { createContext, useContext, useEffect, useState, useCallback, ReactNode } from 'react'
import { setCurrencyConfig } from '../lib/currency'

export interface CurrencyConfig {
  symbol: string
  decimalSep: ',' | '.'
  thousandSep: '.' | ','
}

export interface Currency {
  id: number
  code: string
  name: string
  symbol: string
  exchangeRate: number
  isBase: boolean
}

const DEFAULT_CONFIG: CurrencyConfig = {
  symbol: 'R$',
  decimalSep: ',',
  thousandSep: '.'
}

interface CurrencySettingsContextType {
  config: CurrencyConfig
  updateConfig: (c: CurrencyConfig) => void
  currencies: Currency[]
  baseCurrency: Currency | null
  defaultCurrencyId: number | null
  reloadCurrencies: () => Promise<void>
}

const CurrencySettingsContext = createContext<CurrencySettingsContextType | undefined>(undefined)

export function CurrencySettingsProvider({ children }: { children: ReactNode }) {
  const [config, setConfigState] = useState<CurrencyConfig>(DEFAULT_CONFIG)
  const [currencies, setCurrencies] = useState<Currency[]>([])
  const [baseCurrency, setBaseCurrency] = useState<Currency | null>(null)
  const [defaultCurrencyId, setDefaultCurrencyId] = useState<number | null>(null)

  const loadCurrencies = useCallback(async () => {
    try {
      const list = await window.api.currencies.list()
      setCurrencies(list)
      const base = await window.api.currencies.getBase()
      setBaseCurrency(base)

      const defaultIdStr = await window.api.settings.get('defaultCurrencyId')
      if (defaultIdStr) {
        setDefaultCurrencyId(parseInt(defaultIdStr, 10))
      } else if (base) {
        setDefaultCurrencyId(base.id)
      }
    } catch { /* currencies table might not exist yet */ }
  }, [])

  useEffect(() => {
    window.api.settings.get('currencySettings').then((saved: string | null) => {
      if (saved) {
        try {
          const parsed = JSON.parse(saved)
          const c: CurrencyConfig = {
            symbol: parsed.symbol || DEFAULT_CONFIG.symbol,
            decimalSep: parsed.decimalSep || DEFAULT_CONFIG.decimalSep,
            thousandSep: parsed.thousandSep || DEFAULT_CONFIG.thousandSep
          }
          setConfigState(c)
          setCurrencyConfig(c)
        } catch { /* keep default */ }
      }
    })

    loadCurrencies()

    const cleanup = (window.api as any).currencies.onCurrenciesUpdated(() => {
      loadCurrencies()
    })
    return () => { if (cleanup) cleanup() }
  }, [loadCurrencies])

  const updateConfig = (c: CurrencyConfig) => {
    setConfigState(c)
    setCurrencyConfig(c)
    window.api.settings.set('currencySettings', JSON.stringify(c))
  }

  return (
    <CurrencySettingsContext.Provider value={{
      config,
      updateConfig,
      currencies,
      baseCurrency,
      defaultCurrencyId,
      reloadCurrencies: loadCurrencies
    }}>
      {children}
    </CurrencySettingsContext.Provider>
  )
}

export function useCurrencySettings() {
  const context = useContext(CurrencySettingsContext)
  if (!context) throw new Error('useCurrencySettings must be used within CurrencySettingsProvider')
  return context
}
