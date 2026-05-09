import { WrappedDatabase } from '../connection'
import { addMonths, monthDiff } from '../../utils/month-utils'

export class CardsRepository {
  constructor(private db: WrappedDatabase) {}

  private getTotalAnticipated(itemId: number): number {
    const row = this.db.prepare(
      'SELECT COALESCE(SUM(count), 0) as total FROM item_anticipations WHERE item_id = ? AND split_id IS NULL'
    ).get(itemId) as any
    return row.total
  }

  private getTotalAnticipatedForSplit(splitId: number): number {
    const row = this.db.prepare(
      'SELECT COALESCE(SUM(count), 0) as total FROM item_anticipations WHERE split_id = ?'
    ).get(splitId) as any
    return row.total
  }

  private getAnticipatedInMonth(itemId: number, month: string): number {
    const row = this.db.prepare(
      'SELECT COALESCE(count, 0) as count FROM item_anticipations WHERE item_id = ? AND split_id IS NULL AND month = ?'
    ).get(itemId, month) as any
    return row ? row.count : 0
  }

  private getAnticipatedInMonthForSplit(splitId: number, month: string): number {
    const row = this.db.prepare(
      'SELECT COALESCE(count, 0) as count FROM item_anticipations WHERE split_id = ? AND month = ?'
    ).get(splitId, month) as any
    return row ? row.count : 0
  }

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

  findAll(personId?: number) {
    if (personId) {
      return this.db.prepare(
        `SELECT cards.*, cur.symbol as currency_symbol, cur.code as currency_code, cur.exchange_rate as currency_exchange_rate
         FROM cards LEFT JOIN currencies cur ON cards.currency_id = cur.id
         WHERE cards.person_id = ? ORDER BY cards.name`
      ).all(personId)
    }
    return this.db.prepare(
      `SELECT cards.*, cur.symbol as currency_symbol, cur.code as currency_code, cur.exchange_rate as currency_exchange_rate
       FROM cards LEFT JOIN currencies cur ON cards.currency_id = cur.id
       ORDER BY cards.name`
    ).all()
  }

  findByBankAccountId(bankAccountId: number) {
    return this.db.prepare(
      `SELECT cards.*, cur.symbol as currency_symbol, cur.code as currency_code, cur.exchange_rate as currency_exchange_rate
       FROM cards LEFT JOIN currencies cur ON cards.currency_id = cur.id
       WHERE cards.bank_account_id = ? ORDER BY cards.name`
    ).all(bankAccountId)
  }

  findById(id: number) {
    return this.db.prepare(
      `SELECT cards.*, cur.symbol as currency_symbol, cur.code as currency_code, cur.exchange_rate as currency_exchange_rate
       FROM cards LEFT JOIN currencies cur ON cards.currency_id = cur.id
       WHERE cards.id = ?`
    ).get(id)
  }

  create(data: {
    name: string
    person_id?: number | null
    bank_account_id?: number | null
    number_encrypted: string; number_iv: string; number_tag: string
    expiration_encrypted: string; expiration_iv: string; expiration_tag: string
    holder_encrypted: string; holder_iv: string; holder_tag: string
    total_limit: number; billing_close_day: number; due_day: number
    card_type?: string
    currency_id?: number | null
  }) {
    const cols = `name, person_id, bank_account_id, number_encrypted, number_iv, number_tag,
        expiration_encrypted, expiration_iv, expiration_tag,
        holder_encrypted, holder_iv, holder_tag,
        total_limit, billing_close_day, due_day, card_type, currency_id`
    const params: any[] = [
      data.name, data.person_id || null, data.bank_account_id ?? null,
      data.number_encrypted, data.number_iv, data.number_tag,
      data.expiration_encrypted, data.expiration_iv, data.expiration_tag,
      data.holder_encrypted, data.holder_iv, data.holder_tag,
      data.total_limit, data.billing_close_day, data.due_day,
      data.card_type || 'both', data.currency_id ?? null
    ]
    const placeholders = params.map(() => '?').join(', ')
    const result = this.db.prepare(`INSERT INTO cards (${cols}) VALUES (${placeholders})`).run(...params)
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
    this.db.prepare(`UPDATE cards SET ${fields.join(', ')} WHERE id = ?`).run(...values)
    return this.findById(id)
  }

  delete(id: number) {
    this.db.prepare('DELETE FROM cards WHERE id = ?').run(id)
  }

