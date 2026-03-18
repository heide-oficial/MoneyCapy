import { WrappedDatabase } from '../connection'
import { registerMigration } from './runner'

registerMigration({
  name: '009_due_day_label',
  up: (db: WrappedDatabase) => {
    db.exec(`ALTER TABLE section_items ADD COLUMN due_day_label TEXT`)
  }
})
