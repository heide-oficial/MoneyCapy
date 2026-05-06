import { WrappedDatabase } from '../connection'
import { addMonths, monthDiff, monthLte, monthGt } from '../../utils/month-utils'

export class SectionItemsRepository {
  constructor(private db: WrappedDatabase) {}

  private baseSelect() {
    return `
      SELECT si.*,
        cat.name as category_name, cat.icon as category_icon, cat.color as category_color,
        sub.name as subcategory_name, sub.color as subcategory_color,
        c.name as card_name, c.due_day as card_due_day,
        ba.name as bank_account_name,
        st.name as store_name,
        cur.symbol as currency_symbol, cur.code as currency_code
      FROM section_items si
      LEFT JOIN categories cat ON si.category_id = cat.id
      LEFT JOIN subcategories sub ON si.subcategory_id = sub.id
      LEFT JOIN cards c ON si.card_id = c.id
      LEFT JOIN bank_accounts ba ON si.bank_account_id = ba.id
      LEFT JOIN stores st ON si.store_id = st.id
      LEFT JOIN currencies cur ON si.currency_id = cur.id
    `
  }

  /** Item-level (non-split) total anticipated */
  private getTotalAnticipated(itemId: number): number {
    const row = this.db.prepare(
      'SELECT COALESCE(SUM(count), 0) as total FROM item_anticipations WHERE item_id = ? AND split_id IS NULL'
    ).get(itemId) as any
    return row.total
  }

  /** Split-level total anticipated */
  private getTotalAnticipatedForSplit(splitId: number): number {
    const row = this.db.prepare(
      'SELECT COALESCE(SUM(count), 0) as total FROM item_anticipations WHERE split_id = ?'
    ).get(splitId) as any
    return row.total
  }

  /** Item-level (non-split) anticipated in month */
  private getAnticipatedInMonth(itemId: number, month: string): number {
    const row = this.db.prepare(
      'SELECT COALESCE(count, 0) as count FROM item_anticipations WHERE item_id = ? AND split_id IS NULL AND month = ?'
    ).get(itemId, month) as any
    return row ? row.count : 0
  }

  /** Split-level anticipated in month */
  private getAnticipatedInMonthForSplit(splitId: number, month: string): number {
    const row = this.db.prepare(
      'SELECT COALESCE(count, 0) as count FROM item_anticipations WHERE split_id = ? AND month = ?'
    ).get(splitId, month) as any
    return row ? row.count : 0
  }

  /** Item-level discounted total in month */
  private getDiscountedTotalInMonth(itemId: number, month: string): number | null {
    const row = this.db.prepare(
      'SELECT discounted_total FROM item_anticipations WHERE item_id = ? AND split_id IS NULL AND month = ?'
    ).get(itemId, month) as any
    return row ? row.discounted_total ?? null : null
  }

  /** Split-level discounted total in month */
  private getDiscountedTotalInMonthForSplit(splitId: number, month: string): number | null {
    const row = this.db.prepare(
      'SELECT discounted_total FROM item_anticipations WHERE split_id = ? AND month = ?'
    ).get(splitId, month) as any
    return row ? row.discounted_total ?? null : null
  }

  /** Load interruptions for an item from item_interruptions table */
  private getInterruptions(itemId: number): { id: number; end_month: string; resume_month: string | null }[] {
    return this.db.prepare(
      'SELECT id, end_month, resume_month FROM item_interruptions WHERE item_id = ? ORDER BY end_month ASC'
    ).all(itemId) as any[]
  }

  /** Calculate total pause gap from interruptions that have completed before/at viewMonth */
  private calcTotalPauseGap(interruptions: { end_month: string; resume_month: string | null }[], viewMonth: string): number {
    let total = 0
    for (const int of interruptions) {
      if (int.resume_month && int.resume_month <= viewMonth) {
        total += monthDiff(int.end_month, int.resume_month) - 1
      }
    }
    return total
  }

