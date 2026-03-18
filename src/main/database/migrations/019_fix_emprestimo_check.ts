import { registerMigration } from './runner'

registerMigration({
  name: '019_fix_emprestimo_check',
  up(db) {
    // Check if emprestimo is already allowed by trying a dummy insert
    let needsFix = false
    try {
      db.exec(`INSERT INTO section_items (person_id, description, type, value, start_month) VALUES (0, '__check__', 'emprestimo', 0, '0000-00')`)
      // If it succeeded, constraint is fine — delete the test row
      db.exec(`DELETE FROM section_items WHERE description = '__check__' AND person_id = 0`)
    } catch {
      needsFix = true
    }

    if (!needsFix) return

    // Recreate table with correct CHECK constraint including all columns
    db.exec(`
      CREATE TABLE section_items_fixed (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        person_id INTEGER NOT NULL REFERENCES people(id) ON DELETE CASCADE,
        category_id INTEGER REFERENCES categories(id) ON DELETE SET NULL,
        card_id INTEGER REFERENCES cards(id) ON DELETE SET NULL,
        bank_account_id INTEGER REFERENCES bank_accounts(id) ON DELETE SET NULL,
        description TEXT NOT NULL,
        type TEXT NOT NULL CHECK(type IN ('common','installment','subscription','emprestimo')),
        value REAL NOT NULL,
        due_day INTEGER,
        due_day_label TEXT,
        total_installments INTEGER,
        start_month TEXT NOT NULL,
        end_month TEXT,
        end_reason TEXT,
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

    // Copy all existing data — only select columns that exist in both tables
    // Use a dynamic approach: select common columns
    db.exec(`
      INSERT INTO section_items_fixed (id, person_id, category_id, card_id, description, type, value,
        due_day, due_day_label, total_installments, start_month, end_month, is_active, notes,
        sort_order, icon, color, image_url, store, created_at, updated_at)
      SELECT id, person_id, category_id, card_id, description, type, value,
        due_day, due_day_label, total_installments, start_month, end_month, is_active, notes,
        sort_order, icon, color, image_url, store, created_at, updated_at
      FROM section_items
    `)

    // Try copying optional columns that may or may not exist
    try { db.exec(`UPDATE section_items_fixed SET end_reason = (SELECT end_reason FROM section_items WHERE section_items.id = section_items_fixed.id)`) } catch { /* column may not exist */ }
    try { db.exec(`UPDATE section_items_fixed SET interest_rate = (SELECT interest_rate FROM section_items WHERE section_items.id = section_items_fixed.id)`) } catch { /* column may not exist */ }
    try { db.exec(`UPDATE section_items_fixed SET bank_account_id = (SELECT bank_account_id FROM section_items WHERE section_items.id = section_items_fixed.id)`) } catch { /* column may not exist */ }

    db.exec(`DROP TABLE section_items`)
    db.exec(`ALTER TABLE section_items_fixed RENAME TO section_items`)

    // Recreate indices
    db.exec(`CREATE INDEX IF NOT EXISTS idx_section_items_person_id ON section_items(person_id)`)
    db.exec(`CREATE INDEX IF NOT EXISTS idx_section_items_type ON section_items(type)`)
    db.exec(`CREATE INDEX IF NOT EXISTS idx_section_items_start_month ON section_items(start_month)`)
    db.exec(`CREATE INDEX IF NOT EXISTS idx_section_items_card_id ON section_items(card_id)`)
  }
})
