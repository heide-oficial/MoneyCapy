import { registerMigration } from './runner'

registerMigration({
  name: '030_due_day_month_offset',
  up: (db) => {
    db.exec(`ALTER TABLE section_items ADD COLUMN due_day_month_offset INTEGER DEFAULT 0`)
  }
})
