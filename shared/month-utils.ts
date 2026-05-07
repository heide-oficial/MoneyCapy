const MONTH_PATTERN = /^\d{4}-(0[1-9]|1[0-2])$/

export function isValidMonth(month: string | null | undefined): month is string {
  return typeof month === 'string' && MONTH_PATTERN.test(month)
}

export function parseMonth(month: string): { year: number; month: number } | null {
  if (!isValidMonth(month)) return null
  const [year, monthNumber] = month.split('-').map(Number)
  return { year, month: monthNumber }
}

export function addMonths(month: string, offset: number): string {
  const parsed = parseMonth(month)
  if (!parsed || !Number.isFinite(offset)) return ''
  const total = parsed.year * 12 + parsed.month - 1 + offset
  const nextYear = Math.floor(total / 12)
  const nextMonth = (total % 12) + 1
  return `${nextYear}-${String(nextMonth).padStart(2, '0')}`
}

export function previousMonth(month: string): string {
  return addMonths(month, -1)
}

export function nextMonth(month: string): string {
  return addMonths(month, 1)
}

export function monthDiff(startMonth: string, endMonth: string): number {
  const start = parseMonth(startMonth)
  const end = parseMonth(endMonth)
  if (!start || !end) return 0
  return (end.year - start.year) * 12 + (end.month - start.month)
}

export function monthLte(a: string, b: string): boolean {
  return a <= b
}

export function monthGt(a: string, b: string): boolean {
  return a > b
}

export function getCurrentMonth(date = new Date()): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
}
