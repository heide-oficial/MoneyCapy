import { WrappedDatabase } from '../connection'

export class ItemCardSplitsRepository {
  constructor(private db: WrappedDatabase) {}

  findByItemId(itemId: number) {
    return this.db.prepare(`
      SELECT ics.*, c.name as card_name
      FROM item_card_splits ics
      LEFT JOIN cards c ON ics.card_id = c.id
      WHERE ics.item_id = ?
      ORDER BY c.name
    `).all(itemId)
  }

  replaceForItem(itemId: number, splits: { card_id: number; value: number; total_installments: number }[]) {
    const run = this.db.transaction(() => {
      this.db.prepare('DELETE FROM item_card_splits WHERE item_id = ?').run(itemId)
      const stmt = this.db.prepare(`
        INSERT INTO item_card_splits (item_id, card_id, value, total_installments)
        VALUES (?, ?, ?, ?)
      `)
      for (const s of splits) {
        stmt.run(itemId, s.card_id, s.value, s.total_installments)
      }
    })
    run()
    return this.findByItemId(itemId)
  }

  deleteByItemId(itemId: number) {
    this.db.prepare('DELETE FROM item_card_splits WHERE item_id = ?').run(itemId)
  }
}
