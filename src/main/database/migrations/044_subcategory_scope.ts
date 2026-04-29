import { registerMigration } from './runner'

registerMigration({
  name: '044_subcategory_scope',
  up(db) {
    const columns = db.prepare("PRAGMA table_info(subcategories)").all() as any[]
    if (!columns.some((c: any) => c.name === 'scope')) {
      db.exec(`ALTER TABLE subcategories ADD COLUMN scope TEXT NOT NULL DEFAULT 'both' CHECK (scope IN ('expense','income','both'))`)
    }
  }
})
