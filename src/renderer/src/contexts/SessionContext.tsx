import { createContext, useContext, useState, useEffect, ReactNode } from 'react'

interface SessionContextType {
  isUnlocked: boolean
  hasPassword: boolean
  unlock: (password: string) => Promise<boolean>
  setInitialPassword: (password: string) => Promise<boolean>
  checkPassword: () => Promise<void>
}

const SessionContext = createContext<SessionContextType | undefined>(undefined)

export function SessionProvider({ children }: { children: ReactNode }) {
  const [isUnlocked, setIsUnlocked] = useState(false)
  const [hasPassword, setHasPassword] = useState(false)

  const checkPassword = async () => {
    const has = await window.api.settings.hasPassword()
    setHasPassword(has)
  }

  useEffect(() => {
    checkPassword()
  }, [])

  const unlock = async (password: string): Promise<boolean> => {
    const result = await window.api.settings.verifyPassword(password)
    if (result) {
      setIsUnlocked(true)
    }
    return result
  }

  const setInitialPassword = async (password: string): Promise<boolean> => {
    const result = await window.api.settings.setPassword(password)
    if (result) {
      setHasPassword(true)
      setIsUnlocked(true)
    }
    return result
  }

  return (
    <SessionContext.Provider value={{ isUnlocked, hasPassword, unlock, setInitialPassword, checkPassword }}>
      {children}
    </SessionContext.Provider>
  )
}

export function useSession() {
  const context = useContext(SessionContext)
  if (!context) throw new Error('useSession must be used within SessionProvider')
  return context
}
