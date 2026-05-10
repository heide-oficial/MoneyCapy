import { ipcMain } from 'electron'
import { WrappedDatabase } from '../database/connection'
import { IPC_CHANNELS } from '../../../shared/ipc-channels'
import { SectionItemsRepository } from '../database/repositories/section-items.repo'
import { TagsRepository } from '../database/repositories/tags.repo'
import { ItemCardSplitsRepository } from '../database/repositories/item-card-splits.repo'
import { ItemMonthlyStatusRepository } from '../database/repositories/item-monthly-status.repo'
import { ItemAnticipationsRepository } from '../database/repositories/item-anticipations.repo'
import { ItemCurrentInstallmentPaymentsRepository } from '../database/repositories/item-current-installment-payments.repo'
import { ItemInterruptionsRepository } from '../database/repositories/item-interruptions.repo'
import { SettingsRepository } from '../database/repositories/settings.repo'
import { getStartCountingMonth, isMonthBeforeStart } from './start-counting-month'
import { monthDiff, addMonths, getCardType } from '../utils/month-utils'

function getCardDueDays(item: any, db?: WrappedDatabase): number[] {
  if (item.due_day_type !== 'card_due' || !db) return []
  if (item.card_due_day) return [item.card_due_day]
  const splits = db.prepare(
    'SELECT DISTINCT c.due_day FROM item_card_splits ics JOIN cards c ON c.id = ics.card_id WHERE ics.item_id = ? AND c.due_day IS NOT NULL'
  ).all(item.id) as any[]
  return splits.map(s => s.due_day).filter((d: any) => d != null)
}

function mapItem(item: any, db?: WrappedDatabase) {
  return {
    id: item.id,
    personId: item.person_id,
    categoryId: item.category_id,
    categoryName: item.category_name || undefined,
    categoryIcon: item.category_icon || undefined,
    categoryColor: item.category_color || undefined,
    subcategoryId: item.subcategory_id || null,
    subcategoryName: item.subcategory_name || undefined,
    subcategoryColor: item.subcategory_color || undefined,
    cardId: item.card_id,
    cardName: item.card_name || undefined,
    cardType: db ? getCardType(db, item.card_id) : null,
    description: item.description,
    type: item.type,
    value: item.value,
    dueDay: item.due_day,
    dueDayLabel: item.due_day_label || null,
    dueDayType: item.due_day_type || 'static',
    billingDay: item.billing_day || null,
    billingDayType: item.billing_day_type || 'static',
    billingDayMonthOffset: item.billing_day_month_offset ?? 0,
    totalInstallments: item.total_installments,
    startMonth: item.start_month,
    endMonth: item.end_month,
    isActive: item.isActive !== undefined ? item.isActive : item.is_active === 1,
    isMonthlyDeactivated: item.isMonthlyDeactivated || false,
    notes: item.notes,
    sortOrder: item.sort_order,
    storeId: item.store_id || null,
    storeName: item.store_name || null,
    interestRate: item.interest_rate || null,
    bankAccountId: item.bank_account_id || null,
    baseValue: item.base_value ?? null,
    bankAccountName: item.bank_account_name || null,
    endReason: item.end_reason || null,
    paymentMethod: item.payment_method || null,
    interruptions: item.interruptions || [],
    currencyId: item.currency_id || null,
    currencySymbol: item.currency_symbol || undefined,
    currencyCode: item.currency_code || undefined,
    exchangeRateSnapshot: item.exchange_rate_snapshot ?? 1.0,
    dueDayMonthOffset: item.due_day_month_offset ?? 0,
    cardDueDays: getCardDueDays(item, db),
    anticipations: item.anticipations || [],
    currentInstallmentPayments: item.currentInstallmentPayments || [],
    currentInstallmentPayment: item.currentInstallmentPayment || null,
    totalAnticipated: item.totalAnticipated || 0,
    anticipatedThisMonth: item.anticipatedThisMonth || 0,
    discountedTotalThisMonth: item.discountedTotalThisMonth ?? null,
    effectiveValue: item.effectiveValue,
    hasOverride: item.hasOverride,
    createdAt: item.created_at || null
  }
}

