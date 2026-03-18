export interface DashboardListItem {
  id: number
  description: string
  type: string
  value: number
  dueDay: number | null
  dueDayLabel: string | null
  dueDayType?: string
  dueDayMonthOffset?: number
  cardDueDays?: number[]
  billingDay?: number | null
  billingDayType?: string
  billingDayMonthOffset?: number
  resolvedDueDay?: number | null
  resolvedBillingDay?: number | null
  isPaid: boolean
  categoryName: string | null
  categoryColor: string | null
  cardName: string | null
  cardType: string | null
  paymentMethod: string | null
  cardSplits: { cardName: string | null; cardType: string | null }[]
  store: string | null
  currentInstallment?: number
  totalInstallments?: number
  remainingInstallments?: number
}

export interface DashboardIncomeItem {
  id: number
  description: string
  effectiveValue: number
  isReceived: boolean
  categoryName: string | null
  categoryColor: string | null
}

export interface DashboardComparison {
  currentTotal: number
  previousTotal: number
  delta: number
  deltaPercent: number
}

export interface DashboardPaymentSummary {
  totalItems: number
  paidItems: number
  paidValue: number
  pendingValue: number
}

export interface DashboardMonthSummary {
  month: string
  expensesTotal: number
  incomeTotal: number
  balance: number
  isBeforeStart?: boolean
}

export interface DashboardCardEnriched {
  id: number
  name: string
  totalLimit: number
  usedLimit: number
  availableLimit: number
  billingCloseDay: number
  dueDay: number
  cardType: 'credit' | 'debit' | 'both'
  bankAccountName: string | null
  commonCount: number
  commonTotal: number
  installmentCount: number
  installmentTotal: number
  subscriptionCount: number
  subscriptionTotal: number
  emprestimoCount: number
  emprestimoTotal: number
}

export interface DashboardDistributionEntry {
  name: string
  color: string
  total: number
}

export interface DashboardWidgetsData {
  upcomingExpenses: DashboardListItem[]
  unpaidItems: DashboardListItem[]
  topExpenses: DashboardListItem[]
  pendingIncomes: DashboardIncomeItem[]
  endingInstallments: DashboardListItem[]
  monthComparison: DashboardComparison
  overdueItems: DashboardListItem[]
  paymentSummary: DashboardPaymentSummary
  previousMonthSummary: DashboardMonthSummary
  nextMonthSummary: DashboardMonthSummary
  cardDetails: DashboardCardEnriched[]
  categoryDistribution: DashboardDistributionEntry[]
  tagDistribution: DashboardDistributionEntry[]
  incomeTypeDistribution: DashboardDistributionEntry[]
  incomeCategoryDistribution: DashboardDistributionEntry[]
  upcomingBilling: DashboardListItem[]
}