  getUsedLimitForMonth(cardId: number, month: string): number {
    // Get card's own exchange rate so we can normalize items to card currency
    const cardRow = this.db.prepare(
      `SELECT c.currency_id, COALESCE(cur.exchange_rate, 1.0) as card_rate
       FROM cards c LEFT JOIN currencies cur ON c.currency_id = cur.id WHERE c.id = ?`
    ).get(cardId) as any
    const cardRate = cardRow?.card_rate || 1.0

    let total = 0

    // Common items with this card in this exact month (credit only)
    const commonItems = this.db.prepare(
      `SELECT id, value, exchange_rate_snapshot FROM section_items
       WHERE card_id = ? AND type = 'common' AND start_month = ? AND is_active = 1
       AND (payment_method IS NULL OR payment_method = 'credit')`
    ).all(cardId, month) as any[]
    for (const item of commonItems) {
      if (this.isItemInterrupted(item.id, month)) continue
      const snapshot = item.exchange_rate_snapshot || 1.0
      total += item.value * snapshot / cardRate
    }

    // Subscription items with this card visible in this month (credit only)
    const subs = this.db.prepare(
      `SELECT id, value, exchange_rate_snapshot FROM section_items
       WHERE card_id = ? AND type = 'subscription' AND start_month <= ? AND (end_month IS NULL OR end_month >= ?) AND is_active = 1
       AND (payment_method IS NULL OR payment_method = 'credit')`
    ).all(cardId, month, month) as any[]
    for (const sub of subs) {
      if (this.isItemInterrupted(sub.id, month)) continue
      const snapshot = sub.exchange_rate_snapshot || 1.0
      total += this.getEffectiveValueForSubscription(sub.id, sub.value, month) * snapshot / cardRate
    }

    // Installment items — need JS filtering
    const installmentItems = this.db.prepare(
      `SELECT id, value, total_installments, start_month, end_month, exchange_rate_snapshot FROM section_items
       WHERE card_id = ? AND (type = 'installment' OR type = 'emprestimo') AND start_month <= ? AND is_active = 1`
    ).all(cardId, month) as any[]

    for (const item of installmentItems) {
      if (this.isItemInterrupted(item.id, month)) continue
      const instCount = item.total_installments || 0
      if (instCount <= 0) continue
      if (item.end_month) {
        if (item.end_month < month) continue
      } else {
        const effectiveInst = instCount - this.getTotalAnticipated(item.id)
        if (effectiveInst <= 0) continue
        const endMonth = addMonths(item.start_month, effectiveInst)
        if (endMonth <= month) continue
      }
      const snapshot = item.exchange_rate_snapshot || 1.0
      const monthlyValue = item.value / instCount
      const monthsElapsed = monthDiff(item.start_month, month)
      const totalAnticipated = this.getTotalAnticipated(item.id)
      const anticipatedInMonth = this.getAnticipatedInMonth(item.id, month)
      const pastAnticipations = totalAnticipated - anticipatedInMonth
      const remaining = instCount - monthsElapsed - pastAnticipations
      total += Math.max(0, remaining) * monthlyValue * snapshot / cardRate
    }

    // Splits pointing to this card (credit only for common/subscription)
    const splitItems = this.db.prepare(
      `SELECT ics.id as split_id, ics.value, ics.total_installments, si.type, si.start_month, si.end_month, si.is_active, si.id as item_id,
              si.total_installments as item_total_installments, si.payment_method, si.exchange_rate_snapshot
       FROM item_card_splits ics
       JOIN section_items si ON ics.item_id = si.id
       WHERE ics.card_id = ? AND si.is_active = 1`
    ).all(cardId) as any[]

    for (const sp of splitItems) {
      if (this.isItemInterrupted(sp.item_id, month)) continue
      const isCredit = sp.payment_method === null || sp.payment_method === 'credit'
      const snapshot = sp.exchange_rate_snapshot || 1.0
      if (sp.type === 'common' && sp.start_month === month && isCredit) {
        total += sp.value * snapshot / cardRate
      } else if (sp.type === 'subscription' && sp.start_month <= month && (sp.end_month === null || sp.end_month >= month) && isCredit) {
        total += sp.value * snapshot / cardRate
      } else if ((sp.type === 'installment' || sp.type === 'emprestimo') && sp.start_month <= month) {
        const instCount = sp.total_installments || 0
        if (instCount <= 0) continue
        let visible = false
        if (sp.end_month) {
          visible = sp.end_month >= month
        } else {
          const effectiveInst = instCount - this.getTotalAnticipatedForSplit(sp.split_id)
          if (effectiveInst > 0) {
            const endMonth = addMonths(sp.start_month, effectiveInst)
            visible = endMonth > month
          }
        }
        if (visible) {
          const monthlyValue = sp.value / instCount
          const monthsElapsed = monthDiff(sp.start_month, month)
          const totalAnticipated = this.getTotalAnticipatedForSplit(sp.split_id)
          const anticipatedInMonth = this.getAnticipatedInMonthForSplit(sp.split_id, month)
          const pastAnticipations = totalAnticipated - anticipatedInMonth
          const remaining = instCount - monthsElapsed - pastAnticipations
          total += Math.max(0, remaining) * monthlyValue * snapshot / cardRate
        }
      }
    }

    return total
  }

