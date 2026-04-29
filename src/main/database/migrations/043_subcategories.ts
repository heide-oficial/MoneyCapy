import { registerMigration } from './runner'

registerMigration({
  name: '043_subcategories',
  up(db) {
    db.exec(`
      CREATE TABLE IF NOT EXISTS subcategories (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        color TEXT DEFAULT '#6b7280',
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS category_subcategories (
        category_id INTEGER NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
        subcategory_id INTEGER NOT NULL REFERENCES subcategories(id) ON DELETE CASCADE,
        PRIMARY KEY (category_id, subcategory_id)
      );
    `)

    const itemColumns = db.prepare("PRAGMA table_info(section_items)").all() as any[]
    if (!itemColumns.some((c: any) => c.name === 'subcategory_id')) {
      db.exec(`ALTER TABLE section_items ADD COLUMN subcategory_id INTEGER REFERENCES subcategories(id) ON DELETE SET NULL`)
    }

    const incomeColumns = db.prepare("PRAGMA table_info(person_income)").all() as any[]
    if (!incomeColumns.some((c: any) => c.name === 'subcategory_id')) {
      db.exec(`ALTER TABLE person_income ADD COLUMN subcategory_id INTEGER REFERENCES subcategories(id) ON DELETE SET NULL`)
    }
  }
})
