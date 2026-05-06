import type { ItemInterruption } from '../types/entities'

export function addMonths(month: string, count: number) {
  const [year, monthNumber] = month.split('-').map(Number)
  const total = year * 12 + monthNumber - 1 + count
  const nextYear = Math.floor(total / 12)
  const nextMonth = (total % 12) + 1
  return `${nextYear}-${String(nextMonth).padStart(2, '0')}`
}

export function previousMonth(month: string) {
  return addMonths(month, -1)
}

export function getActiveInterruption(interruptions: ItemInterruption[] | undefined, month: string) {
  return interruptions?.find(interruption => {
    if (interruption.resumeMonth) return month > interruption.endMonth && month < interruption.resumeMonth
    return month > interruption.endMonth
  }) || null
}

export function formatInterruptionSummary(
  interruption: ItemInterruption | null,
  fmtMonth: (month: string) => string,
  t: (key: string, vars?: Record<string, string>) => string
) {
  if (!interruption) return t('items.notInterrupted')

  const startMonth = addMonths(interruption.endMonth, 1)
  if (interruption.resumeMonth) {
    return t('items.interruptionRangeWithResume', {
      start: fmtMonth(startMonth),
      end: fmtMonth(previousMonth(interruption.resumeMonth)),
      resume: fmtMonth(interruption.resumeMonth)
    })
  }

  return t('items.interruptedPermanentlySince', { start: fmtMonth(startMonth) })
}
