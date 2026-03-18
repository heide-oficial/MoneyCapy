import { registerMigration } from './runner'

registerMigration({
  name: '032_billing_day_month_offset',
  up: (db) => {
    db.exec(`ALTER TABLE section_items ADD COLUMN billing_day_month_offset INTEGER DEFAULT 0`)
  }
})