  /** Check if a given month falls inside any interruption pause gap */
  private isMonthPaused(interruptions: { end_month: string; resume_month: string | null }[], month: string): boolean {
    for (const int of interruptions) {
      if (int.resume_month) {
        // Temporary: paused from end_month+1 to resume_month-1
        if (monthGt(month, int.end_month) && monthGt(int.resume_month, month)) return true
      } else {
        // Permanent: paused after end_month
        if (monthGt(month, int.end_month)) return true
      }
    }
    return false
  }

  /**
   * Check if a subscription item is visible in a given month (multi-interruption)
   */
  private isSubscriptionVisibleInMonth(item: any, month: string): boolean {
    if (!monthLte(item.start_month, month)) return false

    // Settled subscriptions use end_month directly
    if (item.end_reason === 'settled') {
      return monthLte(month, item.end_month)
    }

    const interruptions = this.getInterruptions(item.id)

    // If has end_month (not from interruption), check it
    if (item.end_month) return monthLte(month, item.end_month)

    return true
  }

  /**
   * Check if an installment item is visible in a given month (multi-interruption)
   */
  private isInstallmentVisibleInMonth(item: any, month: string): boolean {
    if (!monthLte(item.start_month, month)) return false

    // Settled items use end_month directly
    if (item.end_reason === 'settled') {
      return monthLte(month, item.end_month)
    }

    const interruptions = this.getInterruptions(item.id)

    // Calculate total pause gap for completed interruptions
    const totalPauseGap = this.calcTotalPauseGap(interruptions, month)

    const splits = this.db.prepare(
      'SELECT id, total_installments FROM item_card_splits WHERE item_id = ?'
    ).all(item.id) as any[]

    if (splits.length > 0) {
      for (const sp of splits) {
        const effectiveInst = sp.total_installments - this.getTotalAnticipatedForSplit(sp.id)
        if (effectiveInst > 0) {
          const endMonth = addMonths(item.start_month, effectiveInst + totalPauseGap)
          if (monthGt(endMonth, month)) return true
        }
      }
      return false
    }

    const maxInst = item.total_installments || 0
    if (maxInst <= 0) return false
    const effectiveInst = maxInst - this.getTotalAnticipated(item.id)
    if (effectiveInst <= 0) return false
    const endMonth = addMonths(item.start_month, effectiveInst + totalPauseGap)
    return monthGt(endMonth, month)
  }

  findByPersonAndMonth(personId: number, month: string, typeFilter?: string) {
    if (typeFilter && typeFilter !== 'common' && typeFilter !== 'installment' && typeFilter !== 'subscription' && typeFilter !== 'emprestimo') {
      typeFilter = undefined
    }

    // Get common items for exact month match
    let commonItems: any[] = []
    if (!typeFilter || typeFilter === 'common') {
      commonItems = this.db.prepare(
        `${this.baseSelect()} WHERE si.person_id = ? AND si.type = 'common' AND si.start_month = ? ORDER BY si.sort_order ASC, si.description ASC`
      ).all(personId, month)
    }

    // Get subscription items visible in month — filter in JS for interruption support
    let subscriptionItems: any[] = []
    if (!typeFilter || typeFilter === 'subscription') {
      const allSubscriptions = this.db.prepare(
        `${this.baseSelect()} WHERE si.person_id = ? AND si.type = 'subscription' AND si.start_month <= ? ORDER BY si.sort_order ASC, si.description ASC`
      ).all(personId, month)
      subscriptionItems = allSubscriptions.filter((item: any) => this.isSubscriptionVisibleInMonth(item, month))
    }

    // Get installment items — filter in JS
    let installmentItems: any[] = []
    if (!typeFilter || typeFilter === 'installment') {
      const allInstallments = this.db.prepare(
        `${this.baseSelect()} WHERE si.person_id = ? AND si.type = 'installment' AND si.start_month <= ? ORDER BY si.sort_order ASC, si.description ASC`
      ).all(personId, month)
      installmentItems = allInstallments.filter((item: any) => this.isInstallmentVisibleInMonth(item, month))
    }

    // Get emprestimo items — same visibility logic as installment
    let emprestimoItems: any[] = []
    if (!typeFilter || typeFilter === 'emprestimo') {
      const allEmprestimos = this.db.prepare(
        `${this.baseSelect()} WHERE si.person_id = ? AND si.type = 'emprestimo' AND si.start_month <= ? ORDER BY si.sort_order ASC, si.description ASC`
      ).all(personId, month)
      emprestimoItems = allEmprestimos.filter((item: any) => this.isInstallmentVisibleInMonth(item, month))
    }

    if (typeFilter === 'common') return commonItems
    if (typeFilter === 'installment') return installmentItems
    if (typeFilter === 'subscription') return subscriptionItems
    if (typeFilter === 'emprestimo') return emprestimoItems
    return [...commonItems, ...installmentItems, ...subscriptionItems, ...emprestimoItems]
  }

