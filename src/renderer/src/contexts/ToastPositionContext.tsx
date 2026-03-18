import { createContext, useContext, useState, useEffect, type ReactNode } from 'react'

type ToastPosition = 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left'

interface ToastPositionContextType {
  position: ToastPosition
  setPosition: (pos: ToastPosition) => void
}

const ToastPositionContext = createContext<ToastPositionContextType>({
  position: 'top-right',
  setPosition: () => {}
})

export function ToastPositionProvider({ children }: { children: ReactNode }) {
  const [position, setPositionState] = useState<ToastPosition>('top-right')

  useEffect(() => {
    window.api.settings.get('toastPosition').then((val: string | null) => {
      if (val && ['top-right', 'top-left', 'bottom-right', 'bottom-left'].includes(val)) {
        setPositionState(val as ToastPosition)
      }
    })
  }, [])

  const setPosition = (pos: ToastPosition) => {
    setPositionState(pos)
    window.api.settings.set('toastPosition', pos)
  }

  return (
    <ToastPositionContext.Provider value={{ position, setPosition }}>
      {children}
    </ToastPositionContext.Provider>
  )
}

export function useToastPosition() {
  return useContext(ToastPositionContext)
}
