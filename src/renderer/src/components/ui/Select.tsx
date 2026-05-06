import { useState, useRef, useEffect, useLayoutEffect } from 'react'
import { createPortal } from 'react-dom'
import { ChevronDown } from 'lucide-react'
import { useTranslation } from '../../contexts/LanguageContext'

interface SelectOption {
  value: string | number
  label: string
}

interface SelectProps {
  label?: string
  error?: string
  options: SelectOption[]
  placeholder?: string
  value?: string | number
  onChange?: (e: { target: { value: string } }) => void
  className?: string
  disabled?: boolean
  id?: string
  small?: boolean
  searchable?: boolean
  searchPlaceholder?: string
}

export function Select({
  label,
  error,
  options,
  placeholder,
  value,
  onChange,
  className = '',
  disabled,
  id,
  small,
  searchable,
  searchPlaceholder
}: SelectProps) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const triggerRef = useRef<HTMLButtonElement>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState({ top: 0, left: 0, width: 0, ready: false })
  const shouldSearch = searchable ?? options.length > 6
  const normalizedSearch = search.trim().toLowerCase()
  const filteredOptions = normalizedSearch
    ? options.filter(option => option.label.toLowerCase().includes(normalizedSearch))
    : options

  // Calculate dropdown position when opening
  useLayoutEffect(() => {
    if (!open || !triggerRef.current) return
    const rect = triggerRef.current.getBoundingClientRect()
    const spaceBelow = window.innerHeight - rect.bottom
    const dropdownHeight = Math.min((options.length + (placeholder ? 1 : 0)) * 30 + (shouldSearch ? 48 : 8), 292)
    const openAbove = spaceBelow < dropdownHeight && rect.top > spaceBelow

    setPos({
      top: openAbove ? rect.top - dropdownHeight - 4 : rect.bottom + 4,
      left: rect.left,
      width: rect.width,
      ready: true
    })
  }, [open, options.length, placeholder, shouldSearch])

  // Close on click outside or Escape
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

  const selected = options.find(o => String(o.value) === String(value))
  const displayLabel = selected ? selected.label : placeholder || ''

  const handleSelect = (opt: SelectOption) => {
    onChange?.({ target: { value: String(opt.value) } })
    setOpen(false)
    setSearch('')
  }

  const handleClear = () => {
    if (placeholder) {
      onChange?.({ target: { value: '' } })
      setOpen(false)
      setSearch('')
    }
  }

  return (
    <div className="space-y-1">
      {label && (
        <label htmlFor={id} className="text-sm font-medium text-foreground">
          {label}
        </label>
      )}
      <button
        ref={triggerRef}
        type="button"
        id={id}
        disabled={disabled}
        onClick={() => !disabled && setOpen(!open)}
        className={`flex ${small ? 'h-7 text-xs' : 'h-9 text-sm'} w-full items-center justify-between rounded-md border border-input bg-transparent px-3 py-1 shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 ${
          error ? 'border-destructive' : ''
        } ${!selected ? 'text-muted-foreground' : 'text-foreground'} ${className}`}
      >
        <span className="truncate">{displayLabel}</span>
        <ChevronDown size={14} className={`shrink-0 ml-2 text-muted-foreground transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && createPortal(
        <div
          ref={dropdownRef}
          className="fixed z-[9999] rounded-md border border-border bg-card shadow-lg"
          style={{ top: pos.top, left: pos.left, minWidth: pos.width, visibility: pos.ready ? 'visible' : 'hidden' }}
        >
          {shouldSearch && (
            <div className="p-2 pb-1">
              <input
                value={search}
                onChange={event => setSearch(event.target.value)}
                placeholder={searchPlaceholder || t('common.search')}
                className="h-8 w-full rounded-md border border-input bg-muted/30 px-2.5 text-sm text-foreground outline-none placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring"
                autoFocus
              />
            </div>
          )}
          <div className="max-h-60 overflow-y-auto py-1">
            {placeholder && (
              <button
                type="button"
                onClick={handleClear}
                className={`flex w-full items-center px-3 py-1.5 ${small ? 'text-xs' : 'text-sm'} transition-colors hover:bg-accent hover:text-accent-foreground ${
                  !value ? 'text-primary font-medium' : 'text-muted-foreground'
                }`}
              >
                {placeholder}
              </button>
            )}
            {filteredOptions.length === 0 ? (
              <p className={`px-3 py-4 text-center ${small ? 'text-xs' : 'text-sm'} text-muted-foreground`}>
                {t('filters.noOptions')}
              </p>
            ) : filteredOptions.map(opt => (
              <button
                key={opt.value}
                type="button"
                onClick={() => handleSelect(opt)}
                className={`flex w-full items-center px-3 py-1.5 ${small ? 'text-xs' : 'text-sm'} transition-colors hover:bg-accent hover:text-accent-foreground ${
                  String(opt.value) === String(value) ? 'text-primary font-medium bg-primary/5' : 'text-card-foreground'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>,
        document.body
      )}

      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  )
}