  findByCardIdAndMonth(cardId: number, month: string) {
    // Get direct card items
    const directItems = this.db.prepare(
      `${this.baseSelect()} WHERE si.card_id = ? ORDER BY si.description ASC`
    ).all(cardId) as any[]

    // Get split items with the split's totalInstallments for this specific card
    const splitRows = this.db.prepare(
      'SELECT id, item_id, total_installments FROM item_card_splits WHERE card_id = ?'
    ).all(cardId) as any[]

    const splitDataMap = new Map<number, { installments: number; splitId: number }>()
    for (const row of splitRows) {
      splitDataMap.set(row.item_id, { installments: row.total_installments, splitId: row.id })
    }

    let splitItems: any[] = []
    if (splitDataMap.size > 0) {
      const ids = Array.from(splitDataMap.keys())
      const placeholders = ids.map(() => '?').join(',')
      splitItems = this.db.prepare(
        `${this.baseSelect()} WHERE si.id IN (${placeholders}) ORDER BY si.description ASC`
      ).all(...ids) as any[]
    }

    // Merge & deduplicate, tagging with per-card installment count and split id
    const allItems = new Map<number, any>()
    for (const item of directItems) {
      allItems.set(item.id, { ...item, _card_installments: item.total_installments, _split_id: null })
    }
    for (const item of splitItems) {
      if (!allItems.has(item.id)) {
        const data = splitDataMap.get(item.id)
        allItems.set(item.id, { ...item, _card_installments: data?.installments || item.total_installments, _split_id: data?.splitId || null })
      }
    }

    // Filter by month visibility using per-card installment count and split-level anticipation
    return Array.from(allItems.values()).filter((item: any) => {
      if (item.type === 'common') return item.start_month === month
      if (item.type === 'subscription') return this.isSubscriptionVisibleInMonth(item, month)
      if (item.type === 'installment' || item.type === 'emprestimo') {
        if (!monthLte(item.start_month, month)) return false

        // Settled items
        if (item.end_reason === 'settled') {
          return monthLte(month, item.end_month)
        }

        const interruptions = this.getInterruptions(item.id)

        const totalPauseGap = this.calcTotalPauseGap(interruptions, month)

        const installments = item._card_installments || 0
        if (installments <= 0) return false
        const anticipated = item._split_id
          ? this.getTotalAnticipatedForSplit(item._split_id)
          : this.getTotalAnticipated(item.id)
        const effectiveInst = installments - anticipated
        if (effectiveInst <= 0) return false
        const endMonth = addMonths(item.start_month, effectiveInst + totalPauseGap)
        return monthGt(endMonth, month)
      }
      return false
    })
  }

  findById(id: number) {
    return this.db.prepare(
      `${this.baseSelect()} WHERE si.id = ?`
    ).get(id)
  }

  findAllByPerson(personId: number) {
    return this.db.prepare(
      `${this.baseSelect()} WHERE si.person_id = ? ORDER BY si.start_month DESC, si.description ASC`
    ).all(personId)
  }

  findByCategoryId(categoryId: number) {
    return this.db.prepare(
      `${this.baseSelect()} WHERE si.category_id = ? ORDER BY si.description ASC`
    ).all(categoryId)
  }

