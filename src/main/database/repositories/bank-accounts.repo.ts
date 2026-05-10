import { WrappedDatabase } from '../connection'
import { addMonths } from '../../utils/month-utils'

export class BankAccountsRepository {
  constructor(private db: WrappedDatabase) {}

  private isItemInterrupted(itemId: number, month: string): boolean {
    const rows = this.db.prepare(
      'SELECT end_month, resume_month FROM item_interruptions WHERE item_id = ?'
    ).all(itemId) as any[]
    return rows.some(row => row.resume_month ? month > row.end_month && month < row.resume_month : month > row.end_month)
  }

  private getEffectiveValueForSubscription(itemId: number, baseValue: number, month: string): number {
    const row = this.db.prepare(
      'SELECT value FROM item_monthly_values WHERE item_id = ? AND month <= ? ORDER BY month DESC LIMIT 1'
    ).get(itemId, month) as any
    return row ? row.value : baseValue
  }

  findByPersonId(personId: number) {
    return this.db.prepare(
      `SELECT ba.*, cur.symbol as currency_symbol, cur.code as currency_code, cur.exchange_rate as currency_exchange_rate
       FROM bank_accounts ba
       LEFT JOIN currencies cur ON ba.currency_id = cur.id
       WHERE ba.person_id = ? ORDER BY ba.name`
    ).all(personId)
  }

  findById(id: number) {
    return this.db.prepare(
      `SELECT ba.*, cur.symbol as currency_symbol, cur.code as currency_code, cur.exchange_rate as currency_exchange_rate
       FROM bank_accounts ba
       LEFT JOIN currencies cur ON ba.currency_id = cur.id
       WHERE ba.id = ?`
    ).get(id)
  }

