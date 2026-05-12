import { ipcMain } from 'electron'
import { WrappedDatabase } from '../database/connection'
import { IPC_CHANNELS } from '../../../shared/ipc-channels'
import { SectionItemsRepository } from '../database/repositories/section-items.repo'
import { PersonIncomeRepository } from '../database/repositories/person-income.repo'
import { ItemMonthlyStatusRepository } from '../database/repositories/item-monthly-status.repo'
import { IncomeMonthlyStatusRepository } from '../database/repositories/income-monthly-status.repo'
import { TagsRepository } from '../database/repositories/tags.repo'
import { SettingsRepository } from '../database/repositories/settings.repo'
import { BankAccountsRepository } from '../database/repositories/bank-accounts.repo'
import { getStartCountingMonth, isMonthBeforeStart } from './start-counting-month'
import { resolveDay, type BusinessDayConfig, DEFAULT_BUSINESS_DAY_CONFIG } from '../../../shared/day-utils'
import { getInstallmentMonthValue } from '../../../shared/installment-utils'
import { getHolidays } from '../services/holiday.service'
import type {
  ItemAggregate, IncomeAggregate, CategoryAggregate, TagAggregate, TimePoint,
  InsightsTemporalResult, InsightsComparativeResult, PeriodData,
  ComparisonGranularity, TemporalGrouping,
  PeriodDetailItem, PeriodDetailIncome, PeriodDetailResult,
  ValueRange, CardSplitDetail
} from '../../../shared/insights-types'

import { addMonths, getCardType } from '../utils/month-utils'

function generateMonthRange(start: string, end: string): string[] {
  const months: string[] = []
  let current = start
  while (current <= end) {
    months.push(current)
    current = addMonths(current, 1)
  }
  return months
}

function toDateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function getMondayOfWeek(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00')
  const day = d.getDay()
  const diff = day === 0 ? 6 : day - 1
  d.setDate(d.getDate() - diff)
  return toDateStr(d)
}

/** Compute bucket label for a date based on grouping */
function bucketKey(dateStr: string, grouping: TemporalGrouping): string {
  switch (grouping) {
    case 'day':
      return dateStr // YYYY-MM-DD
    case 'week':
      return getMondayOfWeek(dateStr) // Monday of that week
    case 'month':
      return dateStr.substring(0, 7) // YYYY-MM
    case 'year':
      return dateStr.substring(0, 4) // YYYY
  }
}

interface ItemEntry {
  id: number
  description: string
  type: string
  value: number
  store: string | null
  cardName: string | null
  cardType: string | null
  paymentMethod: string | null
  bankAccountName: string | null
  categoryId: number | null
  categoryName: string | null
  categoryColor: string | null
  categoryIcon: string | null
  isActive: boolean
  effectiveDate: string // YYYY-MM-DD
  month: string
}

interface IncomeEntry {
  id: number
  description: string
  value: number
  categoryId: number | null
  categoryName: string | null
  categoryColor: string | null
  effectiveDate: string
  month: string
}