  findByTagId(tagId: number) {
    return this.db.prepare(
      `${this.baseSelect()} WHERE si.id IN (SELECT item_id FROM item_tags WHERE tag_id = ?) ORDER BY si.description ASC`
    ).all(tagId)
  }

  create(data: {
    person_id: number; category_id?: number | null; subcategory_id?: number | null; card_id?: number | null; bank_account_id?: number | null;
    description: string; type: string; value: number;
    due_day?: number | null; due_day_label?: string | null; due_day_type?: string | null;
    billing_day?: number | null; billing_day_type?: string | null;
    due_day_month_offset?: number | null;
    total_installments?: number | null;
    start_month: string; end_month?: string | null;
    notes?: string | null; store_id?: number | null; interest_rate?: number | null;
    payment_method?: string | null;
    base_value?: number | null;
    currency_id?: number | null;
    exchange_rate_snapshot?: number;
  }) {
    const result = this.db.prepare(`
      INSERT INTO section_items (person_id, category_id, subcategory_id, card_id, bank_account_id, description, type, value,
        due_day, due_day_label, due_day_type, billing_day, billing_day_type, due_day_month_offset,
        total_installments, start_month, end_month, notes, store_id, interest_rate, payment_method, base_value, currency_id, exchange_rate_snapshot, sort_order)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)
    `).run(
      data.person_id, data.category_id || null, data.subcategory_id || null, data.card_id || null, data.bank_account_id || null,
      data.description, data.type, data.value,
      data.due_day || null, data.due_day_label || null, data.due_day_type || 'static',
      data.billing_day || null, data.billing_day_type || 'static',
      data.due_day_month_offset || 0,
      data.total_installments || null,
      data.start_month, data.end_month || null,
      data.notes || null, data.store_id || null, data.interest_rate || null,
      data.payment_method || null,
      data.base_value ?? null,
      data.currency_id ?? null,
      data.exchange_rate_snapshot ?? 1.0
    )
    return this.findById(result.lastInsertRowid as number)
  }

  update(id: number, data: Record<string, any>) {
    const fields: string[] = []
    const values: any[] = []
    for (const [key, value] of Object.entries(data)) {
      if (value !== undefined && key !== 'id') {
        fields.push(`${key} = ?`)
        values.push(value === null ? null : value)
      }
    }
    if (fields.length === 0) return this.findById(id)
    fields.push("updated_at = datetime('now')")
    values.push(id)
    this.db.prepare(`UPDATE section_items SET ${fields.join(', ')} WHERE id = ?`).run(...values)
    return this.findById(id)
  }

  delete(id: number) {
    this.db.prepare('DELETE FROM section_items WHERE id = ?').run(id)
  }

  toggleActive(id: number) {
    this.db.prepare(
      "UPDATE section_items SET is_active = CASE WHEN is_active = 1 THEN 0 ELSE 1 END, updated_at = datetime('now') WHERE id = ?"
    ).run(id)
    return this.findById(id)
  }

  settle(itemId: number, endMonth: string) {
    this.db.prepare(
      "UPDATE section_items SET end_month = ?, end_reason = 'settled', updated_at = datetime('now') WHERE id = ?"
    ).run(endMonth, itemId)
  }