function mapSplit(s: any, db?: WrappedDatabase) {
  return {
    id: s.id,
    cardId: s.card_id,
    cardName: s.card_name || undefined,
    cardType: db ? getCardType(db, s.card_id) : null,
    paymentMethod: s.payment_method || null,
    value: s.value,
    totalInstallments: s.total_installments,
    totalAnticipated: s.totalAnticipated || 0,
    anticipatedThisMonth: s.anticipatedThisMonth || 0,
    discountedTotalThisMonth: s.discountedTotalThisMonth ?? null,
    currentInstallment: s.currentInstallment || undefined,
    currentInstallmentPayment: s.currentInstallmentPayment || null
  }
}

function mapCurrentInstallmentPayment(row: any) {
  return {
    id: row.id,
    itemId: row.item_id,
    splitId: row.split_id ?? null,
    month: row.month,
    originalValue: row.original_value,
    paidValue: row.paid_value,
    paidAt: row.paid_at || null
  }
}

function calcTotalPauseGap(interruptions: { end_month?: string; endMonth?: string; resume_month?: string; resumeMonth?: string }[], viewMonth: string): number {
  let total = 0
  for (const int of interruptions) {
    const endM = int.end_month || int.endMonth
    const resumeM = int.resume_month || int.resumeMonth
    if (resumeM && resumeM <= viewMonth && endM) {
      total += monthDiff(endM, resumeM) - 1
    }
  }
  return total
}

