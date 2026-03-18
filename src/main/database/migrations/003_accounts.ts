import { WrappedDatabase } from '../connection'
import { registerMigration } from './runner'

registerMigration({
  name: '003_accounts',
  up: (db: WrappedDatabase) => {
    // 1. CREATE bank_accounts
    db.exec(`
      CREATE TABLE bank_accounts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        person_id INTEGER NOT NULL REFERENCES people(id) ON DELETE CASCADE,
        name TEXT NOT NULL,
        balance REAL NOT NULL DEFAULT 0,
        icon TEXT NOT NULL DEFAULT 'Landmark',
        color TEXT NOT NULL DEFAULT '#3b82f6',
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      );
      CREATE INDEX idx_bank_accounts_person_id ON bank_accounts(person_id);
    `)

    // 2. CREATE loans
    db.exec(`
      CREATE TABLE loans (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        person_id INTEGER NOT NULL REFERENCES people(id) ON DELETE CASCADE,
        bank_account_id INTEGER REFERENCES bank_accounts(id) ON DELETE CASCADE,
        description TEXT NOT NULL,
        total_amount REAL NOT NULL,
        interest_rate REAL NOT NULL DEFAULT 0,
        due_day INTEGER,
        total_installments INTEGER NOT NULL,
        paid_installments INTEGER NOT NULL DEFAULT 0,
        installment_value REAL NOT NULL,
        notes TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      );
      CREATE INDEX idx_loans_person_id ON loans(person_id);
      CREATE INDEX idx_loans_bank_account_id ON loans(bank_account_id);
    `)

    // 3. ALTER cards ADD bank_account_id
    db.exec(`ALTER TABLE cards ADD COLUMN bank_account_id INTEGER REFERENCES bank_accounts(id) ON DELETE SET NULL`)
  }
})
