import { registerMigration } from './runner'

registerMigration({
  name: '008_monthly_restructure',
  up(db) {
    // Drop old tables (test data only — destructive is OK)
    db.exec(`DROP TABLE IF EXISTS item_card_splits`)
    db.exec(`DROP TABLE IF EXISTS item_tags`)
    db.exec(`DROP TABLE IF EXISTS item_monthly_status`)
    db.exec(`DROP TABLE IF EXISTS section_items`)
    db.exec(`DROP TABLE IF EXISTS sections`)

    // New section_items (person_id instead of section_id)
    db.exec(`
      CREATE TABLE section_items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        person_id INTEGER NOT NULL REFERENCES people(id) ON DELETE CASCADE,
        category_id INTEGER REFERENCES categories(id) ON DELETE SET NULL,
        card_id INTEGER REFERENCES cards(id) ON DELETE SET NULL,
        description TEXT NOT NULL,
        type TEXT NOT NULL CHECK(type IN ('common','installment','subscription')),
        value REAL NOT NULL,
        due_day INTEGER,
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
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      )
    `)

    // Recreate item_tags
    db.exec(`
      CREATE TABLE item_tags (
        item_id INTEGER NOT NULL REFERENCES section_items(id) ON DELETE CASCADE,
        tag_id INTEGER NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
        PRIMARY KEY (item_id, tag_id)
      )
    `)

    // Recreate item_card_splits without paid_installments
    db.exec(`
      CREATE TABLE item_card_splits (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        item_id INTEGER NOT NULL REFERENCES section_items(id) ON DELETE CASCADE,
        card_id INTEGER NOT NULL REFERENCES cards(id) ON DELETE CASCADE,
        value REAL NOT NULL,
        total_installments INTEGER NOT NULL,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      )
    `)

    // Create item_monthly_status
    db.exec(`
      CREATE TABLE item_monthly_status (
        item_id INTEGER NOT NULL REFERENCES section_items(id) ON DELETE CASCADE,
        month TEXT NOT NULL,
        is_paid INTEGER NOT NULL DEFAULT 0,
        PRIMARY KEY (item_id, month)
      )
    `)

    // Indices
    db.exec(`CREATE INDEX idx_section_items_person_id ON section_items(person_id)`)
    db.exec(`CREATE INDEX idx_section_items_type ON section_items(type)`)
    db.exec(`CREATE INDEX idx_section_items_start_month ON section_items(start_month)`)
    db.exec(`CREATE INDEX idx_section_items_card_id ON section_items(card_id)`)
    db.exec(`CREATE INDEX idx_item_monthly_status_month ON item_monthly_status(month)`)
  }
})
