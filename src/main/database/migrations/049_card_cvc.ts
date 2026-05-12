import { registerMigration } from './runner'

registerMigration({
  name: '049_card_cvc',
  up(db) {
    const columns = db.prepare('PRAGMA table_info(cards)').all().map((row: any) => row.name)
    if (!columns.includes('cvc_encrypted')) {
      db.exec(`ALTER TABLE cards ADD COLUMN cvc_encrypted TEXT NOT NULL DEFAULT ''`)
    }
    if (!columns.includes('cvc_iv')) {
      db.exec(`ALTER TABLE cards ADD COLUMN cvc_iv TEXT NOT NULL DEFAULT ''`)
    }
    if (!columns.includes('cvc_tag')) {
      db.exec(`ALTER TABLE cards ADD COLUMN cvc_tag TEXT NOT NULL DEFAULT ''`)
    }
  }
})
