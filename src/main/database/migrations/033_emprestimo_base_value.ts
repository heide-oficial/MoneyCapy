import { registerMigration } from './runner'

registerMigration({
  name: '033_emprestimo_base_value',
  up: (db) => {
    db.exec(`ALTER TABLE section_items ADD COLUMN base_value REAL`)
  }
})
