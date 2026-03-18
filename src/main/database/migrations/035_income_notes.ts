import { registerMigration } from './runner'

registerMigration({
  name: '035_income_notes',
  up(db) {
    db.exec(`ALTER TABLE person_income ADD COLUMN notes TEXT DEFAULT ''`)
  }
})
