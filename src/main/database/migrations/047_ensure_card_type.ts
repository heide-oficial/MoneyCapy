import { registerMigration } from './runner'

registerMigration({
  name: '047_ensure_card_type',
  up(db) {
    const columns = db.prepare('PRAGMA table_info(cards)').all().map((row: any) => row.name)
    if (!columns.includes('card_type')) {
      db.exec(`ALTER TABLE cards ADD COLUMN card_type TEXT NOT NULL DEFAULT 'both'`)
    }
  }
})
