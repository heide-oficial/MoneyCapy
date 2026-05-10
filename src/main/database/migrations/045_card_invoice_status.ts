import { registerMigration } from './runner'

registerMigration({
  name: '045_card_invoice_status',
  up(db) {
    db.exec(`
      CREATE TABLE IF NOT EXISTS card_invoice_status (
        card_id INTEGER NOT NULL,
        month TEXT NOT NULL,
        is_paid INTEGER NOT NULL DEFAULT 0,
        paid_at TEXT DEFAULT NULL,
        updated_at TEXT NOT NULL DEFAULT (datetime('now')),
        PRIMARY KEY (card_id, month),
        FOREIGN KEY (card_id) REFERENCES cards(id) ON DELETE CASCADE
      )
    `)
    db.exec(`CREATE INDEX IF NOT EXISTS idx_card_invoice_status_month ON card_invoice_status(month)`)
  }
})
