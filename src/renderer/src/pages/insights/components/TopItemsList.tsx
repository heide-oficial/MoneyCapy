import { useState, useEffect } from 'react'
import { Card } from '../../../components/ui/Card'
import { Select } from '../../../components/ui/Select'
import { formatCurrency } from '../../../lib/currency'
import { useColorSettings } from '../../../contexts/ColorSettingsContext'
import { useTranslation } from '../../../contexts/LanguageContext'
import { Store, Tag, FolderOpen, Repeat, CreditCard, HandCoins, CircleDot, Layers, Landmark, ChevronLeft, ChevronRight } from 'lucide-react'
import type { ItemAggregate, IncomeAggregate } from '../../../../../../shared/insights-types'

interface TopItemsListExpenseProps {
  items: ItemAggregate[]
  title: string
  variant?: 'expense'
  pageSize?: number
}

interface TopItemsListIncomeProps {
  items: IncomeAggregate[]
  title: string
  variant: 'income'
  pageSize?: number
}

type TopItemsListProps = TopItemsListExpenseProps | TopItemsListIncomeProps

const TYPE_ICONS: Record<string, any> = {
  common: CircleDot,
  installment: Layers,
  subscription: Repeat,
  emprestimo: Landmark
}

function getTypeLabels(t: (key: string) => string): Record<string, string> {
  return {
    common: t('itemTypes.common'),
    installment: t('itemTypes.installment'),
    subscription: t('itemTypes.subscription'),
    emprestimo: t('itemTypes.emprestimo')
  }
}

function getTypeFilterOptions(t: (key: string) => string) {
  return [
    { value: 'all', label: t('topItems.all') },
    { value: 'common', label: t('topItems.singles') },
    { value: 'installment', label: t('topItems.installments') },
    { value: 'subscription', label: t('topItems.recurring') },
    { value: 'emprestimo', label: t('topItems.loans') },
  ]
}

const ROW_HEIGHT = 40

function MetaRow({ items }: { items: { icon: any; text: string }[] }) {
  if (items.length === 0) return null
  return (
    <div className="flex items-center gap-2.5 flex-wrap">
      {items.map((m, i) => {
        const MIcon = m.icon
        return (
          <span key={i} className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
            <MIcon size={10} className="shrink-0 opacity-60" />
            {m.text}
          </span>
        )
      })}
    </div>
  )
}

function ExpenseItem({ item, rank }: { item: ItemAggregate; rank: number }) {
  const { gastosStyle } = useColorSettings()
  const { t } = useTranslation()
  const TypeIcon = TYPE_ICONS[item.type] || CircleDot
  const typeLabels = getTypeLabels(t)

  const meta: { icon: any; text: string }[] = []
  meta.push({ icon: TypeIcon, text: typeLabels[item.type] || item.type })
  if (item.store) meta.push({ icon: Store, text: item.store })

  return (
    <div className="flex items-center gap-2.5 py-2.5 first:pt-0 last:pb-0">
      <span
        className="flex items-center justify-center h-5 w-5 rounded-full text-[10px] font-bold shrink-0"
        style={{ backgroundColor: 'color-mix(in srgb, var(--color-gastos) 10%, transparent)', color: 'var(--color-gastos)' }}
      >
        {rank}
      </span>
      <p className="text-sm font-semibold truncate min-w-0 shrink">{item.description}</p>
      <MetaRow items={meta} />
      {item.tags.map(tag => (
        <span
          key={tag.id}
          className="text-[11px] px-2 py-0.5 rounded-full font-medium whitespace-nowrap shrink-0"
          style={{ backgroundColor: `${tag.color}20`, color: tag.color }}
        >
          {tag.name}
        </span>
      ))}
      <span className="text-sm font-bold tabular-nums shrink-0 ml-auto" style={gastosStyle('tags', 'itens')}>
        {formatCurrency(item.value)}
      </span>
    </div>
  )
}

function IncomeItem({ item, rank }: { item: IncomeAggregate; rank: number }) {
  const { receitasStyle } = useColorSettings()
  const meta: { icon: any; text: string }[] = []
  if (item.categoryName) meta.push({ icon: FolderOpen, text: item.categoryName })

  return (
    <div className="flex items-center gap-2.5 py-2.5 first:pt-0 last:pb-0">
      <span
        className="flex items-center justify-center h-5 w-5 rounded-full text-[10px] font-bold shrink-0"
        style={{ backgroundColor: 'color-mix(in srgb, var(--color-receitas) 10%, transparent)', color: 'var(--color-receitas)' }}
      >
        {rank}
      </span>
      <p className="text-sm font-semibold truncate min-w-0 shrink">{item.description}</p>
      <MetaRow items={meta} />
      {item.tags.map(tag => (
        <span
          key={tag.id}
          className="text-[11px] px-2 py-0.5 rounded-full font-medium whitespace-nowrap shrink-0"
          style={{ backgroundColor: `${tag.color}20`, color: tag.color }}
        >
          {tag.name}
        </span>
      ))}
      <span className="text-sm font-bold tabular-nums shrink-0 ml-auto" style={receitasStyle('tags', 'itens')}>
        {formatCurrency(item.value)}
      </span>
    </div>
  )
}

