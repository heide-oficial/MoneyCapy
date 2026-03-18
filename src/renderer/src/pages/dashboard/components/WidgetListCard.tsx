import { useState, useEffect, type ReactNode } from 'react'
import { Card } from '../../../components/ui/Card'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useTranslation } from '../../../contexts/LanguageContext'

interface WidgetListCardProps<T> {
  icon: any
  label: string
  items: T[]
  renderItem: (item: T, index: number) => ReactNode
  pageSize?: number
  paginated?: boolean
  emptyMessage?: string
}

const ROW_HEIGHT = 40 // py-2.5 top+bottom (~40px per row)

export function WidgetListCard<T>({
  icon: Icon,
  label,
  items,
  renderItem,
  pageSize = 5,
  paginated = false,
  emptyMessage
}: WidgetListCardProps<T>) {
  const { t } = useTranslation()
  const resolvedEmptyMessage = emptyMessage ?? t('dashboard.noItemsFound')
  const [page, setPage] = useState(0)

  useEffect(() => {
    setPage(0)
  }, [items])

  const totalPages = paginated ? Math.max(1, Math.ceil(items.length / pageSize)) : 1
  const start = paginated ? page * pageSize : 0
  const displayed = paginated ? items.slice(start, start + pageSize) : items
  const fixedHeight = pageSize * ROW_HEIGHT

  return (
    <Card className="p-4">
      <div className="flex items-center gap-2 mb-3">
        <Icon size={16} className="text-primary shrink-0" />
        <h3 className="text-sm font-semibold">{label}</h3>
        {items.length > 0 && (
          <span className="text-[10px] text-muted-foreground ml-auto bg-muted/50 px-1.5 py-0.5 rounded-full tabular-nums font-medium">{items.length}</span>
        )}
      </div>
      <div style={{ minHeight: fixedHeight }}>
        {items.length === 0 ? (
          <div className="flex items-center justify-center h-full" style={{ minHeight: fixedHeight }}>
            <p className="text-xs text-muted-foreground text-center">{resolvedEmptyMessage}</p>
          </div>
        ) : (
          <div>
            {displayed.map((item, idx) => renderItem(item, start + idx))}
          </div>
        )}
      </div>
      <div className="flex items-center justify-between mt-2 pt-2 border-t border-border">
        <button
          type="button"
          disabled={page === 0}
          onClick={() => setPage(p => p - 1)}
          className="flex items-center gap-0.5 text-xs text-primary hover:text-primary/80 transition-colors disabled:opacity-30 disabled:pointer-events-none"
        >
          <ChevronLeft size={14} /> {t('common.previous')}
        </button>
        <span className="text-[11px] text-muted-foreground tabular-nums">{page + 1} / {totalPages}</span>
        <button
          type="button"
          disabled={page >= totalPages - 1}
          onClick={() => setPage(p => p + 1)}
          className="flex items-center gap-0.5 text-xs text-primary hover:text-primary/80 transition-colors disabled:opacity-30 disabled:pointer-events-none"
        >
          {t('common.next')} <ChevronRight size={14} />
        </button>
      </div>
    </Card>
  )
}

interface ListWidgetRowProps {
  rank?: number
  description: string
  meta?: string
  value: string
  valueClassName?: string
  valueStyle?: React.CSSProperties
  rankColor?: string
}

export function ListWidgetRow({ rank, description, meta, value, valueClassName, valueStyle, rankColor }: ListWidgetRowProps) {
  const resolvedValueStyle = valueStyle || (!valueClassName ? { color: 'var(--color-gastos)' } : undefined)
  const resolvedRankColor = rankColor || 'var(--color-gastos)'
  return (
    <div className="flex items-center gap-2.5 py-2.5">
      {rank != null && (
        <span
          className="flex items-center justify-center h-5 w-5 rounded-full text-[10px] font-bold shrink-0"
          style={{ backgroundColor: `color-mix(in srgb, ${resolvedRankColor} 10%, transparent)`, color: resolvedRankColor }}
        >
          {rank}
        </span>
      )}
      <p className="text-sm font-medium truncate min-w-0 shrink">{description}</p>
      {meta && (
        <span className="text-[11px] text-muted-foreground whitespace-nowrap shrink-0">{meta}</span>
      )}
      <span className={`text-sm font-bold tabular-nums shrink-0 ml-auto ${valueClassName || ''}`} style={resolvedValueStyle}>
        {value}
      </span>
    </div>
  )
}
