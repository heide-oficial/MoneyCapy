import { useEffect, useId, useState, type CSSProperties, type MouseEvent } from 'react'
import { createPortal } from 'react-dom'
import { formatCurrency, formatCurrencyWith } from '../../lib/currency'
import { useFormatDate } from '../../lib/date'
import { formatCardLabel, getTypeLabels } from '../../lib/card-utils'
import { formatDayLabelResolved } from '../../../../../shared/day-utils'
import { useBusinessDayConfig } from '../../contexts/BusinessDayContext'
import { useDimPaid } from '../../contexts/DimPaidContext'
import { useTileFields } from '../../contexts/TileFieldsContext'
import { useTranslation } from '../../contexts/LanguageContext'
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
  progress?: number
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
  const tooltipWidth = 352
  const estimatedTooltipHeight = 270
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
  const tileInstanceId = useId()
  const [expanded, setExpanded] = useState(false)
  const [infoOpen, setInfoOpen] = useState(false)
  const [tooltipPosition, setTooltipPosition] = useState<TooltipPosition | null>(null)
  const [mYear, mMonth] = month.split('-').map(Number)

  const hasSplits = item.cardSplits && item.cardSplits.length > 0
  const isForeign = !!(item.currencySymbol && item.exchangeRateSnapshot && item.exchangeRateSnapshot !== 1.0)
  const sym = item.currencySymbol || ''
  const snap = item.exchangeRateSnapshot || 1.0
  const fmtVal = (value: number) => isForeign ? formatCurrencyWith(value, sym) : formatCurrency(value)
  const fmtBase = (value: number) => formatCurrency(value * snap)
  const isInstallment = Boolean((item.type === 'installment' || item.type === 'emprestimo') && item.totalInstallments && item.currentInstallment)

  let monthValue: number
  if (hasSplits) {
    monthValue = item.cardSplits!.reduce((acc, split) => {
      const monthly = Math.round((split.value / split.totalInstallments) * 100) / 100
      if ((split.anticipatedThisMonth || 0) > 0 && split.discountedTotalThisMonth != null) {
        return acc + monthly + split.discountedTotalThisMonth
      }
      return acc + monthly * (1 + (split.anticipatedThisMonth || 0))
    }, 0)
  } else if (isInstallment && item.totalInstallments) {
    const monthly = Math.round((item.value / item.totalInstallments) * 100) / 100
    if ((item.anticipatedThisMonth || 0) > 0 && item.discountedTotalThisMonth != null) {
      monthValue = monthly + item.discountedTotalThisMonth
    } else if ((item.anticipatedThisMonth || 0) > 0) {
      monthValue = monthly * (1 + item.anticipatedThisMonth)
    } else {
      monthValue = monthly
    }
  } else {
    monthValue = item.type === 'subscription' ? (item.effectiveValue ?? item.value) : item.value
  }

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

  const cardRows: CardDetailRow[] = []
  if (isInstallment) {
    if (hasSplits && item.type !== 'emprestimo') {
      for (const split of item.cardSplits!) {
        const current = split.currentInstallment || Math.min(item.currentInstallment!, split.totalInstallments)
        const splitLabel = split.cardName ? formatCardLabel(split.cardName, split.cardType, split.paymentMethod, cardTypeLabels) : t('items.cardFallback', { id: String(split.cardId) })
        const anticipated = split.anticipatedThisMonth || 0
        cardRows.push({
          name: splitLabel,
          detail: `${current}/${split.totalInstallments} ${t('items.installments').toLowerCase()}${anticipated > 0 ? ` (+${anticipated})` : ''}`,
          amount: `${fmtVal(split.value / split.totalInstallments)}${t('itemsForm.perMonth')}`,
          progress: Math.min((current / split.totalInstallments) * 100, 100)
        })
      }
    } else {
      cardRows.push({
        name: item.type === 'emprestimo' ? t('items.installments') : (item.cardName ? formatCardLabel(item.cardName, item.cardType, item.paymentMethod, cardTypeLabels) : t('items.installments')),
        detail: `${item.currentInstallment!}/${item.totalInstallments!} ${t('items.installments').toLowerCase()}${(item.anticipatedThisMonth || 0) > 0 ? ` (+${item.anticipatedThisMonth})` : ''}`,
        amount: `${fmtVal(item.value / item.totalInstallments!)}${t('itemsForm.perMonth')}`,
        progress: Math.min((item.currentInstallment! / item.totalInstallments!) * 100, 100)
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
    { icon: Layers, label: t('tileFields.type'), value: typeText },
    billingDayText ? { icon: CalendarClock, label: t('items.billingDayLabel'), value: billingDayText } : null,
    dueDayText ? { icon: CalendarDays, label: t('items.dueDayLabel'), value: dueDayText } : null,
    item.storeName ? { icon: Store, label: t('tileFields.store'), value: item.storeName } : null,
    item.interestRate && item.interestRate > 0 ? { icon: Percent, label: t('tileFields.interestRate'), value: `${item.interestRate}%` } : null,
    item.type === 'emprestimo' && item.baseValue && item.baseValue > 0 ? { icon: DollarSign, label: t('items.baseValue', { value: '' }).replace(': ', '').trim(), value: fmtVal(item.baseValue) } : null,
    statusBadges.length > 0 ? { icon: Bookmark, label: t('items.summaryLabel'), value: statusBadges.join(', ') } : null,
    { icon: CheckCircle, label: t('itemsForm.status'), value: statusSummary },
    { icon: PauseCircle, label: t('items.interruptions'), value: interruptionSummary },
    { icon: Tags, label: t('itemsForm.tags'), value: tagsSummary }
  ].filter(Boolean) as TooltipRow[]

  const togglePaid = (event: MouseEvent) => {
    stop(event)
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
          className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full transition-colors hover:bg-accent"
          title={item.isPaid ? t('items.markUnpaid') : t('items.markPaid')}
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
                  {isInstallment ? t('items.ofTotal', { value: fmtVal(item.value) }) : t('items.total')}
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
                    <div onClick={stop} className="tile-card-tooltip fixed z-[9999] max-h-[calc(100vh-1.5rem)] w-[22rem] overflow-y-auto rounded-lg border border-border p-3 text-left text-xs text-card-foreground opacity-100" style={tooltipPosition}>
                      <p className="font-semibold text-foreground">{t('items.cardInfo')}</p>
                      <dl className="mt-2 space-y-1.5">
                        {tooltipRows.map(row => (
                          <div key={row.label} className="grid grid-cols-[16px_104px_minmax(0,1fr)] gap-2">
                            <row.icon size={14} className="mt-0.5 text-muted-foreground" />
                            <dt className="text-muted-foreground">{row.label}:</dt>
                            <dd className="min-w-0 text-foreground">{row.value}</dd>
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
                {card.progress != null && (
                  <div className="mt-3 h-2 rounded-full bg-muted">
                    <div className={`h-full rounded-full ${card.progress >= 100 ? 'bg-green-500' : 'bg-primary'}`} style={{ width: `${card.progress}%` }} />
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
