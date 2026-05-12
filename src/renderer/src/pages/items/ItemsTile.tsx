import { useEffect, useId, useState, type CSSProperties, type MouseEvent } from 'react'
import { createPortal } from 'react-dom'
import { formatCurrency, formatCurrencyWith } from '../../lib/currency'
import { useFormatDate } from '../../lib/date'
import { formatCardLabel, getTypeLabels } from '../../lib/card-utils'
import { formatDayLabelResolved, resolveDay } from '../../../../../shared/day-utils'
import { getInstallmentMonthValue } from '../../../../../shared/installment-utils'
import { useBusinessDayConfig } from '../../contexts/BusinessDayContext'
import { useDimPaid } from '../../contexts/DimPaidContext'
import { useTileFields } from '../../contexts/TileFieldsContext'
import { useTranslation } from '../../contexts/LanguageContext'
import { useDisplayCurrency } from '../../contexts/DisplayCurrencyContext'
import {
  CheckCircle, Circle,
  Bookmark, CalendarClock, CalendarDays, CreditCard, DollarSign,
  Info, Layers, PauseCircle, Percent, Settings, Store, Tags,
  type LucideIcon
} from 'lucide-react'
import { Card } from '../../components/ui/Card'
import { CurrencyTooltip } from '../../components/ui/CurrencyTooltip'
import { formatInterruptionSummary, getActiveInterruption } from '../../lib/interruptions'
import type { SectionItem } from '../../types/entities'

interface ItemsTileProps {
  item: SectionItem
  month: string
  columns: number
  fieldsPage?: string
  styleScope?: string
  gastosStyle: (category: string, type: string) => CSSProperties
  onEdit: (item: SectionItem) => void
  onToggleActive: (item: SectionItem) => void
  onTogglePaid: (itemId: number) => void
  onDelete: (itemId: number) => void
  onEditValue: (item: SectionItem) => void
  onReactivate: (interruptionId: number) => void
  onInterrupt: (item: SectionItem) => void
  onViewInterruptions: (item: SectionItem) => void
}

interface CardDetailRow {
  name: string
  detail?: string
  amount?: string
  paidProgress?: number
  currentProgress?: number
  overdueProgress?: number
}

interface TooltipRow {
  icon: LucideIcon
  label: string
  value: string
}

interface TooltipPosition {
  left: number
  top?: number
  bottom?: number
}

function stop(event: MouseEvent) {
  event.stopPropagation()
}

function getTooltipPosition(target: HTMLElement): TooltipPosition {
  const rect = target.getBoundingClientRect()
  const tooltipWidth = 448
  const estimatedTooltipHeight = 360
  const margin = 12
  const left = Math.min(
    Math.max(rect.right - tooltipWidth, margin),
    window.innerWidth - tooltipWidth - margin
  )

  if (rect.bottom + estimatedTooltipHeight > window.innerHeight && rect.top > estimatedTooltipHeight) {
    return { left, bottom: window.innerHeight - rect.top + 8 }
  }

  return { left, top: rect.bottom + 8 }
}

const TILE_EXPAND_EVENT = 'moneycapy:tile-expanded'

function announceExpandedTile(key: string) {
  window.dispatchEvent(new CustomEvent(TILE_EXPAND_EVENT, { detail: key }))
}

