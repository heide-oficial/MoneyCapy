import { WrappedDatabase } from '../connection'

export class IncomeMonthlyStatusRepository {
  constructor(private db: WrappedDatabase) {}

  isReceived(incomeId: number, month: string): boolean {
    const row = this.db.prepare(
      'SELECT is_received FROM income_monthly_status WHERE income_id = ? AND month = ?'
    ).get(incomeId, month) as any
    return row ? row.is_received === 1 : false
  }

  getReceivedAt(incomeId: number, month: string): string | null {
    const row = this.db.prepare(
      'SELECT received_at FROM income_monthly_status WHERE income_id = ? AND month = ?'
    ).get(incomeId, month) as any
    return row?.received_at || null
  }

  setReceived(incomeId: number, month: string, isReceived: boolean, receivedAt?: string | null): void {
    const date = isReceived ? (receivedAt || new Date().toISOString().substring(0, 10)) : null
    this.db.prepare(`
      INSERT INTO income_monthly_status (income_id, month, is_received, received_at)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(income_id, month) DO UPDATE SET is_received = excluded.is_received, received_at = excluded.received_at
    `).run(incomeId, month, isReceived ? 1 : 0, date)
  }

  toggleReceived(incomeId: number, month: string): boolean {
    const current = this.isReceived(incomeId, month)
    const newState = !current
    this.setReceived(incomeId, month, newState)
    return newState
  }
}
