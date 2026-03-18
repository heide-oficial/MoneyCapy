import { WrappedDatabase } from '../connection'

export class CurrenciesRepository {
  constructor(private db: WrappedDatabase) {}

  findAll() {
    return this.db.prepare('SELECT * FROM currencies ORDER BY is_base DESC, code ASC').all()
  }

  findById(id: number) {
    return this.db.prepare('SELECT * FROM currencies WHERE id = ?').get(id)
  }

  findByCode(code: string) {
    return this.db.prepare('SELECT * FROM currencies WHERE code = ?').get(code)
  }

  getBase() {
    return this.db.prepare('SELECT * FROM currencies WHERE is_base = 1').get()
  }

  create(data: { code: string; name: string; symbol: string; exchange_rate?: number }) {
    const result = this.db.prepare(
      `INSERT INTO currencies (code, name, symbol, exchange_rate, is_base) VALUES (?, ?, ?, ?, 0)`
    ).run(data.code, data.name, data.symbol, data.exchange_rate ?? 1.0)
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
    this.db.prepare(`UPDATE currencies SET ${fields.join(', ')} WHERE id = ?`).run(...values)
    return this.findById(id)
  }

  delete(id: number): { success: boolean; error?: string } {
    // Check if currency is in use
    const itemCount = (this.db.prepare(
      'SELECT COUNT(*) as cnt FROM section_items WHERE currency_id = ?'
    ).get(id) as any).cnt
    if (itemCount > 0) return { success: false, error: 'Moeda em uso por gastos' }

    const incomeCount = (this.db.prepare(
      'SELECT COUNT(*) as cnt FROM person_income WHERE currency_id = ?'
    ).get(id) as any).cnt
    if (incomeCount > 0) return { success: false, error: 'Moeda em uso por receitas' }

    const cardCount = (this.db.prepare(
      'SELECT COUNT(*) as cnt FROM cards WHERE currency_id = ?'
    ).get(id) as any).cnt
    if (cardCount > 0) return { success: false, error: 'Moeda em uso por cartões' }

    const accountCount = (this.db.prepare(
      'SELECT COUNT(*) as cnt FROM bank_accounts WHERE currency_id = ?'
    ).get(id) as any).cnt
    if (accountCount > 0) return { success: false, error: 'Moeda em uso por contas bancárias' }

    const currency = this.findById(id) as any
    if (currency && currency.is_base === 1) return { success: false, error: 'Não pode excluir a moeda base' }

    this.db.prepare('DELETE FROM currencies WHERE id = ?').run(id)
    return { success: true }
  }

  updateSnapshots() {
    const all = this.findAll() as any[]
    for (const c of all) {
      this.db.prepare(
        'UPDATE section_items SET exchange_rate_snapshot = ? WHERE currency_id = ?'
      ).run(c.exchange_rate, c.id)
      this.db.prepare(
        'UPDATE person_income SET exchange_rate_snapshot = ? WHERE currency_id = ?'
      ).run(c.exchange_rate, c.id)
    }
  }

  setAsBase(id: number) {
    const newBase = this.findById(id) as any
    if (!newBase) throw new Error('Currency not found')
    if (newBase.is_base === 1) return newBase

    const factor = newBase.exchange_rate
    if (factor === 0) throw new Error('Exchange rate cannot be zero')

    const transaction = this.db.transaction(() => {
      // Recalculate all rates: divide by the new base's rate
      const all = this.findAll() as any[]
      for (const c of all) {
        const newRate = c.exchange_rate / factor
        this.db.prepare(
          "UPDATE currencies SET exchange_rate = ?, is_base = ?, updated_at = datetime('now') WHERE id = ?"
        ).run(newRate, c.id === id ? 1 : 0, c.id)
      }

      // Update snapshots in section_items and person_income
      this.db.prepare(
        'UPDATE section_items SET exchange_rate_snapshot = exchange_rate_snapshot / ? WHERE currency_id IS NOT NULL'
      ).run(factor)
      this.db.prepare(
        'UPDATE person_income SET exchange_rate_snapshot = exchange_rate_snapshot / ? WHERE currency_id IS NOT NULL'
      ).run(factor)
    })
    transaction()

    return this.findById(id)
  }
}
