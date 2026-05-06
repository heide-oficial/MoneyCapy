import { useState, type CSSProperties, type MouseEvent } from 'react'
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
  CircleDot, Layers, Repeat, Landmark, CalendarClock, CreditCard,
  Store, DollarSign, Info, Settings
} from 'lucide-react'
import { Card } from '../../components/ui/Card'
import { CurrencyTooltip } from '../../components/ui/CurrencyTooltip'
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

interface ChipItem {
  icon: any
  text: string
}

interface CardDetailRow {
  name: string
  detail?: string
  amount?: string
  progress?: number
}

function previousMonth(month: string) {
  const [year, monthNumber] = month.split('-').map(Number)
  const date = new Date(year, monthNumber - 2, 1)
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
}

function stop(event: MouseEvent) {
  event.stopPropagation()
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
  const [infoOpen, setInfoOpen] = useState(false)
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

  const typeIcon = item.type === 'emprestimo' ? Landmark : item.type === 'installment' ? Layers : item.type === 'subscription' ? Repeat : CircleDot
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

  const chips: ChipItem[] = []
  if (gastosFields.type) chips.push({ icon: typeIcon, text: typeText })
  if (gastosFields.billingDay && billingDayText) chips.push({ icon: CalendarClock, text: billingDayText })
  if (gastosFields.dueDay && dueDayText) chips.push({ icon: CalendarClock, text: dueDayText })
  if (gastosFields.store && item.storeName) chips.push({ icon: Store, text: item.storeName })
  if (gastosFields.interestRate && item.interestRate && item.interestRate > 0) chips.push({ icon: Landmark, text: t('items.interestRate', { rate: item.interestRate }) })
  if (item.type === 'emprestimo' && item.baseValue && item.baseValue > 0) chips.push({ icon: DollarSign, text: t('items.baseValue', { value: fmtVal(item.baseValue) }) })

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

  const activeInterruption = item.interruptions?.find(interruption => {
    if (interruption.resumeMonth) return month >= interruption.endMonth && month < interruption.resumeMonth
    return month >= interruption.endMonth
  })
  const interruptionSummary = activeInterruption
    ? activeInterruption.resumeMonth
      ? t('items.interruptionRange', { start: fmtMonth(activeInterruption.endMonth), end: fmtMonth(previousMonth(activeInterruption.resumeMonth)) })
      : t('items.interruptedPermanentlySince', { start: fmtMonth(activeInterruption.endMonth) })
    : t('items.notInterrupted')

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
  const tooltipItems = [
    ...chips.map(chip => chip.text),
    ...statusBadges
  ]

  const togglePaid = (event: MouseEvent) => {
    stop(event)
    onTogglePaid(item.id)
  }

  const openEdit = (event: MouseEvent) => {
    stop(event)
    onEdit(item)
  }

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

  return (
    <Card
      className={`group relative overflow-visible transition-all duration-200 ease-out ${!item.isActive && dimPaid ? 'opacity-60 hover:opacity-100' : ''} ${item.isPaid && dimPaid ? 'opacity-60 hover:opacity-100' : 'hover:shadow-md'}`}
    >
      {!item.isActive && (
        <div className="absolute inset-0 z-[1] pointer-events-none select-none rounded-lg" style={{ backgroundImage: 'repeating-linear-gradient(135deg, transparent, transparent 8px, hsl(var(--muted)) 8px, hsl(var(--muted)) 9px)', opacity: 0.3 }} />
      )}

      <div className="relative z-[2] flex items-center gap-3 px-3 py-3 sm:px-4">
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
                    onMouseEnter={() => setInfoOpen(true)}
                    onMouseLeave={() => setInfoOpen(false)}
                    onFocus={() => setInfoOpen(true)}
                    onBlur={() => setInfoOpen(false)}
                    onClick={event => {
                      stop(event)
                      setInfoOpen(value => !value)
                    }}
                    className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                    title={t('items.cardInfo')}
                  >
                    <Info size={16} />
                  </button>
                  {infoOpen && (
                    <div className="absolute right-0 top-full z-[100] mt-2 w-72 rounded-lg border border-border bg-card p-3 text-left text-xs text-card-foreground shadow-2xl" style={{ backgroundColor: 'hsl(var(--card))' }}>
                      <p className="font-semibold text-foreground">{t('items.cardInfo')}</p>
                      <div className="mt-2 space-y-1.5">
                        <p className="text-muted-foreground">{t('itemsForm.tags')}: <span className="text-foreground">{tagsSummary}</span></p>
                        <p className="text-muted-foreground">{t('itemsForm.status')}: <span className="text-foreground">{statusSummary}</span></p>
                        <p className="text-muted-foreground">{t('items.interruptions')}: <span className="text-foreground">{interruptionSummary}</span></p>
                      </div>
                      {tooltipItems.length > 0 && (
                        <div className="mt-3 border-t border-border/70 pt-2">
                          <div className="flex flex-wrap gap-1.5">
                            {tooltipItems.map(info => (
                              <span key={info} className="rounded-md border border-border/70 bg-muted/30 px-2 py-1 text-muted-foreground">
                                {info}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
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

      <div className="relative z-[2] border-t border-border/60 px-4 pb-4 pt-3">
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
    </Card>
  )
}
