import { ipcMain } from 'electron'
import { WrappedDatabase } from '../database/connection'
import { IPC_CHANNELS } from '../../../shared/ipc-channels'
import { SettingsRepository } from '../database/repositories/settings.repo'
import { EncryptionService } from '../services/encryption.service'

export function registerSettingsHandlers(db: WrappedDatabase): void {
  const repo = new SettingsRepository(db)

  ipcMain.handle(IPC_CHANNELS.SETTINGS_GET, (_, key: string) => {
    return repo.get(key)
  })

  ipcMain.handle(IPC_CHANNELS.SETTINGS_SET, (_, key: string, value: string) => {
    repo.set(key, value)
    return true
  })

  ipcMain.handle(IPC_CHANNELS.SETTINGS_HAS_PASSWORD, () => {
    return repo.get('password_hash') !== null
  })

  ipcMain.handle(IPC_CHANNELS.SETTINGS_SET_PASSWORD, (_, password: string) => {
    const salt = EncryptionService.generateSalt()
    const encryptionSalt = EncryptionService.generateSalt()
    const hash = EncryptionService.hashPassword(password, salt)
    repo.set('password_hash', hash)
    repo.set('password_salt', salt)
    repo.set('encryption_salt', encryptionSalt)
    EncryptionService.unlock(password, encryptionSalt)
    return true
  })

  ipcMain.handle(IPC_CHANNELS.SETTINGS_VERIFY_PASSWORD, (_, password: string) => {
    const storedHash = repo.get('password_hash')
    const salt = repo.get('password_salt')
    const encryptionSalt = repo.get('encryption_salt')
    if (!storedHash || !salt || !encryptionSalt) return false
    const hash = EncryptionService.hashPassword(password, salt)
    if (hash === storedHash) {
      EncryptionService.unlock(password, encryptionSalt)
      return true
    }
    return false
  })

  ipcMain.handle(IPC_CHANNELS.SETTINGS_CHANGE_PASSWORD, (_, currentPassword: string, newPassword: string) => {
    const storedHash = repo.get('password_hash')
    const salt = repo.get('password_salt')
    if (!storedHash || !salt) return false
    const hash = EncryptionService.hashPassword(currentPassword, salt)
    if (hash !== storedHash) return false

    const newSalt = EncryptionService.generateSalt()
    const newEncryptionSalt = EncryptionService.generateSalt()
    const newHash = EncryptionService.hashPassword(newPassword, newSalt)

    const oldEncryptionSalt = repo.get('encryption_salt')!
    EncryptionService.unlock(currentPassword, oldEncryptionSalt)

    const cards = db.prepare('SELECT * FROM cards').all() as any[]
    const decryptedCards = cards.map(card => ({
      id: card.id,
      number: EncryptionService.decrypt({ ciphertext: card.number_encrypted, iv: card.number_iv, tag: card.number_tag }),
      expiration: EncryptionService.decrypt({ ciphertext: card.expiration_encrypted, iv: card.expiration_iv, tag: card.expiration_tag }),
      holder: EncryptionService.decrypt({ ciphertext: card.holder_encrypted, iv: card.holder_iv, tag: card.holder_tag }),
    }))

    EncryptionService.unlock(newPassword, newEncryptionSalt)

    const updateStmt = db.prepare(`
      UPDATE cards SET
        number_encrypted = ?, number_iv = ?, number_tag = ?,
        expiration_encrypted = ?, expiration_iv = ?, expiration_tag = ?,
        holder_encrypted = ?, holder_iv = ?, holder_tag = ?,
        updated_at = datetime('now')
      WHERE id = ?
    `)

    const transaction = db.transaction(() => {
      for (const card of decryptedCards) {
        const num = EncryptionService.encrypt(card.number)
        const exp = EncryptionService.encrypt(card.expiration)
        const hld = EncryptionService.encrypt(card.holder)
        updateStmt.run(
          num.ciphertext, num.iv, num.tag,
          exp.ciphertext, exp.iv, exp.tag,
          hld.ciphertext, hld.iv, hld.tag,
          card.id
        )
      }
      repo.set('password_hash', newHash)
      repo.set('password_salt', newSalt)
      repo.set('encryption_salt', newEncryptionSalt)
    })
    transaction()
    return true
  })

  // Reset person data
  ipcMain.handle(IPC_CHANNELS.SETTINGS_RESET_PERSON, (_, personId: number) => {
    const transaction = db.transaction(() => {
      // Child tables of section_items
      db.prepare('DELETE FROM item_monthly_values WHERE item_id IN (SELECT id FROM section_items WHERE person_id = ?)').run(personId)
      db.prepare('DELETE FROM item_interruptions WHERE item_id IN (SELECT id FROM section_items WHERE person_id = ?)').run(personId)
      // Child tables of person_income
      db.prepare('DELETE FROM income_monthly_values WHERE income_id IN (SELECT id FROM person_income WHERE person_id = ?)').run(personId)
      db.prepare('DELETE FROM income_monthly_status WHERE income_id IN (SELECT id FROM person_income WHERE person_id = ?)').run(personId)
      db.prepare('DELETE FROM income_tags WHERE income_id IN (SELECT id FROM person_income WHERE person_id = ?)').run(personId)
      db.prepare('DELETE FROM income_interruptions WHERE income_id IN (SELECT id FROM person_income WHERE person_id = ?)').run(personId)
      // Child tables of bank_accounts
      db.prepare('DELETE FROM bank_account_monthly_balance WHERE account_id IN (SELECT id FROM bank_accounts WHERE person_id = ?)').run(personId)

      db.prepare('DELETE FROM section_items WHERE person_id = ?').run(personId)
      db.prepare('DELETE FROM person_income WHERE person_id = ?').run(personId)
      db.prepare('DELETE FROM bank_accounts WHERE person_id = ?').run(personId)
      db.prepare('DELETE FROM loans WHERE person_id = ?').run(personId)

      db.prepare('UPDATE cards SET person_id = NULL WHERE person_id = ?').run(personId)
    })
    transaction()
    return true
  })

  // Reset all data (delete all people cascades everything)
  ipcMain.handle(IPC_CHANNELS.SETTINGS_RESET_ALL_DATA, () => {
    const transaction = db.transaction(() => {
      db.prepare('DELETE FROM item_anticipations').run()
      db.prepare('DELETE FROM item_current_installment_payments').run()
      db.prepare('DELETE FROM item_monthly_status').run()
      db.prepare('DELETE FROM item_monthly_values').run()
      db.prepare('DELETE FROM item_interruptions').run()
      db.prepare('DELETE FROM item_card_splits').run()
      db.prepare('DELETE FROM item_tags').run()
      db.prepare('DELETE FROM section_items').run()
      db.prepare('DELETE FROM card_invoice_status').run()
      db.prepare('DELETE FROM income_monthly_values').run()
      db.prepare('DELETE FROM income_monthly_status').run()
      db.prepare('DELETE FROM income_tags').run()
      db.prepare('DELETE FROM income_interruptions').run()
      db.prepare('DELETE FROM person_income').run()
      db.prepare('DELETE FROM loans').run()
      db.prepare('DELETE FROM cards').run()
      db.prepare('DELETE FROM bank_account_monthly_balance').run()
      db.prepare('DELETE FROM bank_accounts').run()

      db.prepare('DELETE FROM stores').run()
      db.prepare('DELETE FROM categories').run()
      db.prepare('DELETE FROM tags').run()
      db.prepare('DELETE FROM people').run()
    })
    transaction()
    return true
  })

  // Reset app completely
  ipcMain.handle(IPC_CHANNELS.SETTINGS_RESET_APP, () => {
    const transaction = db.transaction(() => {
      db.prepare('DELETE FROM item_anticipations').run()
      db.prepare('DELETE FROM item_current_installment_payments').run()
      db.prepare('DELETE FROM item_monthly_status').run()
      db.prepare('DELETE FROM item_monthly_values').run()
      db.prepare('DELETE FROM item_interruptions').run()
      db.prepare('DELETE FROM item_card_splits').run()
      db.prepare('DELETE FROM item_tags').run()
      db.prepare('DELETE FROM section_items').run()
      db.prepare('DELETE FROM card_invoice_status').run()
      db.prepare('DELETE FROM income_monthly_values').run()
      db.prepare('DELETE FROM income_monthly_status').run()
      db.prepare('DELETE FROM income_tags').run()
      db.prepare('DELETE FROM income_interruptions').run()
      db.prepare('DELETE FROM person_income').run()
      db.prepare('DELETE FROM loans').run()
      db.prepare('DELETE FROM cards').run()
      db.prepare('DELETE FROM bank_account_monthly_balance').run()
      db.prepare('DELETE FROM bank_accounts').run()

      db.prepare('DELETE FROM stores').run()
      db.prepare('DELETE FROM categories').run()
      db.prepare('DELETE FROM tags').run()
      db.prepare('DELETE FROM people').run()
      db.prepare('DELETE FROM currencies').run()
      db.prepare('DELETE FROM settings').run()
    })
    transaction()
    return true
  })
}
