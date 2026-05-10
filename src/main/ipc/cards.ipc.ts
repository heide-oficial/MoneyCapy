import { ipcMain } from 'electron'
import { WrappedDatabase } from '../database/connection'
import { IPC_CHANNELS } from '../../../shared/ipc-channels'
import { CardsRepository } from '../database/repositories/cards.repo'
import { BankAccountsRepository } from '../database/repositories/bank-accounts.repo'
import { SectionItemsRepository } from '../database/repositories/section-items.repo'
import { ItemMonthlyStatusRepository } from '../database/repositories/item-monthly-status.repo'
import { ItemCardSplitsRepository } from '../database/repositories/item-card-splits.repo'
import { EncryptionService } from '../services/encryption.service'
import { SettingsRepository } from '../database/repositories/settings.repo'
import { getStartCountingMonth, isMonthBeforeStart } from './start-counting-month'

function getCurrentMonth(): string {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
}


function mapCard(card: any, usedLimit: number, db?: WrappedDatabase) {
  let numberMasked = '**** **** **** ****'
  let expirationMasked = '**/**'
  let holderMasked = '*****'

  if (EncryptionService.isUnlocked()) {
    try {
      const num = EncryptionService.decrypt({ ciphertext: card.number_encrypted, iv: card.number_iv, tag: card.number_tag })
      const exp = EncryptionService.decrypt({ ciphertext: card.expiration_encrypted, iv: card.expiration_iv, tag: card.expiration_tag })
      const hld = EncryptionService.decrypt({ ciphertext: card.holder_encrypted, iv: card.holder_iv, tag: card.holder_tag })
      if (num) numberMasked = num
      if (exp) expirationMasked = exp
      if (hld) holderMasked = hld
    } catch { /* keep masked */ }
  }

  return {
    id: card.id,
    name: card.name,
    personId: card.person_id,
    bankAccountId: card.bank_account_id ?? null,
    numberMasked,
    expirationMasked,
    holderMasked,
    totalLimit: card.total_limit,
    usedLimit,
    availableLimit: Math.max(0, card.total_limit - usedLimit),
    overLimitAmount: Math.max(0, usedLimit - card.total_limit),
    billingCloseDay: card.billing_close_day,
    dueDay: card.due_day,
    cardType: card.card_type || 'both',
    currencyId: card.currency_id || null,
    currencySymbol: card.currency_symbol || undefined,
    currencyCode: card.currency_code || undefined,
    createdAt: card.created_at || null
  }
}

