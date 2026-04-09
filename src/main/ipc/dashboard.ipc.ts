import { ipcMain } from 'electron'
import { WrappedDatabase } from '../database/connection'
import { IPC_CHANNELS } from '../../../shared/ipc-channels'
import { SectionItemsRepository } from '../database/repositories/section-items.repo'
import { CardsRepository } from '../database/repositories/cards.repo'
import { PersonIncomeRepository } from '../database/repositories/person-income.repo'
import { BankAccountsRepository } from '../database/repositories/bank-accounts.repo'
import { ItemMonthlyStatusRepository } from '../database/repositories/item-monthly-status.repo'
import { IncomeMonthlyStatusRepository } from '../database/repositories/income-monthly-status.repo'

import { ItemAnticipationsRepository } from '../database/repositories/item-anticipations.repo'
import { SettingsRepository } from '../database/repositories/settings.repo'
import { TagsRepository } from '../database/repositories/tags.repo'
import { getStartCountingMonth, isMonthBeforeStart } from './start-counting-month'
import type { DashboardListItem, DashboardWidgetsData, DashboardCardEnriched, DashboardDistributionEntry } from '../../../shared/dashboard-types'
import { resolveDay, type BusinessDayConfig, DEFAULT_BUSINESS_DAY_CONFIG } from '../../../shared/day-utils'
import { getHolidays } from '../services/holiday.service'
import { monthDiff, addMonths, getCardType } from '../utils/month-utils'

function mapToDashboardItem(
  item: any,
  isPaid: boolean,
  anticipationsRepo: ItemAnticipationsRepository,
  month: string,
  itemsRepo: SectionItemsRepository,
  db?: WrappedDatabase
): DashboardListItem {
  const effectiveVal = itemsRepo.getEffectiveValue(item, month)

  // Get card splits for installment items
  let cardSplits: { cardName: string | null; cardType: string | null }[] = []
  if (db && (item.type === 'installment' || item.type === 'emprestimo')) {
    const splits = db.prepare(
      'SELECT ics.card_id, c.name as card_name FROM item_card_splits ics LEFT JOIN cards c ON c.id = ics.card_id WHERE ics.item_id = ?'
    ).all(item.id) as any[]
    cardSplits = splits.map((s: any) => ({ cardName: s.card_name || null, cardType: getCardType(db, s.card_id) }))
  }

  const result: DashboardListItem = {
    id: item.id,
    description: item.description,
    type: item.type,
    value: effectiveVal,
    dueDay: item.due_day || null,
    dueDayLabel: item.due_day_label || null,
    dueDayType: item.due_day_type || 'static',
    billingDay: item.billing_day || null,
    billingDayType: item.billing_day_type || 'static',
    billingDayMonthOffset: item.billing_day_month_offset ?? 0,
    isPaid,
    categoryName: item.category_name || null,
    categoryColor: item.category_color || null,
    cardName: item.card_name || null,
    cardType: db ? getCardType(db, item.card_id) : null,
    paymentMethod: item.payment_method || null,
    cardSplits,
    store: item.store || null,
    dueDayMonthOffset: item.due_day_month_offset || 0,
    cardDueDays: (() => {
      if (item.due_day_type !== 'card_due') return []
      if (item.card_due_day) return [item.card_due_day]
      if (!db) return []
      const splits = db.prepare(
        'SELECT DISTINCT c.due_day FROM item_card_splits ics JOIN cards c ON c.id = ics.card_id WHERE ics.item_id = ? AND c.due_day IS NOT NULL'
      ).all(item.id) as any[]
      return splits.map((s: any) => s.due_day).filter((d: any) => d != null)
    })()
  }

  if ((item.type === 'installment' || item.type === 'emprestimo') && item.total_installments) {
    const anticipatedBefore = anticipationsRepo.getAnticipatedBeforeMonth(item.id, month)
    const totalAnticipated = anticipationsRepo.getTotalAnticipated(item.id)

    // Account for pause gaps from interruptions
    const interruptions = db.prepare(
      'SELECT end_month, resume_month FROM item_interruptions WHERE item_id = ? ORDER BY end_month ASC'
    ).all(item.id) as any[]
    let totalPauseGap = 0
    for (const int of interruptions) {
      if (int.resume_month && int.resume_month <= month) {
        totalPauseGap += monthDiff(int.end_month, int.resume_month) - 1
      }
    }

    const currentInstallment = monthDiff(item.start_month, month) + 1 + anticipatedBefore - totalPauseGap
    const effectiveTotal = item.total_installments - totalAnticipated
    const remaining = Math.max(0, effectiveTotal - currentInstallment)

    result.currentInstallment = currentInstallment
    result.totalInstallments = item.total_installments
    result.remainingInstallments = remaining
  }

  ;(result as any).exchangeRateSnapshot = item.exchange_rate_snapshot || 1.0
  ;(result as any).currencySymbol = item.currency_symbol || undefined
  ;(result as any).currencyCode = item.currency_code || undefined

  return result
}

