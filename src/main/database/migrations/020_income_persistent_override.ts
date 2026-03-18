import { registerMigration } from './runner'

registerMigration({
  name: '020_income_persistent_override',
  up(db) {
    db.exec(`ALTER TABLE income_monthly_values ADD COLUMN persistent INTEGER NOT NULL DEFAULT 0`)
  }
})
