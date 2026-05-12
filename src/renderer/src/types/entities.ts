export interface TagData {
  id: number; name: string; color: string
}

export interface CardSplit {
  id?: number
  cardId: number
  cardName?: string
  cardType?: string | null
  paymentMethod?: string | null
  value: number
  totalInstallments: number
  totalAnticipated?: number
  paidInstallmentsBefore?: number
  anticipatedThisMonth?: number
  discountedTotalThisMonth?: number | null
  currentInstallment?: number
  currentInstallmentPayment?: CurrentInstallmentPayment | null
}

export interface CurrentInstallmentPayment {
  id: number
  itemId: number
  splitId: number | null
  month: string
  originalValue: number
  paidValue: number
  paidAt: string | null
}

export interface ItemInterruption {
  id: number
  endMonth: string
  resumeMonth: string | null
}

export interface SectionItem {
  id: number; personId: number; description: string; type: string
  value: number; dueDay: number | null; dueDayLabel: string | null
  dueDayType?: string; dueDayMonthOffset?: number; cardDueDays?: number[]
  billingDay?: number | null; billingDayType?: string; billingDayMonthOffset?: number
  totalInstallments: number | null
  startMonth: string; endMonth: string | null
  isActive: boolean; isPaid?: boolean; paidAt?: string | null; currentInstallment?: number
  isMonthlyDeactivated?: boolean
  notes: string | null
  categoryId: number | null; categoryName?: string; categoryIcon?: string; categoryColor?: string
  subcategoryId?: number | null; subcategoryName?: string; subcategoryColor?: string
  cardId: number | null; cardName?: string; cardType?: string | null
  storeId: number | null; storeName?: string | null
  baseValue?: number | null
  interestRate?: number | null
  bankAccountId?: number | null
  bankAccountName?: string | null
  endReason: string | null
  paymentMethod?: string | null
  interruptions?: ItemInterruption[]
  tags?: TagData[]
  cardSplits?: CardSplit[]
  anticipations?: { id: number; splitId: number | null; month: string; count: number; discountedTotal?: number | null }[]
  currentInstallmentPayments?: CurrentInstallmentPayment[]
  currentInstallmentPayment?: CurrentInstallmentPayment | null
  totalAnticipated?: number
  paidInstallmentsBefore?: number
  anticipatedThisMonth?: number
  discountedTotalThisMonth?: number | null
  effectiveValue?: number
  hasOverride?: boolean
  currencyId?: number | null
  currencySymbol?: string
  currencyCode?: string
  exchangeRateSnapshot?: number
  createdAt?: string
}

export interface IncomeRecord {
  id: number; personId: number; description: string
  value: number; effectiveValue: number
  isRecurring: boolean; startMonth: string; endMonth: string | null
  isReceived: boolean; receivedAt: string | null; hasOverride: boolean
  categoryId: number | null; categoryName?: string; categoryColor?: string
  subcategoryId?: number | null; subcategoryName?: string; subcategoryColor?: string
  dueDay?: number | null; dueDayType?: string
  notes?: string
  storeId?: number | null; storeName?: string; storeColor?: string
  tags?: TagData[]
  interruptions?: ItemInterruption[]
  currencyId?: number | null
  currencySymbol?: string
  currencyCode?: string
  exchangeRateSnapshot?: number
}
