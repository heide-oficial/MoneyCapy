import { WrappedDatabase } from '../connection'
import { registerMigration } from './runner'

registerMigration({
  name: '002_restructure',
  up: (db: WrappedDatabase) => {
    // 1. ALTER people ADD color
    db.exec(`ALTER TABLE people ADD COLUMN color TEXT NOT NULL DEFAULT '#3b82f6'`)

    // 2. ALTER cards ADD person_id
    db.exec(`ALTER TABLE cards ADD COLUMN person_id INTEGER REFERENCES people(id) ON DELETE SET NULL`)

    // 3. ALTER wishlist_items ADD person_id
    db.exec(`ALTER TABLE wishlist_items ADD COLUMN person_id INTEGER REFERENCES people(id) ON DELETE SET NULL`)

    // 4. Recreate person_income without type, with is_recurring
    db.exec(`
      CREATE TABLE person_income_new (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        person_id INTEGER NOT NULL REFERENCES people(id) ON DELETE CASCADE,
        description TEXT NOT NULL,
        value REAL NOT NULL,
        reference_month TEXT NOT NULL,
        is_recurring INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      );

      INSERT INTO person_income_new (id, person_id, description, value, reference_month, is_recurring, created_at, updated_at)
        SELECT id, person_id, description, value, reference_month,
          CASE WHEN type = 'salary' THEN 1 ELSE 0 END,
          created_at, updated_at
        FROM person_income;

      DROP TABLE person_income;
      ALTER TABLE person_income_new RENAME TO person_income;
      CREATE INDEX idx_person_income_person_month ON person_income(person_id, reference_month);
    `)

    // 5. CREATE sections
    db.exec(`
      CREATE TABLE sections (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        person_id INTEGER NOT NULL REFERENCES people(id) ON DELETE CASCADE,
        name TEXT NOT NULL,
        icon TEXT NOT NULL DEFAULT 'Folder',
        color TEXT NOT NULL DEFAULT '#3b82f6',
        sort_order INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      );
      CREATE INDEX idx_sections_person_id ON sections(person_id);
    `)

    // 6. CREATE section_items
    db.exec(`
      CREATE TABLE section_items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        section_id INTEGER NOT NULL REFERENCES sections(id) ON DELETE CASCADE,
        category_id INTEGER REFERENCES categories(id) ON DELETE SET NULL,
        card_id INTEGER REFERENCES cards(id) ON DELETE SET NULL,
        description TEXT NOT NULL,
        type TEXT NOT NULL CHECK(type IN ('common', 'installment', 'subscription')),
        value REAL NOT NULL,
        due_day INTEGER,
        total_installments INTEGER,
        paid_installments INTEGER DEFAULT 0,
        is_active INTEGER NOT NULL DEFAULT 1,
        is_completed INTEGER NOT NULL DEFAULT 0,
        notes TEXT,
        sort_order INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      );
      CREATE INDEX idx_section_items_section_id ON section_items(section_id);
      CREATE INDEX idx_section_items_card_id ON section_items(card_id);
    `)

    // 7. CREATE tags
    db.exec(`
      CREATE TABLE tags (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        color TEXT NOT NULL DEFAULT '#6366f1',
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      );
    `)

    // 8. CREATE item_tags
    db.exec(`
      CREATE TABLE item_tags (
        item_id INTEGER NOT NULL REFERENCES section_items(id) ON DELETE CASCADE,
        tag_id INTEGER NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
        PRIMARY KEY (item_id, tag_id)
      );
    `)

    // 9. Migrate existing data
    // Check if there are expenses or card_items but no people
    const peopleCount = (db.prepare('SELECT COUNT(*) as cnt FROM people').get() as any).cnt
    const expensesCount = (db.prepare('SELECT COUNT(*) as cnt FROM expenses').get() as any).cnt
    const cardItemsCount = (db.prepare('SELECT COUNT(*) as cnt FROM card_items').get() as any).cnt

    let defaultPersonId: number | null = null

    if (peopleCount === 0 && (expensesCount > 0 || cardItemsCount > 0)) {
      // Create default profile
      const result = db.prepare(
        "INSERT INTO people (name, color) VALUES ('Perfil Principal', '#3b82f6')"
      ).run()
      defaultPersonId = result.lastInsertRowid as number
    } else if (peopleCount > 0) {
      // Use first person
      defaultPersonId = (db.prepare('SELECT id FROM people ORDER BY id LIMIT 1').get() as any).id
    }

    if (defaultPersonId !== null) {
      // Create a single default "Gastos" section for the person
      const secResult = db.prepare(
        "INSERT INTO sections (person_id, name, icon, color, sort_order) VALUES (?, 'Gastos', 'Wallet', '#3b82f6', 0)"
      ).run(defaultPersonId)
      const gastosId = secResult.lastInsertRowid as number

      // Migrate all expenses into the single "Gastos" section
      const allExpenses = db.prepare('SELECT * FROM expenses').all() as any[]
      for (const exp of allExpenses) {
        const itemType = exp.type === 'subscription' ? 'subscription' : 'common'
        db.prepare(`
          INSERT INTO section_items (section_id, category_id, description, type, value, due_day, is_active, is_completed, notes, sort_order)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0)
        `).run(
          gastosId, exp.category_id, exp.description, itemType,
          exp.value, exp.due_day, exp.is_active, exp.is_completed, exp.notes
        )
      }

      // Migrate card_items into the same "Gastos" section
      const allCardItems = db.prepare('SELECT * FROM card_items').all() as any[]
      for (const ci of allCardItems) {
        db.prepare(`
          INSERT INTO section_items (section_id, category_id, card_id, description, type, value, total_installments, paid_installments, is_active, sort_order)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0)
        `).run(
          gastosId, ci.category_id, ci.card_id, ci.description,
          ci.type === 'installment' ? 'installment' : 'common',
          ci.total_value, ci.total_installments, ci.paid_installments, ci.is_active
        )
      }

      // Assign all cards to default person
      db.prepare('UPDATE cards SET person_id = ? WHERE person_id IS NULL').run(defaultPersonId)

      // Assign wishlist items to default person
      db.prepare('UPDATE wishlist_items SET person_id = ? WHERE person_id IS NULL').run(defaultPersonId)
    }

    // 10. DROP old tables
    db.exec(`
      DROP TABLE IF EXISTS plan_person_specific_expenses;
      DROP TABLE IF EXISTS plan_person_config;
      DROP TABLE IF EXISTS plan_shared_items;
      DROP TABLE IF EXISTS monthly_plans;
      DROP TABLE IF EXISTS card_items;
      DROP TABLE IF EXISTS expenses;
    `)
  }
})