export function registerInsightsHandlers(db: WrappedDatabase): void {
  const sectionItemsRepo = new SectionItemsRepository(db)
  const incomeRepo = new PersonIncomeRepository(db)
  const itemStatusRepo = new ItemMonthlyStatusRepository(db)
  const tagsRepo = new TagsRepository(db)
  const settingsRepo = new SettingsRepository(db)
  const incomeStatusRepo = new IncomeMonthlyStatusRepository(db)
  const bankAccountsRepo = new BankAccountsRepository(db)

  /** Resolve the effective date for an item based on due/billing day */
  function resolveItemEffectiveDate(
    item: any, month: string,
    bdConfig: BusinessDayConfig, holidayMap: Map<number, string[]>
  ): string {
    const [y, m] = month.split('-').map(Number)

    // Try due day first (vencimento — when payment is due)
    let dueDay = item.due_day
    let dueDayType = item.due_day_type || 'static'
    const dueOffset = item.due_day_month_offset || 0

    // card_due: the due day comes from the card, not the item
    if (dueDayType === 'card_due') {
      if (item.card_due_day) {
        dueDay = item.card_due_day
        dueDayType = 'static'
      } else {
        // Multi-card split: get first card's due day
        const splitRow = db.prepare(
          'SELECT c.due_day FROM item_card_splits ics JOIN cards c ON c.id = ics.card_id WHERE ics.item_id = ? AND c.due_day IS NOT NULL LIMIT 1'
        ).get(item.id) as any
        if (splitRow) {
          dueDay = splitRow.due_day
          dueDayType = 'static'
        }
      }
    }

    if (dueDay != null || (dueDayType && dueDayType !== 'static' && dueDayType !== 'none')) {
      let targetMonth = m + dueOffset
      let targetYear = y
      if (targetMonth > 12) { targetYear++; targetMonth -= 12 }
      if (targetMonth < 1) { targetYear--; targetMonth += 12 }
      const holidays = holidayMap.get(targetYear) || []
      const resolved = resolveDay({ day: dueDay, dayType: dueDayType as any }, targetYear, targetMonth, bdConfig, holidays)
      if (resolved != null) {
        const dim = new Date(targetYear, targetMonth, 0).getDate()
        const clampedDay = Math.min(resolved, dim)
        return `${targetYear}-${String(targetMonth).padStart(2, '0')}-${String(clampedDay).padStart(2, '0')}`
      }
    }

    // Fallback: billing day (cobrança — when the charge is made)
    const billingDay = item.billing_day
    const billingDayType = item.billing_day_type || 'static'
    const billingOffset = item.billing_day_month_offset || 0

    if (billingDay != null || (billingDayType && billingDayType !== 'static' && billingDayType !== 'none')) {
      let targetMonth = m + billingOffset
      let targetYear = y
      if (targetMonth > 12) { targetYear++; targetMonth -= 12 }
      if (targetMonth < 1) { targetYear--; targetMonth += 12 }
      const holidays = holidayMap.get(targetYear) || []
      const resolved = resolveDay({ day: billingDay, dayType: billingDayType as any }, targetYear, targetMonth, bdConfig, holidays)
      if (resolved != null) {
        const dim = new Date(targetYear, targetMonth, 0).getDate()
        const clampedDay = Math.min(resolved, dim)
        return `${targetYear}-${String(targetMonth).padStart(2, '0')}-${String(clampedDay).padStart(2, '0')}`
      }
    }

    // Final fallback: first day of month
    return `${month}-01`
  }

  /** Resolve the effective date for an income based on due day (dia de recebimento) */
  function resolveIncomeEffectiveDate(
    inc: any, month: string,
    bdConfig: BusinessDayConfig, holidayMap: Map<number, string[]>
  ): string {
    const [y, m] = month.split('-').map(Number)
    const dueDay = inc.due_day
    const dueDayType = inc.due_day_type || 'static'

    if (dueDay != null || (dueDayType && dueDayType !== 'static' && dueDayType !== 'none')) {
      const holidays = holidayMap.get(y) || []
      const resolved = resolveDay({ day: dueDay, dayType: dueDayType as any }, y, m, bdConfig, holidays)
      if (resolved != null) {
        const dim = new Date(y, m, 0).getDate()
        const clampedDay = Math.min(resolved, dim)
        return `${month}-${String(clampedDay).padStart(2, '0')}`
      }
    }

    return `${month}-01`
  }

  /** Collect all item entries for a month with paid_at dates */
  function collectMonthItems(
    personId: number, month: string,
    bdConfig: BusinessDayConfig, holidayMap: Map<number, string[]>
  ): ItemEntry[] {
    const rawItems = sectionItemsRepo.findByPersonAndMonth(personId, month) as any[]
    const entries: ItemEntry[] = []

    for (const item of rawItems) {
      const globalActive = item.is_active === 1
      const isActive = itemStatusRepo.isActiveInMonth(item.id, month, globalActive) && !sectionItemsRepo.isPausedInMonth(item.id, month)
      let effectiveValue = 0

      if (isActive) {
        if ((item.type === 'installment' || item.type === 'emprestimo') && item.total_installments) {
          const splits = db.prepare(
            'SELECT id, value, total_installments FROM item_card_splits WHERE item_id = ?'
          ).all(item.id) as any[]
          if (splits.length > 0) {
            for (const sp of splits) {
              const anticipatedRow = db.prepare(
                'SELECT COALESCE(count, 0) as count, discounted_total FROM item_anticipations WHERE split_id = ? AND month = ?'
              ).get(sp.id, month) as any
              const currentPayment = db.prepare(
                'SELECT paid_value, original_value FROM item_current_installment_payments WHERE item_id = ? AND split_id = ? AND month = ? LIMIT 1'
              ).get(item.id, sp.id, month) as any
              const anticipatedInMonth = anticipatedRow ? anticipatedRow.count : 0
              const monthly = Math.round((sp.value / sp.total_installments) * 100) / 100
              effectiveValue += getInstallmentMonthValue({
                monthlyValue: monthly,
                anticipatedCount: anticipatedInMonth,
                discountedTotal: anticipatedRow?.discounted_total,
                currentPaymentPaidValue: currentPayment?.paid_value,
                currentPaymentOriginalValue: currentPayment?.original_value
              })
            }
          } else {
            const anticipatedRow = db.prepare(
              'SELECT COALESCE(count, 0) as count, discounted_total FROM item_anticipations WHERE item_id = ? AND split_id IS NULL AND month = ?'
            ).get(item.id, month) as any
            const currentPayment = db.prepare(
              'SELECT paid_value, original_value FROM item_current_installment_payments WHERE item_id = ? AND split_id IS NULL AND month = ? LIMIT 1'
            ).get(item.id, month) as any
            const anticipatedInMonth = anticipatedRow ? anticipatedRow.count : 0
            const monthly = Math.round((item.value / item.total_installments) * 100) / 100
            effectiveValue = getInstallmentMonthValue({
              monthlyValue: monthly,
              anticipatedCount: anticipatedInMonth,
              discountedTotal: anticipatedRow?.discounted_total,
              currentPaymentPaidValue: currentPayment?.paid_value,
              currentPaymentOriginalValue: currentPayment?.original_value
            })
          }
        } else {
          effectiveValue = sectionItemsRepo.getEffectiveValue(item, month)
        }
      }

      // Priority: paid_at (actual payment date) > due_day > billing_day > day 01
      const paidAt = itemStatusRepo.getPaidAt(item.id, month)
      const effectiveDate = paidAt || resolveItemEffectiveDate(item, month, bdConfig, holidayMap)

      const snapshot = item.exchange_rate_snapshot || 1.0
      entries.push({
        id: item.id,
        description: item.description,
        type: item.type,
        value: effectiveValue * snapshot,
        store: item.store_name || null,
        cardName: item.card_name || null,
        cardType: getCardType(db, item.card_id),
        paymentMethod: item.payment_method || null,
        bankAccountName: item.bank_account_name || null,
        categoryId: item.category_id,
        categoryName: item.category_name,
        categoryColor: item.category_color,
        categoryIcon: item.category_icon,
        isActive,
        effectiveDate,
        month
      })
    }
    return entries
  }

  /** Collect all income entries for a month */
  function collectMonthIncomes(
    personId: number, month: string,
    bdConfig: BusinessDayConfig, holidayMap: Map<number, string[]>
  ): IncomeEntry[] {
    const rawIncomes = incomeRepo.findByPersonAndMonth(personId, month) as any[]
    const entries: IncomeEntry[] = []
    for (const inc of rawIncomes.filter((income: any) => !incomeRepo.isPausedInMonth(income.id, month))) {
      const val = incomeRepo.getEffectiveValue(inc, month)
      const snapshot = inc.exchange_rate_snapshot || 1.0
      entries.push({
        id: inc.id,
        description: inc.description,
        value: val * snapshot,
        categoryId: inc.category_id || null,
        categoryName: inc.category_name || null,
        categoryColor: inc.category_color || null,
        effectiveDate: incomeStatusRepo.getReceivedAt(inc.id, month) || `${month}-01`,
        month
      })
    }
    return entries
  }

  /** Map a bucket key to its representative month for bank account balance lookup */
  function bucketToMonth(key: string, grouping: TemporalGrouping): string {
    switch (grouping) {
      case 'day':   // YYYY-MM-DD
      case 'week':  // YYYY-MM-DD (Monday)
        return key.substring(0, 7)
      case 'month': // YYYY-MM
        return key
      case 'year':  // YYYY
        return `${key}-12`
    }
  }

  /** Build aggregates from item and income entries */
  function buildFromEntries(
    allItems: ItemEntry[],
    allIncomes: IncomeEntry[],
    grouping: TemporalGrouping,
    startDate: string,
    endDate: string,
    personId: number
  ): PeriodData {
    // Filter by date range
    const filteredItems = allItems.filter(i => i.isActive && i.value > 0 && i.effectiveDate >= startDate && i.effectiveDate <= endDate)
    const filteredIncomes = allIncomes.filter(i => i.value > 0 && i.effectiveDate >= startDate && i.effectiveDate <= endDate)

    // Build timeline buckets
    const bucketMap = new Map<string, { expenses: number; income: number; expenseCount: number; incomeCount: number }>()

    // Pre-populate buckets so we have no gaps
    const allBucketKeys = generateBucketKeys(grouping, startDate, endDate)
    for (const key of allBucketKeys) {
      bucketMap.set(key, { expenses: 0, income: 0, expenseCount: 0, incomeCount: 0 })
    }

    for (const item of filteredItems) {
      const key = bucketKey(item.effectiveDate, grouping)
      const bucket = bucketMap.get(key)
      if (bucket) {
        bucket.expenses += item.value
        bucket.expenseCount++
      }
    }

    for (const inc of filteredIncomes) {
      const key = bucketKey(inc.effectiveDate, grouping)
      const bucket = bucketMap.get(key)
      if (bucket) {
        bucket.income += inc.value
        bucket.incomeCount++
      }
    }

    // Pre-fetch bank account balances per month (deduplicated)
    const monthBalanceCache = new Map<string, number>()
    for (const key of allBucketKeys) {
      const month = bucketToMonth(key, grouping)
      if (!monthBalanceCache.has(month)) {
        monthBalanceCache.set(month, bankAccountsRepo.getTotalByPersonForMonth(personId, month))
      }
    }

    let cumulativeBalance = 0
    const timeline: TimePoint[] = allBucketKeys.map(key => {
      const b = bucketMap.get(key)!
      cumulativeBalance += b.income - b.expenses
      const month = bucketToMonth(key, grouping)
      return {
        label: key,
        expenses: b.expenses,
        income: b.income,
        balance: cumulativeBalance,
        bankAccountBalance: monthBalanceCache.get(month) || 0,
        expenseCount: b.expenseCount,
        incomeCount: b.incomeCount
      }
    })

    // Top items (expenses) — keep max value per item
    const itemMap = new Map<number, ItemAggregate>()
    for (const item of filteredItems) {
      const existing = itemMap.get(item.id)
      if (!existing || item.value > existing.value) {
        const tags = (tagsRepo.findByItemId(item.id) as any[]).map(t => ({
          id: t.id, name: t.name, color: t.color
        }))
        itemMap.set(item.id, {
          itemId: item.id,
          description: item.description,
          type: item.type,
          value: item.value,
          store: item.store,
          categoryId: item.categoryId,
          categoryName: item.categoryName,
          categoryColor: item.categoryColor,
          categoryIcon: item.categoryIcon,
          tags
        })
      }
    }

    // Top incomes — keep max value per income
    const incomeMap = new Map<number, IncomeAggregate>()
    for (const inc of filteredIncomes) {
      const existing = incomeMap.get(inc.id)
      if (!existing || inc.value > existing.value) {
        const tags = (tagsRepo.findByIncomeId(inc.id) as any[]).map(t => ({
          id: t.id, name: t.name, color: t.color
        }))
        incomeMap.set(inc.id, {
          incomeId: inc.id,
          description: inc.description,
          value: inc.value,
          categoryId: inc.categoryId,
          categoryName: inc.categoryName,
          categoryColor: inc.categoryColor,
          tags
        })
      }
    }

    // Categories (expenses only)
    const categoryMap = new Map<number | string, CategoryAggregate>()
    for (const item of filteredItems) {
      const key = item.categoryId ?? 'none'
      const existing = categoryMap.get(key)
      if (existing) {
        existing.total += item.value
        existing.count++
      } else {
        categoryMap.set(key, {
          categoryId: item.categoryId,
          categoryName: item.categoryName,
          categoryColor: item.categoryColor,
          total: item.value,
          count: 1
        })
      }
    }

    // Tags (expenses only)
    const tagMap = new Map<number, TagAggregate>()
    const taggedItemIds = new Set<number>()
    for (const item of filteredItems) {
      const tags = (tagsRepo.findByItemId(item.id) as any[])
      if (tags.length > 0) taggedItemIds.add(item.id)
      for (const tag of tags) {
        const existing = tagMap.get(tag.id)
        if (existing) {
          existing.total += item.value
          existing.count++
        } else {
          tagMap.set(tag.id, {
            tagId: tag.id,
            tagName: tag.name,
            tagColor: tag.color,
            total: item.value,
            count: 1
          })
        }
      }
    }
    // Add "Sem tag" for untagged items
    const untaggedItems = filteredItems.filter(i => !taggedItemIds.has(i.id))
    if (untaggedItems.length > 0) {
      tagMap.set(-1, {
        tagId: -1,
        tagName: '__no_tag__',
        tagColor: '#6b7280',
        total: untaggedItems.reduce((s, i) => s + i.value, 0),
        count: untaggedItems.length
      })
    }

    // Income categories
    const incomeCategoryMap = new Map<number | string, CategoryAggregate>()
    for (const inc of filteredIncomes) {
      const key = inc.categoryId ?? 'none'
      const existing = incomeCategoryMap.get(key)
      if (existing) {
        existing.total += inc.value
        existing.count++
      } else {
        incomeCategoryMap.set(key, {
          categoryId: inc.categoryId,
          categoryName: inc.categoryName,
          categoryColor: inc.categoryColor,
          total: inc.value,
          count: 1
        })
      }
    }

    // Income tags
    const incomeTagMap = new Map<number, TagAggregate>()
    const taggedIncomeIds = new Set<number>()
    for (const inc of filteredIncomes) {
      const tags = (tagsRepo.findByIncomeId(inc.id) as any[])
      if (tags.length > 0) taggedIncomeIds.add(inc.id)
      for (const tag of tags) {
        const existing = incomeTagMap.get(tag.id)
        if (existing) {
          existing.total += inc.value
          existing.count++
        } else {
          incomeTagMap.set(tag.id, {
            tagId: tag.id,
            tagName: tag.name,
            tagColor: tag.color,
            total: inc.value,
            count: 1
          })
        }
      }
    }
    const untaggedIncomes = filteredIncomes.filter(i => !taggedIncomeIds.has(i.id))
    if (untaggedIncomes.length > 0) {
      incomeTagMap.set(-1, {
        tagId: -1,
        tagName: '__no_tag__',
        tagColor: '#6b7280',
        total: untaggedIncomes.reduce((s, i) => s + i.value, 0),
        count: untaggedIncomes.length
      })
    }

    const topItems = Array.from(itemMap.values()).sort((a, b) => b.value - a.value)
    const topIncomes = Array.from(incomeMap.values()).sort((a, b) => b.value - a.value)
    const topCategories = Array.from(categoryMap.values()).sort((a, b) => b.total - a.total)
    const topTags = Array.from(tagMap.values()).sort((a, b) => b.total - a.total)
    const topIncomeCategories = Array.from(incomeCategoryMap.values()).sort((a, b) => b.total - a.total)
    const topIncomeTags = Array.from(incomeTagMap.values()).sort((a, b) => b.total - a.total)

    const totalExpenses = filteredItems.reduce((s, i) => s + i.value, 0)
    const totalIncome = filteredIncomes.reduce((s, i) => s + i.value, 0)

    return {
      topItems, topIncomes, topCategories, topTags, topIncomeCategories, topIncomeTags, timeline,
      totalExpenses, totalIncome, totalBalance: totalIncome - totalExpenses
    }
  }

  /** Generate all bucket keys in order for the date range */
  function generateBucketKeys(grouping: TemporalGrouping, startDate: string, endDate: string): string[] {
    const keys: string[] = []
    switch (grouping) {
      case 'day': {
        const d = new Date(startDate + 'T00:00:00')
        const end = new Date(endDate + 'T00:00:00')
        while (d <= end) {
          keys.push(toDateStr(d))
          d.setDate(d.getDate() + 1)
        }
        break
      }
      case 'week': {
        // Start from the Monday of the start date's week
        let current = getMondayOfWeek(startDate)
        while (current <= endDate) {
          keys.push(current)
          const d = new Date(current + 'T00:00:00')
          d.setDate(d.getDate() + 7)
          current = toDateStr(d)
        }
        break
      }
      case 'month': {
        const startM = startDate.substring(0, 7)
        const endM = endDate.substring(0, 7)
        let cur = startM
        while (cur <= endM) {
          keys.push(cur)
          cur = addMonths(cur, 1)
        }
        break
      }
      case 'year': {
        const startY = parseInt(startDate.substring(0, 4))
        const endY = parseInt(endDate.substring(0, 4))
        for (let y = startY; y <= endY; y++) {
          keys.push(String(y))
        }
        break
      }
    }
    return keys
  }

  /** Load business day config and pre-fetch holidays for relevant years */
  async function loadDayContext(startDate: string, endDate: string): Promise<{ bdConfig: BusinessDayConfig; holidayMap: Map<number, string[]> }> {
    const bdcRaw = settingsRepo.get('businessDayConfig')
    const bdConfig: BusinessDayConfig = bdcRaw ? { ...DEFAULT_BUSINESS_DAY_CONFIG, ...JSON.parse(bdcRaw) } : DEFAULT_BUSINESS_DAY_CONFIG
    const holidayMap = new Map<number, string[]>()
    if (bdConfig.mode === 'api') {
      const startYear = parseInt(startDate.substring(0, 4))
      const endYear = parseInt(endDate.substring(0, 4))
      for (let y = startYear; y <= endYear + 1; y++) {
        const h = await getHolidays(y, bdConfig.countryCode)
        holidayMap.set(y, h)
      }
    }
    return { bdConfig, holidayMap }
  }

  // ── Temporal handler ──
  ipcMain.handle(
    IPC_CHANNELS.INSIGHTS_TEMPORAL,
    async (_, personId: number, grouping: string, startDate: string, endDate: string): Promise<InsightsTemporalResult> => {
      const g = grouping as TemporalGrouping
      // Determine which months to query
      const startMonth = startDate.substring(0, 7)
      const endMonth = endDate.substring(0, 7)
      const months = generateMonthRange(startMonth, endMonth)

      const scm = getStartCountingMonth(settingsRepo, personId)
      const { bdConfig, holidayMap } = await loadDayContext(startDate, endDate)

      // Clamp startDate so bucket keys don't include months before start counting month
      let effectiveStartDate = startDate
      if (scm && startDate < `${scm}-01`) {
        effectiveStartDate = `${scm}-01`
      }

      // Collect all entries (skip months before start counting month)
      const allItems: ItemEntry[] = []
      const allIncomes: IncomeEntry[] = []
      for (const month of months) {
        if (isMonthBeforeStart(month, scm)) continue
        allItems.push(...collectMonthItems(personId, month, bdConfig, holidayMap))
        allIncomes.push(...collectMonthIncomes(personId, month, bdConfig, holidayMap))
      }

      const data = buildFromEntries(allItems, allIncomes, g, effectiveStartDate, endDate, personId)
      return {
        topItems: data.topItems,
        topIncomes: data.topIncomes,
        topCategories: data.topCategories,
        topTags: data.topTags,
        topIncomeCategories: data.topIncomeCategories,
        topIncomeTags: data.topIncomeTags,
        timeline: data.timeline,
        totalExpenses: data.totalExpenses,
        totalIncome: data.totalIncome,
        totalBalance: data.totalBalance
      }
    }
  )

  // ── Comparative handler ──
  ipcMain.handle(
    IPC_CHANNELS.INSIGHTS_COMPARATIVE,
    async (_, personId: number, granularity: string, periodA: string, periodB: string): Promise<InsightsComparativeResult> => {
      const g = granularity as ComparisonGranularity

      function periodToDateRange(period: string): { startDate: string; endDate: string } {
        switch (g) {
          case 'day':
            return { startDate: period, endDate: period }
          case 'week': {
            const monday = getMondayOfWeek(period)
            const d = new Date(monday + 'T00:00:00')
            d.setDate(d.getDate() + 6)
            return { startDate: monday, endDate: toDateStr(d) }
          }
          case 'month': {
            const [y, m] = period.split('-').map(Number)
            const lastDay = new Date(y, m, 0).getDate()
            return { startDate: `${period}-01`, endDate: `${period}-${String(lastDay).padStart(2, '0')}` }
          }
          case 'year':
            return { startDate: `${period}-01-01`, endDate: `${period}-12-31` }
        }
      }

      function periodGrouping(): TemporalGrouping {
        switch (g) {
          case 'day': return 'day'
          case 'week': return 'day'
          case 'month': return 'day'
          case 'year': return 'month'
        }
      }

      const scm = getStartCountingMonth(settingsRepo, personId)

      // Load day context covering both periods
      const rangeA = periodToDateRange(periodA)
      const rangeB = periodToDateRange(periodB)
      const globalStart = rangeA.startDate < rangeB.startDate ? rangeA.startDate : rangeB.startDate
      const globalEnd = rangeA.endDate > rangeB.endDate ? rangeA.endDate : rangeB.endDate
      const { bdConfig, holidayMap } = await loadDayContext(globalStart, globalEnd)

      function buildPeriod(period: string): { data: PeriodData; label: string } {
        const range = periodToDateRange(period)
        const pg = periodGrouping()
        const startMonth = range.startDate.substring(0, 7)
        const endMonth = range.endDate.substring(0, 7)
        const months = generateMonthRange(startMonth, endMonth)

        // Clamp startDate so bucket keys don't include months before start counting month
        let effectiveStartDate = range.startDate
        if (scm && range.startDate < `${scm}-01`) {
          effectiveStartDate = `${scm}-01`
        }

        const allItems: ItemEntry[] = []
        const allIncomes: IncomeEntry[] = []
        for (const month of months) {
          if (isMonthBeforeStart(month, scm)) continue
          allItems.push(...collectMonthItems(personId, month, bdConfig, holidayMap))
          allIncomes.push(...collectMonthIncomes(personId, month, bdConfig, holidayMap))
        }

        const data = buildFromEntries(allItems, allIncomes, pg, effectiveStartDate, range.endDate, personId)

        // For year comparison, use short month names as labels
        if (g === 'year') {
          const monthLabels = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']
          for (const tp of data.timeline) {
            const m = parseInt(tp.label.split('-')[1]) - 1
            tp.label = monthLabels[m] || tp.label
          }
        } else if (g === 'week') {
          const dayNames = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sab', 'Dom']
          for (let i = 0; i < data.timeline.length && i < 7; i++) {
            data.timeline[i].label = dayNames[i]
          }
        }

        return { data, label: period }
      }

      const resultA = buildPeriod(periodA)
      const resultB = buildPeriod(periodB)

      return {
        periodALabel: resultA.label,
        periodBLabel: resultB.label,
        a: resultA.data,
        b: resultB.data
      }
    }
  )

  // ── Period Detail handler ──

  function buildValueHistory(itemId: number, baseValue: number, startMonth: string, endMonth: string): ValueRange[] {
    const overrides = db.prepare(
      'SELECT month, value FROM item_monthly_values WHERE item_id = ? AND month >= ? AND month <= ? ORDER BY month'
    ).all(itemId, startMonth, endMonth) as { month: string; value: number }[]

    const months = generateMonthRange(startMonth, endMonth)
    const ranges: ValueRange[] = []
    let currentValue = baseValue
    let rangeStart = months[0]

    // Build a map of override values at each month
    const overrideMap = new Map<string, number>()
    for (const o of overrides) overrideMap.set(o.month, o.value)

    // Also check for an override before startMonth that sets the initial value
    const priorOverride = db.prepare(
      'SELECT value FROM item_monthly_values WHERE item_id = ? AND month < ? ORDER BY month DESC LIMIT 1'
    ).get(itemId, startMonth) as { value: number } | undefined
    if (priorOverride) currentValue = priorOverride.value

    for (let i = 0; i < months.length; i++) {
      const m = months[i]
      const override = overrideMap.get(m)
      if (override !== undefined && override !== currentValue) {
        // Close the current range
        ranges.push({ startMonth: rangeStart, endMonth: months[i - 1] || rangeStart, value: currentValue })
        currentValue = override
        rangeStart = m
      }
    }
    // Close the last range
    ranges.push({ startMonth: rangeStart, endMonth: months[months.length - 1], value: currentValue })

    return ranges
  }

  function buildIncomeValueHistory(incomeId: number, baseValue: number, startMonth: string, endMonth: string): ValueRange[] {
    const overrides = db.prepare(
      'SELECT month, value FROM income_monthly_values WHERE income_id = ? AND month >= ? AND month <= ? ORDER BY month'
    ).all(incomeId, startMonth, endMonth) as { month: string; value: number }[]

    const months = generateMonthRange(startMonth, endMonth)
    const ranges: ValueRange[] = []
    let currentValue = baseValue
    let rangeStart = months[0]

    const overrideMap = new Map<string, number>()
    for (const o of overrides) overrideMap.set(o.month, o.value)

    const priorOverride = db.prepare(
      'SELECT value FROM income_monthly_values WHERE income_id = ? AND month < ? ORDER BY month DESC LIMIT 1'
    ).get(incomeId, startMonth) as { value: number } | undefined
    if (priorOverride) currentValue = priorOverride.value

    for (let i = 0; i < months.length; i++) {
      const m = months[i]
      const override = overrideMap.get(m)
      if (override !== undefined && override !== currentValue) {
        ranges.push({ startMonth: rangeStart, endMonth: months[i - 1] || rangeStart, value: currentValue })
        currentValue = override
        rangeStart = m
      }
    }
    ranges.push({ startMonth: rangeStart, endMonth: months[months.length - 1], value: currentValue })

    return ranges
  }

  ipcMain.handle(
    IPC_CHANNELS.INSIGHTS_PERIOD_DETAIL,
    async (_, personId: number, startDate: string, endDate: string, categoryId?: number | null, tagId?: number | null, filterType?: string): Promise<PeriodDetailResult> => {
      const ft = filterType || 'both'
      const startMonth = startDate.substring(0, 7)
      const endMonth = endDate.substring(0, 7)
      const months = generateMonthRange(startMonth, endMonth)
      const scm = getStartCountingMonth(settingsRepo, personId)
      const { bdConfig, holidayMap } = await loadDayContext(startDate, endDate)

      // Collect raw entries
      const allItems: ItemEntry[] = []
      const allIncomes: IncomeEntry[] = []
      for (const month of months) {
        if (isMonthBeforeStart(month, scm)) continue
        if (ft !== 'income') allItems.push(...collectMonthItems(personId, month, bdConfig, holidayMap))
        if (ft !== 'expenses') allIncomes.push(...collectMonthIncomes(personId, month, bdConfig, holidayMap))
      }

      // Filter by date range and active
      const filteredItems = allItems.filter(i => i.isActive && i.value > 0 && i.effectiveDate >= startDate && i.effectiveDate <= endDate)
      const filteredIncomes = allIncomes.filter(i => i.value > 0 && i.effectiveDate >= startDate && i.effectiveDate <= endDate)

      // Deduplicate items by id — merge across months
      const itemMap = new Map<number, { entry: ItemEntry; effectiveValue: number; allMonths: string[] }>()
      for (const item of filteredItems) {
        const existing = itemMap.get(item.id)
        if (existing) {
          existing.effectiveValue += item.value
          if (!existing.allMonths.includes(item.month)) existing.allMonths.push(item.month)
        } else {
          itemMap.set(item.id, { entry: item, effectiveValue: item.value, allMonths: [item.month] })
        }
      }

      // Deduplicate incomes by id
      const incomeMap = new Map<number, { entry: IncomeEntry; effectiveValue: number; allMonths: string[] }>()
      for (const inc of filteredIncomes) {
        const existing = incomeMap.get(inc.id)
        if (existing) {
          existing.effectiveValue += inc.value
          if (!existing.allMonths.includes(inc.month)) existing.allMonths.push(inc.month)
        } else {
          incomeMap.set(inc.id, { entry: inc, effectiveValue: inc.value, allMonths: [inc.month] })
        }
      }

      // Filter by categoryId or tagId if provided
      let itemEntries = Array.from(itemMap.values())
      let incomeEntries = Array.from(incomeMap.values())

      if (categoryId !== undefined && categoryId !== null) {
        itemEntries = itemEntries.filter(e => e.entry.categoryId === categoryId)
        incomeEntries = incomeEntries.filter(e => e.entry.categoryId === categoryId)
      }
      if (tagId !== undefined && tagId !== null) {
        if (tagId === -1) {
          // "Sem tag" — items with no tags
          itemEntries = itemEntries.filter(e => {
            const tags = tagsRepo.findByItemId(e.entry.id) as any[]
            return tags.length === 0
          })
        } else {
          itemEntries = itemEntries.filter(e => {
            const tags = tagsRepo.findByItemId(e.entry.id) as any[]
            return tags.some((t: any) => t.id === tagId)
          })
        }
      }

      // Enrich items
      const detailItems: PeriodDetailItem[] = itemEntries.map(({ entry, effectiveValue, allMonths }) => {
        const tags = (tagsRepo.findByItemId(entry.id) as any[]).map(t => ({
          id: t.id, name: t.name, color: t.color
        }))

        const sortedMonths = [...allMonths].sort()
        const firstMonth = sortedMonths[0]
        const lastMonth = sortedMonths[sortedMonths.length - 1]

        // Get base item info
        const rawItem = db.prepare('SELECT value, total_installments, type, start_month, end_month FROM section_items WHERE id = ?').get(entry.id) as any
        const baseValue = rawItem?.value || 0
        const totalInstallments = rawItem?.total_installments || null

        // Anticipations
        const anticipations = db.prepare(
          'SELECT month, count FROM item_anticipations WHERE item_id = ? AND split_id IS NULL ORDER BY month'
        ).all(entry.id) as { month: string; count: number }[]
        const totalAnticipatedValue = anticipations.reduce((s, a) => {
          if (totalInstallments) return s + (baseValue / totalInstallments) * a.count
          return s
        }, 0)

        // Card splits
        const splits = db.prepare(
          'SELECT ics.id, ics.card_id, ics.value, ics.total_installments, c.name as card_name FROM item_card_splits ics LEFT JOIN cards c ON c.id = ics.card_id WHERE ics.item_id = ?'
        ).all(entry.id) as any[]

        const cardSplits: CardSplitDetail[] = splits.map(sp => {
          const spAnticipations = db.prepare(
            'SELECT month, count FROM item_anticipations WHERE split_id = ? ORDER BY month'
          ).all(sp.id) as { month: string; count: number }[]
          const spAnticipatedValue = spAnticipations.reduce((s, a) => s + (sp.value / sp.total_installments) * a.count, 0)
          return {
            splitId: sp.id,
            cardId: sp.card_id,
            cardName: sp.card_name || '__card__',
            cardType: getCardType(db, sp.card_id),
            splitValue: sp.value,
            totalInstallments: sp.total_installments,
            paidInstallments: 0,
            anticipations: spAnticipations,
            totalAnticipatedValue: spAnticipatedValue
          }
        })

        // Value history (subscriptions)
        let valueHistory: ValueRange[] = []
        if (entry.type === 'subscription' && allMonths.length > 1) {
          valueHistory = buildValueHistory(entry.id, baseValue, firstMonth, lastMonth)
        }

        return {
          id: entry.id,
          description: entry.description,
          type: entry.type,
          effectiveValue,
          baseValue,
          store: entry.store,
          cardName: entry.cardName,
          cardType: entry.cardType,
          paymentMethod: entry.paymentMethod,
          bankAccountName: entry.bankAccountName,
          categoryId: entry.categoryId,
          categoryName: entry.categoryName,
          categoryColor: entry.categoryColor,
          categoryIcon: entry.categoryIcon,
          tags,
          totalInstallments,
          allMonths: sortedMonths,
          firstMonth,
          lastMonth,
          anticipations,
          totalAnticipatedValue,
          cardSplits,
          valueHistory
        }
      })

      // Enrich incomes
      const detailIncomes: PeriodDetailIncome[] = incomeEntries.map(({ entry, effectiveValue, allMonths }) => {
        const tags = (tagsRepo.findByIncomeId(entry.id) as any[]).map(t => ({
          id: t.id, name: t.name, color: t.color
        }))
        const sortedMonths = [...allMonths].sort()
        const firstMonth = sortedMonths[0]
        const lastMonth = sortedMonths[sortedMonths.length - 1]

        const rawIncome = db.prepare('SELECT value, is_recurring, start_month, end_month FROM person_income WHERE id = ?').get(entry.id) as any
        const baseValue = rawIncome?.value || 0
        const isRecurring = rawIncome?.is_recurring === 1

        let valueHistory: ValueRange[] = []
        if (isRecurring && allMonths.length > 1) {
          valueHistory = buildIncomeValueHistory(entry.id, baseValue, firstMonth, lastMonth)
        }

        return {
          id: entry.id,
          description: entry.description,
          effectiveValue,
          baseValue,
          categoryId: entry.categoryId,
          categoryName: entry.categoryName,
          categoryColor: entry.categoryColor,
          tags,
          isRecurring,
          allMonths: sortedMonths,
          firstMonth,
          lastMonth,
          valueHistory
        }
      })

      // Sort by effectiveValue desc
      detailItems.sort((a, b) => b.effectiveValue - a.effectiveValue)
      detailIncomes.sort((a, b) => b.effectiveValue - a.effectiveValue)

      const totalExpenses = detailItems.reduce((s, i) => s + i.effectiveValue, 0)
      const totalIncome = detailIncomes.reduce((s, i) => s + i.effectiveValue, 0)

      // Build period label
      const periodLabel = startDate === endDate ? startDate : `${startDate} — ${endDate}`

      return { periodLabel, items: detailItems, incomes: detailIncomes, totalExpenses, totalIncome }
    }
  )
}
