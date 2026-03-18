import { useState, useRef, useEffect, useLayoutEffect } from 'react'
import { createPortal } from 'react-dom'
import { MoreVertical, type LucideIcon } from 'lucide-react'

interface KebabMenuItem {
  label: string
  icon?: LucideIcon
  onClick: () => void
  destructive?: boolean
}

interface KebabMenuProps {
  items: KebabMenuItem[]
  size?: number
  className?: string
}

export function KebabMenu({ items, size = 16, className = '' }: KebabMenuProps) {
  const [open, setOpen] = useState(false)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState({ top: 0, left: 0, ready: false })

  useLayoutEffect(() => {
    if (!open || !triggerRef.current) return
    const rect = triggerRef.current.getBoundingClientRect()
    const dropdownHeight = items.length * 36 + 8
    const spaceBelow = window.innerHeight - rect.bottom
    const openAbove = spaceBelow < dropdownHeight && rect.top > spaceBelow

    setPos({
      top: openAbove ? rect.top - dropdownHeight - 4 : rect.bottom + 4,
      left: rect.right - 160,
      ready: true
    })
  }, [open, items.length])

  useEffect(() => {
    if (!open) return
    const handleClick = (e: MouseEvent) => {
      const target = e.target as Node
      if (triggerRef.current?.contains(target)) return
      if (dropdownRef.current?.contains(target)) return
      setOpen(false)
    }
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    document.addEventListener('keydown', handleKey)
    return () => {
      document.removeEventListener('mousedown', handleClick)
      document.removeEventListener('keydown', handleKey)
    }
  }, [open])

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={e => { e.stopPropagation(); setOpen(!open) }}
        className={`inline-flex items-center justify-center h-7 w-7 rounded-md transition-colors hover:bg-accent ${className}`}
      >
        <MoreVertical size={size} className="text-muted-foreground" />
      </button>

      {open && createPortal(
        <div
          ref={dropdownRef}
          className="fixed z-[9999] min-w-[160px] rounded-md border border-border bg-card shadow-lg py-1"
          style={{ top: pos.top, left: pos.left, visibility: pos.ready ? 'visible' : 'hidden' }}
        >
          {items.map((item, i) => {
            const Icon = item.icon
            return (
              <button
                key={i}
                type="button"
                onClick={() => { item.onClick(); setOpen(false) }}
                className={`flex w-full items-center gap-2 px-3 py-2 text-sm transition-colors hover:bg-accent ${
                  item.destructive ? 'text-destructive hover:text-destructive' : 'text-card-foreground'
                }`}
              >
                {Icon && <Icon size={14} />}
                {item.label}
              </button>
            )
          })}
        </div>,
        document.body
      )}
    </>
  )
}
