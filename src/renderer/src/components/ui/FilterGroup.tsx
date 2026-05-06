import React, { useState, useRef, useEffect, useLayoutEffect, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { Filter } from 'lucide-react'
import { useFilterDisplayMode } from '../../contexts/FilterDisplayModeContext'
import { useTranslation } from '../../contexts/LanguageContext'

interface FilterGroupProps {
  children: ReactNode
  activeCount: number
  onClear: () => void
  primaryCount?: number
}

export function FilterGroup({ children, activeCount, onClear, primaryCount = 3 }: FilterGroupProps) {
  const { filterDisplayMode } = useFilterDisplayMode()
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const [moreOpen, setMoreOpen] = useState(false)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const moreTriggerRef = useRef<HTMLButtonElement>(null)
  const popoverRef = useRef<HTMLDivElement>(null)
  const morePopoverRef = useRef<HTMLDivElement>(null)

  const allChildren = React.Children.toArray(children)

  // Close popovers on click outside / Escape
  useEffect(() => {
    if (!open && !moreOpen) return
    const handleClick = (e: MouseEvent) => {
      const t = e.target as Node
      // Ignore clicks inside portaled filter dropdowns (they appear outside the popover in the DOM tree)
      if ((t as Element).closest?.('[data-filter-dropdown]')) return
      if (open && popoverRef.current && !popoverRef.current.contains(t) && triggerRef.current && !triggerRef.current.contains(t)) {
        setOpen(false)
      }
      if (moreOpen && morePopoverRef.current && !morePopoverRef.current.contains(t) && moreTriggerRef.current && !moreTriggerRef.current.contains(t)) {
        setMoreOpen(false)
      }
    }
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { setOpen(false); setMoreOpen(false) }
    }
    document.addEventListener('mousedown', handleClick)
    document.addEventListener('keydown', handleKey)
    return () => {
      document.removeEventListener('mousedown', handleClick)
      document.removeEventListener('keydown', handleKey)
    }
  }, [open, moreOpen])

  if (filterDisplayMode === 'compact') {
    return (
      <>
        <div className="filter-compact contents">
          {allChildren}
        </div>
        {activeCount > 0 && (
          <button className="text-xs text-muted-foreground hover:text-foreground transition-colors" onClick={onClear}>
            {t('common.clear')}
          </button>
        )}
      </>
    )
  }

  if (filterDisplayMode === 'primary-more') {
    const primary = allChildren.slice(0, primaryCount)
    const rest = allChildren.slice(primaryCount)
    const restCount = rest.length

    return (
      <>
        {primary}
        {restCount > 0 && (
          <>
            <button
              ref={moreTriggerRef}
              type="button"
              onClick={() => setMoreOpen(f => !f)}
              className={`inline-flex items-center gap-1.5 h-7 px-2.5 text-xs font-medium rounded-md border transition-colors ${
                moreOpen
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'bg-transparent text-foreground border-input hover:bg-accent'
              }`}
            >
              <Filter size={11} />
              {t('filters.moreFilters')}
              {activeCount > 0 && (
                <span className="bg-primary-foreground text-primary text-[10px] rounded-full h-4 min-w-[16px] flex items-center justify-center font-bold">{activeCount}</span>
              )}
            </button>
            {moreOpen && createPortal(
              <PopoverPanel anchorRef={moreTriggerRef} popoverRef={morePopoverRef}>
                {rest}
              </PopoverPanel>,
              document.body
            )}
          </>
        )}
        {activeCount > 0 && (
          <button className="text-xs text-muted-foreground hover:text-foreground transition-colors" onClick={onClear}>
            {t('common.clear')}
          </button>
        )}
      </>
    )
  }

  // unified mode (default)
  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen(f => !f)}
        className={`inline-flex items-center gap-1.5 h-7 px-2.5 text-xs font-medium rounded-md border transition-colors ${
          open || activeCount > 0
            ? 'bg-primary text-primary-foreground border-primary'
            : 'bg-transparent text-foreground border-input hover:bg-accent'
        }`}
      >
        <Filter size={11} />
        {t('filters.filters')}
        {activeCount > 0 && (
          <span className="bg-primary-foreground text-primary text-[10px] rounded-full h-4 min-w-[16px] flex items-center justify-center font-bold">{activeCount}</span>
        )}
      </button>
      {activeCount > 0 && (
        <button className="text-xs text-muted-foreground hover:text-foreground transition-colors" onClick={onClear}>
          {t('common.clear')}
        </button>
      )}
      {open && createPortal(
        <PopoverPanel anchorRef={triggerRef} popoverRef={popoverRef}>
          {allChildren}
        </PopoverPanel>,
        document.body
      )}
    </>
  )
}

function PopoverPanel({ anchorRef, popoverRef, children }: { anchorRef: React.RefObject<HTMLElement | null>; popoverRef: React.RefObject<HTMLDivElement | null>; children: ReactNode }) {
  const [pos, setPos] = useState({ top: 0, left: 0, ready: false })

  useLayoutEffect(() => {
    if (!anchorRef.current || !popoverRef.current) return
    const anchor = anchorRef.current.getBoundingClientRect()
    const drop = popoverRef.current.getBoundingClientRect()
    let top = anchor.bottom + 4
    let left = anchor.left
    if (left + drop.width > window.innerWidth) left = window.innerWidth - drop.width - 8
    if (top + drop.height > window.innerHeight) top = anchor.top - drop.height - 4
    if (left < 8) left = 8
    if (top < 8) top = 8
    setPos({ top, left, ready: true })
  }, [anchorRef, popoverRef])

  return (
    <div
      ref={popoverRef}
      className="fixed z-[9999] inline-flex max-w-[min(360px,calc(100vw-16px))] flex-col items-start gap-2 rounded-lg border border-border bg-card p-3 shadow-lg [&_[data-filter-label]]:whitespace-nowrap"
      style={{ top: pos.top, left: pos.left, minWidth: 0, visibility: pos.ready ? 'visible' : 'hidden' }}
    >
      {React.Children.map(children, child => (
        <div className="block max-w-full min-w-0 [&>button]:max-w-full [&>button]:justify-start [&>button]:text-left">
          {child}
        </div>
      ))}
    </div>
  )
}
