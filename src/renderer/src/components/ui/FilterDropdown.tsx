import { useState } from 'react'
import { createPortal } from 'react-dom'
import { Check } from 'lucide-react'
import { useTranslation } from '../../contexts/LanguageContext'
import { useAnchoredPopover } from '../../hooks/useAnchoredPopover'

interface FilterDropdownProps<T extends string | number> {
  anchorRef: React.RefObject<HTMLButtonElement | null>
  dropRef: React.RefObject<HTMLDivElement | null>
  onClose: () => void
  items: { id: T; name: string; color: string }[]
  selected: T[]
  onToggle: (id: T) => void
  emptyText?: string
  searchable?: boolean
  searchPlaceholder?: string
}

export function FilterDropdown<T extends string | number>({
  anchorRef, dropRef, onClose, items, selected, onToggle, emptyText, searchable = true, searchPlaceholder
}: FilterDropdownProps<T>) {
  const { t } = useTranslation()
  const [search, setSearch] = useState('')
  const filteredItems = search.trim()
    ? items.filter(item => item.name.toLowerCase().includes(search.trim().toLowerCase()))
    : items
  const pos = useAnchoredPopover({
    anchorRef,
    popoverRef: dropRef,
    onClose,
    deps: [search, filteredItems.length]
  })

  return createPortal(
    <div
      ref={dropRef}
      data-filter-dropdown="true"
      className="fixed z-[40000] min-w-[220px] max-w-[min(320px,calc(100vw-16px))] rounded-lg border border-border bg-card p-1.5 shadow-lg"
      style={{ top: pos.top, left: pos.left, visibility: pos.ready ? 'visible' : 'hidden' }}
    >
      {searchable && items.length > 0 && (
        <div className="p-1">
          <input
            value={search}
            onChange={event => setSearch(event.target.value)}
            placeholder={searchPlaceholder || t('common.search')}
            className="h-8 w-full rounded-md border border-input bg-muted/30 px-2.5 text-sm text-foreground outline-none placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring"
          />
        </div>
      )}
      <div className="max-h-64 overflow-y-auto py-0.5">
        {filteredItems.length === 0 ? (
          <p className="px-3 py-4 text-sm text-muted-foreground text-center">{emptyText || t('filters.noOptions')}</p>
        ) : filteredItems.map(item => {
          const active = selected.includes(item.id)
          return (
            <button
              key={String(item.id)}
              type="button"
              onClick={() => onToggle(item.id)}
              className={`flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-sm transition-colors hover:bg-accent hover:text-accent-foreground ${
                active ? 'bg-primary/5 text-primary' : 'text-card-foreground'
              }`}
            >
              <span className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border text-[10px] ${
                active ? 'bg-primary border-primary text-primary-foreground' : 'border-input'
              }`}>
                {active && <Check size={11} />}
              </span>
              <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: item.color }} />
              <span className="min-w-0 flex-1 truncate">{item.name}</span>
            </button>
          )
        })}
      </div>
    </div>,
    document.body
  )
}
