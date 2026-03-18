import { registerMigration } from './runner'

registerMigration({
  name: '028_income_received_at',
  up(db) {
    db.exec(`ALTER TABLE income_monthly_status ADD COLUMN received_at TEXT`)
  }
})
