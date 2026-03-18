import { WrappedDatabase } from '../connection'
import { registerMigration } from './runner'

registerMigration({
  name: '006_cleanup_orphaned_cards',
  up: (db: WrappedDatabase) => {
    // Remove card references from section_items that point to orphaned cards
    db.exec(`
      UPDATE section_items SET card_id = NULL
      WHERE card_id IN (SELECT id FROM cards WHERE bank_account_id IS NULL)
    `)

    // Remove splits referencing orphaned cards
    db.exec(`
      DELETE FROM item_card_splits
      WHERE card_id IN (SELECT id FROM cards WHERE bank_account_id IS NULL)
    `)

    // Delete orphaned cards (created before bank accounts feature)
    db.exec(`DELETE FROM cards WHERE bank_account_id IS NULL`)
  }
})
