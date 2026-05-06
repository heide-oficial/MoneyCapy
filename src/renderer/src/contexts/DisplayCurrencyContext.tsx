import { createContext, ReactNode, useContext, useEffect, useMemo, useState } from 'react'
import { formatCurrency, formatCurrencyWith } from '../lib/currency'
import { useCurrencySettings, type Currency } from './CurrencySettingsContext'

interface DisplayCurrencyContextType {
  currencies: Currency[]
  baseCurrency: Currency | null
  displayCurrency: Currency | null
  setDisplayCurrencyId: (id: number | null) => void
  formatDisplayCurrency: (value: number) => string
}

const DisplayCurrencyContext = createContext<DisplayCurrencyContextType | undefined>(undefined)

export function DisplayCurrencyProvider({ children }: { children: ReactNode }) {
  const { currencies, baseCurrency } = useCurrencySettings()
  const [displayCurrencyId, setDisplayCurrencyIdState] = useState<number | null>(null)

  useEffect(() => {
    window.api.settings.get('displayCurrencyId').then(saved => {
      if (!saved) return
      const parsed = Number(saved)
      if (!Number.isNaN(parsed)) setDisplayCurrencyIdState(parsed)
    })
  }, [])

  const displayCurrency = useMemo(() => {
    if (displayCurrencyId != null) {
      const selected = currencies.find(currency => currency.id === displayCurrencyId)
      if (selected) return selected
    }
    return null
  }, [baseCurrency, currencies, displayCurrencyId])

  const setDisplayCurrencyId = (id: number | null) => {
    setDisplayCurrencyIdState(id)
    window.api.settings.set('displayCurrencyId', id == null ? '' : String(id))
  }

  const formatDisplayCurrency = (value: number) => {
    if (displayCurrency && displayCurrency.exchangeRate > 0) {
      return formatCurrencyWith(value / displayCurrency.exchangeRate, displayCurrency.symbol)
    }
    if (baseCurrency) return formatCurrencyWith(value, baseCurrency.symbol)
    return formatCurrency(value)
  }

  return (
    <DisplayCurrencyContext.Provider value={{ currencies, baseCurrency, displayCurrency, setDisplayCurrencyId, formatDisplayCurrency }}>
      {children}
    </DisplayCurrencyContext.Provider>
  )
}

export function useDisplayCurrency() {
  const context = useContext(DisplayCurrencyContext)
  if (!context) throw new Error('useDisplayCurrency must be used within DisplayCurrencyProvider')
  return context
}
