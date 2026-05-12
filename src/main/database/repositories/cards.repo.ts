import { WrappedDatabase } from '../connection'
import { addMonths, monthDiff } from '../../utils/month-utils'
import { getInstallmentMonthValue } from '../../../../shared/installment-utils'

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

  private getDiscountedTotalInMonth(itemId: number, month: string): number | null {
    const row = this.db.prepare(
      'SELECT discounted_total FROM item_anticipations WHERE item_id = ? AND split_id IS NULL AND month = ?'
    ).get(itemId, month) as any
    return row ? row.discounted_total ?? null : null
  }

  private getDiscountedTotalInMonthForSplit(splitId: number, month: string): number | null {
    const row = this.db.prepare(
      'SELECT discounted_total FROM item_anticipations WHERE split_id = ? AND month = ?'
    ).get(splitId, month) as any
    return row ? row.discounted_total ?? null : null
  }

  private getCurrentInstallmentPayment(itemId: number, month: string, splitId?: number | null): { paid_value: number; original_value: number } | null {
    const row = splitId == null
      ? this.db.prepare(
        'SELECT paid_value, original_value FROM item_current_installment_payments WHERE item_id = ? AND month = ? AND split_id IS NULL LIMIT 1'
      ).get(itemId, month)
      : this.db.prepare(
        'SELECT paid_value, original_value FROM item_current_installment_payments WHERE item_id = ? AND month = ? AND split_id = ? LIMIT 1'
      ).get(itemId, month, splitId)
    return row ? (row as any) : null
  }

  private getPaidMonthsCount(itemId: number, startMonth: string, endMonth: string): number {
    const row = this.db.prepare(
      `SELECT COUNT(*) as count
       FROM item_monthly_status
       WHERE item_id = ? AND is_paid = 1 AND month >= ? AND month <= ?`
    ).get(itemId, startMonth, endMonth) as any
    return row?.count || 0
  }

  private isItemPaid(itemId: number, month: string): boolean {
    const row = this.db.prepare(
      'SELECT is_paid FROM item_monthly_status WHERE item_id = ? AND month = ?'
    ).get(itemId, month) as any
    return row ? row.is_paid === 1 : false
  }

  private isInvoiceMarkedPaid(cardId: number, month: string): boolean | null {
    const row = this.db.prepare(
      'SELECT is_paid FROM card_invoice_status WHERE card_id = ? AND month = ?'
    ).get(cardId, month) as any
    if (!row) return null
    return row.is_paid === 1
  }

  private getCreditInvoiceItemIds(cardId: number, month: string): number[] {
    const ids = new Set<number>()
    const rows = this.db.prepare(
      `SELECT si.id, si.type, si.start_month, si.end_month, si.total_installments, si.is_active,
              si.payment_method, NULL as split_id, NULL as split_installments
       FROM section_items si
       WHERE si.card_id = ? AND si.is_active = 1 AND (si.payment_method IS NULL OR si.payment_method = 'credit')
       UNION ALL
       SELECT si.id, si.type, si.start_month, si.end_month, ics.total_installments, si.is_active,
              COALESCE(ics.payment_method, si.payment_method) as payment_method,
              ics.id as split_id, ics.total_installments as split_installments
       FROM item_card_splits ics
       JOIN section_items si ON si.id = ics.item_id
       WHERE ics.card_id = ? AND si.is_active = 1 AND (COALESCE(ics.payment_method, si.payment_method) IS NULL OR COALESCE(ics.payment_method, si.payment_method) = 'credit')`
    ).all(cardId, cardId) as any[]

    for (const row of rows) {
      if (this.isItemInterrupted(row.id, month)) continue
      if (row.type === 'common') {
        if (row.start_month === month) ids.add(row.id)
      } else if (row.type === 'subscription') {
        if (row.start_month <= month && (!row.end_month || row.end_month >= month)) ids.add(row.id)
      } else if (row.type === 'installment' || row.type === 'emprestimo') {
        if (row.start_month > month) continue
        const instCount = row.split_id ? (row.split_installments || 0) : (row.total_installments || 0)
        if (instCount <= 0) continue
        if (row.end_month) {
          if (row.end_month >= month) ids.add(row.id)
        } else {
          const anticipated = row.split_id
            ? this.getTotalAnticipatedForSplit(row.split_id)
            : this.getTotalAnticipated(row.id)
          const effectiveInst = instCount - anticipated
          if (effectiveInst > 0 && addMonths(row.start_month, effectiveInst) > month) ids.add(row.id)
        }
      }
    }

    return Array.from(ids)
  }

  isInvoicePaid(cardId: number, month: string): boolean {
    const marked = this.isInvoiceMarkedPaid(cardId, month)
    if (marked !== null) return marked

    const itemIds = this.getCreditInvoiceItemIds(cardId, month)
    if (itemIds.length === 0) return false
    const placeholders = itemIds.map(() => '?').join(',')
    const row = this.db.prepare(
      `SELECT COUNT(*) as paid_count
       FROM item_monthly_status
       WHERE item_id IN (${placeholders}) AND month = ? AND is_paid = 1`
    ).get(...itemIds, month) as any
    return (row?.paid_count || 0) === itemIds.length
  }

  setInvoicePaid(cardId: number, month: string, isPaid: boolean, paidAt?: string | null): void {
    const date = isPaid ? (paidAt || new Date().toISOString().substring(0, 10)) : null
    this.db.prepare(`
      INSERT INTO card_invoice_status (card_id, month, is_paid, paid_at, updated_at)
      VALUES (?, ?, ?, ?, datetime('now'))
      ON CONFLICT(card_id, month) DO UPDATE SET
        is_paid = excluded.is_paid,
        paid_at = excluded.paid_at,
        updated_at = excluded.updated_at
    `).run(cardId, month, isPaid ? 1 : 0, date)
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

  private getLimitStartMonth(startMonth: string, billingDayMonthOffset: number | null | undefined): string {
    return addMonths(startMonth, billingDayMonthOffset || 0)
  }

  private getInvoiceMonthForLimitMonth(limitMonth: string, billingDayMonthOffset: number | null | undefined): string {
    return addMonths(limitMonth, -(billingDayMonthOffset || 0))
  }

  findAll(personId?: number) {
    if (personId) {
      return this.db.prepare(
        `SELECT cards.*, cur.symbol as currency_symbol, cur.code as currency_code, cur.exchange_rate as currency_exchange_rate,
                clg.name as limit_group_name, clg.total_limit as limit_group_total_limit, clg.currency_id as limit_group_currency_id,
                lgcur.symbol as limit_group_currency_symbol, lgcur.code as limit_group_currency_code, lgcur.exchange_rate as limit_group_currency_exchange_rate,
                (SELECT COUNT(*) FROM cards c2 WHERE c2.limit_group_id = clg.id) as limit_group_card_count
         FROM cards
         LEFT JOIN currencies cur ON cards.currency_id = cur.id
         LEFT JOIN card_limit_groups clg ON cards.limit_group_id = clg.id
         LEFT JOIN currencies lgcur ON clg.currency_id = lgcur.id
         WHERE cards.person_id = ? ORDER BY cards.name`
      ).all(personId)
    }
    return this.db.prepare(
      `SELECT cards.*, cur.symbol as currency_symbol, cur.code as currency_code, cur.exchange_rate as currency_exchange_rate,
              clg.name as limit_group_name, clg.total_limit as limit_group_total_limit, clg.currency_id as limit_group_currency_id,
              lgcur.symbol as limit_group_currency_symbol, lgcur.code as limit_group_currency_code, lgcur.exchange_rate as limit_group_currency_exchange_rate,
              (SELECT COUNT(*) FROM cards c2 WHERE c2.limit_group_id = clg.id) as limit_group_card_count
       FROM cards
       LEFT JOIN currencies cur ON cards.currency_id = cur.id
       LEFT JOIN card_limit_groups clg ON cards.limit_group_id = clg.id
       LEFT JOIN currencies lgcur ON clg.currency_id = lgcur.id
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
      `SELECT cards.*, cur.symbol as currency_symbol, cur.code as currency_code, cur.exchange_rate as currency_exchange_rate,
              clg.name as limit_group_name, clg.total_limit as limit_group_total_limit, clg.currency_id as limit_group_currency_id,
              lgcur.symbol as limit_group_currency_symbol, lgcur.code as limit_group_currency_code, lgcur.exchange_rate as limit_group_currency_exchange_rate,
              (SELECT COUNT(*) FROM cards c2 WHERE c2.limit_group_id = clg.id) as limit_group_card_count
       FROM cards
       LEFT JOIN currencies cur ON cards.currency_id = cur.id
       LEFT JOIN card_limit_groups clg ON cards.limit_group_id = clg.id
       LEFT JOIN currencies lgcur ON clg.currency_id = lgcur.id
       WHERE cards.id = ?`
    ).get(id)
  }

  findLimitGroupsByPerson(personId?: number | null) {
    const baseSql = `
      SELECT clg.*, cur.symbol as currency_symbol, cur.code as currency_code, cur.exchange_rate as currency_exchange_rate,
             COUNT(cards.id) as card_count
      FROM card_limit_groups clg
      LEFT JOIN currencies cur ON clg.currency_id = cur.id
      LEFT JOIN cards ON cards.limit_group_id = clg.id
    `
    const suffix = ` GROUP BY clg.id ORDER BY clg.name`
    if (personId) {
      return this.db.prepare(`${baseSql} WHERE clg.person_id = ?${suffix}`).all(personId)
    }
    return this.db.prepare(`${baseSql}${suffix}`).all()
  }

  findLimitGroupById(id: number) {
    return this.db.prepare(
      `SELECT clg.*, cur.symbol as currency_symbol, cur.code as currency_code, cur.exchange_rate as currency_exchange_rate,
              COUNT(cards.id) as card_count
       FROM card_limit_groups clg
       LEFT JOIN currencies cur ON clg.currency_id = cur.id
       LEFT JOIN cards ON cards.limit_group_id = clg.id
       WHERE clg.id = ?
       GROUP BY clg.id`
    ).get(id)
  }

  createLimitGroup(data: {
    person_id?: number | null
    name: string
    total_limit: number
    currency_id?: number | null
  }) {
    const result = this.db.prepare(`
      INSERT INTO card_limit_groups (person_id, name, total_limit, currency_id)
      VALUES (?, ?, ?, ?)
    `).run(data.person_id ?? null, data.name, data.total_limit || 0, data.currency_id ?? null)
    return this.findLimitGroupById(result.lastInsertRowid as number)
  }

  updateLimitGroup(id: number, data: Record<string, any>) {
    const fields: string[] = []
    const values: any[] = []
    for (const [key, value] of Object.entries(data)) {
      if (value !== undefined && key !== 'id') {
        fields.push(`${key} = ?`)
        values.push(value)
      }
    }
    if (fields.length === 0) return this.findLimitGroupById(id)
    fields.push("updated_at = datetime('now')")
    values.push(id)
    this.db.prepare(`UPDATE card_limit_groups SET ${fields.join(', ')} WHERE id = ?`).run(...values)
    return this.findLimitGroupById(id)
  }

  deleteLimitGroup(id: number) {
    this.db.prepare('UPDATE cards SET limit_group_id = NULL WHERE limit_group_id = ?').run(id)
    this.db.prepare('DELETE FROM card_limit_groups WHERE id = ?').run(id)
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
    limit_group_id?: number | null
  }) {
    const cols = `name, person_id, bank_account_id, number_encrypted, number_iv, number_tag,
        expiration_encrypted, expiration_iv, expiration_tag,
        holder_encrypted, holder_iv, holder_tag,
        total_limit, billing_close_day, due_day, card_type, currency_id, limit_group_id`
    const params: any[] = [
      data.name, data.person_id || null, data.bank_account_id ?? null,
      data.number_encrypted, data.number_iv, data.number_tag,
      data.expiration_encrypted, data.expiration_iv, data.expiration_tag,
      data.holder_encrypted, data.holder_iv, data.holder_tag,
      data.total_limit, data.billing_close_day, data.due_day,
      data.card_type || 'both', data.currency_id ?? null, data.limit_group_id ?? null
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
    this.db.prepare('DELETE FROM card_invoice_status WHERE card_id = ?').run(id)
    this.db.prepare('DELETE FROM cards WHERE id = ?').run(id)
  }

  getUsedLimitForMonth(cardId: number, month: string): number {
    // Get card's own exchange rate so we can normalize items to card currency
    const cardRow = this.db.prepare(
      `SELECT c.currency_id, COALESCE(cur.exchange_rate, 1.0) as card_rate
       FROM cards c LEFT JOIN currencies cur ON c.currency_id = cur.id WHERE c.id = ?`
    ).get(cardId) as any
    const cardRate = cardRow?.card_rate || 1.0
    const maxInvoiceMonth = addMonths(month, 1)

    let total = 0

    // Common credit purchases consume limit in their billing month.
    const commonItems = this.db.prepare(
      `SELECT id, value, start_month, billing_day_month_offset, exchange_rate_snapshot FROM section_items
       WHERE card_id = ? AND type = 'common' AND start_month <= ? AND is_active = 1
       AND (payment_method IS NULL OR payment_method = 'credit')`
    ).all(cardId, maxInvoiceMonth) as any[]
    for (const item of commonItems) {
      const limitStartMonth = this.getLimitStartMonth(item.start_month, item.billing_day_month_offset)
      if (limitStartMonth !== month) continue
      if (this.isItemInterrupted(item.id, item.start_month)) continue
      if (this.isItemPaid(item.id, item.start_month) || this.isInvoicePaid(cardId, item.start_month)) continue
      const snapshot = item.exchange_rate_snapshot || 1.0
      total += item.value * snapshot / cardRate
    }

    // Subscription credit charges consume limit in the configured billing month for each invoice month.
    const subs = this.db.prepare(
      `SELECT id, value, start_month, end_month, billing_day_month_offset, exchange_rate_snapshot FROM section_items
       WHERE card_id = ? AND type = 'subscription' AND start_month <= ? AND is_active = 1
       AND (payment_method IS NULL OR payment_method = 'credit')`
    ).all(cardId, maxInvoiceMonth) as any[]
    for (const sub of subs) {
      const invoiceMonth = this.getInvoiceMonthForLimitMonth(month, sub.billing_day_month_offset)
      if (sub.start_month > invoiceMonth) continue
      if (sub.end_month && sub.end_month < invoiceMonth) continue
      if (this.isItemInterrupted(sub.id, invoiceMonth)) continue
      if (this.isItemPaid(sub.id, invoiceMonth) || this.isInvoicePaid(cardId, invoiceMonth)) continue
      const snapshot = sub.exchange_rate_snapshot || 1.0
      total += this.getEffectiveValueForSubscription(sub.id, sub.value, invoiceMonth) * snapshot / cardRate
    }

    // Installment credit purchases consume limit from their billing month, while installments still follow start_month.
    const installmentItems = this.db.prepare(
      `SELECT id, value, total_installments, start_month, end_month, billing_day_month_offset, exchange_rate_snapshot FROM section_items
       WHERE card_id = ? AND (type = 'installment' OR type = 'emprestimo') AND start_month <= ? AND is_active = 1
       AND (payment_method IS NULL OR payment_method = 'credit')`
    ).all(cardId, maxInvoiceMonth) as any[]

    for (const item of installmentItems) {
      const limitStartMonth = this.getLimitStartMonth(item.start_month, item.billing_day_month_offset)
      if (limitStartMonth > month) continue
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
      const monthsElapsed = month < item.start_month ? 0 : monthDiff(item.start_month, month) + 1
      const paidMonths = this.getPaidMonthsCount(item.id, limitStartMonth, month)
      const totalAnticipated = this.getTotalAnticipated(item.id)
      const anticipatedInMonth = this.getAnticipatedInMonth(item.id, month)
      const pastAnticipations = totalAnticipated - anticipatedInMonth
      const remaining = instCount - Math.max(monthsElapsed, paidMonths) - pastAnticipations
      total += Math.max(0, remaining) * monthlyValue * snapshot / cardRate
    }

    // Splits pointing to this card (credit only)
    const splitItems = this.db.prepare(
      `SELECT ics.id as split_id, ics.value, ics.total_installments, si.type, si.start_month, si.end_month, si.is_active, si.id as item_id,
              si.total_installments as item_total_installments, COALESCE(ics.payment_method, si.payment_method) as payment_method,
              si.billing_day_month_offset, si.exchange_rate_snapshot
       FROM item_card_splits ics
       JOIN section_items si ON ics.item_id = si.id
       WHERE ics.card_id = ? AND si.is_active = 1`
    ).all(cardId) as any[]

    for (const sp of splitItems) {
      const isCredit = sp.payment_method === null || sp.payment_method === 'credit'
      const snapshot = sp.exchange_rate_snapshot || 1.0
      if (sp.type === 'common' && isCredit) {
        const limitStartMonth = this.getLimitStartMonth(sp.start_month, sp.billing_day_month_offset)
        if (limitStartMonth !== month) continue
        if (this.isItemInterrupted(sp.item_id, sp.start_month)) continue
        if (this.isItemPaid(sp.item_id, sp.start_month) || this.isInvoicePaid(cardId, sp.start_month)) continue
        total += sp.value * snapshot / cardRate
      } else if (sp.type === 'subscription' && isCredit) {
        const invoiceMonth = this.getInvoiceMonthForLimitMonth(month, sp.billing_day_month_offset)
        if (sp.start_month > invoiceMonth) continue
        if (sp.end_month && sp.end_month < invoiceMonth) continue
        if (this.isItemInterrupted(sp.item_id, invoiceMonth)) continue
        if (this.isItemPaid(sp.item_id, invoiceMonth) || this.isInvoicePaid(cardId, invoiceMonth)) continue
        total += sp.value * snapshot / cardRate
      } else if ((sp.type === 'installment' || sp.type === 'emprestimo') && sp.start_month <= maxInvoiceMonth && isCredit) {
        const limitStartMonth = this.getLimitStartMonth(sp.start_month, sp.billing_day_month_offset)
        if (limitStartMonth > month) continue
        if (this.isItemInterrupted(sp.item_id, month)) continue
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
          const monthsElapsed = month < sp.start_month ? 0 : monthDiff(sp.start_month, month) + 1
          const paidMonths = this.getPaidMonthsCount(sp.item_id, limitStartMonth, month)
          const totalAnticipated = this.getTotalAnticipatedForSplit(sp.split_id)
          const anticipatedInMonth = this.getAnticipatedInMonthForSplit(sp.split_id, month)
          const pastAnticipations = totalAnticipated - anticipatedInMonth
          const remaining = instCount - Math.max(monthsElapsed, paidMonths) - pastAnticipations
          total += Math.max(0, remaining) * monthlyValue * snapshot / cardRate
        }
      }
    }

    return total
  }

  getLimitGroupUsedLimitForMonth(groupId: number, month: string): number {
    const group = this.findLimitGroupById(groupId) as any
    if (!group) return 0
    const groupRate = group.currency_exchange_rate || 1.0
    const groupCards = this.db.prepare(
      `SELECT cards.id, COALESCE(cur.exchange_rate, 1.0) as currency_exchange_rate
       FROM cards
       LEFT JOIN currencies cur ON cards.currency_id = cur.id
       WHERE cards.limit_group_id = ?`
    ).all(groupId) as any[]

    return groupCards.reduce((sum, card) => {
      const usedInCardCurrency = this.getUsedLimitForMonth(card.id, month)
      const cardRate = card.currency_exchange_rate || 1.0
      return sum + (usedInCardCurrency * cardRate / groupRate)
    }, 0)
  }

  getLimitMetricsForCard(card: any, month: string, groupUsageCache?: Map<number, number>) {
    if (card.limit_group_id) {
      const groupId = Number(card.limit_group_id)
      let usedLimit = groupUsageCache?.get(groupId)
      if (usedLimit === undefined) {
        usedLimit = this.getLimitGroupUsedLimitForMonth(groupId, month)
        groupUsageCache?.set(groupId, usedLimit)
      }
      const totalLimit = card.limit_group_total_limit ?? 0
      return {
        totalLimit,
        ownTotalLimit: card.total_limit || 0,
        usedLimit,
        availableLimit: Math.max(0, totalLimit - usedLimit),
        overLimitAmount: Math.max(0, usedLimit - totalLimit),
        limitGroupId: groupId,
        limitGroupName: card.limit_group_name || null,
        limitGroupCardCount: card.limit_group_card_count || 0,
        currencyId: card.limit_group_currency_id ?? card.currency_id ?? null,
        currencySymbol: card.limit_group_currency_symbol || card.currency_symbol || undefined,
        currencyCode: card.limit_group_currency_code || card.currency_code || undefined,
        currencyExchangeRate: card.limit_group_currency_exchange_rate || card.currency_exchange_rate || 1.0
      }
    }

    const usedLimit = this.getUsedLimitForMonth(card.id, month)
    const totalLimit = card.total_limit || 0
    return {
      totalLimit,
      ownTotalLimit: totalLimit,
      usedLimit,
      availableLimit: Math.max(0, totalLimit - usedLimit),
      overLimitAmount: Math.max(0, usedLimit - totalLimit),
      limitGroupId: null,
      limitGroupName: null,
      limitGroupCardCount: 0,
      currencyId: card.currency_id ?? null,
      currencySymbol: card.currency_symbol || undefined,
      currencyCode: card.currency_code || undefined,
      currencyExchangeRate: card.currency_exchange_rate || 1.0
    }
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
        const baseMonthly = item.value / instCount
        const currentPayment = this.getCurrentInstallmentPayment(item.id, month, null)
        const discounted = this.getDiscountedTotalInMonth(item.id, month)
        const monthlyValue = getInstallmentMonthValue({
          monthlyValue: baseMonthly,
          anticipatedCount: anticipatedInMonth,
          discountedTotal: discounted,
          currentPaymentPaidValue: currentPayment?.paid_value,
          currentPaymentOriginalValue: currentPayment?.original_value
        }) * snapshot / cardRate
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
          const baseMonthly = sp.value / instCount
          const currentPayment = this.getCurrentInstallmentPayment(sp.item_id, month, sp.split_id)
          const discounted = this.getDiscountedTotalInMonthForSplit(sp.split_id, month)
          const monthlyValue = getInstallmentMonthValue({
            monthlyValue: baseMonthly,
            anticipatedCount: anticipatedInMonth,
            discountedTotal: discounted,
            currentPaymentPaidValue: currentPayment?.paid_value,
            currentPaymentOriginalValue: currentPayment?.original_value
          }) * snapshot / cardRate
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
