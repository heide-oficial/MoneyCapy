import { createContext, useContext, useState, useEffect, type ReactNode } from 'react'

type ColorMode = 'preset' | 'custom'

export const ENTITY_PALETTE = [
  '#3b82f6', '#22c55e', '#f59e0b', '#ef4444', '#8b5cf6',
  '#ec4899', '#06b6d4', '#f97316', '#14b8a6', '#6366f1',
  '#84cc16', '#e11d48', '#0ea5e9', '#d946ef', '#64748b'
]

interface ColorModeContextType {
  colorMode: ColorMode
  setColorMode: (mode: ColorMode) => void
  resolveEntityColor: (storedColor: string, index: number) => string
}

const ColorModeContext = createContext<ColorModeContextType>({
  colorMode: 'preset',
  setColorMode: () => {},
  resolveEntityColor: (_storedColor, index) => ENTITY_PALETTE[index % ENTITY_PALETTE.length]
})

export function ColorModeProvider({ children }: { children: ReactNode }) {
  const [colorMode, setColorModeState] = useState<ColorMode>('preset')

  useEffect(() => {
    window.api.settings.get('colorMode').then((val: string | null) => {
      if (val === 'preset' || val === 'custom') {
        setColorModeState(val)
      }
    })
  }, [])

  const setColorMode = (mode: ColorMode) => {
    setColorModeState(mode)
    window.api.settings.set('colorMode', mode)
  }

  const resolveEntityColor = (storedColor: string, index: number): string => {
    if (colorMode === 'custom') return storedColor
    return ENTITY_PALETTE[index % ENTITY_PALETTE.length]
  }

  return (
    <ColorModeContext.Provider value={{ colorMode, setColorMode, resolveEntityColor }}>
      {children}
    </ColorModeContext.Provider>
  )
}

export function useColorMode() {
  return useContext(ColorModeContext)
}
