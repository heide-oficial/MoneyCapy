import type { IncomeRecord, SectionItem } from '../types/entities'
import { getActiveInterruption } from './interruptions'

export function getMonthlyExpenseValue(item: SectionItem): number {
  const rate = item.exchangeRateSnapshot || 1

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

export function getMonthlyIncomeValue(income: IncomeRecord): number {
  return income.effectiveValue * (income.exchangeRateSnapshot || 1)
}

export function isInterruptedInMonth(record: Pick<SectionItem | IncomeRecord, 'interruptions'>, month: string): boolean {
  return Boolean(getActiveInterruption(record.interruptions, month))
}

export function getActiveMonthlyExpenses(items: SectionItem[], month: string): SectionItem[] {
  return items.filter(item => item.isActive && !isInterruptedInMonth(item, month))
}

export function getNonInterruptedExpenses(items: SectionItem[], month: string): SectionItem[] {
  return items.filter(item => !isInterruptedInMonth(item, month))
}

export function sumActiveMonthlyExpenses(items: SectionItem[], month: string): number {
  return getActiveMonthlyExpenses(items, month).reduce((sum, item) => sum + getMonthlyExpenseValue(item), 0)
}

export function sumMonthlyIncomes(incomes: IncomeRecord[], month: string): number {
  return incomes
    .filter(income => !isInterruptedInMonth(income, month))
    .reduce((sum, income) => sum + getMonthlyIncomeValue(income), 0)
}

export function uniqueById<T extends { id: number }>(records: T[]): T[] {
  const seen = new Set<number>()
  const unique: T[] = []

  for (const record of records) {
    if (seen.has(record.id)) continue
    seen.add(record.id)
    unique.push(record)
  }

  return unique
}
