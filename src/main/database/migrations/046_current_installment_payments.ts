import { registerMigration } from './runner'

registerMigration({
  name: '046_current_installment_payments',
  up: (db) => {
    db.exec(`
      CREATE TABLE IF NOT EXISTS item_current_installment_payments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        item_id INTEGER NOT NULL REFERENCES section_items(id) ON DELETE CASCADE,
        split_id INTEGER REFERENCES item_card_splits(id) ON DELETE CASCADE,
        month TEXT NOT NULL,
        original_value REAL NOT NULL,
        paid_value REAL NOT NULL,
        paid_at TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT
      );

      CREATE UNIQUE INDEX IF NOT EXISTS idx_current_installment_payments_target
        ON item_current_installment_payments(item_id, COALESCE(split_id, -1), month);

      CREATE INDEX IF NOT EXISTS idx_current_installment_payments_item
        ON item_current_installment_payments(item_id);

      CREATE INDEX IF NOT EXISTS idx_current_installment_payments_month
        ON item_current_installment_payments(month);
    `)
  }
})
