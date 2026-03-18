import { useState, useRef, useEffect, useMemo, useCallback } from 'react'
import { Modal } from './Modal'
import { Button } from './Button'
import { Pipette } from 'lucide-react'
import {
  type HSVA,
  hsvToRgb, rgbToHsv, rgbToHsl, hslToRgb,
  rgbToHex, hexToHsva, hsvToHex, clamp
} from '../../lib/colorUtils'
import { useTranslation } from '../../contexts/LanguageContext'

interface ColorPickerProps {
  open: boolean
  onClose: () => void
  value: string
  onConfirm: (color: string) => void
}

function drawCheckerboard(ctx: CanvasRenderingContext2D, w: number, h: number, size = 6) {
  for (let y = 0; y < h; y += size) {
    for (let x = 0; x < w; x += size) {
      ctx.fillStyle = ((x / size + y / size) % 2 === 0) ? '#ccc' : '#fff'
      ctx.fillRect(x, y, size, size)
    }
  }
}

export function ColorPicker({ open, value, onClose, onConfirm }: ColorPickerProps) {
  const { t } = useTranslation()
  const [hsva, setHsva] = useState<HSVA>({ h: 0, s: 100, v: 100, a: 1 })
  const [originalColor, setOriginalColor] = useState(value)
  const [dragging, setDragging] = useState<'sat' | 'hue' | 'alpha' | null>(null)
  const [hexInput, setHexInput] = useState('')

  const satCanvasRef = useRef<HTMLCanvasElement>(null)
  const hueCanvasRef = useRef<HTMLCanvasElement>(null)
  const alphaCanvasRef = useRef<HTMLCanvasElement>(null)

  const rgb = useMemo(() => hsvToRgb(hsva), [hsva])
  const hsl = useMemo(() => rgbToHsl(rgb), [rgb])
  const hex = useMemo(() => hsvToHex(hsva), [hsva])

  useEffect(() => {
    if (open) {
      const parsed = hexToHsva(value || '#ff0000')
      setHsva(parsed)
      setOriginalColor(value || '#ff0000')
      setHexInput((value || '#ff0000').replace('#', ''))
    }
  }, [open, value])

  useEffect(() => { setHexInput(hex.replace('#', '')) }, [hex])

  // ─── Sync canvas resolution with display size ───
  const syncAndDraw = useCallback(() => {
    const dpr = window.devicePixelRatio || 1
    for (const ref of [satCanvasRef, hueCanvasRef, alphaCanvasRef]) {
      const canvas = ref.current
      if (!canvas) continue
      const rect = canvas.getBoundingClientRect()
      const w = Math.round(rect.width * dpr)
      const h = Math.round(rect.height * dpr)
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w
        canvas.height = h
      }
    }
  }, [])

  // ─── Draw canvases ───
  const drawSatPanel = useCallback(() => {
    const canvas = satCanvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const w = canvas.width, h = canvas.height

    ctx.fillStyle = `hsl(${hsva.h}, 100%, 50%)`
    ctx.fillRect(0, 0, w, h)
    const wg = ctx.createLinearGradient(0, 0, w, 0)
    wg.addColorStop(0, 'rgba(255,255,255,1)')
    wg.addColorStop(1, 'rgba(255,255,255,0)')
    ctx.fillStyle = wg
    ctx.fillRect(0, 0, w, h)
    const bg = ctx.createLinearGradient(0, 0, 0, h)
    bg.addColorStop(0, 'rgba(0,0,0,0)')
    bg.addColorStop(1, 'rgba(0,0,0,1)')
    ctx.fillStyle = bg
    ctx.fillRect(0, 0, w, h)
  }, [hsva.h])

  const drawHueSlider = useCallback(() => {
    const canvas = hueCanvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const w = canvas.width, h = canvas.height
    ctx.clearRect(0, 0, w, h)
    const grad = ctx.createLinearGradient(0, 0, 0, h)
    ;([[0, '#ff0000'], [1/6, '#ffff00'], [2/6, '#00ff00'], [3/6, '#00ffff'], [4/6, '#0000ff'], [5/6, '#ff00ff'], [1, '#ff0000']] as [number, string][])
      .forEach(([p, c]) => grad.addColorStop(p, c))
    ctx.fillStyle = grad
    ctx.fillRect(0, 0, w, h)
  }, [])

  const drawAlphaSlider = useCallback(() => {
    const canvas = alphaCanvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const w = canvas.width, h = canvas.height
    ctx.clearRect(0, 0, w, h)
    drawCheckerboard(ctx, w, h, Math.max(4, Math.round(w / 4)))
    const grad = ctx.createLinearGradient(0, 0, 0, h)
    const { r, g, b } = hsvToRgb(hsva)
    grad.addColorStop(0, `rgba(${r},${g},${b},1)`)
    grad.addColorStop(1, `rgba(${r},${g},${b},0)`)
    ctx.fillStyle = grad
    ctx.fillRect(0, 0, w, h)
  }, [hsva.h, hsva.s, hsva.v])

  useEffect(() => { drawSatPanel() }, [drawSatPanel])
  useEffect(() => { drawHueSlider() }, [drawHueSlider])
  useEffect(() => { drawAlphaSlider() }, [drawAlphaSlider])

  // Redraw all on open
  useEffect(() => {
    if (!open) return
    const t = setTimeout(() => {
      syncAndDraw()
      drawSatPanel()
      drawHueSlider()
      drawAlphaSlider()
    }, 30)
    return () => clearTimeout(t)
  }, [open, syncAndDraw, drawSatPanel, drawHueSlider, drawAlphaSlider])

  // ─── Pointer interaction ───
  const getPos = (e: React.PointerEvent, el: HTMLCanvasElement) => {
    const r = el.getBoundingClientRect()
    return { x: clamp(e.clientX - r.left, 0, r.width), y: clamp(e.clientY - r.top, 0, r.height), w: r.width, h: r.height }
  }

  const handleSat = (e: React.PointerEvent) => {
    const c = satCanvasRef.current; if (!c) return
    const { x, y, w, h } = getPos(e, c)
    setHsva(p => ({ ...p, s: Math.round((x / w) * 100), v: Math.round((1 - y / h) * 100) }))
  }
  const handleHue = (e: React.PointerEvent) => {
    const c = hueCanvasRef.current; if (!c) return
    const { y, h } = getPos(e, c)
    setHsva(p => ({ ...p, h: Math.round((y / h) * 360) }))
  }
  const handleAlpha = (e: React.PointerEvent) => {
    const c = alphaCanvasRef.current; if (!c) return
    const { y, h } = getPos(e, c)
    setHsva(p => ({ ...p, a: Math.round((1 - y / h) * 100) / 100 }))
  }

  const down = (type: 'sat' | 'hue' | 'alpha', e: React.PointerEvent) => {
    setDragging(type)
    ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
    ;(type === 'sat' ? handleSat : type === 'hue' ? handleHue : handleAlpha)(e)
  }
  const move = (type: 'sat' | 'hue' | 'alpha', e: React.PointerEvent) => {
    if (dragging !== type) return
    ;(type === 'sat' ? handleSat : type === 'hue' ? handleHue : handleAlpha)(e)
  }

  // ─── Input handlers ───
  const handleHexChange = (val: string) => {
    val = val.replace(/[^0-9a-fA-F]/g, '').slice(0, 8)
    setHexInput(val)
    if (val.length === 6 || val.length === 8 || val.length === 3) setHsva(hexToHsva('#' + val))
  }
  const handleRgbChange = (ch: 'r' | 'g' | 'b', val: string) => {
    const n = clamp(parseInt(val) || 0, 0, 255)
    setHsva(p => ({ ...rgbToHsv({ ...rgb, [ch]: n }), a: p.a }))
  }
  const handleAlphaInput = (val: string) => {
    setHsva(p => ({ ...p, a: clamp(parseInt(val) || 0, 0, 100) / 100 }))
  }
  const handleHslChange = (ch: 'h' | 's' | 'l', val: string) => {
    const n = clamp(parseInt(val) || 0, 0, ch === 'h' ? 360 : 100)
    const newHsv = rgbToHsv(hslToRgb({ ...hsl, [ch]: n }))
    if (ch === 'h') newHsv.h = n
    setHsva(p => ({ ...newHsv, a: p.a }))
  }

  const handleEyedropper = async () => {
    try {
      // @ts-ignore
      const r = await new EyeDropper().open()
      if (r?.sRGBHex) setHsva(hexToHsva(r.sRGBHex))
    } catch { /* cancelled */ }
  }

  if (!open) return null

  const checkerBg = 'linear-gradient(45deg,#ccc 25%,transparent 25%,transparent 75%,#ccc 75%),linear-gradient(45deg,#ccc 25%,transparent 25%,transparent 75%,#ccc 75%)'
  const inputCls = 'h-8 text-sm text-center rounded-md border border-input bg-transparent focus:outline-none focus:ring-2 focus:ring-ring tabular-nums'

  return (
    <Modal open={open} onClose={onClose} title={t('colorPicker.title')} maxWidth="max-w-lg">
      <div className="space-y-4">
        {/* Row 1: Sat panel + Hue + Alpha + Preview */}
        <div className="flex gap-3" style={{ height: 220 }}>
          {/* Sat/Brightness panel */}
          <div className="relative shrink-0 rounded-lg overflow-hidden" style={{ width: 220, height: 220 }}>
            <canvas ref={satCanvasRef} className="w-full h-full cursor-crosshair block"
              onPointerDown={e => down('sat', e)} onPointerMove={e => move('sat', e)} onPointerUp={() => setDragging(null)} />
            <div className="absolute pointer-events-none -translate-x-1/2 -translate-y-1/2"
              style={{ left: `${hsva.s}%`, top: `${100 - hsva.v}%`, width: 16, height: 16, borderRadius: '50%', border: '2.5px solid white', boxShadow: '0 0 0 1.5px rgba(0,0,0,.3), inset 0 0 0 1.5px rgba(0,0,0,.3)' }} />
          </div>

          {/* Hue */}
          <div className="relative shrink-0 rounded-lg overflow-hidden" style={{ width: 22, height: 220 }}>
            <canvas ref={hueCanvasRef} className="w-full h-full cursor-pointer block"
              onPointerDown={e => down('hue', e)} onPointerMove={e => move('hue', e)} onPointerUp={() => setDragging(null)} />
            <div className="absolute left-0 pointer-events-none -translate-y-1/2"
              style={{ top: `${(hsva.h / 360) * 100}%`, width: 22, height: 8, borderRadius: 4, border: '2.5px solid white', boxShadow: '0 0 3px rgba(0,0,0,.5)' }} />
          </div>

          {/* Alpha */}
          <div className="relative shrink-0 rounded-lg overflow-hidden" style={{ width: 22, height: 220 }}>
            <canvas ref={alphaCanvasRef} className="w-full h-full cursor-pointer block"
              onPointerDown={e => down('alpha', e)} onPointerMove={e => move('alpha', e)} onPointerUp={() => setDragging(null)} />
            <div className="absolute left-0 pointer-events-none -translate-y-1/2"
              style={{ top: `${(1 - hsva.a) * 100}%`, width: 22, height: 8, borderRadius: 4, border: '2.5px solid white', boxShadow: '0 0 3px rgba(0,0,0,.5)' }} />
          </div>

          {/* Preview + Eyedropper */}
          <div className="flex flex-col gap-2 flex-1 min-w-0">
            <div className="flex-1 flex rounded-lg overflow-hidden border border-border min-h-0">
              <div className="flex-1 relative">
                <div className="absolute inset-0" style={{ backgroundImage: checkerBg, backgroundSize: '10px 10px', backgroundPosition: '0 0, 5px 5px' }} />
                <div className="absolute inset-0" style={{ backgroundColor: originalColor }} />
                <span className="absolute bottom-1 left-1.5 text-[10px] font-semibold text-white mix-blend-difference select-none">{t('colorPicker.current')}</span>
              </div>
              <div className="flex-1 relative">
                <div className="absolute inset-0" style={{ backgroundImage: checkerBg, backgroundSize: '10px 10px', backgroundPosition: '0 0, 5px 5px' }} />
                <div className="absolute inset-0" style={{ backgroundColor: `rgba(${rgb.r},${rgb.g},${rgb.b},${hsva.a})` }} />
                <span className="absolute bottom-1 left-1.5 text-[10px] font-semibold text-white mix-blend-difference select-none">{t('colorPicker.new')}</span>
              </div>
            </div>
            <button type="button" onClick={handleEyedropper}
              className="flex items-center justify-center gap-2 h-8 rounded-md border border-input hover:bg-accent text-sm text-muted-foreground hover:text-foreground transition-colors shrink-0">
              <Pipette size={14} /> {t('colorPicker.eyeDropper')}
            </button>
          </div>
        </div>

        {/* Row 2: HEX */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground font-medium w-8 shrink-0">HEX</span>
          <span className="text-sm text-muted-foreground font-mono">#</span>
          <input type="text" value={hexInput} onChange={e => handleHexChange(e.target.value)}
            className="flex-1 h-8 text-sm px-2 rounded-md border border-input bg-transparent focus:outline-none focus:ring-2 focus:ring-ring font-mono" placeholder="ffffff" />
        </div>

        {/* Row 3: RGB */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground font-medium w-8 shrink-0">RGB</span>
          {(['r', 'g', 'b'] as const).map(ch => (
            <input key={ch} type="number" min={0} max={255} value={rgb[ch]}
              onChange={e => handleRgbChange(ch, e.target.value)} title={ch.toUpperCase()} className={`flex-1 ${inputCls}`} />
          ))}
          <input type="number" min={0} max={100} value={Math.round(hsva.a * 100)}
            onChange={e => handleAlphaInput(e.target.value)} title="A" className={`flex-1 ${inputCls}`} />
        </div>

        {/* Row 4: HSL */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground font-medium w-8 shrink-0">HSL</span>
          {(['h', 's', 'l'] as const).map(ch => (
            <input key={ch} type="number" min={0} max={ch === 'h' ? 360 : 100} value={hsl[ch]}
              onChange={e => handleHslChange(ch, e.target.value)} title={ch.toUpperCase()} className={`flex-1 ${inputCls}`} />
          ))}
          <input type="number" min={0} max={100} value={Math.round(hsva.a * 100)}
            onChange={e => handleAlphaInput(e.target.value)} title="A" className={`flex-1 ${inputCls}`} />
        </div>

        {/* Buttons */}
        <div className="flex justify-end gap-2 pt-1">
          <Button variant="outline" onClick={onClose}>{t('common.cancel')}</Button>
          <Button onClick={() => onConfirm(hex)}>{t('common.confirm')}</Button>
        </div>
      </div>
    </Modal>
  )
}
