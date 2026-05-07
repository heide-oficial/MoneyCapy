import type { ItemInterruption } from '../types/entities'
import { addMonths, previousMonth } from '../../../../shared/month-utils'

export { addMonths, previousMonth }

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
