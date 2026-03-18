import { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import { getCurrentMonth, getPreviousMonth, getNextMonth } from '../lib/date'

export type MonthOffset = 'current' | 'previous' | 'next'

interface DefaultMonthContextType {
  offset: MonthOffset
  setOffset: (offset: MonthOffset) => void
  getDefaultMonth: () => string
}

const DefaultMonthContext = createContext<DefaultMonthContextType | undefined>(undefined)

export function DefaultMonthProvider({ children }: { children: ReactNode }) {
  const [offset, setOffsetState] = useState<MonthOffset>('current')

  useEffect(() => {
    window.api.settings.get('defaultMonth').then((saved: string | null) => {
      if (saved) {
        const parsed = JSON.parse(saved)
        if (parsed.offset) setOffsetState(parsed.offset)
      }
    })
  }, [])

  const setOffset = (o: MonthOffset) => {
    setOffsetState(o)
    window.api.settings.set('defaultMonth', JSON.stringify({ offset: o }))
  }

  const getDefaultMonth = (): string => {
    const current = getCurrentMonth()
    if (offset === 'previous') return getPreviousMonth(current)
    if (offset === 'next') return getNextMonth(current)
    return current
  }

  return (
    <DefaultMonthContext.Provider value={{ offset, setOffset, getDefaultMonth }}>
      {children}
    </DefaultMonthContext.Provider>
  )
}

export function useDefaultMonth() {
  const context = useContext(DefaultMonthContext)
  if (!context) throw new Error('useDefaultMonth must be used within DefaultMonthProvider')
  return context
}
