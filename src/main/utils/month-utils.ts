export {
  addMonths,
  getCurrentMonth,
  isValidMonth,
  monthDiff,
  monthGt,
  monthLte,
  nextMonth,
  parseMonth,
  previousMonth
} from '../../../shared/month-utils'

/**
 * Get card_type for a card, with fallback if column doesn't exist.
 * Returns null if cardId is null/undefined, or the card_type string.
 */
export function getCardType(db: any, cardId: number | null | undefined): string | null {
  if (!cardId) return null
  try {
    const row = db.prepare('SELECT card_type FROM cards WHERE id = ?').get(cardId) as any
    return row?.card_type || null
  } catch {
    return null
  }
}
