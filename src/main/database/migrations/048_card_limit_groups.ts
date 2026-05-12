import { registerMigration } from './runner'

registerMigration({
  name: '048_card_limit_groups',
  up(db) {
    db.exec(`
      CREATE TABLE IF NOT EXISTS card_limit_groups (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        person_id INTEGER REFERENCES people(id) ON DELETE CASCADE,
        name TEXT NOT NULL,
        total_limit REAL NOT NULL DEFAULT 0,
        currency_id INTEGER REFERENCES currencies(id) ON DELETE SET NULL,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE INDEX IF NOT EXISTS idx_card_limit_groups_person_id ON card_limit_groups(person_id);
    `)

    const cardColumns = db.prepare('PRAGMA table_info(cards)').all().map((row: any) => row.name)
    if (!cardColumns.includes('limit_group_id')) {
      db.exec(`ALTER TABLE cards ADD COLUMN limit_group_id INTEGER REFERENCES card_limit_groups(id) ON DELETE SET NULL`)
    }

    db.exec(`CREATE INDEX IF NOT EXISTS idx_cards_limit_group_id ON cards(limit_group_id);`)
  }
})
