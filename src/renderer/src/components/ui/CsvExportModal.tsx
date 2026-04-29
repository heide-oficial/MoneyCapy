import { useEffect, useMemo, useState } from 'react'
import { Download } from 'lucide-react'
import { Modal } from './Modal'
import { Button } from './Button'
import { useTranslation } from '../../contexts/LanguageContext'

export interface CsvColumn<T> {
  id: string
  label: string
  value: (row: T) => unknown
}

interface CsvExportModalProps<T> {
  open: boolean
  onClose: () => void
  settingsKey: string
  filename: string
  rows: T[]
  columns: CsvColumn<T>[]
}

function escapeCsvCell(value: unknown): string {
  if (value === null || value === undefined) return ''
  const text = String(value)
  if (/[",\r\n]/.test(text)) return `"${text.replace(/"/g, '""')}"`
  return text
}

function downloadCsv(filename: string, content: string): void {
  const blob = new Blob(['\uFEFF' + content], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

export function CsvExportModal<T>({ open, onClose, settingsKey, filename, rows, columns }: CsvExportModalProps<T>) {
  const { t } = useTranslation()
  const allColumnIds = useMemo(() => columns.map(c => c.id), [columns])
  const [selectedIds, setSelectedIds] = useState<string[]>(allColumnIds)

  useEffect(() => {
    if (!open) return
    let cancelled = false
    window.api.settings.get(settingsKey).then((saved: string | null) => {
      if (cancelled) return
      if (!saved) {
        setSelectedIds(allColumnIds)
        return
      }
      try {
        const parsed = JSON.parse(saved)
        const savedIds = Array.isArray(parsed?.selectedIds) ? parsed.selectedIds.filter((id: string) => allColumnIds.includes(id)) : []
        const newIds = allColumnIds.filter(id => !savedIds.includes(id) && !parsed?.knownIds?.includes(id))
        setSelectedIds([...savedIds, ...newIds])
      } catch {
        setSelectedIds(allColumnIds)
      }
    })
    return () => { cancelled = true }
  }, [open, settingsKey, allColumnIds])

  const persistSelection = (ids: string[]) => {
    setSelectedIds(ids)
    window.api.settings.set(settingsKey, JSON.stringify({ selectedIds: ids, knownIds: allColumnIds }))
  }

  const toggleColumn = (id: string) => {
    persistSelection(selectedIds.includes(id)
      ? selectedIds.filter(x => x !== id)
      : [...selectedIds, id])
  }

  const handleExport = () => {
    const selectedColumns = columns.filter(c => selectedIds.includes(c.id))
    const header = selectedColumns.map(c => escapeCsvCell(c.label)).join(',')
    const body = rows.map(row => selectedColumns.map(c => escapeCsvCell(c.value(row))).join(','))
    downloadCsv(filename, [header, ...body].join('\r\n'))
    onClose()
  }

  return (
    <Modal open={open} onClose={onClose} title={t('csvExport.title')} maxWidth="max-w-2xl">
      <div className="space-y-4">
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm text-muted-foreground">
            {t('csvExport.rowsSelected', { count: String(rows.length) })}
          </p>
          <div className="flex gap-2">
            <Button type="button" size="sm" variant="ghost" onClick={() => persistSelection(allColumnIds)}>
              {t('csvExport.selectAll')}
            </Button>
            <Button type="button" size="sm" variant="ghost" onClick={() => persistSelection([])}>
              {t('csvExport.clearAll')}
            </Button>
          </div>
        </div>

        <div className="grid max-h-[360px] grid-cols-1 gap-2 overflow-y-auto pr-1 sm:grid-cols-2">
          {columns.map(column => (
            <label key={column.id} className="flex items-center gap-2 rounded-md border border-border px-3 py-2 text-sm hover:bg-accent/50">
              <input
                type="checkbox"
                checked={selectedIds.includes(column.id)}
                onChange={() => toggleColumn(column.id)}
                className="h-4 w-4 accent-primary"
              />
              <span className="min-w-0 truncate">{column.label}</span>
            </label>
          ))}
        </div>

        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={onClose}>{t('common.cancel')}</Button>
          <Button type="button" onClick={handleExport} disabled={selectedIds.length === 0 || rows.length === 0}>
            <Download size={14} /> {t('csvExport.export')}
          </Button>
        </div>
      </div>
    </Modal>
  )
}
