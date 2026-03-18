import { registerMigration } from './runner'

registerMigration({
  name: '024_stores',
  up(db) {
    db.exec(`
      CREATE TABLE IF NOT EXISTS stores (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      )
    `)

    db.exec(`ALTER TABLE section_items ADD COLUMN store_id INTEGER REFERENCES stores(id) ON DELETE SET NULL`)

    // Backfill: for each unique store TEXT, create a store record and update store_id
    const uniqueStores = db.prepare(
      `SELECT DISTINCT store FROM section_items WHERE store IS NOT NULL AND store != ''`
    ).all() as { store: string }[]

    for (const row of uniqueStores) {
      const result = db.prepare(`INSERT INTO stores (name) VALUES (?)`).run(row.store)
      const storeId = result.lastInsertRowid
      db.prepare(`UPDATE section_items SET store_id = ? WHERE store = ?`).run(storeId, row.store)
    }
  }
})
