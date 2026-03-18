import { registerMigration } from './runner'

registerMigration({
  name: '021_paid_at',
  up(db) {
    db.exec(`ALTER TABLE item_monthly_status ADD COLUMN paid_at TEXT DEFAULT NULL`)
  }
})
