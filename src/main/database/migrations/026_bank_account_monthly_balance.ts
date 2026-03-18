import { registerMigration } from './runner'

registerMigration({
  name: '026_bank_account_monthly_balance',
  up(db) {
    db.exec(`
      CREATE TABLE bank_account_monthly_balance (
        bank_account_id INTEGER NOT NULL REFERENCES bank_accounts(id) ON DELETE CASCADE,
        month TEXT NOT NULL,
        balance REAL NOT NULL,
        PRIMARY KEY (bank_account_id, month)
      )
    `)
  }
})
