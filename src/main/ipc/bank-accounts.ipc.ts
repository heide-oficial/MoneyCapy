import { ipcMain } from 'electron'
import { WrappedDatabase } from '../database/connection'
import { IPC_CHANNELS } from '../../../shared/ipc-channels'
import { BankAccountsRepository } from '../database/repositories/bank-accounts.repo'
import { CardsRepository } from '../database/repositories/cards.repo'

function mapBankAccount(row: any) {
  return {
    id: row.id,
    personId: row.person_id,
    name: row.name,
    balance: row.balance,
    icon: row.icon,
    color: row.color,
    accountType: row.account_type || 'corrente',
    juridicidade: row.juridicidade || 'cpf',
    agencia: row.agencia || null,
    conta: row.conta || null,
    banco: row.banco || null,
    nomeBanco: row.nome_banco || null,
    currencyId: row.currency_id || null,
    currencySymbol: row.currency_symbol || undefined,
    currencyCode: row.currency_code || undefined
  }
}

export function registerBankAccountsHandlers(db: WrappedDatabase): void {
  const repo = new BankAccountsRepository(db)
  const cardsRepo = new CardsRepository(db)

  ipcMain.handle(IPC_CHANNELS.BANK_ACCOUNTS_LIST, (_, personId: number) => {
    const rows = repo.findByPersonId(personId) as any[]
    return rows.map(mapBankAccount)
  })

  ipcMain.handle(IPC_CHANNELS.BANK_ACCOUNTS_CREATE, (_, data) => {
    const row = repo.create({
      person_id: data.personId,
      name: data.name,
      balance: data.balance,
      icon: data.icon,
      color: data.color,
      account_type: data.accountType,
      juridicidade: data.juridicidade,
      agencia: data.agencia,
      conta: data.conta,
      banco: data.banco,
      nome_banco: data.nomeBanco,
      currency_id: data.currencyId || null
    }) as any
    return mapBankAccount(row)
  })

  ipcMain.handle(IPC_CHANNELS.BANK_ACCOUNTS_UPDATE, (_, data) => {
    const updateData: Record<string, any> = {}
    if (data.name !== undefined) updateData.name = data.name
    if (data.balance !== undefined) updateData.balance = data.balance
    if (data.icon !== undefined) updateData.icon = data.icon
    if (data.color !== undefined) updateData.color = data.color
    if (data.personId !== undefined) updateData.person_id = data.personId
    if (data.accountType !== undefined) updateData.account_type = data.accountType
    if (data.juridicidade !== undefined) updateData.juridicidade = data.juridicidade
    if (data.agencia !== undefined) updateData.agencia = data.agencia
    if (data.conta !== undefined) updateData.conta = data.conta
    if (data.banco !== undefined) updateData.banco = data.banco
    if (data.nomeBanco !== undefined) updateData.nome_banco = data.nomeBanco
    if (data.currencyId !== undefined) updateData.currency_id = data.currencyId
    const row = repo.update(data.id, updateData) as any
    return mapBankAccount(row)
  })

  ipcMain.handle(IPC_CHANNELS.BANK_ACCOUNTS_DELETE, (_, id: number) => {
    repo.delete(id)
  })

  ipcMain.handle(IPC_CHANNELS.BANK_ACCOUNTS_LIST_ENRICHED, (_, personId: number, month: string) => {
    const rows = repo.findByPersonId(personId) as any[]
    return rows.map(row => {
      const base = mapBankAccount(row)
      const linkedCards = repo.countLinkedCards(row.id)
      const linkedLoans = repo.countLinkedLoans(row.id, month)
      const cardIds = repo.getLinkedCardIds(row.id)

      let commonCount = 0, commonTotal = 0
      let installmentCount = 0, installmentTotal = 0
      let subscriptionCount = 0, subscriptionTotal = 0
      let emprestimoCount = 0, emprestimoTotal = 0

      // Items from cards linked to this account
      for (const cardId of cardIds) {
        const counts = cardsRepo.getItemCountsForMonth(cardId, month)
        commonCount += counts.commonCount
        commonTotal += counts.commonTotal
        installmentCount += counts.installmentCount
        installmentTotal += counts.installmentTotal
        subscriptionCount += counts.subscriptionCount
        subscriptionTotal += counts.subscriptionTotal
        emprestimoCount += counts.emprestimoCount
        emprestimoTotal += counts.emprestimoTotal
      }

      // Items directly linked to this bank account (via bank_account_id on section_items)
      const direct = repo.getDirectItemCountsForMonth(row.id, month)
      commonCount += direct.commonCount
      commonTotal += direct.commonTotal
      installmentCount += direct.installmentCount
      installmentTotal += direct.installmentTotal
      subscriptionCount += direct.subscriptionCount
      subscriptionTotal += direct.subscriptionTotal
      emprestimoCount += direct.emprestimoCount
      emprestimoTotal += direct.emprestimoTotal

      return {
        ...base,
        balance: repo.getMonthlyBalance(row.id, month),
        hasMonthlyOverride: repo.hasMonthlyBalanceOverride(row.id, month),
        linkedCards,
        linkedLoans,
        commonCount,
        commonTotal,
        installmentCount,
        installmentTotal,
        subscriptionCount,
        subscriptionTotal,
        emprestimoCount,
        emprestimoTotal
      }
    })
  })

  ipcMain.handle(IPC_CHANNELS.BANK_ACCOUNTS_SET_MONTHLY_BALANCE, (_, bankAccountId: number, month: string, balance: number) => {
    repo.setMonthlyBalance(bankAccountId, month, balance)
    return {
      balance: repo.getMonthlyBalance(bankAccountId, month),
      hasOverride: true
    }
  })

  ipcMain.handle(IPC_CHANNELS.BANK_ACCOUNTS_REMOVE_MONTHLY_BALANCE, (_, bankAccountId: number, month: string) => {
    repo.removeMonthlyBalance(bankAccountId, month)
    return {
      balance: repo.getMonthlyBalance(bankAccountId, month),
      hasOverride: false
    }
  })
}
