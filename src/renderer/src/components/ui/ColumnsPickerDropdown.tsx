import { useState, useEffect, useLayoutEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { Check, LayoutGrid } from 'lucide-react'
import { useTranslation } from '../../contexts/LanguageContext'

const COLUMN_OPTIONS = [
  { value: 1, tKey: 'common.columnsPerRow1' },
  { value: 2, tKey: 'common.columnsPerRow2' },
  { value: 3, tKey: 'common.columnsPerRow3' }
]

function ColumnsDropdown({ anchorRef, dropRef, current, onChange, onClose }: {
  anchorRef: React.RefObject<HTMLButtonElement | null>
  dropRef: React.RefObject<HTMLDivElement | null>
  current: number
  onChange: (v: number) => void
  onClose: () => void
}) {
  const { t } = useTranslation()
  const [pos, setPos] = useState({ top: 0, left: 0, ready: false })

  useLayoutEffect(() => {
    if (!anchorRef.current || !dropRef.current) return
    const anchor = anchorRef.current.getBoundingClientRect()
    const drop = dropRef.current.getBoundingClientRect()
    let top = anchor.bottom + 4, left = anchor.right - drop.width
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

  return (
    <div ref={dropRef} className="fixed z-[9999] rounded-md border border-border bg-card shadow-lg py-1 min-w-[160px]"
      style={{ top: pos.top, left: pos.left, visibility: pos.ready ? 'visible' : 'hidden' }}>
      {COLUMN_OPTIONS.map(opt => (
        <button key={opt.value} type="button"
          onClick={() => onChange(opt.value)}
          className={`flex w-full items-center gap-2 px-3 py-1.5 text-sm transition-colors hover:bg-accent hover:text-accent-foreground ${
            current === opt.value ? 'text-primary font-medium bg-primary/5' : 'text-card-foreground'
          }`}>
          {current === opt.value && <Check size={12} />}
          <span className={current !== opt.value ? 'ml-5' : ''}>{t(opt.tKey)}</span>
        </button>
      ))}
    </div>
  )
}

export function useColumnsPicker(settingsKey: string, defaultColumns = 2) {
  const { t } = useTranslation()
  const [columns, setColumns] = useState(defaultColumns)
  const [showPicker, setShowPicker] = useState(false)
  const btnRef = useRef<HTMLButtonElement>(null)
  const dropRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    window.api.settings.get(settingsKey).then((v: any) => {
      const n = parseInt(v)
      if (n >= 1 && n <= 3) setColumns(n)
    })
  }, [settingsKey])

  const changeColumns = (n: number) => {
    setColumns(n)
    setShowPicker(false)
    window.api.settings.set(settingsKey, String(n))
  }

  const gridClass = columns === 1 ? 'grid-cols-1' : columns === 3 ? 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3' : 'grid-cols-1 md:grid-cols-2'

  const pickerButton = (
    <div className="relative">
      <button
        ref={btnRef}
        type="button"
        onClick={() => setShowPicker(f => !f)}
        className="inline-flex items-center justify-center h-7 w-7 rounded-md hover:bg-accent transition-colors"
        title={t('common.columns')}
      >
        <LayoutGrid size={14} className="text-muted-foreground" />
      </button>
      {showPicker && createPortal(
        <ColumnsDropdown
          anchorRef={btnRef}
          dropRef={dropRef}
          current={columns}
          onChange={changeColumns}
          onClose={() => setShowPicker(false)}
        />,
        document.body
      )}
    </div>
  )

  return { columns, gridClass, pickerButton }
}
