import { registerMigration } from './runner'

registerMigration({
  name: '041_split_payment_method',
  up(db) {
    const columns = db.prepare("PRAGMA table_info(item_card_splits)").all() as any[]
    if (!columns.some((c: any) => c.name === 'payment_method')) {
      db.exec(`ALTER TABLE item_card_splits ADD COLUMN payment_method TEXT DEFAULT NULL`)
    }
  }
})
