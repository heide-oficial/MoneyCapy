import { registerMigration } from './runner'

registerMigration({
  name: '025_monthly_active',
  up(db) {
    db.exec(`ALTER TABLE item_monthly_status ADD COLUMN is_active INTEGER DEFAULT NULL`)
  }
})
