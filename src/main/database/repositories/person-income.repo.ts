import { WrappedDatabase } from '../connection'
import { monthLte, monthGt } from '../../utils/month-utils'

export class PersonIncomeRepository {
  constructor(private db: WrappedDatabase) {}

  /** Load interruptions for an income from income_interruptions table */
  private getIncomeInterruptions(incomeId: number): { id: number; end_month: string; resume_month: string | null }[] {
    return this.db.prepare(
      'SELECT id, end_month, resume_month FROM income_interruptions WHERE income_id = ? ORDER BY end_month ASC'
    ).all(incomeId) as any[]
  }

  /** Check if a given month falls inside any interruption pause gap */
  private isMonthPaused(interruptions: { end_month: string; resume_month: string | null }[], month: string): boolean {
    for (const int of interruptions) {
      if (int.resume_month) {
        if (monthGt(month, int.end_month) && monthGt(int.resume_month, month)) return true
      } else {
        if (monthGt(month, int.end_month)) return true
      }
    }
    return false
  }

  /** Check if an income is visible in a given month (considering interruptions) */
  private isIncomeVisibleInMonth(income: any, month: string): boolean {
    if (!monthLte(income.start_month, month)) return false

    // If has end_month, check it
    if (income.end_month && !monthLte(month, income.end_month)) return false

    return true
  }

  findByPersonId(personId: number) {
    return this.db.prepare(`
      SELECT pi.*, p.name as person_name,
        c.name as category_name, c.color as category_color,
        sub.name as subcategory_name, sub.color as subcategory_color,
        s.name as store_name, s.color as store_color,
        cur.symbol as currency_symbol, cur.code as currency_code
      FROM person_income pi
      LEFT JOIN people p ON pi.person_id = p.id
      LEFT JOIN categories c ON pi.category_id = c.id
      LEFT JOIN subcategories sub ON pi.subcategory_id = sub.id
      LEFT JOIN stores s ON pi.store_id = s.id
      LEFT JOIN currencies cur ON pi.currency_id = cur.id
      WHERE pi.person_id = ?
      ORDER BY pi.description
    `).all(personId)
  }

  findByPersonAndMonth(personId: number, month: string) {
    const all = this.db.prepare(`
      SELECT pi.*, p.name as person_name,
        c.name as category_name, c.color as category_color,
        sub.name as subcategory_name, sub.color as subcategory_color,
        s.name as store_name, s.color as store_color,
        cur.symbol as currency_symbol, cur.code as currency_code
      FROM person_income pi
      LEFT JOIN people p ON pi.person_id = p.id
      LEFT JOIN categories c ON pi.category_id = c.id
      LEFT JOIN subcategories sub ON pi.subcategory_id = sub.id
      LEFT JOIN stores s ON pi.store_id = s.id
      LEFT JOIN currencies cur ON pi.currency_id = cur.id
      WHERE pi.person_id = ?
        AND pi.start_month <= ?
      ORDER BY pi.description
    `).all(personId, month) as any[]
    return all.filter((inc: any) => this.isIncomeVisibleInMonth(inc, month))
  }

  findById(id: number) {
    return this.db.prepare(`
      SELECT pi.*, c.name as category_name, c.color as category_color,
        sub.name as subcategory_name, sub.color as subcategory_color,
        s.name as store_name, s.color as store_color,
        cur.symbol as currency_symbol, cur.code as currency_code
      FROM person_income pi
      LEFT JOIN categories c ON pi.category_id = c.id
      LEFT JOIN subcategories sub ON pi.subcategory_id = sub.id
      LEFT JOIN stores s ON pi.store_id = s.id
      LEFT JOIN currencies cur ON pi.currency_id = cur.id
      WHERE pi.id = ?
    `).get(id)
  }