  getItemCountsForMonth(cardId: number, month: string): {
    commonCount: number; commonTotal: number
    installmentCount: number; installmentTotal: number
    subscriptionCount: number; subscriptionTotal: number
    emprestimoCount: number; emprestimoTotal: number
  } {
    // Get card's own exchange rate to normalize items to card currency
    const cardRow = this.db.prepare(
      `SELECT COALESCE(cur.exchange_rate, 1.0) as card_rate
       FROM cards c LEFT JOIN currencies cur ON c.currency_id = cur.id WHERE c.id = ?`
    ).get(cardId) as any
    const cardRate = cardRow?.card_rate || 1.0

    let commonCount = 0, commonTotal = 0
    let installmentCount = 0, installmentTotal = 0
    let subscriptionCount = 0, subscriptionTotal = 0
    let emprestimoCount = 0, emprestimoTotal = 0

    // Common items with this card in this exact month
    const commons = this.db.prepare(
      `SELECT id, value, exchange_rate_snapshot FROM section_items
       WHERE card_id = ? AND type = 'common' AND start_month = ? AND is_active = 1`
    ).all(cardId, month) as any[]
    commonCount += commons.length
    commonTotal += commons.reduce((s: number, r: any) => s + r.value * (r.exchange_rate_snapshot || 1.0) / cardRate, 0)

    // Subscriptions directly on this card
    const subsForCount = this.db.prepare(
      `SELECT id, value, exchange_rate_snapshot FROM section_items
       WHERE card_id = ? AND type = 'subscription' AND start_month <= ? AND (end_month IS NULL OR end_month >= ?) AND is_active = 1`
    ).all(cardId, month, month) as any[]
    for (const sub of subsForCount) {
      if (this.isItemInterrupted(sub.id, month)) continue
      subscriptionCount++
      const snapshot = sub.exchange_rate_snapshot || 1.0
      subscriptionTotal += this.getEffectiveValueForSubscription(sub.id, sub.value, month) * snapshot / cardRate
    }

    // Installment and emprestimo items directly on this card
    const installments = this.db.prepare(
      `SELECT id, type, value, total_installments, start_month, end_month, exchange_rate_snapshot FROM section_items
       WHERE card_id = ? AND (type = 'installment' OR type = 'emprestimo') AND start_month <= ? AND is_active = 1`
    ).all(cardId, month) as any[]
    for (const item of installments) {
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
        const monthlyValue = (item.value / instCount) * (1 + anticipatedInMonth) * snapshot / cardRate
        if (item.type === 'emprestimo') {
          emprestimoCount++
          emprestimoTotal += monthlyValue
        } else {
          installmentCount++
          installmentTotal += monthlyValue
        }
      }
    }

    // Splits pointing to this card
    const splits = this.db.prepare(
      `SELECT ics.id as split_id, ics.value, ics.total_installments, ics.item_id, si.type, si.start_month, si.end_month, si.is_active, si.exchange_rate_snapshot
       FROM item_card_splits ics
       JOIN section_items si ON ics.item_id = si.id
       WHERE ics.card_id = ? AND si.is_active = 1`
    ).all(cardId) as any[]
    for (const sp of splits) {
      if (this.isItemInterrupted(sp.item_id, month)) continue
      const snapshot = sp.exchange_rate_snapshot || 1.0
      if (sp.type === 'common' && sp.start_month === month) {
        commonCount++
        commonTotal += sp.value * snapshot / cardRate
      } else if (sp.type === 'subscription' && sp.start_month <= month && (sp.end_month === null || sp.end_month >= month)) {
        subscriptionCount++
        subscriptionTotal += sp.value * snapshot / cardRate
      } else if ((sp.type === 'installment' || sp.type === 'emprestimo') && sp.start_month <= month) {
        let visible = false
        if (sp.end_month) {
          visible = sp.end_month >= month
        } else {
          const instCount = sp.total_installments || 0
          if (instCount > 0) {
            const effectiveInst = instCount - this.getTotalAnticipatedForSplit(sp.split_id)
            if (effectiveInst > 0) {
              const endMonth = addMonths(sp.start_month, effectiveInst)
              visible = endMonth > month
            }
          }
        }
        if (visible) {
          const instCount = sp.total_installments || 1
          const anticipatedInMonth = this.getAnticipatedInMonthForSplit(sp.split_id, month)
          const monthlyValue = (sp.value / instCount) * (1 + anticipatedInMonth) * snapshot / cardRate
          if (sp.type === 'emprestimo') {
            emprestimoCount++
            emprestimoTotal += monthlyValue
          } else {
            installmentCount++
            installmentTotal += monthlyValue
          }
        }
      }
    }

    return { commonCount, commonTotal, installmentCount, installmentTotal, subscriptionCount, subscriptionTotal, emprestimoCount, emprestimoTotal }
  }

}
