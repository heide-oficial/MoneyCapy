import { registerMigration } from './runner'

registerMigration({
  name: '022_item_monthly_values',
  up(db) {
    db.exec(`
      CREATE TABLE item_monthly_values (
        item_id INTEGER NOT NULL REFERENCES section_items(id) ON DELETE CASCADE,
        month TEXT NOT NULL,
        value REAL NOT NULL,
        persistent INTEGER NOT NULL DEFAULT 0,
        PRIMARY KEY (item_id, month)
      )
    `)
    db.exec(`CREATE INDEX idx_item_monthly_values_month ON item_monthly_values(month)`)
  }
})
