import { createContext, useContext, useState, useEffect, type ReactNode } from 'react'

interface DimPaidContextType {
  dimPaid: boolean
  setDimPaid: (val: boolean) => void
}

const DimPaidContext = createContext<DimPaidContextType>({
  dimPaid: true,
  setDimPaid: () => {}
})

export function DimPaidProvider({ children }: { children: ReactNode }) {
  const [dimPaid, setDimPaidState] = useState(true)

  useEffect(() => {
    window.api.settings.get('dimPaid').then((val: string | null) => {
      if (val === 'false') setDimPaidState(false)
    })
  }, [])

  const setDimPaid = (val: boolean) => {
    setDimPaidState(val)
    window.api.settings.set('dimPaid', String(val))
  }

  return (
    <DimPaidContext.Provider value={{ dimPaid, setDimPaid }}>
      {children}
    </DimPaidContext.Provider>
  )
}

export function useDimPaid() {
  return useContext(DimPaidContext)
}
