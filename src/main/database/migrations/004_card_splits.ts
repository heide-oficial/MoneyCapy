import { WrappedDatabase } from '../connection'
import { registerMigration } from './runner'

registerMigration({
  name: '004_card_splits',
  up: (db: WrappedDatabase) => {
    // 1. Add bank_account_id to loans if missing (for DBs where 003 ran without it)
    const loansColumns = db.prepare("PRAGMA table_info(loans)").all() as any[]
    const hasBankAccountId = loansColumns.some((c: any) => c.name === 'bank_account_id')
    if (!hasBankAccountId) {
      db.exec(`ALTER TABLE loans ADD COLUMN bank_account_id INTEGER REFERENCES bank_accounts(id) ON DELETE CASCADE`)
    }

    // 2. Create item_card_splits for installment items with multiple cards
    db.exec(`
      CREATE TABLE item_card_splits (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        item_id INTEGER NOT NULL REFERENCES section_items(id) ON DELETE CASCADE,
        card_id INTEGER NOT NULL REFERENCES cards(id) ON DELETE CASCADE,
        value REAL NOT NULL,
        total_installments INTEGER NOT NULL,
        paid_installments INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      );
      CREATE INDEX idx_item_card_splits_item_id ON item_card_splits(item_id);
      CREATE INDEX idx_item_card_splits_card_id ON item_card_splits(card_id);
    `)
  }
})
