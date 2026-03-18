import { registerMigration } from './runner'

registerMigration({
  name: '018_item_bank_account',
  up(db) {
    db.exec(`ALTER TABLE section_items ADD COLUMN bank_account_id INTEGER REFERENCES bank_accounts(id) ON DELETE SET NULL`)
  }
})
