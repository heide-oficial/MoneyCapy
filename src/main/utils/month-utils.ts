export function addMonths(month: string, n: number): string {
  const [y, m] = month.split('-').map(Number)
  const total = (y * 12 + m - 1) + n
  const ny = Math.floor(total / 12)
  const nm = (total % 12) + 1
  return `${ny}-${String(nm).padStart(2, '0')}`
}

export function monthDiff(a: string, b: string): number {
  const [ay, am] = a.split('-').map(Number)
  const [by, bm] = b.split('-').map(Number)
  return (by - ay) * 12 + (bm - am)
}

export function monthLte(a: string, b: string): boolean {
  return a <= b
}

export function monthGt(a: string, b: string): boolean {
  return a > b
}

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
