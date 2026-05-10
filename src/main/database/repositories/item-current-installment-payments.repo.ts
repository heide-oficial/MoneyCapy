import { WrappedDatabase } from '../connection'

export interface CurrentInstallmentPaymentRow {
  id: number
  item_id: number
  split_id: number | null
  month: string
  original_value: number
  paid_value: number
  paid_at: string | null
  created_at?: string
  updated_at?: string | null
}

export interface CurrentInstallmentPaymentInput {
  itemId: number
  splitId?: number | null
  month: string
  originalValue: number
  paidValue: number
  paidAt?: string | null
}

export class ItemCurrentInstallmentPaymentsRepository {
  constructor(private db: WrappedDatabase) {}

  findByItemId(itemId: number): CurrentInstallmentPaymentRow[] {
    return this.db.prepare(
      'SELECT * FROM item_current_installment_payments WHERE item_id = ? ORDER BY month DESC, id DESC'
    ).all(itemId) as CurrentInstallmentPaymentRow[]
  }

  findByItemAndMonth(itemId: number, month: string): CurrentInstallmentPaymentRow[] {
    return this.db.prepare(
      'SELECT * FROM item_current_installment_payments WHERE item_id = ? AND month = ? ORDER BY split_id ASC, id ASC'
    ).all(itemId, month) as CurrentInstallmentPaymentRow[]
  }

  findByTarget(itemId: number, month: string, splitId?: number | null): CurrentInstallmentPaymentRow | null {
    const row = splitId == null
      ? this.db.prepare(
        'SELECT * FROM item_current_installment_payments WHERE item_id = ? AND month = ? AND split_id IS NULL LIMIT 1'
      ).get(itemId, month)
      : this.db.prepare(
        'SELECT * FROM item_current_installment_payments WHERE item_id = ? AND month = ? AND split_id = ? LIMIT 1'
      ).get(itemId, month, splitId)
    return (row as CurrentInstallmentPaymentRow | undefined) || null
  }

  upsert(input: CurrentInstallmentPaymentInput): CurrentInstallmentPaymentRow {
    const splitId = input.splitId ?? null
    const existing = this.findByTarget(input.itemId, input.month, splitId)

    if (existing) {
      this.db.prepare(`
        UPDATE item_current_installment_payments
        SET original_value = ?, paid_value = ?, paid_at = ?, updated_at = datetime('now')
        WHERE id = ?
      `).run(input.originalValue, input.paidValue, input.paidAt ?? null, existing.id)
      return this.findById(existing.id)!
    }

    const result = this.db.prepare(`
      INSERT INTO item_current_installment_payments (item_id, split_id, month, original_value, paid_value, paid_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(input.itemId, splitId, input.month, input.originalValue, input.paidValue, input.paidAt ?? null)

    return this.findById(result.lastInsertRowid as number)!
  }

  findById(id: number): CurrentInstallmentPaymentRow | null {
    const row = this.db.prepare('SELECT * FROM item_current_installment_payments WHERE id = ?').get(id)
    return (row as CurrentInstallmentPaymentRow | undefined) || null
  }

  deleteById(id: number): void {
    this.db.prepare('DELETE FROM item_current_installment_payments WHERE id = ?').run(id)
  }

  getPaidValueForMonth(itemId: number, month: string, splitId?: number | null): number | null {
    const payment = this.findByTarget(itemId, month, splitId)
    return payment ? payment.paid_value : null
  }
}
