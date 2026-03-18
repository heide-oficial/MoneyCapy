import { registerMigration } from './runner'

registerMigration({
  name: '027_stores_color',
  up(db) {
    db.exec(`ALTER TABLE stores ADD COLUMN color TEXT NOT NULL DEFAULT '#6366f1'`)
  }
})
