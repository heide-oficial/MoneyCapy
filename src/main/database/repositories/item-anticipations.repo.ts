import { WrappedDatabase } from '../connection'

export class ItemAnticipationsRepository {
  constructor(private db: WrappedDatabase) {}

  findByItemId(itemId: number): any[] {
    return this.db.prepare(
      'SELECT * FROM item_anticipations WHERE item_id = ? ORDER BY month ASC'
    ).all(itemId) as any[]
  }

  /** Total anticipated for item-level (non-split) anticipations */
  getTotalAnticipated(itemId: number): number {
    const row = this.db.prepare(
      'SELECT COALESCE(SUM(count), 0) as total FROM item_anticipations WHERE item_id = ? AND split_id IS NULL'
    ).get(itemId) as any
    return row.total
  }

  /** Total anticipated for a specific split */
  getTotalAnticipatedForSplit(splitId: number): number {
    const row = this.db.prepare(
      'SELECT COALESCE(SUM(count), 0) as total FROM item_anticipations WHERE split_id = ?'
    ).get(splitId) as any
    return row.total
  }

  /** Item-level anticipated before a given month (non-split) */
  getAnticipatedBeforeMonth(itemId: number, month: string): number {
    const row = this.db.prepare(
      'SELECT COALESCE(SUM(count), 0) as total FROM item_anticipations WHERE item_id = ? AND split_id IS NULL AND month < ?'
    ).get(itemId, month) as any
    return row.total
  }

  /** Split-level anticipated before a given month */
  getAnticipatedBeforeMonthForSplit(splitId: number, month: string): number {
    const row = this.db.prepare(
      'SELECT COALESCE(SUM(count), 0) as total FROM item_anticipations WHERE split_id = ? AND month < ?'
    ).get(splitId, month) as any
    return row.total
  }

  /** Item-level anticipated in a specific month (non-split) */
  getAnticipatedInMonth(itemId: number, month: string): number {
    const row = this.db.prepare(
      'SELECT COALESCE(count, 0) as count FROM item_anticipations WHERE item_id = ? AND split_id IS NULL AND month = ?'
    ).get(itemId, month) as any
    return row ? row.count : 0
  }

  /** Split-level anticipated in a specific month */
  getAnticipatedInMonthForSplit(splitId: number, month: string): number {
    const row = this.db.prepare(
      'SELECT COALESCE(count, 0) as count FROM item_anticipations WHERE split_id = ? AND month = ?'
    ).get(splitId, month) as any
    return row ? row.count : 0
  }

  getDiscountedTotalInMonth(itemId: number, month: string): number | null {
    const row = this.db.prepare(
      'SELECT discounted_total FROM item_anticipations WHERE item_id = ? AND split_id IS NULL AND month = ?'
    ).get(itemId, month) as any
    return row ? row.discounted_total ?? null : null
  }

  getDiscountedTotalInMonthForSplit(splitId: number, month: string): number | null {
    const row = this.db.prepare(
      'SELECT discounted_total FROM item_anticipations WHERE split_id = ? AND month = ?'
    ).get(splitId, month) as any
    return row ? row.discounted_total ?? null : null
  }

  create(itemId: number, month: string, count: number, splitId?: number, discountedTotal?: number): void {
    this.db.prepare(
      'INSERT INTO item_anticipations (item_id, split_id, month, count, discounted_total) VALUES (?, ?, ?, ?, ?)'
    ).run(itemId, splitId ?? null, month, count, discountedTotal ?? null)
  }

  deleteById(id: number): void {
    this.db.prepare('DELETE FROM item_anticipations WHERE id = ?').run(id)
  }

}
