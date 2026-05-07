export const ENTITY_ITEM_TYPE_FILTERS = [
  'expense:common',
  'expense:installment',
  'expense:subscription',
  'expense:emprestimo',
  'income:non-recurring',
  'income:recurring'
] as const

export type EntityItemTypeFilter = typeof ENTITY_ITEM_TYPE_FILTERS[number]

export function getEntityItemTypeOptions(t: (key: string) => string) {
  return [
    { id: 'expense:common' as EntityItemTypeFilter, name: t('filters.singles'), color: '#6b7280' },
    { id: 'expense:installment' as EntityItemTypeFilter, name: t('filters.installments'), color: '#8b5cf6' },
    { id: 'expense:subscription' as EntityItemTypeFilter, name: t('filters.recurring'), color: '#22c55e' },
    { id: 'expense:emprestimo' as EntityItemTypeFilter, name: t('filters.loans'), color: '#f97316' },
    { id: 'income:non-recurring' as EntityItemTypeFilter, name: t('filters.nonRecurringIncome'), color: '#38bdf8' },
    { id: 'income:recurring' as EntityItemTypeFilter, name: t('filters.recurringIncome'), color: '#14b8a6' }
  ]
}

export function matchesExpenseType(selected: EntityItemTypeFilter[], type: string) {
  return selected.includes(`expense:${type}` as EntityItemTypeFilter)
}

export function matchesIncomeType(selected: EntityItemTypeFilter[], isRecurring: boolean) {
  return selected.includes(isRecurring ? 'income:recurring' : 'income:non-recurring')
}
