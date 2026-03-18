import { registerMigration } from './runner'

registerMigration({
  name: '023_payment_method_billing',
  up(db) {
    db.exec(`ALTER TABLE section_items ADD COLUMN payment_method TEXT DEFAULT NULL`)
    db.exec(`ALTER TABLE cards ADD COLUMN card_type TEXT NOT NULL DEFAULT 'both'`)

    // Backfill: installment/emprestimo items with a card → credit
    db.exec(`
      UPDATE section_items
      SET payment_method = 'credit'
      WHERE card_id IS NOT NULL
        AND (type = 'installment' OR type = 'emprestimo')
    `)

    // Backfill: subscription items with a card → credit
    db.exec(`
      UPDATE section_items
      SET payment_method = 'credit'
      WHERE card_id IS NOT NULL
        AND type = 'subscription'
    `)
  }
})
