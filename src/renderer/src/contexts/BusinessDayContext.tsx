import { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import { type BusinessDayConfig, DEFAULT_BUSINESS_DAY_CONFIG } from '../../../../shared/day-utils'

interface BusinessDayContextType {
  businessDayConfig: BusinessDayConfig
  setBusinessDayConfig: (config: BusinessDayConfig) => void
}

const BusinessDayContext = createContext<BusinessDayContextType | undefined>(undefined)

export function BusinessDayProvider({ children }: { children: ReactNode }) {
  const [config, setConfig] = useState<BusinessDayConfig>(DEFAULT_BUSINESS_DAY_CONFIG)

  useEffect(() => {
    window.api.settings.get('businessDayConfig').then((saved: string | null) => {
      if (saved) {
        try {
          const parsed = JSON.parse(saved)
          setConfig({ ...DEFAULT_BUSINESS_DAY_CONFIG, ...parsed })
        } catch { /* keep default */ }
      }
    })
  }, [])

  const setBusinessDayConfig = (newConfig: BusinessDayConfig) => {
    setConfig(newConfig)
    window.api.settings.set('businessDayConfig', JSON.stringify(newConfig))
  }

  return (
    <BusinessDayContext.Provider value={{ businessDayConfig: config, setBusinessDayConfig }}>
      {children}
    </BusinessDayContext.Provider>
  )
}

export function useBusinessDayConfig() {
  const context = useContext(BusinessDayContext)
  if (!context) throw new Error('useBusinessDayConfig must be used within BusinessDayProvider')
  return context
}
