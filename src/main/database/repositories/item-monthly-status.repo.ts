import { WrappedDatabase } from '../connection'

export class ItemMonthlyStatusRepository {
  constructor(private db: WrappedDatabase) {}

  isPaid(itemId: number, month: string): boolean {
    const row = this.db.prepare(
      'SELECT is_paid FROM item_monthly_status WHERE item_id = ? AND month = ?'
    ).get(itemId, month) as any
    return row ? row.is_paid === 1 : false
  }

  getPaidAt(itemId: number, month: string): string | null {
    const row = this.db.prepare(
      'SELECT paid_at FROM item_monthly_status WHERE item_id = ? AND month = ?'
    ).get(itemId, month) as any
    return row?.paid_at || null
  }

  setPaid(itemId: number, month: string, isPaid: boolean, paidAt?: string | null): void {
    const date = isPaid ? (paidAt || new Date().toISOString().substring(0, 10)) : null
    this.db.prepare(`
      INSERT INTO item_monthly_status (item_id, month, is_paid, paid_at)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(item_id, month) DO UPDATE SET is_paid = excluded.is_paid, paid_at = excluded.paid_at
    `).run(itemId, month, isPaid ? 1 : 0, date)
  }

  togglePaid(itemId: number, month: string): boolean {
    const current = this.isPaid(itemId, month)
    const newState = !current
    this.setPaid(itemId, month, newState)
    return newState
  }

  getPaidStatusBatch(itemIds: number[], month: string): Map<number, { isPaid: boolean; paidAt: string | null }> {
    const result = new Map<number, { isPaid: boolean; paidAt: string | null }>()
    if (itemIds.length === 0) return result

    const placeholders = itemIds.map(() => '?').join(',')
    const rows = this.db.prepare(
      `SELECT item_id, is_paid, paid_at FROM item_monthly_status WHERE item_id IN (${placeholders}) AND month = ?`
    ).all(...itemIds, month) as any[]

    for (const id of itemIds) {
      result.set(id, { isPaid: false, paidAt: null })
    }
    for (const row of rows) {
      result.set(row.item_id, { isPaid: row.is_paid === 1, paidAt: row.paid_at || null })
    }
    return result
  }

  // Monthly active status methods

  getMonthlyActive(itemId: number, month: string): boolean | null {
    const row = this.db.prepare(
      'SELECT is_active FROM item_monthly_status WHERE item_id = ? AND month = ?'
    ).get(itemId, month) as any
    if (!row || row.is_active === null || row.is_active === undefined) return null
    return row.is_active === 1
  }

  setMonthlyActive(itemId: number, month: string, isActive: boolean | null): void {
    const val = isActive === null ? null : (isActive ? 1 : 0)
    this.db.prepare(`
      INSERT INTO item_monthly_status (item_id, month, is_paid, is_active)
      VALUES (?, ?, 0, ?)
      ON CONFLICT(item_id, month) DO UPDATE SET is_active = excluded.is_active
    `).run(itemId, month, val)
  }

  isActiveInMonth(itemId: number, month: string, globalIsActive: boolean): boolean {
    const monthly = this.getMonthlyActive(itemId, month)
    if (monthly !== null) return monthly
    return globalIsActive
  }
}
