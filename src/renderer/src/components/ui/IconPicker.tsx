import { useState, useRef, useCallback, useMemo } from 'react'
import { createPortal } from 'react-dom'
import * as LucideIcons from 'lucide-react'
import { Search, X } from 'lucide-react'

const ALL_ICON_NAMES: string[] = Object.keys(LucideIcons)
  .filter(key => {
    if (!/^[A-Z]/.test(key)) return false
    const val = (LucideIcons as any)[key]
    return val != null && (typeof val === 'object' || typeof val === 'function')
  })
  .sort()

const BATCH_SIZE = 120

interface IconPickerProps {
  value: string
  onChange: (iconName: string) => void
}

export function IconPicker({ value, onChange }: IconPickerProps) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [visibleCount, setVisibleCount] = useState(BATCH_SIZE)
  const containerRef = useRef<HTMLDivElement>(null)

  const filtered = useMemo(() => {
    if (!search) return ALL_ICON_NAMES
    const lower = search.toLowerCase()
    return ALL_ICON_NAMES.filter(name => name.toLowerCase().includes(lower))
  }, [search])

  const visible = filtered.slice(0, visibleCount)

  const handleScroll = useCallback(() => {
    const el = containerRef.current
    if (!el) return
    if (el.scrollTop + el.clientHeight >= el.scrollHeight - 50) {
      setVisibleCount(prev => Math.min(prev + BATCH_SIZE, filtered.length))
    }
  }, [filtered.length])

  const handleOpen = () => {
    setSearch('')
    setVisibleCount(BATCH_SIZE)
    setOpen(true)
  }

  const handleSelect = (name: string) => {
    onChange(name)
    setOpen(false)
  }

  const SelectedIcon = value ? (LucideIcons as any)[value] : null

  return (
    <>
      <div className="space-y-1.5">
        <label className="text-xs text-muted-foreground">Icone</label>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleOpen}
            className="flex items-center gap-2 h-9 px-3 rounded-md border border-input bg-transparent text-sm transition-colors hover:bg-accent hover:text-accent-foreground"
          >
            {SelectedIcon ? (
              <>
                <SelectedIcon size={16} />
                <span className="text-foreground">{value}</span>
              </>
            ) : (
              <span className="text-muted-foreground">Escolher icone...</span>
            )}
          </button>
          {value && (
            <button
              type="button"
              onClick={() => onChange('')}
              className="h-7 w-7 flex items-center justify-center rounded-md border border-border hover:bg-muted transition-colors"
              title="Remover icone"
            >
              <X size={12} className="text-muted-foreground" />
            </button>
          )}
        </div>
      </div>

      {open && createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center">
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setOpen(false)} />
          <div className="relative z-50 w-full max-w-md mx-4 rounded-xl border border-border bg-card p-4 shadow-2xl">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-card-foreground">Escolher icone</h3>
              <button onClick={() => setOpen(false)} className="rounded-md p-1 text-muted-foreground hover:bg-accent transition-colors">
                <X size={16} />
              </button>
            </div>

            <div className="relative mb-3">
              <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input
                type="text"
                value={search}
                onChange={e => { setSearch(e.target.value); setVisibleCount(BATCH_SIZE) }}
                placeholder="Buscar icone..."
                autoFocus
                className="w-full h-9 pl-8 pr-3 rounded-md border border-input bg-transparent text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
            </div>

            <div
              ref={containerRef}
              onScroll={handleScroll}
              className="grid grid-cols-8 gap-1 max-h-64 overflow-y-auto p-1"
            >
              {visible.map(iconName => {
                const IC = (LucideIcons as any)[iconName]
                if (!IC || typeof IC === 'string') return null
                return (
                  <button
                    key={iconName}
                    type="button"
                    onClick={() => handleSelect(iconName)}
                    title={iconName}
                    className={`flex items-center justify-center h-9 w-9 rounded-md transition-colors ${
                      value === iconName
                        ? 'bg-primary/10 text-primary ring-1 ring-primary'
                        : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
                    }`}
                  >
                    <IC size={18} />
                  </button>
                )
              })}
            </div>

            <p className="text-[11px] text-muted-foreground text-center pt-2">
              {filtered.length} icone{filtered.length !== 1 ? 's' : ''}
              {visible.length < filtered.length && ` (mostrando ${visible.length})`}
            </p>
          </div>
        </div>,
        document.body
      )}
    </>
  )
}
