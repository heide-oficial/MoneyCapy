import type { SectionItem } from '../types/entities'

export type ItemSortMode =
  | 'az' | 'za'
  | 'value-desc' | 'value-asc'
  | 'installment-value-desc' | 'installment-value-asc'
  | 'installments-desc' | 'installments-asc'
  | 'newest' | 'oldest'
  | 'due-day-asc' | 'due-day-desc'

export const ITEM_SORT_OPTIONS: { key: ItemSortMode; label: string }[] = [
  { key: 'az', label: 'Alfabetica crescente' },
  { key: 'za', label: 'Alfabetica decrescente' },
  { key: 'newest', label: 'Adicionado mais recente' },
  { key: 'oldest', label: 'Adicionado mais antigo' },
  { key: 'value-desc', label: 'Valor total maior' },
  { key: 'value-asc', label: 'Valor total menor' },
  { key: 'installment-value-desc', label: 'Parcela com valor maior' },
  { key: 'installment-value-asc', label: 'Parcela com valor menor' },
  { key: 'installments-desc', label: 'Mais parcelas restantes' },
  { key: 'installments-asc', label: 'Menos parcelas restantes' },
  { key: 'due-day-asc', label: 'Dia de vencimento mais proximo' },
  { key: 'due-day-desc', label: 'Dia de vencimento mais distante' }
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
    { key: 'installments-desc', label: t('sort.installmentsDesc') },
    { key: 'installments-asc', label: t('sort.installmentsAsc') },
    { key: 'due-day-asc', label: t('sort.dueDayAsc') },
    { key: 'due-day-desc', label: t('sort.dueDayDesc') }
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

function getDueSortValue(item: SectionItem, month?: string, farthest = false): number | null {
  const dueDays = item.dueDay != null
    ? [item.dueDay]
    : (item.cardDueDays || []).filter((day): day is number => day != null)
  if (dueDays.length === 0) return null
  const dueDay = farthest ? Math.max(...dueDays) : Math.min(...dueDays)
  if (!month) return dueDay
  const [year, monthNumber] = month.split('-').map(Number)
  let dueMonth = monthNumber + (item.dueDayMonthOffset || 0)
  let dueYear = year
  while (dueMonth > 12) { dueYear += 1; dueMonth -= 12 }
  while (dueMonth < 1) { dueYear -= 1; dueMonth += 12 }
  return new Date(dueYear, dueMonth - 1, dueDay).getTime()
}

function getRemainingInstallments(item: SectionItem): number | null {
  if (item.type !== 'installment' && item.type !== 'emprestimo') return null
  if (item.cardSplits && item.cardSplits.length > 0) {
    const remaining = item.cardSplits
      .map(split => {
        const effectiveTotal = Math.max((split.totalInstallments || 0) - (split.totalAnticipated || 0), 0)
        return Math.max(effectiveTotal - (split.currentInstallment || item.currentInstallment || 0), 0)
      })
      .filter(count => count > 0)
    return remaining.length > 0 ? Math.max(...remaining) : 0
  }
  if (!item.totalInstallments) return null
  const effectiveTotal = Math.max(item.totalInstallments - (item.totalAnticipated || 0), 0)
  return Math.max(effectiveTotal - (item.currentInstallment || 0), 0)
}

function compareNullableNumber(a: number | null, b: number | null, direction: 'asc' | 'desc'): number {
  if (a == null && b == null) return 0
  if (a == null) return 1
  if (b == null) return -1
  return direction === 'asc' ? a - b : b - a
}

export function sortItems<T extends SectionItem>(
  items: T[],
  mode: ItemSortMode,
  month?: string
): T[] {
  return [...items].sort((a, b) => {
    switch (mode) {
      case 'az': return a.description.localeCompare(b.description)
      case 'za': return b.description.localeCompare(a.description)
      case 'value-desc': return b.value - a.value
      case 'value-asc': return a.value - b.value
      case 'installment-value-desc': return getMonthValue(b) - getMonthValue(a)
      case 'installment-value-asc': return getMonthValue(a) - getMonthValue(b)
      case 'installments-desc': return compareNullableNumber(getRemainingInstallments(a), getRemainingInstallments(b), 'desc')
      case 'installments-asc': return compareNullableNumber(getRemainingInstallments(a), getRemainingInstallments(b), 'asc')
      case 'newest': return (b.createdAt || '').localeCompare(a.createdAt || '')
      case 'oldest': return (a.createdAt || '').localeCompare(b.createdAt || '')
      case 'due-day-asc': return compareNullableNumber(getDueSortValue(a, month), getDueSortValue(b, month), 'asc')
      case 'due-day-desc': return compareNullableNumber(getDueSortValue(a, month, true), getDueSortValue(b, month, true), 'desc')
      default: return 0
    }
  })
}
