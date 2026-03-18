import { createContext, useContext, useEffect, useState, ReactNode } from 'react'

export type DateOrder = 'DMY' | 'YMD' | 'MDY'
export type DateSeparator = '/' | '-'

interface DateFormatContextType {
  order: DateOrder
  separator: DateSeparator
  setOrder: (order: DateOrder) => void
  setSeparator: (separator: DateSeparator) => void
}

const DateFormatContext = createContext<DateFormatContextType | undefined>(undefined)

export function DateFormatProvider({ children }: { children: ReactNode }) {
  const [order, setOrderState] = useState<DateOrder>('DMY')
  const [separator, setSeparatorState] = useState<DateSeparator>('/')

  useEffect(() => {
    window.api.settings.get('dateFormat').then((saved: string | null) => {
      if (saved) {
        const parsed = JSON.parse(saved)
        if (parsed.order) setOrderState(parsed.order)
        if (parsed.separator) setSeparatorState(parsed.separator)
      }
    })
  }, [])

  const persist = (o: DateOrder, s: DateSeparator) => {
    window.api.settings.set('dateFormat', JSON.stringify({ order: o, separator: s }))
  }

  const setOrder = (o: DateOrder) => {
    setOrderState(o)
    persist(o, separator)
  }

  const setSeparator = (s: DateSeparator) => {
    setSeparatorState(s)
    persist(order, s)
  }

  return (
    <DateFormatContext.Provider value={{ order, separator, setOrder, setSeparator }}>
      {children}
    </DateFormatContext.Provider>
  )
}

export function useDateFormat() {
  const context = useContext(DateFormatContext)
  if (!context) throw new Error('useDateFormat must be used within DateFormatProvider')
  return context
}
