import { WrappedDatabase } from '../connection'

export class StoresRepository {
  constructor(private db: WrappedDatabase) {}

  findAll() {
    return this.db.prepare('SELECT * FROM stores ORDER BY name').all()
  }

  findById(id: number) {
    return this.db.prepare('SELECT * FROM stores WHERE id = ?').get(id)
  }

  create(data: { name: string; color?: string }) {
    const color = data.color || '#6366f1'
    const result = this.db.prepare(
      'INSERT INTO stores (name, color) VALUES (?, ?)'
    ).run(data.name, color)
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
    this.db.prepare(`UPDATE stores SET ${fields.join(', ')} WHERE id = ?`).run(...values)
    return this.findById(id)
  }

  delete(id: number) {
    this.db.prepare('DELETE FROM stores WHERE id = ?').run(id)
  }
}
