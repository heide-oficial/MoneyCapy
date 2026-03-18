import { useState, useEffect, useLayoutEffect } from 'react'
import { createPortal } from 'react-dom'
import { useTranslation } from '../../contexts/LanguageContext'

interface FilterDropdownProps<T extends string | number> {
  anchorRef: React.RefObject<HTMLButtonElement | null>
  dropRef: React.RefObject<HTMLDivElement | null>
  onClose: () => void
  items: { id: T; name: string; color: string }[]
  selected: T[]
  onToggle: (id: T) => void
  emptyText?: string
}

export function FilterDropdown<T extends string | number>({ anchorRef, dropRef, onClose, items, selected, onToggle, emptyText }: FilterDropdownProps<T>) {
  const { t } = useTranslation()
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
    <div ref={dropRef} data-filter-dropdown="true" className="fixed z-[9999] rounded-md border border-border bg-card shadow-lg py-1 min-w-[180px] max-h-64 overflow-y-auto"
      style={{ top: pos.top, left: pos.left, visibility: pos.ready ? 'visible' : 'hidden' }}>
      {items.length === 0 ? (
        <p className="px-3 py-4 text-sm text-muted-foreground text-center">{emptyText || t('filters.noOptions')}</p>
      ) : items.map(item => {
        const active = selected.includes(item.id)
        return (
          <button key={String(item.id)} type="button"
            onClick={() => onToggle(item.id)}
            className="flex w-full items-center gap-2 px-3 py-1.5 text-sm transition-colors hover:bg-accent hover:text-accent-foreground">
            <span className={`flex h-4 w-4 items-center justify-center rounded border text-[10px] ${
              active ? 'bg-primary border-primary text-primary-foreground' : 'border-input'
            }`}>
              {active && '✓'}
            </span>
            <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: item.color }} />
            <span className="truncate">{item.name}</span>
          </button>
        )
      })}
    </div>,
    document.body
  )
}
