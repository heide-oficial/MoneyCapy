import { ipcMain } from 'electron'
import { WrappedDatabase } from '../database/connection'
import { IPC_CHANNELS } from '../../../shared/ipc-channels'
import { PersonIncomeRepository } from '../database/repositories/person-income.repo'
import { IncomeMonthlyStatusRepository } from '../database/repositories/income-monthly-status.repo'
import { IncomeInterruptionsRepository } from '../database/repositories/income-interruptions.repo'
import { TagsRepository } from '../database/repositories/tags.repo'
import { SettingsRepository } from '../database/repositories/settings.repo'
import { getStartCountingMonth, isMonthBeforeStart } from './start-counting-month'
import { addMonths } from '../utils/month-utils'

function mapIncome(i: any) {
  return {
    id: i.id,
    personId: i.person_id,
    personName: i.person_name,
    description: i.description,
    value: i.value,
    isRecurring: i.is_recurring === 1,
    startMonth: i.start_month,
    endMonth: i.end_month || null,
    categoryId: i.category_id || null,
    categoryName: i.category_name || undefined,
    categoryColor: i.category_color || undefined,
    dueDay: i.due_day || null,
    dueDayType: i.due_day_type || 'static',
    notes: i.notes || '',
    storeId: i.store_id || null,
    storeName: i.store_name || undefined,
    storeColor: i.store_color || undefined,
    currencyId: i.currency_id || null,
    currencySymbol: i.currency_symbol || undefined,
    currencyCode: i.currency_code || undefined,
    exchangeRateSnapshot: i.exchange_rate_snapshot ?? 1.0,
    createdAt: i.created_at || null
  }
}

function enrichIncome(mapped: any, tagsRepo: TagsRepository, interruptionsRepo?: IncomeInterruptionsRepository) {
  mapped.tags = (tagsRepo.findByIncomeId(mapped.id) as any[]).map(t => ({
    id: t.id, name: t.name, color: t.color
  }))
  if (interruptionsRepo) {
    mapped.interruptions = interruptionsRepo.findByIncomeId(mapped.id).map(int => ({
      id: int.id, endMonth: int.end_month, resumeMonth: int.resume_month || null
    }))
  }
  return mapped
}

