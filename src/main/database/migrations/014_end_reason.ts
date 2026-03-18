import { registerMigration } from './runner'

registerMigration({
  name: '014_end_reason',
  up(db) {
    db.exec(`ALTER TABLE section_items ADD COLUMN end_reason TEXT`)
  }
})
