import { useState, useEffect, useLayoutEffect } from 'react'
import { createPortal } from 'react-dom'
import { Check } from 'lucide-react'

interface SimpleDropdownProps {
  anchorRef: React.RefObject<HTMLButtonElement | null>
  dropRef: React.RefObject<HTMLDivElement | null>
  options: { key: string; label: string }[]
  current: string
  onChange: (v: string) => void
  onClose: () => void
}

export function SimpleDropdown({ anchorRef, dropRef, options, current, onChange, onClose }: SimpleDropdownProps) {
  const [pos, setPos] = useState({ top: 0, left: 0, ready: false })

  useLayoutEffect(() => {
    if (!anchorRef.current || !dropRef.current) return
    const anchor = anchorRef.current.getBoundingClientRect()
    const drop = dropRef.current.getBoundingClientRect()
    let top = anchor.bottom + 4, left = anchor.left
    if (left + drop.width > window.innerWidth) left = window.innerWidth - drop.width - 8
    if (top + drop.height > window.innerHeight) top = anchor.top - drop.height - 4
    if (left < 8) left = 8
    if (top < 8) top = 8
    setPos({ top, left, ready: true })
  }, [anchorRef])

  useEffect(() => {
    const handle = (e: MouseEvent) => {
      const target = e.target as Node
      if (anchorRef.current?.contains(target)) return
      if (dropRef.current?.contains(target)) return
      onClose()
    }
    const handleKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('mousedown', handle)
    document.addEventListener('keydown', handleKey)
    return () => { document.removeEventListener('mousedown', handle); document.removeEventListener('keydown', handleKey) }
  }, [anchorRef, dropRef, onClose])

  return createPortal(
    <div ref={dropRef} data-filter-dropdown="true" className="fixed z-[9999] rounded-md border border-border bg-card shadow-lg py-1 min-w-[160px]"
      style={{ top: pos.top, left: pos.left, visibility: pos.ready ? 'visible' : 'hidden' }}>
      {options.map(opt => (
        <button key={opt.key} type="button"
          onClick={() => onChange(opt.key)}
          className={`flex w-full items-center gap-2 px-3 py-1.5 text-sm transition-colors hover:bg-accent hover:text-accent-foreground ${
            current === opt.key ? 'text-primary font-medium bg-primary/5' : 'text-card-foreground'
          }`}>
          {current === opt.key && <Check size={12} />}
          <span className={current !== opt.key ? 'ml-5' : ''}>{opt.label}</span>
        </button>
      ))}
    </div>,
    document.body
  )
}
