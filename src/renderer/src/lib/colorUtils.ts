// ─── Types ───
export interface HSV { h: number; s: number; v: number }
export interface RGB { r: number; g: number; b: number }
export interface HSL { h: number; s: number; l: number }
export interface HSVA extends HSV { a: number }
export interface RGBA extends RGB { a: number }
export interface HSLA extends HSL { a: number }

// ─── Helpers ───
export function clamp(val: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, val))
}

function round(v: number): number {
  return Math.round(v)
}

// ─── HSV ↔ RGB ───
export function hsvToRgb({ h, s, v }: HSV): RGB {
  h = ((h % 360) + 360) % 360
  s = s / 100
  v = v / 100
  const c = v * s
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1))
  const m = v - c
  let r = 0, g = 0, b = 0
  if (h < 60) { r = c; g = x; b = 0 }
  else if (h < 120) { r = x; g = c; b = 0 }
  else if (h < 180) { r = 0; g = c; b = x }
  else if (h < 240) { r = 0; g = x; b = c }
  else if (h < 300) { r = x; g = 0; b = c }
  else { r = c; g = 0; b = x }
  return {
    r: round((r + m) * 255),
    g: round((g + m) * 255),
    b: round((b + m) * 255)
  }
}

export function rgbToHsv({ r, g, b }: RGB): HSV {
  r /= 255; g /= 255; b /= 255
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const d = max - min
  let h = 0
  if (d !== 0) {
    if (max === r) h = 60 * (((g - b) / d) % 6)
    else if (max === g) h = 60 * ((b - r) / d + 2)
    else h = 60 * ((r - g) / d + 4)
  }
  if (h < 0) h += 360
  const s = max === 0 ? 0 : (d / max) * 100
  const v = max * 100
  return { h: round(h), s: round(s), v: round(v) }
}

// ─── RGB ↔ HSL ───
export function rgbToHsl({ r, g, b }: RGB): HSL {
  r /= 255; g /= 255; b /= 255
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const l = (max + min) / 2
  let h = 0, s = 0
  if (max !== min) {
    const d = max - min
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
    if (max === r) h = 60 * (((g - b) / d) % 6)
    else if (max === g) h = 60 * ((b - r) / d + 2)
    else h = 60 * ((r - g) / d + 4)
    if (h < 0) h += 360
  }
  return { h: round(h), s: round(s * 100), l: round(l * 100) }
}

export function hslToRgb({ h, s, l }: HSL): RGB {
  h = ((h % 360) + 360) % 360
  s = s / 100
  l = l / 100
  const c = (1 - Math.abs(2 * l - 1)) * s
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1))
  const m = l - c / 2
  let r = 0, g = 0, b = 0
  if (h < 60) { r = c; g = x; b = 0 }
  else if (h < 120) { r = x; g = c; b = 0 }
  else if (h < 180) { r = 0; g = c; b = x }
  else if (h < 240) { r = 0; g = x; b = c }
  else if (h < 300) { r = x; g = 0; b = c }
  else { r = c; g = 0; b = x }
  return {
    r: round((r + m) * 255),
    g: round((g + m) * 255),
    b: round((b + m) * 255)
  }
}

// ─── HEX ───
export function rgbToHex({ r, g, b, a }: RGBA): string {
  const hex = '#' + [r, g, b].map(v => clamp(v, 0, 255).toString(16).padStart(2, '0')).join('')
  if (a !== undefined && a < 1) {
    return hex + round(a * 255).toString(16).padStart(2, '0')
  }
  return hex
}

export function hexToRgba(hex: string): RGBA {
  hex = hex.replace(/^#/, '')
  if (hex.length === 3) {
    hex = hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2]
  }
  if (hex.length === 4) {
    hex = hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2] + hex[3] + hex[3]
  }
  const r = parseInt(hex.substring(0, 2), 16) || 0
  const g = parseInt(hex.substring(2, 4), 16) || 0
  const b = parseInt(hex.substring(4, 6), 16) || 0
  const a = hex.length >= 8 ? parseInt(hex.substring(6, 8), 16) / 255 : 1
  return { r, g, b, a }
}

// ─── Convenience ───
export function hsvToHex(hsva: HSVA): string {
  const rgb = hsvToRgb(hsva)
  return rgbToHex({ ...rgb, a: hsva.a })
}

export function hexToHsva(hex: string): HSVA {
  const rgba = hexToRgba(hex)
  const hsv = rgbToHsv(rgba)
  return { ...hsv, a: rgba.a }
}
