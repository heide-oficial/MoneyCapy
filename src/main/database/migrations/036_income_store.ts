import { registerMigration } from './runner'

registerMigration({
  name: '036_income_store',
  up(db) {
    db.exec(`ALTER TABLE person_income ADD COLUMN store_id INTEGER REFERENCES stores(id) ON DELETE SET NULL`)
  }
})