function Pagination({ page, totalPages, onPrev, onNext }: { page: number; totalPages: number; onPrev: () => void; onNext: () => void }) {
  const { t } = useTranslation()
  return (
    <div className="flex items-center justify-between mt-2 pt-2 border-t border-border">
      <button
        type="button"
        disabled={page === 0}
        onClick={onPrev}
        className="flex items-center gap-0.5 text-xs text-primary hover:text-primary/80 transition-colors disabled:opacity-30 disabled:pointer-events-none"
      >
        <ChevronLeft size={14} /> {t('common.previous')}
      </button>
      <span className="text-[11px] text-muted-foreground tabular-nums">{page + 1} / {totalPages}</span>
      <button
        type="button"
        disabled={page >= totalPages - 1}
        onClick={onNext}
        className="flex items-center gap-0.5 text-xs text-primary hover:text-primary/80 transition-colors disabled:opacity-30 disabled:pointer-events-none"
      >
        {t('common.next')} <ChevronRight size={14} />
      </button>
    </div>
  )
}

export function TopItemsList(props: TopItemsListProps) {
  const { t } = useTranslation()
  const { title, pageSize = 10 } = props
  const isIncome = props.variant === 'income'
  const [typeFilter, setTypeFilter] = useState('all')
  const [page, setPage] = useState(0)

  if (isIncome) {
    const items = (props as TopItemsListIncomeProps).items

    useEffect(() => { setPage(0) }, [items])

    const totalPages = Math.max(1, Math.ceil(items.length / pageSize))
    const start = page * pageSize
    const display = items.slice(start, start + pageSize)
    const fixedHeight = pageSize * ROW_HEIGHT

    return (
      <Card className="p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold">{title}</h3>
          {items.length > 0 && (
            <span className="text-[10px] text-muted-foreground bg-muted/50 px-1.5 py-0.5 rounded-full tabular-nums font-medium">{items.length}</span>
          )}
        </div>
        <div style={{ minHeight: fixedHeight }}>
          {items.length === 0 ? (
            <div className="flex items-center justify-center h-full" style={{ minHeight: fixedHeight }}>
              <p className="text-xs text-muted-foreground text-center">{t('common.noResults')}</p>
            </div>
          ) : (
            <div className="space-y-0">
              {display.map((item, idx) => (
                <IncomeItem key={item.incomeId + '-' + idx} item={item} rank={start + idx + 1} />
              ))}
            </div>
          )}
        </div>
        <Pagination
          page={page}
          totalPages={totalPages}
          onPrev={() => setPage(p => p - 1)}
          onNext={() => setPage(p => p + 1)}
        />
      </Card>
    )
  }

  // Expense variant
  const items = (props as TopItemsListExpenseProps).items
  const filtered = typeFilter === 'all' ? items : items.filter(i => i.type === typeFilter)

  useEffect(() => { setPage(0) }, [items, typeFilter])

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize))
  const start = page * pageSize
  const display = filtered.slice(start, start + pageSize)
  const fixedHeight = pageSize * ROW_HEIGHT

  return (
    <Card className="p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold">{title}</h3>
        <div className="flex items-center gap-2">
          {filtered.length > 0 && (
            <span className="text-[10px] text-muted-foreground bg-muted/50 px-1.5 py-0.5 rounded-full tabular-nums font-medium">{filtered.length}</span>
          )}
          <div className="w-32">
            <Select
              small
              options={getTypeFilterOptions(t)}
              value={typeFilter}
              onChange={e => setTypeFilter(e.target.value)}
            />
          </div>
        </div>
      </div>
      <div style={{ minHeight: fixedHeight }}>
        {filtered.length === 0 ? (
          <div className="flex items-center justify-center h-full" style={{ minHeight: fixedHeight }}>
            <p className="text-xs text-muted-foreground text-center">{t('common.noResults')}</p>
          </div>
        ) : (
          <div className="space-y-0">
            {display.map((item, idx) => (
              <ExpenseItem key={item.itemId + '-' + idx} item={item} rank={start + idx + 1} />
            ))}
          </div>
        )}
      </div>
      <Pagination
        page={page}
        totalPages={totalPages}
        onPrev={() => setPage(p => p - 1)}
        onNext={() => setPage(p => p + 1)}
      />
    </Card>
  )
}
