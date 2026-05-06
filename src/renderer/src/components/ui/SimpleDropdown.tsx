import { useState, useEffect, useLayoutEffect } from 'react'
import { createPortal } from 'react-dom'
import { Check, Star } from 'lucide-react'

interface SimpleDropdownProps {
  anchorRef: React.RefObject<HTMLButtonElement | null>
  dropRef: React.RefObject<HTMLDivElement | null>
  options: { key: string; label: string }[]
  current: string
  onChange: (v: string) => void
  onClose: () => void
  defaultKey?: string | null
  onDefaultChange?: (v: string) => void
  defaultTitle?: string
}

export function SimpleDropdown({ anchorRef, dropRef, options, current, onChange, onClose, defaultKey, onDefaultChange, defaultTitle }: SimpleDropdownProps) {
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
    <div ref={dropRef} data-filter-dropdown="true" className="fixed z-[9999] min-w-[180px] max-w-[min(320px,calc(100vw-16px))] rounded-lg border border-border bg-card p-1.5 shadow-lg"
      style={{ top: pos.top, left: pos.left, visibility: pos.ready ? 'visible' : 'hidden' }}>
      {options.map(opt => (
        <button key={opt.key} type="button"
          onClick={() => onChange(opt.key)}
          className={`group/drop-option flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-sm transition-colors hover:bg-accent hover:text-accent-foreground ${
            current === opt.key ? 'text-primary font-medium bg-primary/5' : 'text-card-foreground'
          }`}>
          <span className="flex h-4 w-4 shrink-0 items-center justify-center">
            {current === opt.key && <Check size={12} />}
          </span>
          <span className="min-w-0 flex-1 whitespace-normal break-words">{opt.label}</span>
          {onDefaultChange && (
            <span
              role="button"
              tabIndex={0}
              title={defaultTitle}
              onClick={event => {
                event.stopPropagation()
                onDefaultChange(opt.key)
              }}
              onKeyDown={event => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault()
                  event.stopPropagation()
                  onDefaultChange(opt.key)
                }
              }}
              className={`flex h-5 w-5 shrink-0 items-center justify-center rounded transition-opacity ${
                defaultKey === opt.key ? 'opacity-100 text-primary' : 'opacity-0 text-muted-foreground group-hover/drop-option:opacity-100 hover:text-primary'
              }`}
            >
              <Star size={13} className={defaultKey === opt.key ? 'fill-primary' : ''} />
            </span>
          )}
        </button>
      ))}
    </div>,
    document.body
  )
}
