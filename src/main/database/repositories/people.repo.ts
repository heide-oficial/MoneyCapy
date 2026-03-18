import { WrappedDatabase } from '../connection'

export class PeopleRepository {
  constructor(private db: WrappedDatabase) {}

  findAll() {
    return this.db.prepare('SELECT * FROM people ORDER BY name').all()
  }

  findById(id: number) {
    return this.db.prepare('SELECT * FROM people WHERE id = ?').get(id)
  }

  create(data: { name: string; color: string }) {
    const result = this.db.prepare('INSERT INTO people (name, color) VALUES (?, ?)').run(data.name, data.color)
    return this.findById(result.lastInsertRowid as number)
  }

  update(id: number, data: { name?: string; color?: string }) {
    const fields: string[] = []
    const values: any[] = []
    if (data.name !== undefined) { fields.push('name = ?'); values.push(data.name) }
    if (data.color !== undefined) { fields.push('color = ?'); values.push(data.color) }
    if (fields.length === 0) return this.findById(id)
    fields.push("updated_at = datetime('now')")
    values.push(id)
    this.db.prepare(`UPDATE people SET ${fields.join(', ')} WHERE id = ?`).run(...values)
    return this.findById(id)
  }

  delete(id: number) {
    this.db.prepare('DELETE FROM people WHERE id = ?').run(id)
  }
}