export function registerPersonIncomeHandlers(db: WrappedDatabase): void {
  const repo = new PersonIncomeRepository(db)
  const statusRepo = new IncomeMonthlyStatusRepository(db)
  const interruptionsRepo = new IncomeInterruptionsRepository(db)
  const tagsRepo = new TagsRepository(db)
  const settingsRepo = new SettingsRepository(db)

  ipcMain.handle(IPC_CHANNELS.PERSON_INCOME_LIST_BY_MONTH, (_, personId: number, month: string) => {
    const scm = getStartCountingMonth(settingsRepo, personId)
    if (isMonthBeforeStart(month, scm)) return []

    const incomes = repo.findByPersonAndMonth(personId, month) as any[]
    return incomes.map(i => {
      const mapped = mapIncome(i)
      const info = repo.getOverrideInfo(i.id, month)
      const enriched = enrichIncome({
        ...mapped,
        effectiveValue: info ? info.value : i.value,
        hasOverride: info !== null,
        isReceived: statusRepo.isReceived(i.id, month),
        receivedAt: statusRepo.getReceivedAt(i.id, month)
      }, tagsRepo, interruptionsRepo)
      return enriched
    })
  })

  ipcMain.handle(IPC_CHANNELS.PERSON_INCOME_CREATE, (_, data) => {
    const item = repo.create({
      person_id: data.personId,
      description: data.description,
      value: data.value,
      is_recurring: data.isRecurring ? 1 : 0,
      start_month: data.startMonth,
      end_month: data.endMonth || null,
      category_id: data.categoryId || null,
      due_day: data.dueDay || null,
      due_day_type: data.dueDayType || 'static',
      notes: data.notes || '',
      store_id: data.storeId || null,
      currency_id: data.currencyId || null,
      exchange_rate_snapshot: data.exchangeRateSnapshot ?? 1.0
    }) as any
    if (data.tagIds && data.tagIds.length > 0) {
      tagsRepo.setIncomeTags(item.id, data.tagIds)
    }
    return enrichIncome(mapIncome(item), tagsRepo)
  })

  ipcMain.handle(IPC_CHANNELS.PERSON_INCOME_UPDATE, (_, data) => {
    const updateData: Record<string, any> = {}
    if (data.personId !== undefined) updateData.person_id = data.personId
    if (data.description !== undefined) updateData.description = data.description
    if (data.value !== undefined) updateData.value = data.value
    if (data.isRecurring !== undefined) updateData.is_recurring = data.isRecurring ? 1 : 0
    if (data.startMonth !== undefined) updateData.start_month = data.startMonth
    if (data.endMonth !== undefined) updateData.end_month = data.endMonth
    if (data.categoryId !== undefined) updateData.category_id = data.categoryId || null
    if (data.dueDay !== undefined) updateData.due_day = data.dueDay
    if (data.dueDayType !== undefined) updateData.due_day_type = data.dueDayType
    if (data.notes !== undefined) updateData.notes = data.notes
    if (data.storeId !== undefined) updateData.store_id = data.storeId || null
    if (data.currencyId !== undefined) updateData.currency_id = data.currencyId
    if (data.exchangeRateSnapshot !== undefined) updateData.exchange_rate_snapshot = data.exchangeRateSnapshot
    const item = repo.update(data.id, updateData) as any
    if (data.tagIds !== undefined) {
      tagsRepo.setIncomeTags(data.id, data.tagIds)
    }
    return enrichIncome(mapIncome(item), tagsRepo)
  })

  ipcMain.handle(IPC_CHANNELS.PERSON_INCOME_DELETE, (_, id) => repo.delete(id))

  ipcMain.handle(IPC_CHANNELS.PERSON_INCOME_TOGGLE_RECEIVED, (_, incomeId: number, month: string) => {
    return statusRepo.toggleReceived(incomeId, month)
  })

  ipcMain.handle(IPC_CHANNELS.PERSON_INCOME_SET_RECEIVED, (_, incomeId: number, month: string, isReceived: boolean, receivedAt?: string) => {
    statusRepo.setReceived(incomeId, month, isReceived, receivedAt || null)
  })

  ipcMain.handle(IPC_CHANNELS.PERSON_INCOME_SET_MONTH_VALUE, (_, incomeId: number, month: string, value: number) => {
    repo.setValueForMonth(incomeId, month, value)
  })

  ipcMain.handle(IPC_CHANNELS.PERSON_INCOME_REMOVE_MONTH_VALUE, (_, incomeId: number, month: string) => {
    repo.removeValueOverride(incomeId, month)
  })

  ipcMain.handle(IPC_CHANNELS.PERSON_INCOME_SEARCH, (_, personId: number, query: string, filters?: { isRecurring?: boolean; categoryId?: number; tagId?: number }) => {
    const items = (repo.search(personId, query, filters) as any[]).map(i => {
      const mapped = mapIncome(i)
      return enrichIncome(mapped, tagsRepo, interruptionsRepo)
    })
    return items
  })

  ipcMain.handle(IPC_CHANNELS.INCOME_INTERRUPT, (_, incomeId: number, currentMonth: string, pauseMonths?: number) => {
    const income = repo.findById(incomeId) as any
    if (!income) throw new Error('Income not found')
    if (!pauseMonths && interruptionsRepo.hasPermanent(incomeId)) throw new Error('Income already has a permanent interruption')
    const resumeMonth = pauseMonths ? addMonths(currentMonth, pauseMonths + 1) : undefined
    interruptionsRepo.create(incomeId, currentMonth, resumeMonth)
  })

  ipcMain.handle(IPC_CHANNELS.INCOME_REACTIVATE, (_, interruptionId: number) => {
    interruptionsRepo.deleteById(interruptionId)
  })
}