export function ItemsTile({
  item, month, columns, fieldsPage = 'items', styleScope = 'items', gastosStyle,
  onEdit, onTogglePaid
}: ItemsTileProps) {
  const { t } = useTranslation()
  const { fmtDate, fmtMonth } = useFormatDate()
  const { businessDayConfig } = useBusinessDayConfig()
  const { dimPaid } = useDimPaid()
  const { gastosFields } = useTileFields(fieldsPage)
  const { displayCurrency } = useDisplayCurrency()
  const tileInstanceId = useId()
  const [expanded, setExpanded] = useState(false)
  const [infoOpen, setInfoOpen] = useState(false)
  const [tooltipPosition, setTooltipPosition] = useState<TooltipPosition | null>(null)
  const [mYear, mMonth] = month.split('-').map(Number)

  const hasSplits = item.cardSplits && item.cardSplits.length > 0
  const isForeign = !!(item.currencySymbol && item.exchangeRateSnapshot && item.exchangeRateSnapshot !== 1.0)
  const sym = item.currencySymbol || ''
  const snap = item.exchangeRateSnapshot || 1.0
  const fmtVal = (value: number) => displayCurrency && displayCurrency.exchangeRate > 0
    ? formatCurrencyWith((value * snap) / displayCurrency.exchangeRate, displayCurrency.symbol)
    : isForeign ? formatCurrencyWith(value, sym) : formatCurrency(value)
  const fmtBase = (value: number) => formatCurrency(value * snap)
  const isInstallment = Boolean((item.type === 'installment' || item.type === 'emprestimo') && item.totalInstallments && item.currentInstallment)

  let monthValue: number
  if (hasSplits) {
    monthValue = item.cardSplits!.reduce((acc, split) => {
      const monthly = Math.round((split.value / split.totalInstallments) * 100) / 100
      return acc + getInstallmentMonthValue({
        monthlyValue: monthly,
        anticipatedCount: split.anticipatedThisMonth,
        discountedTotal: split.discountedTotalThisMonth,
        currentPaymentPaidValue: split.currentInstallmentPayment?.paidValue,
        currentPaymentOriginalValue: split.currentInstallmentPayment?.originalValue
      })
    }, 0)
  } else if (isInstallment && item.totalInstallments) {
    const monthly = Math.round((item.value / item.totalInstallments) * 100) / 100
    monthValue = getInstallmentMonthValue({
      monthlyValue: monthly,
      anticipatedCount: item.anticipatedThisMonth,
      discountedTotal: item.discountedTotalThisMonth,
      currentPaymentPaidValue: item.currentInstallmentPayment?.paidValue,
      currentPaymentOriginalValue: item.currentInstallmentPayment?.originalValue
    })
  } else {
    monthValue = item.type === 'subscription' ? (item.effectiveValue ?? item.value) : item.value
  }

  const adjustedInstallmentTotal = (() => {
    if (!isInstallment) return item.value
    const currentPaymentSavings = (item.currentInstallmentPayments || []).reduce((sum, payment) => {
      return sum + Math.max(0, payment.originalValue - payment.paidValue)
    }, 0)
    const anticipationSavings = (item.anticipations || []).reduce((sum, anticipation) => {
      if (anticipation.discountedTotal == null) return sum
      const split = anticipation.splitId ? item.cardSplits?.find(s => s.id === anticipation.splitId) : null
      const monthly = split
        ? split.value / split.totalInstallments
        : item.totalInstallments ? item.value / item.totalInstallments : 0
      const originalTotal = monthly * anticipation.count
      return sum + Math.max(0, originalTotal - anticipation.discountedTotal)
    }, 0)
    return Math.max(0, item.value - currentPaymentSavings - anticipationSavings)
  })()

  const typeText = item.type === 'emprestimo' ? t('itemTypes.emprestimo') : item.type === 'installment' ? t('itemTypes.installment') : item.type === 'subscription' ? t('itemTypes.subscription') : t('itemTypes.common')
  const categoryLabel = item.categoryName ? `${item.categoryName}${item.subcategoryName ? `/${item.subcategoryName}` : ''}` : t('items.noCategoryDefined')

  const cardTypeLabels = getTypeLabels(t)

  const billingDayText = formatDayLabelResolved(item.billingDay ?? null, item.billingDayType || null, t('items.billingDayLabel'), mYear, mMonth, businessDayConfig, undefined, item.billingDayMonthOffset || 0)
  const dueDayText = (() => {
    if (!item.dueDay && !(item.dueDayType === 'card_due' && item.cardDueDays?.length)) return ''
    const dueOffset = item.dueDayMonthOffset || 0
    if (item.dueDayType === 'card_due' && item.cardDueDays && item.cardDueDays.length > 0) {
      let dueMonth = mMonth + dueOffset
      if (dueMonth > 12) dueMonth -= 12
      const mm = String(dueMonth).padStart(2, '0')
      const uniqueDays = [...new Set(item.cardDueDays)]
      return t('items.dueDayText', { label: t('items.dueDayLabel'), day: uniqueDays.map(day => `${String(day).padStart(2, '0')}/${mm}`).join(` ${t('insights.andConjunction')} `) }) + ` (${t('dayPicker.cardDueDay')})`
    }
    return formatDayLabelResolved(item.dueDay, item.dueDayType || null, t('items.dueDayLabel'), mYear, mMonth, businessDayConfig, undefined, dueOffset)
  })()
  const dueDate = (() => {
    if (!item.dueDay && !(item.dueDayType === 'card_due' && item.cardDueDays?.length)) return null
    const dueOffset = item.dueDayMonthOffset || 0
    let dueMonth = mMonth + dueOffset
    let dueYear = mYear
    while (dueMonth > 12) { dueYear++; dueMonth -= 12 }
    while (dueMonth < 1) { dueYear--; dueMonth += 12 }

    if (item.dueDayType === 'card_due' && item.cardDueDays && item.cardDueDays.length > 0) {
      const resolvedDays = [...new Set(item.cardDueDays)]
        .map(day => resolveDay({ day, dayType: 'static' }, dueYear, dueMonth, businessDayConfig))
        .filter((day): day is number => day != null)
      if (resolvedDays.length === 0) return null
      return new Date(dueYear, dueMonth - 1, Math.max(...resolvedDays), 23, 59, 59, 999)
    }

    const resolvedDay = resolveDay(
      { day: item.dueDay, dayType: (item.dueDayType || 'static') as any },
      dueYear,
      dueMonth,
      businessDayConfig
    )
    return resolvedDay == null ? null : new Date(dueYear, dueMonth - 1, resolvedDay, 23, 59, 59, 999)
  })()
  const isOverdue = Boolean(dueDate && !item.isPaid && dueDate.getTime() < Date.now())
  const buildInstallmentProgress = (currentInstallment: number, totalInstallments: number, anticipatedThisMonth = 0) => {
    const total = Math.max(totalInstallments, 1)
    const current = Math.min(Math.max(currentInstallment, 1), total)
    const previousPaid = Math.min(Math.max(current - 1, 0), total)
    const currentAndAnticipated = Math.min(1 + Math.max(anticipatedThisMonth, 0), Math.max(total - previousPaid, 0))
    const paidCount = item.isPaid ? Math.min(previousPaid + currentAndAnticipated, total) : previousPaid
    const pendingCount = item.isPaid ? 0 : currentAndAnticipated
    return {
      paidProgress: (paidCount / total) * 100,
      currentProgress: isOverdue ? 0 : (pendingCount / total) * 100,
      overdueProgress: isOverdue ? (pendingCount / total) * 100 : 0
    }
  }
  const formatInstallmentDetail = (currentInstallment: number, totalInstallments: number, anticipatedThisMonth = 0) => {
    const base = `${currentInstallment}/${totalInstallments} ${t('items.installments').toLowerCase()}`
    if (anticipatedThisMonth <= 0) return base
    return `${base} (${t('items.anticipatedInstallmentsToMonth', { count: String(anticipatedThisMonth), month: fmtMonth(month) })})`
  }

  const cardRows: CardDetailRow[] = []
  if (isInstallment) {
    if (hasSplits && item.type !== 'emprestimo') {
      for (const split of item.cardSplits!) {
        const current = split.currentInstallment || Math.min(item.currentInstallment!, split.totalInstallments)
        const splitLabel = split.cardName ? formatCardLabel(split.cardName, split.cardType, split.paymentMethod, cardTypeLabels) : t('items.cardFallback', { id: String(split.cardId) })
        const anticipated = split.anticipatedThisMonth || 0
        const monthly = Math.round((split.value / split.totalInstallments) * 100) / 100
        const rowValue = getInstallmentMonthValue({
          monthlyValue: monthly,
          anticipatedCount: anticipated,
          discountedTotal: split.discountedTotalThisMonth,
          currentPaymentPaidValue: split.currentInstallmentPayment?.paidValue,
          currentPaymentOriginalValue: split.currentInstallmentPayment?.originalValue
        })
        cardRows.push({
          name: splitLabel,
          detail: formatInstallmentDetail(current, split.totalInstallments, anticipated),
          amount: `${fmtVal(rowValue)}${t('itemsForm.perMonth')}`,
          ...buildInstallmentProgress(current, split.totalInstallments, anticipated)
        })
      }
    } else {
      const anticipated = item.anticipatedThisMonth || 0
      const monthly = Math.round((item.value / item.totalInstallments!) * 100) / 100
      const rowValue = getInstallmentMonthValue({
        monthlyValue: monthly,
        anticipatedCount: anticipated,
        discountedTotal: item.discountedTotalThisMonth,
        currentPaymentPaidValue: item.currentInstallmentPayment?.paidValue,
        currentPaymentOriginalValue: item.currentInstallmentPayment?.originalValue
      })
      cardRows.push({
        name: item.type === 'emprestimo' ? t('items.installments') : (item.cardName ? formatCardLabel(item.cardName, item.cardType, item.paymentMethod, cardTypeLabels) : t('items.installments')),
        detail: formatInstallmentDetail(item.currentInstallment!, item.totalInstallments!, anticipated),
        amount: `${fmtVal(rowValue)}${t('itemsForm.perMonth')}`,
        ...buildInstallmentProgress(item.currentInstallment!, item.totalInstallments!, anticipated)
      })
    }
  } else if (item.cardName) {
    const recurring = item.type === 'subscription'
    cardRows.push({
      name: formatCardLabel(item.cardName, item.cardType, item.paymentMethod, cardTypeLabels),
      detail: recurring && item.endMonth ? t('items.cardUntil', { month: fmtMonth(item.endMonth) }) : undefined,
      amount: recurring ? `${fmtVal(monthValue)}${t('itemsForm.perMonth')}` : fmtVal(monthValue)
    })
  }

  const activeInterruption = getActiveInterruption(item.interruptions, month)
  const interruptionSummary = formatInterruptionSummary(activeInterruption, fmtMonth, t)

  const tagsSummary = item.tags && item.tags.length > 0 ? item.tags.map(tag => tag.name).join(', ') : t('items.noTags')
  const statusSummary = item.isPaid
    ? (item.paidAt ? t('items.paidAt', { date: fmtDate(item.paidAt) }) : t('items.paid'))
    : t('items.notPaidYet')

  const totalAnticipatedThisMonth = hasSplits
    ? item.cardSplits!.reduce((sum, split) => sum + (split.anticipatedThisMonth || 0), 0)
    : (item.anticipatedThisMonth || 0)
  const statusBadges = [
    totalAnticipatedThisMonth > 0 ? t('items.anticipatedInstallments', { count: totalAnticipatedThisMonth }) : '',
    !item.isActive ? t('common.disabled') : ''
  ].filter(Boolean)
  const tooltipRows: TooltipRow[] = [
    gastosFields.type ? { icon: Layers, label: t('tileFields.type'), value: typeText } : null,
    gastosFields.billingDay && billingDayText ? { icon: CalendarClock, label: t('items.billingDayLabel'), value: billingDayText } : null,
    gastosFields.dueDay && dueDayText ? { icon: CalendarDays, label: t('items.dueDayLabel'), value: dueDayText } : null,
    gastosFields.store && item.storeName ? { icon: Store, label: t('tileFields.store'), value: item.storeName } : null,
    gastosFields.interestRate && item.interestRate && item.interestRate > 0 ? { icon: Percent, label: t('tileFields.interestRate'), value: `${item.interestRate}%` } : null,
    gastosFields.baseValue && item.type === 'emprestimo' && item.baseValue && item.baseValue > 0 ? { icon: DollarSign, label: t('items.baseValue', { value: '' }).replace(': ', '').trim(), value: fmtVal(item.baseValue) } : null,
    gastosFields.summary && statusBadges.length > 0 ? { icon: Bookmark, label: t('items.summaryLabel'), value: statusBadges.join(', ') } : null,
    gastosFields.status ? { icon: CheckCircle, label: t('itemsForm.status'), value: statusSummary } : null,
    gastosFields.interruptions ? { icon: PauseCircle, label: t('items.interruptions'), value: interruptionSummary } : null,
    gastosFields.tags ? { icon: Tags, label: t('itemsForm.tags'), value: tagsSummary } : null
  ].filter(Boolean) as TooltipRow[]

  const togglePaid = (event: MouseEvent) => {
    stop(event)
    if (activeInterruption) return
    onTogglePaid(item.id)
  }

  const openEdit = (event: MouseEvent) => {
    stop(event)
    onEdit(item)
  }

  const openInfo = (target: HTMLElement) => {
    setTooltipPosition(getTooltipPosition(target))
    setInfoOpen(true)
  }

  const toggleInfo = (event: MouseEvent<HTMLButtonElement>) => {
    stop(event)
    setTooltipPosition(getTooltipPosition(event.currentTarget))
    setInfoOpen(value => !value)
  }

  const toggleExpanded = () => {
    setExpanded(value => {
      const next = !value
      if (next) announceExpandedTile(tileInstanceId)
      return next
    })
  }

  useEffect(() => {
    const closeOtherExpandedTiles = (event: Event) => {
      const selectedKey = (event as CustomEvent<string>).detail
      if (selectedKey !== tileInstanceId) setExpanded(false)
    }
    window.addEventListener(TILE_EXPAND_EVENT, closeOtherExpandedTiles)
    return () => window.removeEventListener(TILE_EXPAND_EVENT, closeOtherExpandedTiles)
  }, [tileInstanceId])

  const renderValue = (value: number) => (
    isForeign ? (
      <CurrencyTooltip label={fmtBase(value)}>
        <span className="text-lg font-bold leading-tight tabular-nums sm:text-xl" style={gastosStyle(styleScope, 'itens')}>
          {fmtVal(value)}
        </span>
      </CurrencyTooltip>
    ) : (
      <span className="text-lg font-bold leading-tight tabular-nums sm:text-xl" style={gastosStyle(styleScope, 'itens')}>
        {fmtVal(value)}
      </span>
    )
  )
  const cardDimClass = !infoOpen && activeInterruption && !expanded
    ? 'opacity-50 hover:opacity-100'
    : !infoOpen && !item.isActive && dimPaid
      ? 'opacity-60 hover:opacity-100'
      : !infoOpen && item.isPaid && dimPaid
        ? 'opacity-60 hover:opacity-100'
        : 'hover:shadow-md'

  return (
    <>
    {expanded && (
      <div
        aria-hidden="true"
        className="tile-card-backdrop fixed inset-0 z-40 bg-black/60 backdrop-blur-[1px]"
        onClick={() => setExpanded(false)}
      />
    )}
    <Card
      tabIndex={0}
      onClick={toggleExpanded}
      onKeyDown={event => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault()
          toggleExpanded()
        }
        if (event.key === 'Escape') {
          setExpanded(false)
        }
      }}
      className={`group relative overflow-visible cursor-pointer transition-all duration-200 ease-out ${expanded ? 'z-50 rounded-b-none border-b-0 shadow-2xl' : ''} ${cardDimClass} focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring`}
    >
      {!item.isActive && (
        <div className="absolute inset-0 z-[1] pointer-events-none select-none rounded-lg" style={{ backgroundImage: 'repeating-linear-gradient(135deg, transparent, transparent 8px, hsl(var(--muted)) 8px, hsl(var(--muted)) 9px)', opacity: 0.3 }} />
      )}

      <div className="relative z-20 flex items-center gap-3 px-3 py-3 sm:px-4">
        <button
          type="button"
          onClick={togglePaid}
          disabled={!!activeInterruption}
          className={`mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full transition-colors ${activeInterruption ? 'cursor-not-allowed opacity-60' : 'hover:bg-accent'}`}
          title={activeInterruption ? t('items.interrupted') : item.isPaid ? t('items.markUnpaid') : t('items.markPaid')}
        >
          {item.isPaid
            ? <CheckCircle size={24} className="text-primary" />
            : <Circle size={24} className="text-muted-foreground/60 group-hover:text-primary" />}
        </button>

        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h3 className="truncate text-lg font-bold leading-tight text-foreground sm:text-xl">
                {item.description}
              </h3>
              <p className="mt-1 truncate text-sm text-muted-foreground">
                {categoryLabel}
              </p>
            </div>

            <div className="flex shrink-0 items-start gap-3 text-right">
              <div>
                <div className="leading-none">{renderValue(monthValue)}</div>
                <p className="mt-1 text-sm text-muted-foreground">
                  {isInstallment ? t('items.ofTotal', { value: fmtVal(adjustedInstallmentTotal) }) : t('items.total')}
                </p>
              </div>
              <div className="flex flex-col items-center gap-1 border-l border-border pl-2">
                <span className="relative">
                  <button
                    type="button"
                    onMouseEnter={event => openInfo(event.currentTarget)}
                    onMouseLeave={() => setInfoOpen(false)}
                    onFocus={event => openInfo(event.currentTarget)}
                    onBlur={() => setInfoOpen(false)}
                    onClick={toggleInfo}
                    className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                    title={t('items.cardInfo')}
                  >
                    <Info size={16} />
                  </button>
                  {infoOpen && tooltipPosition && typeof document !== 'undefined' && createPortal(
                    <div onClick={stop} className="tile-card-tooltip fixed max-h-[calc(100vh-1.5rem)] w-[28rem] overflow-y-auto rounded-lg border border-border p-3 text-left text-xs text-card-foreground opacity-100" style={tooltipPosition}>
                      <p className="font-semibold text-foreground">{t('items.cardInfo')}</p>
                      <dl className="mt-2 space-y-1.5">
                        {tooltipRows.map(row => (
                          <div key={row.label} className="grid grid-cols-[16px_minmax(0,1fr)] gap-2">
                            <row.icon size={14} className="mt-0.5 text-muted-foreground" />
                            <div className="min-w-0">
                              <dt className="text-muted-foreground">{row.label}:</dt>
                              <dd className="min-w-0 whitespace-normal break-words text-foreground leading-snug">{row.value}</dd>
                            </div>
                          </div>
                        ))}
                      </dl>
                    </div>,
                    document.body
                  )}
                </span>
                <button
                  type="button"
                  onClick={openEdit}
                  className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                  title={t('common.edit')}
                >
                  <Settings size={16} />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {expanded && (
      <div className="tile-card-panel absolute -left-px -right-px top-full z-10 -mt-px rounded-b-lg border border-t-0 border-border px-4 pb-4 pt-3 shadow-2xl" onClick={stop}>
        <div className="overflow-hidden rounded-lg border border-border/70 bg-background/20">
          {cardRows.length === 0 ? (
            <div className="flex items-center gap-2 px-3 py-3 text-sm text-muted-foreground">
              <CreditCard size={14} className="shrink-0 opacity-70" />
              {t('items.noLinkedCard')}
            </div>
          ) : (
            cardRows.map((card, index) => (
              <div key={`${card.name}-${index}`} className="border-b border-border/60 px-3 py-3 last:border-b-0">
                <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-start">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                      <p className="truncate text-sm font-semibold">{card.name}</p>
                      {card.detail && <p className="text-xs text-muted-foreground">{card.detail}</p>}
                    </div>
                  </div>
                  {card.amount && <p className="text-sm font-bold tabular-nums text-foreground sm:text-right">{card.amount}</p>}
                </div>
                {card.paidProgress != null && (
                  <div className="mt-3 h-2 overflow-hidden rounded-full bg-muted">
                    <div className="flex h-full">
                      {(card.paidProgress || 0) > 0 && (
                        <div className="h-full bg-green-500 transition-all" style={{ width: `${card.paidProgress}%` }} />
                      )}
                      {(card.currentProgress || 0) > 0 && (
                        <div className="h-full bg-yellow-500 transition-all" style={{ width: `${card.currentProgress}%` }} />
                      )}
                      {(card.overdueProgress || 0) > 0 && (
                        <div className="h-full bg-red-500 transition-all" style={{ width: `${card.overdueProgress}%` }} />
                      )}
                    </div>
                  </div>
                )}
              </div>
            ))
          )}
          </div>
      </div>
      )}
    </Card>
    </>
  )
}
