import { WrappedDatabase } from '../connection'
import { registerMigration } from './runner'

registerMigration({
  name: '005_item_details',
  up: (db: WrappedDatabase) => {
    db.exec(`
      ALTER TABLE section_items ADD COLUMN icon TEXT;
      ALTER TABLE section_items ADD COLUMN color TEXT;
      ALTER TABLE section_items ADD COLUMN image_url TEXT;
    `)
  }
})