export function registerDashboardHandlers(db: WrappedDatabase): void {
  const sectionItemsRepo = new SectionItemsRepository(db)
  const cardsRepo = new CardsRepository(db)
  const incomeRepo = new PersonIncomeRepository(db)
  const bankAccountsRepo = new BankAccountsRepository(db)
  const itemStatusRepo = new ItemMonthlyStatusRepository(db)
  const incomeStatusRepo = new IncomeMonthlyStatusRepository(db)

  const anticipationsRepo = new ItemAnticipationsRepository(db)
  const settingsRepo = new SettingsRepository(db)
  const tagsRepo = new TagsRepository(db)

  ipcMain.handle(IPC_CHANNELS.DASHBOARD_SUMMARY, (_, personId: number, month: string) => {
    const scm = getStartCountingMonth(settingsRepo, personId)

    // --- Bank accounts (not affected by start counting month) ---
    const bankAccountsTotal = bankAccountsRepo.getTotalByPersonForMonth(personId, month)
    const bankAccountRows = bankAccountsRepo.findByPersonId(personId) as any[]
    const bankAccounts = bankAccountRows.map(ba => ({
      id: ba.id,
      name: ba.name,
      balance: bankAccountsRepo.getMonthlyBalance(ba.id, month),
      icon: ba.icon,
      color: ba.color
    }))

    if (isMonthBeforeStart(month, scm)) {
      const typeKeys = ['common', 'installment', 'subscription', 'emprestimo'] as const
      return {
        typeTotals: typeKeys.map(type => ({ type, total: 0 })),
        cardsTotal: 0,
        cardSummaries: [],
        incomeTotal: 0,
        grandTotal: 0,
        bankAccountsTotal,
        bankAccounts
      }
    }

    // --- Type totals ---
    const typeKeys = ['common', 'installment', 'subscription', 'emprestimo'] as const

    const typeTotals = typeKeys.map(type => {
      const total = sectionItemsRepo.getTotalByPersonAndMonth(personId, month, type)
      return {
        type,
        total
      }
    })

    // --- Cards ---
    const cards = cardsRepo.findAll(personId) as any[]
    let cardsTotal = 0
    const cardSummaries = cards.map(card => {
      const used = cardsRepo.getUsedLimitForMonth(card.id, month)
      const cardCurrencyRate = card.currency_exchange_rate || 1.0
      cardsTotal += used * cardCurrencyRate
      return {
        id: card.id,
        name: card.name,
        totalLimit: card.total_limit || 0,
        usedLimit: used
      }
    })

    // --- Income ---
    const incomeTotal = incomeRepo.getTotalByPersonAndMonth(personId, month)

    const grandTotal = typeTotals.reduce((sum, t) => sum + t.total, 0)

    return {
      typeTotals,
      cardsTotal,
      cardSummaries,
      incomeTotal,
      grandTotal,
      bankAccountsTotal,
      bankAccounts
    }
  })

  ipcMain.handle(IPC_CHANNELS.DASHBOARD_WIDGETS, async (_, personId: number, month: string) => {
    const scm = getStartCountingMonth(settingsRepo, personId)

    if (isMonthBeforeStart(month, scm)) {
      const emptyResult: DashboardWidgetsData = {
        upcomingExpenses: [],
        unpaidItems: [],
        topExpenses: [],
        pendingIncomes: [],
        endingInstallments: [],
        monthComparison: { currentTotal: 0, previousTotal: 0, delta: 0, deltaPercent: 0 },
        overdueItems: [],
        paymentSummary: { totalItems: 0, paidItems: 0, paidValue: 0, pendingValue: 0 },
        previousMonthSummary: { month: addMonths(month, -1), expensesTotal: 0, incomeTotal: 0, balance: 0, bankAccountsTotal: 0 },
        nextMonthSummary: { month: addMonths(month, 1), expensesTotal: 0, incomeTotal: 0, balance: 0, bankAccountsTotal: 0 },
        cardDetails: [],
        categoryDistribution: [],
        tagDistribution: [],
        incomeTypeDistribution: [],
        incomeCategoryDistribution: [],
        upcomingBilling: []
      }
      return emptyResult
    }

    // Load business day config
    const bdcRaw = settingsRepo.get('businessDayConfig')
    const businessDayConfig: BusinessDayConfig = bdcRaw ? { ...DEFAULT_BUSINESS_DAY_CONFIG, ...JSON.parse(bdcRaw) } : DEFAULT_BUSINESS_DAY_CONFIG
    const [yearNum, monthNum] = month.split('-').map(Number)
    let holidays: string[] = []
    if (businessDayConfig.mode === 'api') {
      holidays = await getHolidays(yearNum, businessDayConfig.countryCode)
    }

    // --- Fetch all items for this month ---
    const allItems = sectionItemsRepo.findByPersonAndMonth(personId, month) as any[]
    const itemIds = allItems.filter((i: any) => i.is_active === 1).map((i: any) => i.id)
    const paidMap = itemStatusRepo.getPaidStatusBatch(itemIds, month)

    // Build dashboard items from active items
    const dashItems: DashboardListItem[] = allItems
      .filter((i: any) => i.is_active === 1)
      .map((item: any) => {
        const status = paidMap.get(item.id)
        const isPaid = status?.isPaid ?? false
        return mapToDashboardItem(item, isPaid, anticipationsRepo, month, sectionItemsRepo, db)
      })

    // --- Resolve days ---
    for (const item of dashItems) {
      const rawOffset = item.dueDayMonthOffset || 0
      const isCardBased = item.dueDayType === 'card_due'

      if (isCardBased && item.cardDueDays && item.cardDueDays.length > 0) {
        let dueMonth = monthNum + rawOffset
        let dueYear = yearNum
        if (dueMonth > 12) { dueYear++; dueMonth -= 12 }
        item.resolvedDueDay = resolveDay(
          { day: item.cardDueDays[0], dayType: 'static' },
          dueYear, dueMonth, businessDayConfig, holidays
        )
      } else if (item.dueDay != null || (item.dueDayType && item.dueDayType !== 'static')) {
        let dueMonth = monthNum + rawOffset
        let dueYear = yearNum
        if (dueMonth > 12) { dueYear++; dueMonth -= 12 }
        item.resolvedDueDay = resolveDay(
          { day: item.dueDay, dayType: (item.dueDayType || 'static') as any },
          dueYear, dueMonth, businessDayConfig, holidays
        )
      } else {
        item.resolvedDueDay = item.dueDay
      }
      if (item.billingDay != null || (item.billingDayType && item.billingDayType !== 'static')) {
        const billOff = item.billingDayMonthOffset || 0
        let billMonth = monthNum + billOff
        let billYear = yearNum
        if (billMonth > 12) { billYear++; billMonth -= 12 }
        if (billMonth < 1) { billYear--; billMonth += 12 }
        item.resolvedBillingDay = resolveDay(
          { day: item.billingDay ?? null, dayType: (item.billingDayType || 'static') as any },
          billYear, billMonth, businessDayConfig, holidays
        )
      } else {
        item.resolvedBillingDay = item.billingDay ?? null
      }
    }

    // --- Compute effective monthly value for sorting (in base currency) ---
    function effectiveValue(item: DashboardListItem): number {
      const snapshot = (item as any).exchangeRateSnapshot || 1.0
      if ((item.type === 'installment' || item.type === 'emprestimo') && item.totalInstallments) {
        return Math.round((item.value / item.totalInstallments) * 100) / 100 * snapshot
      }
      return item.value * snapshot
    }

    // --- Today's date for due_day comparisons ---
    const today = new Date()
    const todayMidnight = new Date(today.getFullYear(), today.getMonth(), today.getDate())
    const todayMonth = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`
    const isCurrentMonth = month === todayMonth

    function getDueDate(i: DashboardListItem): Date {
      const dueOff = i.dueDayMonthOffset || 0
      let dm = monthNum + dueOff, dy = yearNum
      if (dm > 12) { dy++; dm -= 12 }
      return new Date(dy, dm - 1, i.resolvedDueDay!)
    }

    // Widget 1: Proximos gastos a vencer (upcoming, unpaid, dueDate >= today, limit 5)
    const upcomingExpenses = dashItems
      .filter(i => {
        if (i.isPaid || i.resolvedDueDay == null) return false
        if (!isCurrentMonth && (i.dueDayMonthOffset || 0) === 0) return true
        return getDueDate(i) >= todayMidnight
      })
      .sort((a, b) => getDueDate(a).getTime() - getDueDate(b).getTime())
      .slice(0, 5)

    // Widget 2: Itens nao pagos (sort by effective value DESC)
    const unpaidItems = dashItems
      .filter(i => !i.isPaid)
      .sort((a, b) => effectiveValue(b) - effectiveValue(a))

    // Widget 3: Maiores gastos do mes (top 5 by effective value)
    const topExpenses = [...dashItems]
      .sort((a, b) => effectiveValue(b) - effectiveValue(a))
      .slice(0, 5)

    // Widget 8: Itens vencidos (dueDate < today, unpaid)
    const overdueItems = dashItems
      .filter(i => {
        if (i.isPaid || i.resolvedDueDay == null) return false
        return getDueDate(i) < todayMidnight
      })
      .sort((a, b) => getDueDate(a).getTime() - getDueDate(b).getTime())

    // Widget: Upcoming billing (items with billing day, not paid, sorted by resolvedBillingDay)
    const upcomingBilling = dashItems
      .filter(i => !i.isPaid && i.resolvedBillingDay != null)
      .sort((a, b) => (a.resolvedBillingDay ?? 0) - (b.resolvedBillingDay ?? 0))

    // Widget 5: Itens com poucas parcelas restantes (remaining <= 3)
    const endingInstallments = dashItems
      .filter(i => i.remainingInstallments != null && i.remainingInstallments <= 3 && i.remainingInstallments > 0)
      .sort((a, b) => (a.remainingInstallments ?? 0) - (b.remainingInstallments ?? 0))

    // --- Widget 4: Receitas pendentes ---
    const incomes = incomeRepo.findByPersonAndMonth(personId, month) as any[]
    const pendingIncomes = incomes
      .filter((inc: any) => !incomeStatusRepo.isReceived(inc.id, month))
      .map((inc: any) => ({
        id: inc.id,
        description: inc.description,
        effectiveValue: incomeRepo.getEffectiveValue(inc, month) * (inc.exchange_rate_snapshot || 1.0),
        isReceived: false,
        categoryName: inc.category_name || null,
        categoryColor: inc.category_color || null
      }))
      .sort((a, b) => b.effectiveValue - a.effectiveValue)

    // --- Widget 7: Comparativo mes anterior ---
    const previousMonth = addMonths(month, -1)
    const currentTotal = sectionItemsRepo.getTotalByPersonAndMonth(personId, month)
    const previousTotal = isMonthBeforeStart(previousMonth, scm) ? 0 : sectionItemsRepo.getTotalByPersonAndMonth(personId, previousMonth)
    const delta = currentTotal - previousTotal
    const deltaPercent = previousTotal !== 0 ? (delta / previousTotal) * 100 : 0

    // --- Previous month summary ---
    const prevMonthExpenses = previousTotal
    const prevMonthIncome = isMonthBeforeStart(previousMonth, scm) ? 0 : incomeRepo.getTotalByPersonAndMonth(personId, previousMonth)
    const prevMonthBalance = prevMonthIncome - prevMonthExpenses
    const prevMonthBankAccountsTotal = bankAccountsRepo.getTotalByPersonForMonth(personId, previousMonth)

    // --- Next month summary ---
    const nextMonth = addMonths(month, 1)
    const nextMonthExpenses = isMonthBeforeStart(nextMonth, scm) ? 0 : sectionItemsRepo.getTotalByPersonAndMonth(personId, nextMonth)
    const nextMonthIncome = isMonthBeforeStart(nextMonth, scm) ? 0 : incomeRepo.getTotalByPersonAndMonth(personId, nextMonth)
    const nextMonthBalance = nextMonthIncome - nextMonthExpenses
    const nextMonthBankAccountsTotal = bankAccountsRepo.getTotalByPersonForMonth(personId, nextMonth)

    // --- Payment summary (compact widget) ---
    const paidCount = dashItems.filter(i => i.isPaid).length
    const paidValue = dashItems.filter(i => i.isPaid).reduce((s, i) => s + effectiveValue(i), 0)
    const pendingValue = dashItems.filter(i => !i.isPaid).reduce((s, i) => s + effectiveValue(i), 0)

    // --- Card details (enriched) ---
    const allCards = cardsRepo.findAll(personId) as any[]
    const cardDetails: DashboardCardEnriched[] = allCards.map(card => {
      const usedLimit = cardsRepo.getUsedLimitForMonth(card.id, month)
      const totalLimit = card.total_limit || 0
      const counts = cardsRepo.getItemCountsForMonth(card.id, month)
      let bankAccountName: string | null = null
      if (card.bank_account_id) {
        const ba = bankAccountsRepo.findById(card.bank_account_id) as any
        if (ba) bankAccountName = ba.name
      }
      return {
        id: card.id,
        name: card.name,
        totalLimit,
        usedLimit,
        availableLimit: Math.max(0, totalLimit - usedLimit),
        billingCloseDay: card.billing_close_day,
        dueDay: card.due_day,
        cardType: card.card_type || 'both',
        bankAccountName,
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

    // --- Category distribution ---
    const DIST_COLORS = ['#0ea5e9', '#f59e0b', '#8b5cf6', '#ef4444', '#10b981', '#f97316', '#ec4899', '#14b8a6', '#6366f1', '#84cc16']
    const catMap = new Map<string, { color: string; total: number }>()
    for (const item of dashItems) {
      const name = item.categoryName || '__no_category__'
      const color = item.categoryColor || '#6b7280'
      const val = effectiveValue(item)
      const entry = catMap.get(name)
      if (entry) { entry.total += val } else { catMap.set(name, { color, total: val }) }
    }
    // If all entries share the same color, assign distinct colors
    const catEntries = [...catMap.entries()]
    const uniqueCatColors = new Set(catEntries.map(([, v]) => v.color))
    if (uniqueCatColors.size === 1 && catEntries.length > 1) {
      catEntries.forEach(([, v], i) => { v.color = DIST_COLORS[i % DIST_COLORS.length] })
    }
    const categoryDistribution: DashboardDistributionEntry[] = catEntries
      .map(([name, { color, total }]) => ({ name, color, total }))
      .sort((a, b) => b.total - a.total)

    // --- Tag distribution ---
    const tagMap = new Map<string, { color: string; total: number }>()
    for (const item of dashItems) {
      const itemTags = tagsRepo.findByItemId(item.id) as any[]
      const val = effectiveValue(item)
      if (itemTags.length === 0) {
        const entry = tagMap.get('__no_tag__')
        if (entry) { entry.total += val } else { tagMap.set('__no_tag__', { color: '#6b7280', total: val }) }
      } else {
        for (const tag of itemTags) {
          const entry = tagMap.get(tag.name)
          if (entry) { entry.total += val } else { tagMap.set(tag.name, { color: tag.color || '#6b7280', total: val }) }
        }
      }
    }
    const tagDistribution: DashboardDistributionEntry[] = [...tagMap.entries()]
      .map(([name, { color, total }]) => ({ name, color, total }))
      .sort((a, b) => b.total - a.total)

    // --- Income type distribution (Recorrente vs Não recorrente) ---
    const incomeTypeMap = new Map<string, { color: string; total: number }>()
    for (const inc of incomes as any[]) {
      const isRecurring = inc.is_recurring === 1
      const name = isRecurring ? '__recurring__' : '__non_recurring__'
      const color = isRecurring ? '#8b5cf6' : '#0ea5e9'
      const val = incomeRepo.getEffectiveValue(inc, month) * (inc.exchange_rate_snapshot || 1.0)
      const entry = incomeTypeMap.get(name)
      if (entry) { entry.total += val } else { incomeTypeMap.set(name, { color, total: val }) }
    }
    const incomeTypeDistribution: DashboardDistributionEntry[] = [...incomeTypeMap.entries()]
      .map(([name, { color, total }]) => ({ name, color, total }))
      .sort((a, b) => b.total - a.total)

    // --- Income category distribution ---
    const incomeCatMap = new Map<string, { color: string; total: number }>()
    for (const inc of incomes as any[]) {
      const name = inc.category_name || '__no_category__'
      const color = inc.category_color || '#6b7280'
      const val = incomeRepo.getEffectiveValue(inc, month) * (inc.exchange_rate_snapshot || 1.0)
      const entry = incomeCatMap.get(name)
      if (entry) { entry.total += val } else { incomeCatMap.set(name, { color, total: val }) }
    }
    // If all entries share the same color, assign distinct colors
    const incomeCatEntries = [...incomeCatMap.entries()]
    const uniqueColors = new Set(incomeCatEntries.map(([, v]) => v.color))
    if (uniqueColors.size === 1 && incomeCatEntries.length > 1) {
      incomeCatEntries.forEach(([, v], i) => { v.color = DIST_COLORS[i % DIST_COLORS.length] })
    }
    const incomeCategoryDistribution: DashboardDistributionEntry[] = incomeCatEntries
      .map(([name, { color, total }]) => ({ name, color, total }))
      .sort((a, b) => b.total - a.total)

    const result: DashboardWidgetsData = {
      upcomingExpenses,
      unpaidItems,
      topExpenses,
      pendingIncomes,
      endingInstallments,
      monthComparison: { currentTotal, previousTotal, delta, deltaPercent },
      overdueItems,
      paymentSummary: { totalItems: dashItems.length, paidItems: paidCount, paidValue, pendingValue },
      previousMonthSummary: { month: previousMonth, expensesTotal: prevMonthExpenses, incomeTotal: prevMonthIncome, balance: prevMonthBalance, bankAccountsTotal: prevMonthBankAccountsTotal, isBeforeStart: isMonthBeforeStart(previousMonth, scm) },
      nextMonthSummary: { month: nextMonth, expensesTotal: nextMonthExpenses, incomeTotal: nextMonthIncome, balance: nextMonthBalance, bankAccountsTotal: nextMonthBankAccountsTotal, isBeforeStart: isMonthBeforeStart(nextMonth, scm) },
      cardDetails,
      categoryDistribution,
      tagDistribution,
      incomeTypeDistribution,
      incomeCategoryDistribution,
      upcomingBilling
    }

    return result
  })
}