function enrichItem(
  item: any,
  tagsRepo: TagsRepository,
  splitsRepo: ItemCardSplitsRepository,
  statusRepo: ItemMonthlyStatusRepository,
  anticipationsRepo: ItemAnticipationsRepository,
  currentPaymentsRepo: ItemCurrentInstallmentPaymentsRepository,
  interruptionsRepo: ItemInterruptionsRepository,
  month?: string,
  itemsRepo?: SectionItemsRepository,
  db?: WrappedDatabase
) {
  item.tags = (tagsRepo.findByItemId(item.id) as any[]).map(t => ({
    id: t.id, name: t.name, color: t.color
  }))
  if (item.type === 'installment') {
    const splits = splitsRepo.findByItemId(item.id) as any[]
    item.cardSplits = splits.map(s => mapSplit(s, db))
  }
  if (item.type === 'installment' || item.type === 'emprestimo') {
    item.anticipations = anticipationsRepo.findByItemId(item.id).map((a: any) => ({
      id: a.id, splitId: a.split_id || null, month: a.month, count: a.count, discountedTotal: a.discounted_total ?? null
    }))
    item.currentInstallmentPayments = currentPaymentsRepo.findByItemId(item.id).map(mapCurrentInstallmentPayment)
    item.totalAnticipated = anticipationsRepo.getTotalAnticipated(item.id)

    // Load interruptions
    item.interruptions = interruptionsRepo.findByItemId(item.id).map(int => ({
      id: int.id, endMonth: int.end_month, resumeMonth: int.resume_month || null
    }))

    // Enrich splits with per-split anticipation data
    if (item.cardSplits && item.cardSplits.length > 0) {
      for (const sp of item.cardSplits) {
        sp.totalAnticipated = anticipationsRepo.getTotalAnticipatedForSplit(sp.id)
        if (month) {
          sp.anticipatedThisMonth = anticipationsRepo.getAnticipatedInMonthForSplit(sp.id, month)
          sp.discountedTotalThisMonth = anticipationsRepo.getDiscountedTotalInMonthForSplit(sp.id, month)
          const splitPayment = currentPaymentsRepo.findByTarget(item.id, month, sp.id)
          sp.currentInstallmentPayment = splitPayment ? mapCurrentInstallmentPayment(splitPayment) : null
          const anticipatedBefore = anticipationsRepo.getAnticipatedBeforeMonthForSplit(sp.id, month)
          const spPauseGap = calcTotalPauseGap(item.interruptions, month)
          sp.currentInstallment = monthDiff(item.startMonth, month) + 1 + anticipatedBefore - spPauseGap
        }
      }
    }
  }
  if (month) {
    item.isPaid = statusRepo.isPaid(item.id, month)
    item.paidAt = statusRepo.getPaidAt(item.id, month)
    const globalActive = item.is_active === 1 || item.isActive === true
    const monthlyActive = statusRepo.getMonthlyActive(item.id, month)
    if (monthlyActive !== null) {
      item.isActive = monthlyActive
      item.isMonthlyDeactivated = !monthlyActive
    } else {
      item.isActive = globalActive
      item.isMonthlyDeactivated = false
    }
    if ((item.type === 'installment' || item.type === 'emprestimo') && item.startMonth) {
      const anticipatedBefore = anticipationsRepo.getAnticipatedBeforeMonth(item.id, month)
      const interruptions = item.interruptions || interruptionsRepo.findByItemId(item.id).map(int => ({
        id: int.id, endMonth: int.end_month, resumeMonth: int.resume_month || null
      }))
      const itemPauseGap = calcTotalPauseGap(interruptions, month)
      item.currentInstallment = monthDiff(item.startMonth, month) + 1 + anticipatedBefore - itemPauseGap
      item.anticipatedThisMonth = anticipationsRepo.getAnticipatedInMonth(item.id, month)
      item.discountedTotalThisMonth = anticipationsRepo.getDiscountedTotalInMonth(item.id, month)
      const itemPayment = currentPaymentsRepo.findByTarget(item.id, month, null)
      item.currentInstallmentPayment = itemPayment ? mapCurrentInstallmentPayment(itemPayment) : null
    }
    if (item.type === 'subscription') {
      // Load interruptions for subscriptions
      item.interruptions = interruptionsRepo.findByItemId(item.id).map(int => ({
        id: int.id, endMonth: int.end_month, resumeMonth: int.resume_month || null
      }))
      if (itemsRepo) {
        const info = itemsRepo.getOverrideInfo(item.id, month)
        item.effectiveValue = info ? info.value : item.value
        item.hasOverride = info !== null
      }
    }
  }
  return item
}

