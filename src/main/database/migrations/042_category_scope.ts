import { registerMigration } from './runner'

registerMigration({
  name: '042_category_scope',
  up(db) {
    const columns = db.prepare("PRAGMA table_info(categories)").all() as any[]
    if (!columns.some((c: any) => c.name === 'scope')) {
      db.exec(`ALTER TABLE categories ADD COLUMN scope TEXT NOT NULL DEFAULT 'both'`)
    }
  }
})
