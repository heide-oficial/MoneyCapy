import { WrappedDatabase } from '../connection'

export class CategoriesRepository {
  constructor(private db: WrappedDatabase) {}

  findAll() {
    return this.db.prepare('SELECT * FROM categories ORDER BY name').all()
  }

  findById(id: number) {
    return this.db.prepare('SELECT * FROM categories WHERE id = ?').get(id)
  }

  create(data: { name: string; icon: string; color: string }) {
    const result = this.db.prepare(
      'INSERT INTO categories (name, icon, color) VALUES (?, ?, ?)'
    ).run(data.name, data.icon, data.color)
    return this.findById(result.lastInsertRowid as number)
  }

  update(id: number, data: { name?: string; icon?: string; color?: string }) {
    const fields: string[] = []
    const values: any[] = []
    if (data.name !== undefined) { fields.push('name = ?'); values.push(data.name) }
    if (data.icon !== undefined) { fields.push('icon = ?'); values.push(data.icon) }
    if (data.color !== undefined) { fields.push('color = ?'); values.push(data.color) }
    if (fields.length === 0) return this.findById(id)
    fields.push("updated_at = datetime('now')")
    values.push(id)
    this.db.prepare(`UPDATE categories SET ${fields.join(', ')} WHERE id = ?`).run(...values)
    return this.findById(id)
  }

  delete(id: number) {
    this.db.prepare('DELETE FROM categories WHERE id = ?').run(id)
  }
}
