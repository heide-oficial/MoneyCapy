export type InsightsMode = 'temporal' | 'comparative'
export type TemporalGrouping = 'day' | 'week' | 'month' | 'year'
export type ComparisonGranularity = 'day' | 'week' | 'month' | 'year'

export interface ItemAggregate {
  itemId: number
  description: string
  type: string
  value: number
  store: string | null
  categoryId: number | null
  categoryName: string | null
  categoryColor: string | null
  categoryIcon: string | null
  tags: { id: number; name: string; color: string }[]
}

export interface IncomeAggregate {
  incomeId: number
  description: string
  value: number
  categoryId: number | null
  categoryName: string | null
  categoryColor: string | null
  tags: { id: number; name: string; color: string }[]
}

export interface CategoryAggregate {
  categoryId: number | null
  categoryName: string | null
  categoryColor: string | null
  total: number
  count: number
}

export interface TagAggregate {
  tagId: number
  tagName: string
  tagColor: string
  total: number
  count: number
}

export interface TimePoint {
  label: string
  expenses: number
  income: number
  balance: number
  bankAccountBalance: number
  expenseCount: number
  incomeCount: number
}

export interface InsightsTemporalResult {
  topItems: ItemAggregate[]
  topIncomes: IncomeAggregate[]
  topCategories: CategoryAggregate[]
  topTags: TagAggregate[]
  topIncomeCategories: CategoryAggregate[]
  topIncomeTags: TagAggregate[]
  timeline: TimePoint[]
  totalExpenses: number
  totalIncome: number
  totalBalance: number
}

export interface PeriodData {
  topItems: ItemAggregate[]
  topIncomes: IncomeAggregate[]
  topCategories: CategoryAggregate[]
  topTags: TagAggregate[]
  topIncomeCategories: CategoryAggregate[]
  topIncomeTags: TagAggregate[]
  timeline: TimePoint[]
  totalExpenses: number
  totalIncome: number
  totalBalance: number
}

export interface InsightsComparativeResult {
  periodALabel: string
  periodBLabel: string
  a: PeriodData
  b: PeriodData
}

// ── Period Detail types ──

export interface ValueRange {
  startMonth: string
  endMonth: string
  value: number
}

export interface CardSplitDetail {
  splitId: number
  cardId: number
  cardName: string
  cardType: string | null
  splitValue: number
  totalInstallments: number
  paidInstallments: number
  anticipations: { month: string; count: number }[]
  totalAnticipatedValue: number
}

export interface PeriodDetailItem {
  id: number
  description: string
  type: string
  effectiveValue: number
  baseValue: number
  store: string | null
  cardName: string | null
  cardType: string | null
  paymentMethod: string | null
  bankAccountName: string | null
  categoryId: number | null
  categoryName: string | null
  categoryColor: string | null
  categoryIcon: string | null
  tags: { id: number; name: string; color: string }[]
  totalInstallments: number | null
  allMonths: string[]
  firstMonth: string
  lastMonth: string
  anticipations: { month: string; count: number }[]
  totalAnticipatedValue: number
  cardSplits: CardSplitDetail[]
  valueHistory: ValueRange[]
}

export interface PeriodDetailIncome {
  id: number
  description: string
  effectiveValue: number
  baseValue: number
  categoryId: number | null
  categoryName: string | null
  categoryColor: string | null
  tags: { id: number; name: string; color: string }[]
  isRecurring: boolean
  allMonths: string[]
  firstMonth: string
  lastMonth: string
  valueHistory: ValueRange[]
}

export interface PeriodDetailResult {
  periodLabel: string
  items: PeriodDetailItem[]
  incomes: PeriodDetailIncome[]
  totalExpenses: number
  totalIncome: number
}