  create(data: {
    person_id: number; description: string; value: number;
    is_recurring?: number; start_month: string; end_month?: string | null;
    category_id?: number | null; subcategory_id?: number | null; due_day?: number | null; due_day_type?: string | null;
    notes?: string; store_id?: number | null;
    currency_id?: number | null; exchange_rate_snapshot?: number;
  }) {
    const result = this.db.prepare(`
      INSERT INTO person_income (person_id, description, value, reference_month, is_recurring, start_month, end_month, category_id, subcategory_id, due_day, due_day_type, notes, store_id, currency_id, exchange_rate_snapshot)
      VALUES (?, ?, ?, '', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      data.person_id, data.description, data.value,
      data.is_recurring || 0,
      data.start_month, data.end_month || null,
      data.category_id || null,
      data.subcategory_id || null,
      data.due_day || null, data.due_day_type || 'static',
      data.notes || '',
      data.store_id || null,
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
    this.db.prepare(`UPDATE person_income SET ${fields.join(', ')} WHERE id = ?`).run(...values)
    return this.findById(id)
  }

  delete(id: number) {
    this.db.prepare('DELETE FROM person_income WHERE id = ?').run(id)
  }

  setValueForMonth(incomeId: number, month: string, value: number): void {
    this.db.prepare(`
      INSERT OR REPLACE INTO income_monthly_values (income_id, month, value, persistent)
      VALUES (?, ?, ?, 1)
    `).run(incomeId, month, value)
  }

  removeValueOverride(incomeId: number, month: string): void {
    this.db.prepare(
      'DELETE FROM income_monthly_values WHERE income_id = ? AND month = ?'
    ).run(incomeId, month)
  }

  listValueOverrides(incomeId: number): { month: string; value: number }[] {
    return this.db.prepare(
      'SELECT month, value FROM income_monthly_values WHERE income_id = ? ORDER BY month ASC'
    ).all(incomeId) as any[]
  }

  getOverrideInfo(incomeId: number, month: string): { value: number } | null {
    const row = this.db.prepare(
      'SELECT value FROM income_monthly_values WHERE income_id = ? AND month <= ? ORDER BY month DESC LIMIT 1'
    ).get(incomeId, month) as any
    return row ? { value: row.value } : null
  }

  getEffectiveValue(income: any, month: string): number {
    const info = this.getOverrideInfo(income.id, month)
    return info ? info.value : income.value
  }

  getTotalByPersonAndMonth(personId: number, month: string): number {
    const incomes = this.findByPersonAndMonth(personId, month) as any[]
    let total = 0
    for (const inc of incomes) {
      if (this.isMonthPaused(this.getIncomeInterruptions(inc.id), month)) continue
      total += this.getEffectiveValue(inc, month) * (inc.exchange_rate_snapshot || 1.0)
    }
    return total
  }

  search(personId: number, query: string, filters?: { isRecurring?: boolean; categoryId?: number; tagId?: number }) {
    const conditions = ['pi.person_id = ?', 'pi.description LIKE ?']
    const params: any[] = [personId, `%${query}%`]

    if (filters?.isRecurring !== undefined) {
      conditions.push('pi.is_recurring = ?')
      params.push(filters.isRecurring ? 1 : 0)
    }
    if (filters?.categoryId) {
      conditions.push('pi.category_id = ?')
      params.push(filters.categoryId)
    }
    if (filters?.tagId) {
      conditions.push('pi.id IN (SELECT income_id FROM income_tags WHERE tag_id = ?)')
      params.push(filters.tagId)
    }

    return this.db.prepare(`
      SELECT pi.*, c.name as category_name, c.color as category_color,
        sub.name as subcategory_name, sub.color as subcategory_color,
        cur.symbol as currency_symbol, cur.code as currency_code
      FROM person_income pi
      LEFT JOIN categories c ON pi.category_id = c.id
      LEFT JOIN subcategories sub ON pi.subcategory_id = sub.id
      LEFT JOIN currencies cur ON pi.currency_id = cur.id
      WHERE ${conditions.join(' AND ')}
      ORDER BY pi.start_month DESC
      LIMIT 50
    `).all(...params)
  }

}
