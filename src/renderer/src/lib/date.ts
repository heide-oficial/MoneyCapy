import { useLocaleArray } from '../contexts/LanguageContext'

export const MONTH_NAMES = [
  'Janeiro', 'Fevereiro', 'Marco', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
]

export const MONTH_NAMES_SHORT = [
  'Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun',
  'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'
]

export function useLocalizedMonths() {
  const monthsFull = useLocaleArray('months.full')
  const monthsShort = useLocaleArray('months.short')
  const names = monthsFull.length === 12 ? monthsFull : MONTH_NAMES
  const namesShort = monthsShort.length === 12 ? monthsShort : MONTH_NAMES_SHORT

  const getMonthLabel = (month: string | null | undefined): string => {
    if (!month) return ''
    const [year, m] = month.split('-')
    return `${names[parseInt(m) - 1]} ${year}`
  }

  return { monthNames: names, monthNamesShort: namesShort, getMonthLabel }
}

export function getCurrentMonth(): string {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
}

export function getMonthLabel(month: string | null | undefined): string {
  if (!month) return ''
  const [year, m] = month.split('-')
  return `${MONTH_NAMES[parseInt(m) - 1]} ${year}`
}

export function getMonthsOfYear(year: number): string[] {
  return Array.from({ length: 12 }, (_, i) => `${year}-${String(i + 1).padStart(2, '0')}`)
}

export function getPreviousMonth(month: string): string {
  if (!month) return getCurrentMonth()
  const [year, m] = month.split('-').map(Number)
  if (m === 1) return `${year - 1}-12`
  return `${year}-${String(m - 1).padStart(2, '0')}`
}

export function getNextMonth(month: string): string {
  if (!month) return getCurrentMonth()
  const [year, m] = month.split('-').map(Number)
  if (m === 12) return `${year + 1}-01`
  return `${year}-${String(m + 1).padStart(2, '0')}`
}

// ── Configurable date formatting ──

import type { DateOrder, DateSeparator } from '../contexts/DateFormatContext'
import { useDateFormat } from '../contexts/DateFormatContext'

/** Format YYYY-MM → "MM/YYYY" or "YYYY-MM" etc */
export function formatMonth(m: string, order: DateOrder, sep: DateSeparator): string {
  const [y, mo] = m.split('-')
  if (order === 'YMD') return `${y}${sep}${mo}`
  return `${mo}${sep}${y}`  // DMY and MDY are same for month-only (MM/YYYY)
}

/** Format YYYY-MM-DD (or datetime string) → "DD/MM/YYYY" etc */
export function formatDate(d: string, order: DateOrder, sep: DateSeparator): string {
  const [y, mo, day] = d.substring(0, 10).split('-')
  switch (order) {
    case 'DMY': return `${day}${sep}${mo}${sep}${y}`
    case 'YMD': return `${y}${sep}${mo}${sep}${day}`
    case 'MDY': return `${mo}${sep}${day}${sep}${y}`
  }
}

/** Hook: returns ready-to-use format functions bound to current settings */
export function useFormatDate() {
  const { order, separator } = useDateFormat()
  return {
    fmtMonth: (m: string) => formatMonth(m, order, separator),
    fmtDate: (d: string) => formatDate(d, order, separator)
  }
}
