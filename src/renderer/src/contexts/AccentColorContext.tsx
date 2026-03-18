import { createContext, useContext, useState, useEffect, type ReactNode } from 'react'

const DEFAULT_ACCENT = '142 71% 45%'

export const ACCENT_PRESETS = [
  { label: 'accentPresets.green', hsl: '142 71% 45%' },
  { label: 'accentPresets.blue', hsl: '217 91% 60%' },
  { label: 'accentPresets.purple', hsl: '263 70% 50%' },
  { label: 'accentPresets.pink', hsl: '330 81% 60%' },
  { label: 'accentPresets.red', hsl: '0 84% 60%' },
  { label: 'accentPresets.orange', hsl: '25 95% 53%' },
  { label: 'accentPresets.cyan', hsl: '186 76% 44%' },
  { label: 'accentPresets.indigo', hsl: '239 84% 67%' }
]

function applyAccentColor(hsl: string) {
  const style = document.documentElement.style
  style.setProperty('--primary', hsl)
  style.setProperty('--ring', hsl)
}

export function hslToHex(hsl: string): string {
  const parts = hsl.split(/\s+/)
  if (parts.length < 3) return '#22c55e'
  const h = parseFloat(parts[0]) / 360
  const s = parseFloat(parts[1]) / 100
  const l = parseFloat(parts[2]) / 100

  const hue2rgb = (p: number, q: number, t: number) => {
    if (t < 0) t += 1
    if (t > 1) t -= 1
    if (t < 1 / 6) return p + (q - p) * 6 * t
    if (t < 1 / 2) return q
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6
    return p
  }

  let r: number, g: number, b: number
  if (s === 0) {
    r = g = b = l
  } else {
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s
    const p = 2 * l - q
    r = hue2rgb(p, q, h + 1 / 3)
    g = hue2rgb(p, q, h)
    b = hue2rgb(p, q, h - 1 / 3)
  }

  const toHex = (n: number) => Math.round(n * 255).toString(16).padStart(2, '0')
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`
}

interface AccentColorContextType {
  accentColor: string
  setAccentColor: (hsl: string) => void
}

const AccentColorContext = createContext<AccentColorContextType>({
  accentColor: DEFAULT_ACCENT,
  setAccentColor: () => {}
})

export function AccentColorProvider({ children }: { children: ReactNode }) {
  const [accentColor, setAccentColorState] = useState(DEFAULT_ACCENT)

  useEffect(() => {
    window.api.settings.get('accentColor').then((val: string | null) => {
      if (val) {
        setAccentColorState(val)
        applyAccentColor(val)
      }
    })
  }, [])

  const setAccentColor = (hsl: string) => {
    setAccentColorState(hsl)
    applyAccentColor(hsl)
    window.api.settings.set('accentColor', hsl)
  }

  return (
    <AccentColorContext.Provider value={{ accentColor, setAccentColor }}>
      {children}
    </AccentColorContext.Provider>
  )
}

export function useAccentColor() {
  return useContext(AccentColorContext)
}
