import { registerMigration } from './runner'

registerMigration({
  name: '038_resume_month',
  up(db) {
    db.exec(`ALTER TABLE section_items ADD COLUMN resume_month TEXT`)
  }
})
