import { registerMigration } from './runner'

registerMigration({
  name: '034_anticipation_discount',
  up: (db) => {
    db.exec(`ALTER TABLE item_anticipations ADD COLUMN discounted_total REAL`)
  }
})
