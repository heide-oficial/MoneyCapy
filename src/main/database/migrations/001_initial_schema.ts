import { WrappedDatabase } from '../connection'
import { registerMigration } from './runner'

registerMigration({
  name: '001_initial_schema',
  up: (db: WrappedDatabase) => {
    db.exec(`
      CREATE TABLE categories (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        icon TEXT NOT NULL DEFAULT 'circle',
        color TEXT NOT NULL DEFAULT '#22c55e',
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE TABLE cards (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        number_encrypted TEXT NOT NULL DEFAULT '',
        number_iv TEXT NOT NULL DEFAULT '',
        number_tag TEXT NOT NULL DEFAULT '',
        expiration_encrypted TEXT NOT NULL DEFAULT '',
        expiration_iv TEXT NOT NULL DEFAULT '',
        expiration_tag TEXT NOT NULL DEFAULT '',
        holder_encrypted TEXT NOT NULL DEFAULT '',
        holder_iv TEXT NOT NULL DEFAULT '',
        holder_tag TEXT NOT NULL DEFAULT '',
        total_limit REAL NOT NULL DEFAULT 0,
        billing_close_day INTEGER NOT NULL DEFAULT 1,
        due_day INTEGER NOT NULL DEFAULT 10,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE TABLE card_items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        card_id INTEGER NOT NULL REFERENCES cards(id) ON DELETE CASCADE,
        category_id INTEGER REFERENCES categories(id) ON DELETE SET NULL,
        description TEXT NOT NULL,
        type TEXT NOT NULL CHECK(type IN ('common', 'installment')),
        total_value REAL NOT NULL,
        total_installments INTEGER,
        paid_installments INTEGER DEFAULT 0,
        installment_value REAL,
        reference_month TEXT NOT NULL,
        is_active INTEGER NOT NULL DEFAULT 1,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE INDEX idx_card_items_card_id ON card_items(card_id);
      CREATE INDEX idx_card_items_reference_month ON card_items(reference_month);

      CREATE TABLE people (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE TABLE expenses (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        category_id INTEGER REFERENCES categories(id) ON DELETE SET NULL,
        person_id INTEGER REFERENCES people(id) ON DELETE SET NULL,
        type TEXT NOT NULL CHECK(type IN ('random', 'monthly', 'debt', 'subscription')),
        description TEXT NOT NULL,
        value REAL NOT NULL,
        due_day INTEGER,
        creditor_name TEXT,
        is_paid INTEGER NOT NULL DEFAULT 0,
        is_active INTEGER NOT NULL DEFAULT 1,
        reference_month TEXT,
        is_completed INTEGER NOT NULL DEFAULT 0,
        notes TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE INDEX idx_expenses_type ON expenses(type);
      CREATE INDEX idx_expenses_reference_month ON expenses(reference_month);
      CREATE INDEX idx_expenses_person_id ON expenses(person_id);

      CREATE TABLE person_income (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        person_id INTEGER NOT NULL REFERENCES people(id) ON DELETE CASCADE,
        type TEXT NOT NULL,
        description TEXT NOT NULL,
        value REAL NOT NULL,
        reference_month TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE INDEX idx_person_income_person_month ON person_income(person_id, reference_month);

      CREATE TABLE monthly_plans (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        reference_month TEXT NOT NULL UNIQUE,
        is_finalized INTEGER NOT NULL DEFAULT 0,
        notes TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE TABLE plan_shared_items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        plan_id INTEGER NOT NULL REFERENCES monthly_plans(id) ON DELETE CASCADE,
        description TEXT NOT NULL,
        value REAL NOT NULL,
        source_type TEXT,
        source_id INTEGER,
        sort_order INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE INDEX idx_plan_shared_items_plan_id ON plan_shared_items(plan_id);

      CREATE TABLE plan_person_config (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        plan_id INTEGER NOT NULL REFERENCES monthly_plans(id) ON DELETE CASCADE,
        person_id INTEGER NOT NULL REFERENCES people(id) ON DELETE CASCADE,
        participates_in_shared INTEGER NOT NULL DEFAULT 1,
        manual_percentage REAL,
        total_income REAL NOT NULL DEFAULT 0,
        UNIQUE(plan_id, person_id)
      );

      CREATE INDEX idx_plan_person_config_plan_id ON plan_person_config(plan_id);

      CREATE TABLE plan_person_specific_expenses (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        config_id INTEGER NOT NULL REFERENCES plan_person_config(id) ON DELETE CASCADE,
        description TEXT NOT NULL,
        value REAL NOT NULL,
        source_type TEXT,
        source_id INTEGER,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE INDEX idx_plan_person_specific_config_id ON plan_person_specific_expenses(config_id);

      CREATE TABLE wishlist_items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        estimated_value REAL,
        is_bought INTEGER NOT NULL DEFAULT 0,
        notes TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE TABLE settings (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      );
    `)
  }
})
