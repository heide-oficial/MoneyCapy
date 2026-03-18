import { createContext, useContext, useState, useEffect, type ReactNode } from 'react'

export type FilterDisplayMode = 'unified' | 'primary-more' | 'compact'

interface FilterDisplayModeContextType {
  filterDisplayMode: FilterDisplayMode
  setFilterDisplayMode: (val: FilterDisplayMode) => void
}

const FilterDisplayModeContext = createContext<FilterDisplayModeContextType>({
  filterDisplayMode: 'unified',
  setFilterDisplayMode: () => {}
})

export function FilterDisplayModeProvider({ children }: { children: ReactNode }) {
  const [filterDisplayMode, setModeState] = useState<FilterDisplayMode>('unified')

  useEffect(() => {
    window.api.settings.get('filterDisplayMode').then((val: string | null) => {
      if (val === 'primary-more' || val === 'compact') setModeState(val)
    })
  }, [])

  const setFilterDisplayMode = (val: FilterDisplayMode) => {
    setModeState(val)
    window.api.settings.set('filterDisplayMode', val)
  }

  return (
    <FilterDisplayModeContext.Provider value={{ filterDisplayMode, setFilterDisplayMode }}>
      {children}
    </FilterDisplayModeContext.Provider>
  )
}

export function useFilterDisplayMode() {
  return useContext(FilterDisplayModeContext)
}
