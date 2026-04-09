import type { SectionItem } from '../types/entities'

export type ItemSortMode =
  | 'az' | 'za'
  | 'value-desc' | 'value-asc'
  | 'installment-value-desc' | 'installment-value-asc'
  | 'installments-desc' | 'installments-asc'
  | 'newest' | 'oldest'
  | 'paid-first' | 'unpaid-first'
  | 'due-day-asc' | 'due-day-desc'

export const ITEM_SORT_OPTIONS: { key: ItemSortMode; label: string }[] = [
  { key: 'az', label: 'Alfabética crescente' },
  { key: 'za', label: 'Alfabética decrescente' },
  { key: 'newest', label: 'Mais recente' },
  { key: 'oldest', label: 'Mais antigo' },
  { key: 'value-desc', label: 'Mais caro (total)' },
  { key: 'value-asc', label: 'Mais barato (total)' },
  { key: 'installment-value-desc', label: 'Mais caro (parcela)' },
  { key: 'installment-value-asc', label: 'Mais barato (parcela)' },
  { key: 'paid-first', label: 'Pagos no topo' },
  { key: 'unpaid-first', label: 'Não pagos no topo' },
  { key: 'installments-desc', label: 'Mais parcelas' },
  { key: 'installments-asc', label: 'Menos parcelas' },
  { key: 'due-day-asc', label: 'Dia de cobrança crescente' },
  { key: 'due-day-desc', label: 'Dia de cobrança decrescente' }
]

export const SORT_LABEL_MAP: Record<ItemSortMode, string> = Object.fromEntries(
  ITEM_SORT_OPTIONS.map(o => [o.key, o.label])
) as Record<ItemSortMode, string>

export function getItemSortOptions(t: (key: string) => string): { key: ItemSortMode; label: string }[] {
  return [
    { key: 'az', label: t('sort.azAsc') },
    { key: 'za', label: t('sort.azDesc') },
    { key: 'newest', label: t('sort.newest') },
    { key: 'oldest', label: t('sort.oldest') },
    { key: 'value-desc', label: t('sort.valueDesc') },
    { key: 'value-asc', label: t('sort.valueAsc') },
    { key: 'installment-value-desc', label: t('sort.installmentValueDesc') },
    { key: 'installment-value-asc', label: t('sort.installmentValueAsc') },
    { key: 'paid-first', label: t('sort.paidFirst') },
    { key: 'unpaid-first', label: t('sort.unpaidFirst') },
    { key: 'installments-desc', label: t('sort.installmentsDesc') },
    { key: 'installments-asc', label: t('sort.installmentsAsc') },
    { key: 'due-day-asc', label: t('sort.dueDayAsc') },
    { key: 'due-day-desc', label: t('sort.dueDayDesc') }
  ]
}

export function getSortLabelMap(t: (key: string) => string): Record<ItemSortMode, string> {
  return Object.fromEntries(getItemSortOptions(t).map(o => [o.key, o.label])) as Record<ItemSortMode, string>
}

export function sortItems<T extends Pick<SectionItem, 'description' | 'value' | 'type' | 'totalInstallments' | 'startMonth' | 'isPaid' | 'createdAt' | 'dueDay'>>(
  items: T[],
  mode: ItemSortMode
): T[] {
  const getInstallmentValue = (i: T) =>
    (i.type === 'installment' || i.type === 'emprestimo') && i.totalInstallments
      ? i.value / i.totalInstallments
      : i.value
  const getInstallmentCount = (i: T) =>
    (i.type === 'installment' || i.type === 'emprestimo') && i.totalInstallments
      ? i.totalInstallments
      : 1

  return [...items].sort((a, b) => {
    switch (mode) {
      case 'az': return a.description.localeCompare(b.description)
      case 'za': return b.description.localeCompare(a.description)
      case 'value-desc': return b.value - a.value
      case 'value-asc': return a.value - b.value
      case 'installment-value-desc': return getInstallmentValue(b) - getInstallmentValue(a)
      case 'installment-value-asc': return getInstallmentValue(a) - getInstallmentValue(b)
      case 'installments-desc': return getInstallmentCount(b) - getInstallmentCount(a)
      case 'installments-asc': return getInstallmentCount(a) - getInstallmentCount(b)
      case 'newest': return (b.createdAt || '').localeCompare(a.createdAt || '')
      case 'oldest': return (a.createdAt || '').localeCompare(b.createdAt || '')
      case 'paid-first': return (b.isPaid ? 1 : 0) - (a.isPaid ? 1 : 0)
      case 'unpaid-first': return (a.isPaid ? 1 : 0) - (b.isPaid ? 1 : 0)
      case 'due-day-asc': return (a.dueDay ?? 99) - (b.dueDay ?? 99)
      case 'due-day-desc': return (b.dueDay ?? 0) - (a.dueDay ?? 0)
      default: return 0
    }
  })
}
