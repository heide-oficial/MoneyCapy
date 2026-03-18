import { registerMigration } from './runner'

registerMigration({
  name: '012_emprestimo_type',
  up(db) {
    // SQLite doesn't support ALTER CHECK, so we recreate the table with updated constraint
    db.exec(`
      CREATE TABLE section_items_new (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        person_id INTEGER NOT NULL REFERENCES people(id) ON DELETE CASCADE,
        category_id INTEGER REFERENCES categories(id) ON DELETE SET NULL,
        card_id INTEGER REFERENCES cards(id) ON DELETE SET NULL,
        description TEXT NOT NULL,
        type TEXT NOT NULL CHECK(type IN ('common','installment','subscription','emprestimo')),
        value REAL NOT NULL,
        due_day INTEGER,
        due_day_label TEXT,
        total_installments INTEGER,
        start_month TEXT NOT NULL,
        end_month TEXT,
        is_active INTEGER NOT NULL DEFAULT 1,
        notes TEXT,
        sort_order INTEGER NOT NULL DEFAULT 0,
        icon TEXT,
        color TEXT,
        image_url TEXT,
        store TEXT,
        interest_rate REAL,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      )
    `)

    db.exec(`
      INSERT INTO section_items_new (id, person_id, category_id, card_id, description, type, value,
        due_day, due_day_label, total_installments, start_month, end_month, is_active, notes,
        sort_order, icon, color, image_url, store, created_at, updated_at)
      SELECT id, person_id, category_id, card_id, description, type, value,
        due_day, due_day_label, total_installments, start_month, end_month, is_active, notes,
        sort_order, icon, color, image_url, store, created_at, updated_at
      FROM section_items
    `)

    db.exec(`DROP TABLE section_items`)
    db.exec(`ALTER TABLE section_items_new RENAME TO section_items`)

    // Recreate indices
    db.exec(`CREATE INDEX idx_section_items_person_id ON section_items(person_id)`)
    db.exec(`CREATE INDEX idx_section_items_type ON section_items(type)`)
    db.exec(`CREATE INDEX idx_section_items_start_month ON section_items(start_month)`)
    db.exec(`CREATE INDEX idx_section_items_card_id ON section_items(card_id)`)
  }
})
