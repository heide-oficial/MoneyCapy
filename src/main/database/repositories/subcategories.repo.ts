import { WrappedDatabase } from '../connection'

export class SubcategoriesRepository {
  constructor(private db: WrappedDatabase) {}

  private attachCategories(row: any) {
    const categoryIds = this.db.prepare(
      'SELECT category_id FROM category_subcategories WHERE subcategory_id = ? ORDER BY category_id'
    ).all(row.id) as any[]
    return {
      ...row,
      categoryIds: categoryIds.map(r => r.category_id)
    }
  }

  findAll() {
    const rows = this.db.prepare('SELECT * FROM subcategories ORDER BY name').all() as any[]
    return rows.map(row => this.attachCategories(row))
  }

  findById(id: number) {
    const row = this.db.prepare('SELECT * FROM subcategories WHERE id = ?').get(id) as any
    return row ? this.attachCategories(row) : null
  }

  create(data: { name: string; color?: string; scope?: 'expense' | 'income' | 'both'; categoryIds?: number[] }) {
    const result = this.db.prepare(
      'INSERT INTO subcategories (name, color, scope) VALUES (?, ?, ?)'
    ).run(data.name, data.color || '#6b7280', data.scope || 'both')
    const id = result.lastInsertRowid as number
    this.setCategories(id, data.categoryIds || [])
    return this.findById(id)
  }

  update(id: number, data: { name?: string; color?: string; scope?: 'expense' | 'income' | 'both'; categoryIds?: number[] }) {
    const fields: string[] = []
    const values: any[] = []
    if (data.name !== undefined) { fields.push('name = ?'); values.push(data.name) }
    if (data.color !== undefined) { fields.push('color = ?'); values.push(data.color) }
    if (data.scope !== undefined) { fields.push('scope = ?'); values.push(data.scope) }
    if (fields.length > 0) {
      fields.push("updated_at = datetime('now')")
      values.push(id)
      this.db.prepare(`UPDATE subcategories SET ${fields.join(', ')} WHERE id = ?`).run(...values)
    }
    if (data.categoryIds !== undefined) this.setCategories(id, data.categoryIds)
    return this.findById(id)
  }

  delete(id: number) {
    this.db.prepare('DELETE FROM subcategories WHERE id = ?').run(id)
  }

  setCategories(subcategoryId: number, categoryIds: number[]) {
    const run = this.db.transaction(() => {
      this.db.prepare('DELETE FROM category_subcategories WHERE subcategory_id = ?').run(subcategoryId)
      const insert = this.db.prepare('INSERT OR IGNORE INTO category_subcategories (category_id, subcategory_id) VALUES (?, ?)')
      for (const categoryId of categoryIds) insert.run(categoryId, subcategoryId)
    })
    run()
  }
}
