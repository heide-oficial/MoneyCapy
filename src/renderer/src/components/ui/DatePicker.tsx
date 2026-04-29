import { useState, useRef, useEffect, useLayoutEffect } from 'react'
import { createPortal } from 'react-dom'
import { Calendar, ChevronLeft, ChevronRight } from 'lucide-react'
import { MONTH_NAMES, MONTH_NAMES_SHORT, useFormatDate } from '../../lib/date'

interface DatePickerProps {
  mode: 'date' | 'month' | 'week' | 'year'
  value: string
  onChange: (value: string) => void
  label?: string
  small?: boolean
  placeholder?: string
  clearable?: boolean
  clearLabel?: string
  className?: string
}

type View = 'days' | 'months' | 'years'

const WEEKDAY_NAMES_SHORT = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sab', 'Dom']

function dayOfWeek(date: Date): number {
  const d = date.getDay()
  return d === 0 ? 6 : d - 1 // 0=Mon..6=Sun
}

function getMonday(date: Date): Date {
  const d = new Date(date)
  const diff = dayOfWeek(d)
  d.setDate(d.getDate() - diff)
  return d
}

function generateCalendarDays(year: number, month: number): Date[] {
  const first = new Date(year, month, 1)
  const startOffset = dayOfWeek(first)
  const start = new Date(year, month, 1 - startOffset)
  const cells: Date[] = []
  for (let i = 0; i < 42; i++) {
    const d = new Date(start)
    d.setDate(start.getDate() + i)
    cells.push(d)
  }
  return cells
}