export function registerSectionItemsHandlers(db: WrappedDatabase): void {
  const repo = new SectionItemsRepository(db)
  const tagsRepo = new TagsRepository(db)
  const splitsRepo = new ItemCardSplitsRepository(db)
  const statusRepo = new ItemMonthlyStatusRepository(db)
  const anticipationsRepo = new ItemAnticipationsRepository(db)
  const currentPaymentsRepo = new ItemCurrentInstallmentPaymentsRepository(db)
  const interruptionsRepo = new ItemInterruptionsRepository(db)
  const settingsRepo = new SettingsRepository(db)
  const isItemInterrupted = (itemId: number, month: string) =>
    interruptionsRepo.findByItemId(itemId).some(int => int.resume_month ? month > int.end_month && month < int.resume_month : month > int.end_month)

  ipcMain.handle(IPC_CHANNELS.ITEMS_LIST, (_, personId: number, month: string, typeFilter?: string) => {
    const scm = getStartCountingMonth(settingsRepo, personId)
    if (isMonthBeforeStart(month, scm)) return []

    const items = (repo.findByPersonAndMonth(personId, month, typeFilter) as any[]).map(i => mapItem(i, db))
    for (const item of items) {
      enrichItem(item, tagsRepo, splitsRepo, statusRepo, anticipationsRepo, currentPaymentsRepo, interruptionsRepo, month, repo, db)
    }
    return items
  })

  ipcMain.handle(IPC_CHANNELS.ITEMS_CREATE, (_, data) => {
    const item = repo.create({
      person_id: data.personId,
      category_id: data.categoryId,
      subcategory_id: data.subcategoryId,
      card_id: data.cardId,
      bank_account_id: data.bankAccountId || null,
      description: data.description,
      type: data.type,
      value: data.value,
      due_day: data.dueDay,
      due_day_label: data.dueDayLabel || null,
      due_day_type: data.dueDayType || 'static',
      billing_day: data.billingDay || null,
      billing_day_type: data.billingDayType || 'static',
      billing_day_month_offset: data.billingDayMonthOffset || 0,
      due_day_month_offset: data.dueDayMonthOffset || 0,
      total_installments: data.totalInstallments,
      start_month: data.startMonth,
      end_month: data.endMonth || null,
      notes: data.notes,
      store_id: data.storeId || null,
      interest_rate: data.interestRate || null,
      payment_method: data.paymentMethod || null,
      base_value: data.baseValue || null,
      currency_id: data.currencyId || null,
      exchange_rate_snapshot: data.exchangeRateSnapshot ?? 1.0
    }) as any
    if (data.tagIds && data.tagIds.length > 0) {
      tagsRepo.setItemTags(item.id, data.tagIds)
    }
    if (data.cardSplits && data.cardSplits.length > 0) {
      splitsRepo.replaceForItem(item.id, data.cardSplits.map((s: any) => ({
        card_id: s.cardId,
        value: s.value,
        total_installments: s.totalInstallments,
        payment_method: s.paymentMethod || null
      })))
    }
    const mapped = mapItem(item, db)
    return enrichItem(mapped, tagsRepo, splitsRepo, statusRepo, anticipationsRepo, currentPaymentsRepo, interruptionsRepo, undefined, undefined, db)
  })

  ipcMain.handle(IPC_CHANNELS.ITEMS_UPDATE, (_, data) => {
    const updateData: Record<string, any> = {}
    if (data.personId !== undefined) updateData.person_id = data.personId
    if (data.categoryId !== undefined) updateData.category_id = data.categoryId
    if (data.subcategoryId !== undefined) updateData.subcategory_id = data.subcategoryId
    if (data.cardId !== undefined) updateData.card_id = data.cardId
    if (data.bankAccountId !== undefined) updateData.bank_account_id = data.bankAccountId
    if (data.description !== undefined) updateData.description = data.description
    if (data.type !== undefined) updateData.type = data.type
    if (data.value !== undefined) updateData.value = data.value
    if (data.dueDay !== undefined) updateData.due_day = data.dueDay
    if (data.dueDayLabel !== undefined) updateData.due_day_label = data.dueDayLabel
    if (data.dueDayType !== undefined) updateData.due_day_type = data.dueDayType
    if (data.billingDay !== undefined) updateData.billing_day = data.billingDay
    if (data.billingDayType !== undefined) updateData.billing_day_type = data.billingDayType
    if (data.billingDayMonthOffset !== undefined) updateData.billing_day_month_offset = data.billingDayMonthOffset
    if (data.dueDayMonthOffset !== undefined) updateData.due_day_month_offset = data.dueDayMonthOffset
    if (data.totalInstallments !== undefined) updateData.total_installments = data.totalInstallments
    if (data.startMonth !== undefined) updateData.start_month = data.startMonth
    if (data.endMonth !== undefined) updateData.end_month = data.endMonth
    if (data.notes !== undefined) updateData.notes = data.notes
    if (data.sortOrder !== undefined) updateData.sort_order = data.sortOrder
    if (data.storeId !== undefined) updateData.store_id = data.storeId
    if (data.interestRate !== undefined) updateData.interest_rate = data.interestRate
    if (data.paymentMethod !== undefined) updateData.payment_method = data.paymentMethod
    if (data.baseValue !== undefined) updateData.base_value = data.baseValue
    if (data.currencyId !== undefined) updateData.currency_id = data.currencyId
    if (data.exchangeRateSnapshot !== undefined) updateData.exchange_rate_snapshot = data.exchangeRateSnapshot
    const item = repo.update(data.id, updateData) as any
    if (data.tagIds !== undefined) {
      tagsRepo.setItemTags(data.id, data.tagIds)
    }
    if (data.cardSplits !== undefined) {
      if (data.cardSplits.length > 0) {
        splitsRepo.replaceForItem(data.id, data.cardSplits.map((s: any) => ({
          card_id: s.cardId,
          value: s.value,
          total_installments: s.totalInstallments,
          payment_method: s.paymentMethod || null
        })))
      } else {
        splitsRepo.deleteByItemId(data.id)
      }
    }
    const mapped = mapItem(item, db)
    return enrichItem(mapped, tagsRepo, splitsRepo, statusRepo, anticipationsRepo, currentPaymentsRepo, interruptionsRepo, undefined, undefined, db)
  })

  ipcMain.handle(IPC_CHANNELS.ITEMS_DELETE, (_, id) => repo.delete(id))

  ipcMain.handle(IPC_CHANNELS.ITEMS_TOGGLE_ACTIVE, (_, id) => {
    const item = repo.toggleActive(id) as any
    return mapItem(item, db)
  })

  ipcMain.handle(IPC_CHANNELS.ITEMS_TOGGLE_PAID, (_, itemId: number, month: string) => {
    if (isItemInterrupted(itemId, month)) return statusRepo.isPaid(itemId, month)
    return statusRepo.togglePaid(itemId, month)
  })

  ipcMain.handle(IPC_CHANNELS.ITEMS_SET_PAID, (_, itemId: number, month: string, isPaid: boolean, paidAt?: string) => {
    if (isItemInterrupted(itemId, month)) return statusRepo.isPaid(itemId, month)
    statusRepo.setPaid(itemId, month, isPaid, paidAt || null)
  })

  ipcMain.handle(IPC_CHANNELS.ITEMS_INTERRUPT, (_, itemId: number, currentMonth: string, pauseMonths?: number | null) => {
    const item = repo.findById(itemId) as any
    if (!item) throw new Error('Item not found')
    if (item.type !== 'installment' && item.type !== 'emprestimo' && item.type !== 'subscription') throw new Error('Only installment/emprestimo/subscription items can be interrupted')
    const temporaryMonths = typeof pauseMonths === 'number' && pauseMonths > 0 ? pauseMonths : null
    if (temporaryMonths === null && interruptionsRepo.hasPermanent(itemId)) throw new Error('Item already has a permanent interruption')
    const resumeMonth = temporaryMonths !== null ? addMonths(currentMonth, temporaryMonths + 1) : null
    interruptionsRepo.create(itemId, currentMonth, resumeMonth)
  })

  ipcMain.handle(IPC_CHANNELS.ITEMS_UPDATE_INTERRUPTION, (_, interruptionId: number, endMonth: string, resumeMonth?: string | null) => {
    interruptionsRepo.updateById(interruptionId, endMonth, resumeMonth ?? null)
  })

  ipcMain.handle(IPC_CHANNELS.ITEMS_REACTIVATE, (_, interruptionId: number) => {
    interruptionsRepo.deleteById(interruptionId)
  })

  ipcMain.handle(IPC_CHANNELS.ITEMS_ANTICIPATE, (_, itemId: number, month: string, count: number, splitId?: number, discountedTotal?: number) => {
    const item = repo.findById(itemId) as any
    if (!item) throw new Error('Item not found')
    if (item.type !== 'installment' && item.type !== 'emprestimo') throw new Error('Only installment/emprestimo items can be anticipated')
    if (item.end_reason === 'settled') throw new Error('Cannot anticipate a settled item')
    if (interruptionsRepo.hasPermanent(item.id)) throw new Error('Cannot anticipate an item with permanent interruption')
    if (!count || count <= 0) throw new Error('Count must be positive')
    anticipationsRepo.create(itemId, month, count, splitId || undefined, discountedTotal)
    statusRepo.setPaid(itemId, month, true)
  })

  ipcMain.handle(IPC_CHANNELS.ITEMS_UNDO_ANTICIPATION, (_, anticipationId: number) => {
    anticipationsRepo.deleteById(anticipationId)
  })

  ipcMain.handle(IPC_CHANNELS.ITEMS_SET_CURRENT_INSTALLMENT_PAYMENT, (_, itemId: number, month: string, originalValue: number, paidValue: number, paidAt?: string, splitId?: number) => {
    const item = repo.findById(itemId) as any
    if (!item) throw new Error('Item not found')
    if (item.type !== 'installment' && item.type !== 'emprestimo') throw new Error('Only installment/emprestimo items can use current installment payment anticipation')
    if (item.end_reason === 'settled') throw new Error('Cannot anticipate payment for a settled item')
    if (!Number.isFinite(originalValue) || originalValue <= 0) throw new Error('Original value must be positive')
    if (!Number.isFinite(paidValue) || paidValue < 0) throw new Error('Paid value must be zero or positive')
    if (paidValue > originalValue) throw new Error('Paid value cannot be greater than original value')
    currentPaymentsRepo.upsert({
      itemId,
      splitId: splitId ?? null,
      month,
      originalValue,
      paidValue,
      paidAt: paidAt || new Date().toISOString().substring(0, 10)
    })

    if (!splitId) {
      if (isItemInterrupted(itemId, month)) return
      statusRepo.setPaid(itemId, month, true, paidAt || undefined)
      return
    }

    const splitRows = splitsRepo.findByItemId(itemId) as any[]
    const allSplitsHaveCurrentPayment = splitRows.length > 0 && splitRows.every(split =>
      currentPaymentsRepo.findByTarget(itemId, month, split.id)
    )
    if (allSplitsHaveCurrentPayment && !isItemInterrupted(itemId, month)) statusRepo.setPaid(itemId, month, true, paidAt || undefined)
  })

  ipcMain.handle(IPC_CHANNELS.ITEMS_DELETE_CURRENT_INSTALLMENT_PAYMENT, (_, paymentId: number) => {
    currentPaymentsRepo.deleteById(paymentId)
  })

  ipcMain.handle(IPC_CHANNELS.ITEMS_SET_MONTH_VALUE, (_, itemId: number, month: string, value: number) => {
    repo.setValueForMonth(itemId, month, value)
  })

  ipcMain.handle(IPC_CHANNELS.ITEMS_REMOVE_MONTH_VALUE, (_, itemId: number, month: string) => {
    repo.removeValueOverride(itemId, month)
  })

  ipcMain.handle(IPC_CHANNELS.ITEMS_LIST_MONTH_VALUES, (_, itemId: number) => {
    return repo.listValueOverrides(itemId)
  })

  ipcMain.handle(IPC_CHANNELS.ITEMS_SET_MONTHLY_ACTIVE, (_, itemId: number, month: string, isActive: boolean | null) => {
    statusRepo.setMonthlyActive(itemId, month, isActive)
  })

  ipcMain.handle(IPC_CHANNELS.ITEMS_SEARCH, (_, personId: number, query: string, filters?: { type?: string; categoryId?: number; storeId?: number; cardId?: number; tagId?: number; isPaid?: boolean; isActive?: boolean; bankAccountId?: number }) => {
    const items = (repo.search(personId, query, filters) as any[]).map(i => mapItem(i, db))
    for (const item of items) {
      enrichItem(item, tagsRepo, splitsRepo, statusRepo, anticipationsRepo, currentPaymentsRepo, interruptionsRepo, undefined, undefined, db)
    }
    return items
  })
}
