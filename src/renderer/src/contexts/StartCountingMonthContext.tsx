import { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import { useActivePerson } from './ActivePersonContext'

interface StartCountingMonthContextType {
  startCountingMonth: string | null
  setStartCountingMonth: (month: string | null) => void
}

const StartCountingMonthContext = createContext<StartCountingMonthContextType | undefined>(undefined)

export function StartCountingMonthProvider({ children }: { children: ReactNode }) {
  const { activePerson } = useActivePerson()
  const [startCountingMonth, setStartCountingMonthState] = useState<string | null>(null)

  useEffect(() => {
    if (!activePerson) {
      setStartCountingMonthState(null)
      return
    }
    window.api.settings.get(`start-counting-month-${activePerson.id}`).then((saved: string | null) => {
      setStartCountingMonthState(saved || null)
    })
  }, [activePerson?.id])

  const setStartCountingMonth = (month: string | null) => {
    setStartCountingMonthState(month)
    if (!activePerson) return
    const key = `start-counting-month-${activePerson.id}`
    window.api.settings.set(key, month || '')
  }

  return (
    <StartCountingMonthContext.Provider value={{ startCountingMonth, setStartCountingMonth }}>
      {children}
    </StartCountingMonthContext.Provider>
  )
}

export function useStartCountingMonth() {
  const context = useContext(StartCountingMonthContext)
  if (!context) throw new Error('useStartCountingMonth must be used within StartCountingMonthProvider')
  return context
}