function toDateStr(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

function decadeStart(year: number): number {
  return Math.floor(year / 12) * 12
}

export function DatePicker({
  mode,
  value,
  onChange,
  label,
  small,
  placeholder,
  clearable,
  clearLabel = 'Limpar',
  className = ''
}: DatePickerProps) {
  const [open, setOpen] = useState(false)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState({ top: 0, left: 0, ready: false })
  const { fmtMonth, fmtDate } = useFormatDate()

  // Parse value into nav state
  const parseValue = () => {
    const now = new Date()
    if (mode === 'year') {
      const y = parseInt(value) || now.getFullYear()
      return { year: y, month: 0 }
    }
    if (mode === 'month') {
      const [y, m] = (value || '').split('-').map(Number)
      return { year: y || now.getFullYear(), month: (m || 1) - 1 }
    }
    // date or week
    const parts = (value || '').split('-').map(Number)
    return {
      year: parts[0] || now.getFullYear(),
      month: (parts[1] || (now.getMonth() + 1)) - 1
    }
  }

  const initial = parseValue()
  const [navYear, setNavYear] = useState(initial.year)
  const [navMonth, setNavMonth] = useState(initial.month)
  const [view, setView] = useState<View>(() => {
    if (mode === 'year') return 'years'
    if (mode === 'month') return 'months'
    return 'days'
  })

  // Reset nav state when opening
  useEffect(() => {
    if (open) {
      const p = parseValue()
      setNavYear(p.year)
      setNavMonth(p.month)
      if (mode === 'year') setView('years')
      else if (mode === 'month') setView('months')
      else setView('days')
    }
  }, [open])

  // Position dropdown
  useLayoutEffect(() => {
    if (!open || !triggerRef.current) return
    const rect = triggerRef.current.getBoundingClientRect()
    const popupW = view === 'days' ? 280 : 240
    const popupH = view === 'days' ? 320 : 260
    const spaceBelow = window.innerHeight - rect.bottom
    const openAbove = spaceBelow < popupH && rect.top > spaceBelow
    let left = rect.left
    if (left + popupW > window.innerWidth) left = window.innerWidth - popupW - 8
    if (left < 8) left = 8
    setPos({
      top: openAbove ? rect.top - popupH - 4 : rect.bottom + 4,
      left,
      ready: true
    })
  }, [open, view])

  // Close on Escape / click outside
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

  // Format display text
  const getDisplayText = (): string => {
    if (!value) return placeholder || ''
    if (mode === 'year') return value
    if (mode === 'month') return fmtMonth(value)
    if (mode === 'week') {
      const parts = value.split('-').map(Number)
      if (parts.length === 3) {
        const d = new Date(parts[0], parts[1] - 1, parts[2])
        const monday = getMonday(d)
        const sunday = new Date(monday)
        sunday.setDate(monday.getDate() + 6)
        return `${fmtDate(toDateStr(monday))} - ${fmtDate(toDateStr(sunday))}`
      }
      return value
    }
    return fmtDate(value)
  }

  const today = new Date()
  const todayStr = toDateStr(today)

  // Handlers
  const selectDay = (date: Date) => {
    if (mode === 'week') {
      const monday = getMonday(date)
      onChange(toDateStr(monday))
    } else {
      onChange(toDateStr(date))
    }
    setOpen(false)
  }

  const selectMonth = (monthIdx: number) => {
    if (mode === 'month') {
      onChange(`${navYear}-${String(monthIdx + 1).padStart(2, '0')}`)
      setOpen(false)
    } else {
      // drill down to days
      setNavMonth(monthIdx)
      setView('days')
    }
  }

  const selectYear = (year: number) => {
    if (mode === 'year') {
      onChange(String(year))
      setOpen(false)
    } else {
      // drill down to months
      setNavYear(year)
      setView('months')
    }
  }

  // Navigation
  const prevMonth = () => {
    if (navMonth === 0) { setNavMonth(11); setNavYear(y => y - 1) }
    else setNavMonth(m => m - 1)
  }
  const nextMonth = () => {
    if (navMonth === 11) { setNavMonth(0); setNavYear(y => y + 1) }
    else setNavMonth(m => m + 1)
  }

  const renderHeader = () => {
    if (view === 'days') {
      return (
        <div className="flex items-center justify-between px-2 py-1.5">
          <button type="button" onClick={prevMonth} className="h-7 w-7 flex items-center justify-center rounded hover:bg-accent text-muted-foreground hover:text-foreground transition-colors">
            <ChevronLeft size={16} />
          </button>
          <button type="button" onClick={() => setView('months')} className="text-sm font-semibold hover:bg-accent px-2 py-0.5 rounded transition-colors">
            {MONTH_NAMES[navMonth]} {navYear}
          </button>
          <button type="button" onClick={nextMonth} className="h-7 w-7 flex items-center justify-center rounded hover:bg-accent text-muted-foreground hover:text-foreground transition-colors">
            <ChevronRight size={16} />
          </button>
        </div>
      )
    }
    if (view === 'months') {
      return (
        <div className="flex items-center justify-between px-2 py-1.5">
          <button type="button" onClick={() => setNavYear(y => y - 1)} className="h-7 w-7 flex items-center justify-center rounded hover:bg-accent text-muted-foreground hover:text-foreground transition-colors">
            <ChevronLeft size={16} />
          </button>
          <button type="button" onClick={() => setView('years')} className="text-sm font-semibold hover:bg-accent px-2 py-0.5 rounded transition-colors">
            {navYear}
          </button>
          <button type="button" onClick={() => setNavYear(y => y + 1)} className="h-7 w-7 flex items-center justify-center rounded hover:bg-accent text-muted-foreground hover:text-foreground transition-colors">
            <ChevronRight size={16} />
          </button>
        </div>
      )
    }
    // years
    const start = decadeStart(navYear)
    const end = start + 11
    return (
      <div className="flex items-center justify-between px-2 py-1.5">
        <button type="button" onClick={() => setNavYear(y => y - 12)} className="h-7 w-7 flex items-center justify-center rounded hover:bg-accent text-muted-foreground hover:text-foreground transition-colors">
          <ChevronLeft size={16} />
        </button>
        <span className="text-sm font-semibold">
          {start} - {end}
        </span>
        <button type="button" onClick={() => setNavYear(y => y + 12)} className="h-7 w-7 flex items-center justify-center rounded hover:bg-accent text-muted-foreground hover:text-foreground transition-colors">
          <ChevronRight size={16} />
        </button>
      </div>
    )
  }

  const renderDays = () => {
    const cells = generateCalendarDays(navYear, navMonth)

    // For week mode: compute which monday is selected
    const selectedMondayStr = mode === 'week' && value ? (() => {
      const parts = value.split('-').map(Number)
      if (parts.length === 3) {
        return toDateStr(getMonday(new Date(parts[0], parts[1] - 1, parts[2])))
      }
      return ''
    })() : ''

    return (
      <div className="px-2 pb-2">
        {/* Weekday headers */}
        <div className="grid grid-cols-7 mb-1">
          {WEEKDAY_NAMES_SHORT.map(d => (
            <div key={d} className="text-center text-[10px] font-medium text-muted-foreground py-1">{d}</div>
          ))}
        </div>
        {/* Day cells */}
        <div className="grid grid-cols-7">
          {cells.map((date, i) => {
            const dateStr = toDateStr(date)
            const isCurrentMonth = date.getMonth() === navMonth
            const isToday = dateStr === todayStr
            const isSelected = mode === 'date' && dateStr === value
            const isWeekSelected = mode === 'week' && selectedMondayStr && toDateStr(getMonday(date)) === selectedMondayStr
            const isWeekRow = mode === 'week'

            return (
              <button
                key={i}
                type="button"
                onClick={() => selectDay(date)}
                className={`h-8 w-full text-xs font-medium rounded transition-colors
                  ${isSelected ? 'bg-primary text-primary-foreground' : ''}
                  ${isWeekSelected ? 'bg-primary/15 text-primary' : ''}
                  ${!isSelected && !isWeekSelected && isToday ? 'border border-primary text-primary' : ''}
                  ${!isSelected && !isWeekSelected && !isToday && isCurrentMonth ? 'text-foreground hover:bg-accent' : ''}
                  ${!isCurrentMonth && !isSelected && !isWeekSelected ? 'text-muted-foreground/30 hover:bg-accent/50' : ''}
                  ${isWeekRow && !isWeekSelected && isCurrentMonth ? 'hover:bg-accent' : ''}
                `}
              >
                {date.getDate()}
              </button>
            )
          })}
        </div>
      </div>
    )
  }

  const renderMonths = () => {
    const selectedMonthStr = (() => {
      if (mode === 'month' && value) return value
      if ((mode === 'date' || mode === 'week') && value) {
        const parts = value.split('-')
        return `${parts[0]}-${parts[1]}`
      }
      return ''
    })()
    const todayMonth = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`

    return (
      <div className="grid grid-cols-3 gap-1.5 p-3">
        {MONTH_NAMES_SHORT.map((name, i) => {
          const monthStr = `${navYear}-${String(i + 1).padStart(2, '0')}`
          const isSelected = monthStr === selectedMonthStr
          const isToday = monthStr === todayMonth

          return (
            <button
              key={i}
              type="button"
              onClick={() => selectMonth(i)}
              className={`py-2 text-sm font-medium rounded transition-colors
                ${isSelected ? 'bg-primary text-primary-foreground' : ''}
                ${!isSelected && isToday ? 'border border-primary text-primary' : ''}
                ${!isSelected && !isToday ? 'text-foreground hover:bg-accent' : ''}
              `}
            >
              {name}
            </button>
          )
        })}
      </div>
    )
  }

  const renderYears = () => {
    const start = decadeStart(navYear)
    const years = Array.from({ length: 12 }, (_, i) => start + i)
    const selectedYear = mode === 'year' ? parseInt(value) : parseInt((value || '').split('-')[0])
    const todayYear = today.getFullYear()

    return (
      <div className="grid grid-cols-3 gap-1.5 p-3">
        {years.map(y => {
          const isSelected = y === selectedYear
          const isToday = y === todayYear

          return (
            <button
              key={y}
              type="button"
              onClick={() => selectYear(y)}
              className={`py-2 text-sm font-medium rounded transition-colors
                ${isSelected ? 'bg-primary text-primary-foreground' : ''}
                ${!isSelected && isToday ? 'border border-primary text-primary' : ''}
                ${!isSelected && !isToday ? 'text-foreground hover:bg-accent' : ''}
              `}
            >
              {y}
            </button>
          )
        })}
      </div>
    )
  }

  const renderClearAction = () => {
    if (!clearable || !value) return null
    return (
      <div className="border-t border-border px-2 py-2">
        <button
          type="button"
          onClick={() => {
            onChange('')
            setOpen(false)
          }}
          className="w-full rounded px-2 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
        >
          {clearLabel}
        </button>
      </div>
    )
  }

  const displayText = getDisplayText()
  const hasValue = !!value

  const trigger = (
    <button
      ref={triggerRef}
      type="button"
      onClick={() => setOpen(!open)}
      className={`flex ${small ? 'h-7 text-xs' : 'h-9 text-sm'} items-center gap-2 rounded-md border border-input bg-transparent px-3 py-1 shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
        !hasValue ? 'text-muted-foreground' : 'text-foreground'
      } ${className}`}
    >
      <Calendar size={small ? 12 : 14} className="shrink-0 text-muted-foreground" />
      <span className="truncate">{displayText || placeholder || 'Selecionar'}</span>
    </button>
  )

  const popupWidth = view === 'days' ? 280 : 240

  return (
    <div className="space-y-1">
      {label && (
        <label className="text-sm font-medium text-foreground">{label}</label>
      )}
      {trigger}
      {open && createPortal(
        <div
          ref={dropdownRef}
          className="fixed z-[9999] rounded-md border border-border bg-card shadow-lg"
          style={{ top: pos.top, left: pos.left, width: popupWidth, visibility: pos.ready ? 'visible' : 'hidden' }}
        >
          {renderHeader()}
          {view === 'days' && renderDays()}
          {view === 'months' && renderMonths()}
          {view === 'years' && renderYears()}
          {renderClearAction()}
        </div>,
        document.body
      )}
    </div>
  )
}
