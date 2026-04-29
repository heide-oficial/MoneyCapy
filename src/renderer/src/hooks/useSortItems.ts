import type { SectionItem } from '../types/entities'

export type ItemSortMode =
  | 'az' | 'za'
  | 'value-desc' | 'value-asc'
  | 'installment-value-desc' | 'installment-value-asc'
  | 'installments-desc' | 'installments-asc'
  | 'newest' | 'oldest'
  | 'paid-first' | 'unpaid-first'
  | 'due-day-asc' | 'due-day-desc'
  | 'billing-day-nearest' | 'billing-day-farthest'

export const ITEM_SORT_OPTIONS: { key: ItemSortMode; label: string }[] = [
  { key: 'az', label: 'Alfabetica crescente' },
  { key: 'za', label: 'Alfabetica decrescente' },
  { key: 'newest', label: 'Mais recente' },
  { key: 'oldest', label: 'Mais antigo' },
  { key: 'value-desc', label: 'Mais caro (total)' },
  { key: 'value-asc', label: 'Mais barato (total)' },
  { key: 'installment-value-desc', label: 'Mais caro (parcela)' },
  { key: 'installment-value-asc', label: 'Mais barato (parcela)' },
  { key: 'paid-first', label: 'Pagos no topo' },
  { key: 'unpaid-first', label: 'Nao pagos no topo' },
  { key: 'installments-desc', label: 'Mais parcelas' },
  { key: 'installments-asc', label: 'Menos parcelas' },
  { key: 'due-day-asc', label: 'Dia de vencimento crescente' },
  { key: 'due-day-desc', label: 'Dia de vencimento decrescente' },
  { key: 'billing-day-nearest', label: 'Dia de cobranca mais proximo' },
  { key: 'billing-day-farthest', label: 'Dia de cobranca mais distante' }
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
    { key: 'due-day-desc', label: t('sort.dueDayDesc') },
    { key: 'billing-day-nearest', label: t('sort.billingDayNearest') },
    { key: 'billing-day-farthest', label: t('sort.billingDayFarthest') }
  ]
}

export function getSortLabelMap(t: (key: string) => string): Record<ItemSortMode, string> {
  return Object.fromEntries(getItemSortOptions(t).map(o => [o.key, o.label])) as Record<ItemSortMode, string>
}

function getMonthValue(item: SectionItem): number {
  const rate = item.exchangeRateSnapshot || 1.0
  if ((item.type === 'installment' || item.type === 'emprestimo') && item.totalInstallments) {
    if (item.cardSplits && item.cardSplits.length > 0) {
      return item.cardSplits.reduce((sum, split) => {
        const monthly = Math.round((split.value / split.totalInstallments) * 100) / 100
        if ((split.anticipatedThisMonth || 0) > 0 && split.discountedTotalThisMonth != null) {
          return sum + monthly + split.discountedTotalThisMonth
        }
        return sum + monthly * (1 + (split.anticipatedThisMonth || 0))
      }, 0) * rate
    }
    const monthly = Math.round((item.value / item.totalInstallments) * 100) / 100
    if ((item.anticipatedThisMonth || 0) > 0 && item.discountedTotalThisMonth != null) {
      return (monthly + item.discountedTotalThisMonth) * rate
    }
    return monthly * (1 + (item.anticipatedThisMonth || 0)) * rate
  }
  return (item.type === 'subscription' ? (item.effectiveValue ?? item.value) : item.value) * rate
}

function getBillingSortValue(item: SectionItem, month?: string): number | null {
  if (item.billingDay == null) return null
  if (!month) return item.billingDay
  const [year, monthNumber] = month.split('-').map(Number)
  let billingMonth = monthNumber + (item.billingDayMonthOffset || 0)
  let billingYear = year
  while (billingMonth > 12) { billingYear += 1; billingMonth -= 12 }
  while (billingMonth < 1) { billingYear -= 1; billingMonth += 12 }
  return new Date(billingYear, billingMonth - 1, item.billingDay).getTime()
}

export function sortItems<T extends SectionItem>(
  items: T[],
  mode: ItemSortMode,
  month?: string
): T[] {
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
      case 'installment-value-desc': return getMonthValue(b) - getMonthValue(a)
      case 'installment-value-asc': return getMonthValue(a) - getMonthValue(b)
      case 'installments-desc': return getInstallmentCount(b) - getInstallmentCount(a)
      case 'installments-asc': return getInstallmentCount(a) - getInstallmentCount(b)
      case 'newest': return (b.createdAt || '').localeCompare(a.createdAt || '')
      case 'oldest': return (a.createdAt || '').localeCompare(b.createdAt || '')
      case 'paid-first': return (b.isPaid ? 1 : 0) - (a.isPaid ? 1 : 0)
      case 'unpaid-first': return (a.isPaid ? 1 : 0) - (b.isPaid ? 1 : 0)
      case 'due-day-asc': return (a.dueDay ?? 99) - (b.dueDay ?? 99)
      case 'due-day-desc': return (b.dueDay ?? 0) - (a.dueDay ?? 0)
      case 'billing-day-nearest': return (getBillingSortValue(a, month) ?? Number.MAX_SAFE_INTEGER) - (getBillingSortValue(b, month) ?? Number.MAX_SAFE_INTEGER)
      case 'billing-day-farthest': return (getBillingSortValue(b, month) ?? Number.MIN_SAFE_INTEGER) - (getBillingSortValue(a, month) ?? Number.MIN_SAFE_INTEGER)
      default: return 0
    }
  })
}
