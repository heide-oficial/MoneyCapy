import { WrappedDatabase } from '../connection'

export class TagsRepository {
  constructor(private db: WrappedDatabase) {}

  findAll() {
    return this.db.prepare('SELECT * FROM tags ORDER BY name').all()
  }

  findById(id: number) {
    return this.db.prepare('SELECT * FROM tags WHERE id = ?').get(id)
  }

  create(data: { name: string; color: string }) {
    const result = this.db.prepare(
      'INSERT INTO tags (name, color) VALUES (?, ?)'
    ).run(data.name, data.color)
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
    this.db.prepare(`UPDATE tags SET ${fields.join(', ')} WHERE id = ?`).run(...values)
    return this.findById(id)
  }

  delete(id: number) {
    this.db.prepare('DELETE FROM tags WHERE id = ?').run(id)
  }

  findByItemId(itemId: number) {
    return this.db.prepare(`
      SELECT t.* FROM tags t
      INNER JOIN item_tags it ON it.tag_id = t.id
      WHERE it.item_id = ?
      ORDER BY t.name
    `).all(itemId)
  }

  setItemTags(itemId: number, tagIds: number[]) {
    const run = this.db.transaction(() => {
      this.db.prepare('DELETE FROM item_tags WHERE item_id = ?').run(itemId)
      const stmt = this.db.prepare('INSERT INTO item_tags (item_id, tag_id) VALUES (?, ?)')
      for (const tagId of tagIds) {
        stmt.run(itemId, tagId)
      }
    })
    run()
  }

  findByIncomeId(incomeId: number) {
    return this.db.prepare(`
      SELECT t.* FROM tags t
      INNER JOIN income_tags it ON it.tag_id = t.id
      WHERE it.income_id = ?
      ORDER BY t.name
    `).all(incomeId)
  }

  setIncomeTags(incomeId: number, tagIds: number[]) {
    const run = this.db.transaction(() => {
      this.db.prepare('DELETE FROM income_tags WHERE income_id = ?').run(incomeId)
      const stmt = this.db.prepare('INSERT INTO income_tags (income_id, tag_id) VALUES (?, ?)')
      for (const tagId of tagIds) {
        stmt.run(incomeId, tagId)
      }
    })
    run()
  }
}
