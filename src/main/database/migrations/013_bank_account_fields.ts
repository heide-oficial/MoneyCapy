import { registerMigration } from './runner'

registerMigration({
  name: '013_bank_account_fields',
  up(db) {
    db.exec(`ALTER TABLE bank_accounts ADD COLUMN account_type TEXT NOT NULL DEFAULT 'corrente'`)
    db.exec(`ALTER TABLE bank_accounts ADD COLUMN juridicidade TEXT NOT NULL DEFAULT 'cpf'`)
    db.exec(`ALTER TABLE bank_accounts ADD COLUMN agencia TEXT`)
    db.exec(`ALTER TABLE bank_accounts ADD COLUMN conta TEXT`)
    db.exec(`ALTER TABLE bank_accounts ADD COLUMN banco TEXT`)
    db.exec(`ALTER TABLE bank_accounts ADD COLUMN nome_banco TEXT`)
  }
})