export function registerCardsHandlers(db: WrappedDatabase): void {
  const repo = new CardsRepository(db)
  const bankAccountsRepo = new BankAccountsRepository(db)
  const itemsRepo = new SectionItemsRepository(db)
  const statusRepo = new ItemMonthlyStatusRepository(db)
  const splitsRepo = new ItemCardSplitsRepository(db)
  const settingsRepo = new SettingsRepository(db)

  ipcMain.handle(IPC_CHANNELS.CARDS_LIST, (_, personId?: number, month?: string) => {
    const m = month || getCurrentMonth()
    const cards = repo.findAll(personId) as any[]
    return cards.map(card => mapCard(card, repo.getUsedLimitForMonth(card.id, m), db))
  })

  ipcMain.handle(IPC_CHANNELS.CARDS_GET_DECRYPTED, (_, id: number) => {
    if (!EncryptionService.isUnlocked()) {
      throw new Error('Encryption service is locked')
    }
    const card = repo.findById(id) as any
    if (!card) return null
    const m = getCurrentMonth()
    const usedLimit = repo.getUsedLimitForMonth(card.id, m)
    return {
      ...mapCard(card, usedLimit, db),
      number: EncryptionService.decrypt({ ciphertext: card.number_encrypted, iv: card.number_iv, tag: card.number_tag }),
      expiration: EncryptionService.decrypt({ ciphertext: card.expiration_encrypted, iv: card.expiration_iv, tag: card.expiration_tag }),
      holder: EncryptionService.decrypt({ ciphertext: card.holder_encrypted, iv: card.holder_iv, tag: card.holder_tag })
    }
  })

  ipcMain.handle(IPC_CHANNELS.CARDS_CREATE, (_, data) => {
    if (!EncryptionService.isUnlocked()) {
      throw new Error('Encryption service is locked. Set a password first.')
    }
    const numEnc = EncryptionService.encrypt(data.number || '')
    const expEnc = EncryptionService.encrypt(data.expiration || '')
    const hldEnc = EncryptionService.encrypt(data.holder || '')
    return repo.create({
      name: data.name,
      person_id: data.personId || null,
      bank_account_id: data.bankAccountId ?? null,
      number_encrypted: numEnc.ciphertext, number_iv: numEnc.iv, number_tag: numEnc.tag,
      expiration_encrypted: expEnc.ciphertext, expiration_iv: expEnc.iv, expiration_tag: expEnc.tag,
      holder_encrypted: hldEnc.ciphertext, holder_iv: hldEnc.iv, holder_tag: hldEnc.tag,
      total_limit: data.totalLimit,
      billing_close_day: data.billingCloseDay,
      due_day: data.dueDay,
      card_type: data.cardType || 'both',
      currency_id: data.currencyId || null
    })
  })

  ipcMain.handle(IPC_CHANNELS.CARDS_UPDATE, (_, data) => {
    const updateData: Record<string, any> = {}
    if (data.name !== undefined) updateData.name = data.name
    if (data.personId !== undefined) updateData.person_id = data.personId
    if (data.bankAccountId !== undefined) updateData.bank_account_id = data.bankAccountId
    if (data.totalLimit !== undefined) updateData.total_limit = data.totalLimit
    if (data.billingCloseDay !== undefined) updateData.billing_close_day = data.billingCloseDay
    if (data.dueDay !== undefined) updateData.due_day = data.dueDay
    if (data.cardType !== undefined) updateData.card_type = data.cardType
    if (data.currencyId !== undefined) updateData.currency_id = data.currencyId
    if (data.number !== undefined && EncryptionService.isUnlocked()) {
      const enc = EncryptionService.encrypt(data.number)
      updateData.number_encrypted = enc.ciphertext
      updateData.number_iv = enc.iv
      updateData.number_tag = enc.tag
    }
    if (data.expiration !== undefined && EncryptionService.isUnlocked()) {
      const enc = EncryptionService.encrypt(data.expiration)
      updateData.expiration_encrypted = enc.ciphertext
      updateData.expiration_iv = enc.iv
      updateData.expiration_tag = enc.tag
    }
    if (data.holder !== undefined && EncryptionService.isUnlocked()) {
      const enc = EncryptionService.encrypt(data.holder)
      updateData.holder_encrypted = enc.ciphertext
      updateData.holder_iv = enc.iv
      updateData.holder_tag = enc.tag
    }
    return repo.update(data.id, updateData)
  })

  ipcMain.handle(IPC_CHANNELS.CARDS_DELETE, (_, id) => repo.delete(id))

  ipcMain.handle(IPC_CHANNELS.CARDS_LIST_ENRICHED, (_, personId: number, month: string) => {
    const m = month || getCurrentMonth()
    const scm = getStartCountingMonth(settingsRepo, personId)
    const beforeStart = isMonthBeforeStart(m, scm)
    const cards = repo.findAll(personId) as any[]
    return cards.map(card => {
      const usedLimit = beforeStart ? 0 : repo.getUsedLimitForMonth(card.id, m)
      const base = mapCard(card, usedLimit, db)
      const counts = beforeStart
        ? { commonCount: 0, commonTotal: 0, installmentCount: 0, installmentTotal: 0, subscriptionCount: 0, subscriptionTotal: 0, emprestimoCount: 0, emprestimoTotal: 0 }
        : repo.getItemCountsForMonth(card.id, m)

      let bankAccountName: string | null = null
      if (card.bank_account_id) {
        const acc = bankAccountsRepo.findById(card.bank_account_id) as any
        bankAccountName = acc?.name || null
      }

      // Check if all credit items for this card are already paid
      let invoiceAllPaid = false
      if (!beforeStart && base.cardType !== 'debit') {
        invoiceAllPaid = repo.isInvoicePaid(card.id, m)
        const cardItems = itemsRepo.findByCardIdAndMonth(card.id, m) as any[]
        const isInterrupted = (itemId: number) => {
          const rows = db.prepare('SELECT end_month, resume_month FROM item_interruptions WHERE item_id = ?').all(itemId) as any[]
          return rows.some(row => row.resume_month ? m > row.end_month && m < row.resume_month : m > row.end_month)
        }
        const creditItems = cardItems.filter((item: any) => {
          if (isInterrupted(item.id)) return false
          if (item.type === 'installment' || item.type === 'emprestimo') return true
          return item.payment_method === 'credit'
        })
        invoiceAllPaid = invoiceAllPaid || creditItems.length === 0 || creditItems.every((item: any) => statusRepo.isPaid(item.id, m))
      }

      return {
        ...base,
        bankAccountName,
        invoiceAllPaid,
        commonCount: counts.commonCount,
        commonTotal: counts.commonTotal,
        installmentCount: counts.installmentCount,
        installmentTotal: counts.installmentTotal,
        subscriptionCount: counts.subscriptionCount,
        subscriptionTotal: counts.subscriptionTotal,
        emprestimoCount: counts.emprestimoCount,
        emprestimoTotal: counts.emprestimoTotal
      }
    })
  })

  ipcMain.handle(IPC_CHANNELS.CARDS_PAY_INVOICE, (_, cardId: number, month: string) => {
    const items = itemsRepo.findByCardIdAndMonth(cardId, month) as any[]
    const isInterrupted = (itemId: number) => {
      const rows = db.prepare('SELECT end_month, resume_month FROM item_interruptions WHERE item_id = ?').all(itemId) as any[]
      return rows.some(row => row.resume_month ? month > row.end_month && month < row.resume_month : month > row.end_month)
    }

    // Filter to credit items only (installment/emprestimo are always credit; common/subscription check payment_method)
    const creditItems = items.filter((item: any) => {
      if (isInterrupted(item.id)) return false
      if (item.type === 'installment' || item.type === 'emprestimo') return true
      return item.payment_method === 'credit'
    })

    const unpaid = creditItems.filter((item: any) => !statusRepo.isPaid(item.id, month))

    // Detect multi-card split items
    const multiCardItemNames: string[] = []
    for (const item of unpaid) {
      const splits = splitsRepo.findByItemId(item.id) as any[]
      if (splits.length > 0) {
        const otherCards = splits.filter((s: any) => s.card_id !== cardId)
        if (otherCards.length > 0) multiCardItemNames.push(item.description)
      }
    }

    // Mark all unpaid credit items as paid
    const today = new Date().toISOString().substring(0, 10)
    for (const item of unpaid) {
      statusRepo.setPaid(item.id, month, true, today)
    }
    repo.setInvoicePaid(cardId, month, true, today)

    return {
      paidCount: unpaid.length,
      hasMultiCardItems: multiCardItemNames.length > 0,
      multiCardItemNames
    }
  })
}
