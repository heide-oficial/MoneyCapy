import { WrappedDatabase } from '../connection'
import { registerMigration } from './runner'

registerMigration({
  name: '007_item_store',
  up: (db: WrappedDatabase) => {
    db.exec(`ALTER TABLE section_items ADD COLUMN store TEXT`)
  }
})