  getTotalByPersonAndMonth(personId: number, month: string, typeFilter?: string): number {
    const items = this.findByPersonAndMonth(personId, month, typeFilter)
    let total = 0
    for (const item of items as any[]) {
      if (item.is_active !== 1) continue
      if (this.isMonthPaused(this.getInterruptions(item.id), month)) continue
      const monthlyActive = this.db.prepare(
        'SELECT is_active FROM item_monthly_status WHERE item_id = ? AND month = ?'
      ).get(item.id, month) as any
      if (monthlyActive && monthlyActive.is_active === 0) continue
      const snapshot = item.exchange_rate_snapshot || 1.0
      if ((item.type === 'installment' || item.type === 'emprestimo') && item.total_installments) {
        // Check for splits — use per-split anticipation
        const splits = this.db.prepare(
          'SELECT id, value, total_installments FROM item_card_splits WHERE item_id = ?'
        ).all(item.id) as any[]
        if (splits.length > 0) {
          for (const sp of splits) {
            const splitAnticipated = this.getAnticipatedInMonthForSplit(sp.id, month)
            const monthly = Math.round((sp.value / sp.total_installments) * 100) / 100
            if (splitAnticipated > 0) {
              const discounted = this.getDiscountedTotalInMonthForSplit(sp.id, month)
              total += (monthly + (discounted != null ? discounted : monthly * splitAnticipated)) * snapshot
            } else {
              total += monthly * snapshot
            }
          }
        } else {
          const anticipatedInMonth = this.getAnticipatedInMonth(item.id, month)
          const monthly = Math.round((item.value / item.total_installments) * 100) / 100
          if (anticipatedInMonth > 0) {
            const discounted = this.getDiscountedTotalInMonth(item.id, month)
            total += (monthly + (discounted != null ? discounted : monthly * anticipatedInMonth)) * snapshot
          } else {
            total += monthly * snapshot
          }
        }
      } else {
        total += this.getEffectiveValue(item, month) * snapshot
      }
    }
    return total
  }

  setValueForMonth(itemId: number, month: string, value: number): void {
    this.db.prepare(`
      INSERT OR REPLACE INTO item_monthly_values (item_id, month, value, persistent)
      VALUES (?, ?, ?, 1)
    `).run(itemId, month, value)
  }

  removeValueOverride(itemId: number, month: string): void {
    this.db.prepare(
      'DELETE FROM item_monthly_values WHERE item_id = ? AND month = ?'
    ).run(itemId, month)
  }

  listValueOverrides(itemId: number): { month: string; value: number }[] {
    return this.db.prepare(
      'SELECT month, value FROM item_monthly_values WHERE item_id = ? ORDER BY month ASC'
    ).all(itemId) as any[]
  }

  getOverrideInfo(itemId: number, month: string): { value: number } | null {
    const row = this.db.prepare(
      'SELECT value FROM item_monthly_values WHERE item_id = ? AND month <= ? ORDER BY month DESC LIMIT 1'
    ).get(itemId, month) as any
    return row ? { value: row.value } : null
  }

  getEffectiveValue(item: any, month: string): number {
    if (item.type === 'subscription') {
      const info = this.getOverrideInfo(item.id, month)
      return info ? info.value : item.value
    }
    return item.value
  }

  search(personId: number, query: string, filters?: { type?: string; categoryId?: number; storeId?: number; cardId?: number; tagId?: number; isPaid?: boolean; isActive?: boolean; bankAccountId?: number }) {
    const conditions = ['si.person_id = ?', 'si.description LIKE ?']
    const params: any[] = [personId, `%${query}%`]

    if (filters?.type) {
      conditions.push('si.type = ?')
      params.push(filters.type)
    }
    if (filters?.categoryId) {
      conditions.push('si.category_id = ?')
      params.push(filters.categoryId)
    }
    if (filters?.storeId) {
      conditions.push('si.store_id = ?')
      params.push(filters.storeId)
    }
    if (filters?.cardId) {
      conditions.push('si.card_id = ?')
      params.push(filters.cardId)
    }
    if (filters?.tagId) {
      conditions.push('si.id IN (SELECT item_id FROM item_tags WHERE tag_id = ?)')
      params.push(filters.tagId)
    }
    if (filters?.isPaid !== undefined) {
      conditions.push('si.is_paid = ?')
      params.push(filters.isPaid ? 1 : 0)
    }
    if (filters?.isActive !== undefined) {
      conditions.push('si.is_active = ?')
      params.push(filters.isActive ? 1 : 0)
    }
    if (filters?.bankAccountId) {
      conditions.push('si.card_id IN (SELECT id FROM cards WHERE bank_account_id = ?)')
      params.push(filters.bankAccountId)
    }

    return this.db.prepare(`
      ${this.baseSelect()}
      WHERE ${conditions.join(' AND ')}
      ORDER BY si.start_month DESC
      LIMIT 50
    `).all(...params)
  }
}