  create(data: {
    person_id: number; name: string; balance?: number; icon?: string; color?: string
    account_type?: string; juridicidade?: string; agencia?: string | null
    conta?: string | null; banco?: string | null; nome_banco?: string | null
    currency_id?: number | null
  }) {
    const result = this.db.prepare(
      `INSERT INTO bank_accounts (person_id, name, balance, icon, color, account_type, juridicidade, agencia, conta, banco, nome_banco, currency_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      data.person_id, data.name, data.balance ?? 0,
      data.icon || 'Landmark', data.color || '#3b82f6',
      data.account_type || 'corrente', data.juridicidade || 'cpf',
      data.agencia ?? null, data.conta ?? null, data.banco ?? null, data.nome_banco ?? null,
      data.currency_id ?? null
    )
    return this.findById(result.lastInsertRowid as number)
  }

  update(id: number, data: Record<string, any>) {
    const fields: string[] = []
    const values: any[] = []
    for (const [key, value] of Object.entries(data)) {
      if (value !== undefined && key !== 'id') {
        fields.push(`${key} = ?`)
        values.push(value)
      }
    }
    if (fields.length === 0) return this.findById(id)
    fields.push("updated_at = datetime('now')")
    values.push(id)
    this.db.prepare(`UPDATE bank_accounts SET ${fields.join(', ')} WHERE id = ?`).run(...values)
    return this.findById(id)
  }

  delete(id: number) {
    this.db.prepare('DELETE FROM bank_accounts WHERE id = ?').run(id)
  }

  getTotalByPerson(personId: number): number {
    const accounts = this.findByPersonId(personId) as any[]
    let total = 0
    for (const acc of accounts) {
      total += acc.balance * (acc.currency_exchange_rate || 1.0)
    }
    return total
  }

  getLinkedCardIds(bankAccountId: number): number[] {
    const rows = this.db.prepare(
      'SELECT id FROM cards WHERE bank_account_id = ?'
    ).all(bankAccountId) as any[]
    return rows.map(r => r.id)
  }

  countLinkedCards(bankAccountId: number): number {
    const row = this.db.prepare(
      'SELECT COUNT(*) as cnt FROM cards WHERE bank_account_id = ?'
    ).get(bankAccountId) as any
    return row.cnt
  }

  countLinkedLoans(bankAccountId: number, month?: string): number {
    if (!month) {
      const row = this.db.prepare(
        `SELECT COUNT(*) as cnt FROM section_items WHERE bank_account_id = ? AND type = 'emprestimo'`
      ).get(bankAccountId) as any
      return row.cnt
    }
    const loans = this.db.prepare(
      `SELECT id, total_installments, start_month, end_month FROM section_items
       WHERE bank_account_id = ? AND type = 'emprestimo' AND start_month <= ? AND is_active = 1`
    ).all(bankAccountId, month) as any[]
    let count = 0
    for (const loan of loans) {
      if (this.isItemInterrupted(loan.id, month)) continue
      if (loan.end_month) {
        if (loan.end_month >= month) count++
      } else {
        const instCount = loan.total_installments || 0
        if (instCount <= 0) continue
        const anticipated = this.getTotalAnticipated(loan.id)
        const effectiveInst = instCount - anticipated
        if (effectiveInst <= 0) continue
        const endMonth = addMonths(loan.start_month, effectiveInst)
        if (endMonth > month) count++
      }
    }
    return count
  }

  private getTotalAnticipated(itemId: number): number {
    const row = this.db.prepare(
      'SELECT COALESCE(SUM(count), 0) as total FROM item_anticipations WHERE item_id = ? AND split_id IS NULL'
    ).get(itemId) as any
    return row.total
  }

  private getAnticipatedInMonth(itemId: number, month: string): number {
    const row = this.db.prepare(
      'SELECT COALESCE(count, 0) as count FROM item_anticipations WHERE item_id = ? AND split_id IS NULL AND month = ?'
    ).get(itemId, month) as any
    return row ? row.count : 0
  }

  private getCurrentInstallmentPaidValue(itemId: number, month: string): number | null {
    const row = this.db.prepare(
      'SELECT paid_value FROM item_current_installment_payments WHERE item_id = ? AND month = ? AND split_id IS NULL LIMIT 1'
    ).get(itemId, month) as any
    return row ? row.paid_value ?? null : null
  }

  /**
   * Get item counts for items directly linked to this bank account (via bank_account_id on section_items)
   */
  getDirectItemCountsForMonth(bankAccountId: number, month: string): {
    commonCount: number; commonTotal: number
    installmentCount: number; installmentTotal: number
    subscriptionCount: number; subscriptionTotal: number
    emprestimoCount: number; emprestimoTotal: number
  } {
    let commonCount = 0, commonTotal = 0
    let installmentCount = 0, installmentTotal = 0
    let subscriptionCount = 0, subscriptionTotal = 0
    let emprestimoCount = 0, emprestimoTotal = 0

    const commons = this.db.prepare(
      `SELECT id, value, exchange_rate_snapshot FROM section_items
       WHERE bank_account_id = ? AND type = 'common' AND start_month = ? AND is_active = 1`
    ).all(bankAccountId, month) as any[]
    commonCount += commons.length
    commonTotal += commons.reduce((s: number, r: any) => s + r.value * (r.exchange_rate_snapshot || 1.0), 0)

    const subs = this.db.prepare(
      `SELECT id, value, exchange_rate_snapshot FROM section_items
       WHERE bank_account_id = ? AND type = 'subscription' AND start_month <= ? AND (end_month IS NULL OR end_month >= ?) AND is_active = 1`
    ).all(bankAccountId, month, month) as any[]
    for (const sub of subs) {
      if (this.isItemInterrupted(sub.id, month)) continue
      subscriptionCount++
      subscriptionTotal += this.getEffectiveValueForSubscription(sub.id, sub.value, month) * (sub.exchange_rate_snapshot || 1.0)
    }

    const instItems = this.db.prepare(
      `SELECT id, type, value, total_installments, start_month, end_month, exchange_rate_snapshot FROM section_items
       WHERE bank_account_id = ? AND (type = 'installment' OR type = 'emprestimo') AND start_month <= ? AND is_active = 1`
    ).all(bankAccountId, month) as any[]
    for (const item of instItems) {
      if (this.isItemInterrupted(item.id, month)) continue
      let visible = false
      if (item.end_month) {
        visible = item.end_month >= month
      } else {
        const instCount = item.total_installments || 0
        if (instCount > 0) {
          const effectiveInst = instCount - this.getTotalAnticipated(item.id)
          if (effectiveInst > 0) {
            const endMonth = addMonths(item.start_month, effectiveInst)
            visible = endMonth > month
          }
        }
      }
      if (visible) {
        const instCount = item.total_installments || 1
        const snapshot = item.exchange_rate_snapshot || 1.0
        const anticipatedInMonth = this.getAnticipatedInMonth(item.id, month)
        const baseMonthly = item.value / instCount
        const currentMonthly = this.getCurrentInstallmentPaidValue(item.id, month) ?? baseMonthly
        const monthlyValue = (currentMonthly + baseMonthly * anticipatedInMonth) * snapshot
        if (item.type === 'emprestimo') {
          emprestimoCount++
          emprestimoTotal += monthlyValue
        } else {
          installmentCount++
          installmentTotal += monthlyValue
        }
      }
    }

    return { commonCount, commonTotal, installmentCount, installmentTotal, subscriptionCount, subscriptionTotal, emprestimoCount, emprestimoTotal }
  }

  /**
   * Get the effective balance for a bank account in a given month.
   * Chain: exact month override → most recent prior override → base balance from bank_accounts table.
   */
  getMonthlyBalance(bankAccountId: number, month: string): number {
    // Try exact month
    const exact = this.db.prepare(
      'SELECT balance FROM bank_account_monthly_balance WHERE bank_account_id = ? AND month = ?'
    ).get(bankAccountId, month) as any
    if (exact) return exact.balance

    // Try most recent prior month
    const prior = this.db.prepare(
      'SELECT balance FROM bank_account_monthly_balance WHERE bank_account_id = ? AND month < ? ORDER BY month DESC LIMIT 1'
    ).get(bankAccountId, month) as any
    if (prior) return prior.balance

    // Fallback to base balance
    const base = this.findById(bankAccountId) as any
    return base ? base.balance : 0
  }

  setMonthlyBalance(bankAccountId: number, month: string, balance: number): void {
    this.db.prepare(
      `INSERT INTO bank_account_monthly_balance (bank_account_id, month, balance)
       VALUES (?, ?, ?)
       ON CONFLICT (bank_account_id, month) DO UPDATE SET balance = excluded.balance`
    ).run(bankAccountId, month, balance)
  }

  removeMonthlyBalance(bankAccountId: number, month: string): void {
    this.db.prepare(
      'DELETE FROM bank_account_monthly_balance WHERE bank_account_id = ? AND month = ?'
    ).run(bankAccountId, month)
  }

  hasMonthlyBalanceOverride(bankAccountId: number, month: string): boolean {
    const row = this.db.prepare(
      'SELECT 1 FROM bank_account_monthly_balance WHERE bank_account_id = ? AND month = ?'
    ).get(bankAccountId, month)
    return !!row
  }

  getTotalByPersonForMonth(personId: number, month: string): number {
    const accounts = this.findByPersonId(personId) as any[]
    let total = 0
    for (const acc of accounts) {
      const balance = this.getMonthlyBalance(acc.id, month)
      const rate = acc.currency_exchange_rate || 1.0
      total += balance * rate
    }
    return total
  }
}
