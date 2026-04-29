import { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import { getCurrentMonth, getPreviousMonth, getNextMonth } from '../lib/date'

export type MonthOffset = 'current' | 'previous' | 'next'

interface DefaultMonthContextType {
  offset: MonthOffset
  setOffset: (offset: MonthOffset) => void
  getDefaultMonth: () => string
  keepMonthOnNavigation: boolean
  setKeepMonthOnNavigation: (enabled: boolean) => void
  sharedMonth: string
  setSharedMonth: (month: string) => void
}

const DefaultMonthContext = createContext<DefaultMonthContextType | undefined>(undefined)

export function DefaultMonthProvider({ children }: { children: ReactNode }) {
  const [offset, setOffsetState] = useState<MonthOffset>('current')
  const [keepMonthOnNavigation, setKeepMonthOnNavigationState] = useState(false)
  const [sharedMonth, setSharedMonth] = useState(getCurrentMonth())

  useEffect(() => {
    window.api.settings.get('defaultMonth').then((saved: string | null) => {
      if (saved) {
        const parsed = JSON.parse(saved)
        if (parsed.offset) {
          setOffsetState(parsed.offset)
          const current = getCurrentMonth()
          if (parsed.offset === 'previous') setSharedMonth(getPreviousMonth(current))
          else if (parsed.offset === 'next') setSharedMonth(getNextMonth(current))
          else setSharedMonth(current)
        }
      }
    })
    window.api.settings.get('keepMonthOnNavigation').then((saved: string | null) => {
      setKeepMonthOnNavigationState(saved === 'true')
    })
  }, [])

  const setOffset = (o: MonthOffset) => {
    setOffsetState(o)
    window.api.settings.set('defaultMonth', JSON.stringify({ offset: o }))
  }

  const setKeepMonthOnNavigation = (enabled: boolean) => {
    setKeepMonthOnNavigationState(enabled)
    window.api.settings.set('keepMonthOnNavigation', String(enabled))
  }

  const getDefaultMonth = (): string => {
    const current = getCurrentMonth()
    if (offset === 'previous') return getPreviousMonth(current)
    if (offset === 'next') return getNextMonth(current)
    return current
  }

  return (
    <DefaultMonthContext.Provider value={{ offset, setOffset, getDefaultMonth, keepMonthOnNavigation, setKeepMonthOnNavigation, sharedMonth, setSharedMonth }}>
      {children}
    </DefaultMonthContext.Provider>
  )
}

export function useDefaultMonth() {
  const context = useContext(DefaultMonthContext)
  if (!context) throw new Error('useDefaultMonth must be used within DefaultMonthProvider')
  return context
}

export function usePageMonth() {
  const context = useDefaultMonth()
  const [localMonth, setLocalMonth] = useState(() => context.getDefaultMonth())

  useEffect(() => {
    if (!context.keepMonthOnNavigation) {
      setLocalMonth(context.getDefaultMonth())
    }
  }, [context.offset, context.keepMonthOnNavigation])

  return context.keepMonthOnNavigation
    ? { month: context.sharedMonth, setMonth: context.setSharedMonth }
    : { month: localMonth, setMonth: setLocalMonth }
}
