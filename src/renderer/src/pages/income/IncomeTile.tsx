import { useState, type CSSProperties, type MouseEvent } from 'react'
import { createPortal } from 'react-dom'
import { formatCurrency, formatCurrencyWith } from '../../lib/currency'
import { useFormatDate } from '../../lib/date'
import { formatDayLabelResolved } from '../../../../../shared/day-utils'
import { useBusinessDayConfig } from '../../contexts/BusinessDayContext'
import { useDimPaid } from '../../contexts/DimPaidContext'
import { useTileFields } from '../../contexts/TileFieldsContext'
import { useTranslation } from '../../contexts/LanguageContext'
import { useDisplayCurrency } from '../../contexts/DisplayCurrencyContext'
import {
  CalendarClock, CheckCircle, Circle, Info, Layers, PauseCircle,
  Settings, Store, Tags, type LucideIcon
} from 'lucide-react'
import { Card } from '../../components/ui/Card'
import { CurrencyTooltip } from '../../components/ui/CurrencyTooltip'
import { formatInterruptionSummary, getActiveInterruption } from '../../lib/interruptions'
import type { IncomeRecord } from '../../types/entities'

interface IncomeTileProps {
  income: IncomeRecord
  month: string
  fieldsPage?: string
  styleScope?: string
  receitasStyle: (category: string, type: string) => CSSProperties
  onEdit: (income: IncomeRecord) => void
  onToggleReceived: (incomeId: number) => void
  onDelete: (incomeId: number) => void
  onEditValue: (income: IncomeRecord) => void
  onInterrupt: (income: IncomeRecord) => void
  onReactivate: (interruptionId: number) => void
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
  const estimatedTooltipHeight = 320
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

export function IncomeTile({
  income, month, fieldsPage = 'income', styleScope = 'income', receitasStyle,
  onEdit, onToggleReceived
}: IncomeTileProps) {
  const { t } = useTranslation()
  const { fmtDate, fmtMonth } = useFormatDate()
  const { businessDayConfig } = useBusinessDayConfig()
  const { dimPaid } = useDimPaid()
  const { receitasFields } = useTileFields(fieldsPage)
  const { displayCurrency } = useDisplayCurrency()
  const [infoOpen, setInfoOpen] = useState(false)
  const [tooltipPosition, setTooltipPosition] = useState<TooltipPosition | null>(null)
  const [mYear, mMonth] = month.split('-').map(Number)

  const isForeign = !!(income.currencySymbol && income.exchangeRateSnapshot && income.exchangeRateSnapshot !== 1.0)
  const snap = income.exchangeRateSnapshot || 1.0
  const fmtVal = (value: number) => displayCurrency && displayCurrency.exchangeRate > 0
    ? formatCurrencyWith((value * snap) / displayCurrency.exchangeRate, displayCurrency.symbol)
    : isForeign ? formatCurrencyWith(value, income.currencySymbol || '') : formatCurrency(value)
  const fmtBase = (value: number) => formatCurrency(value * snap)
  const categoryLabel = income.categoryName ? `${income.categoryName}${income.subcategoryName ? `/${income.subcategoryName}` : ''}` : t('items.noCategoryDefined')
  const typeText = income.isRecurring ? t('income.recurring') : t('income.single')
  const receivingDayLabel = income.isRecurring ? t('income.receivingDay') : t('income.receivedDay')
  const receivingDayText = formatDayLabelResolved(income.dueDay ?? null, income.dueDayType || null, receivingDayLabel, mYear, mMonth, businessDayConfig)

  const activeInterruption = getActiveInterruption(income.interruptions, month)
  const interruptionSummary = formatInterruptionSummary(activeInterruption, fmtMonth, t)

  const tagsSummary = income.tags && income.tags.length > 0 ? income.tags.map(tag => tag.name).join(', ') : t('items.noTags')
  const statusSummary = income.isReceived
    ? (income.receivedAt ? t('items.receivedAt', { date: fmtDate(income.receivedAt) }) : t('items.received'))
    : t('items.notReceived')
  const tooltipRows: TooltipRow[] = [
    receitasFields.type ? { icon: Layers, label: t('tileFields.type'), value: typeText } : null,
    receitasFields.dueDay && receivingDayText ? { icon: CalendarClock, label: receivingDayLabel, value: receivingDayText } : null,
    receitasFields.store && income.storeName ? { icon: Store, label: t('tileFields.store'), value: income.storeName } : null,
    (receitasFields.status || receitasFields.receivedDate) ? { icon: CheckCircle, label: t('itemsForm.status'), value: statusSummary } : null,
    receitasFields.interruptions ? { icon: PauseCircle, label: t('items.interruptions'), value: interruptionSummary } : null,
    receitasFields.tags ? { icon: Tags, label: t('itemsForm.tags'), value: tagsSummary } : null
  ].filter(Boolean) as TooltipRow[]

  const toggleReceived = (event: MouseEvent) => {
    stop(event)
    if (activeInterruption) return
    onToggleReceived(income.id)
  }

  const openEdit = (event: MouseEvent) => {
    stop(event)
    onEdit(income)
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

  const renderValue = () => (
    isForeign ? (
      <CurrencyTooltip label={fmtBase(income.effectiveValue)}>
        <span className="text-lg font-bold leading-tight tabular-nums sm:text-xl" style={receitasStyle(styleScope, 'itens')}>
          {fmtVal(income.effectiveValue)}
        </span>
      </CurrencyTooltip>
    ) : (
      <span className="text-lg font-bold leading-tight tabular-nums sm:text-xl" style={receitasStyle(styleScope, 'itens')}>
        {fmtVal(income.effectiveValue)}
      </span>
    )
  )
  const cardDimClass = !infoOpen && activeInterruption
    ? 'opacity-50 hover:opacity-100'
    : !infoOpen && income.isReceived && dimPaid
      ? 'opacity-60 hover:opacity-100'
      : 'hover:shadow-md'

  return (
    <Card
      className={`group relative overflow-visible transition-all duration-200 ease-out ${cardDimClass}`}
    >
      <div className="relative z-20 flex items-center gap-3 px-3 py-3 sm:px-4">
        <button
          type="button"
          onClick={toggleReceived}
          disabled={!!activeInterruption}
          className={`mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full transition-colors ${activeInterruption ? 'cursor-not-allowed opacity-60' : 'hover:bg-accent'}`}
          title={activeInterruption ? t('items.interrupted') : income.isReceived ? t('items.markNotReceived') : t('items.markReceived')}
        >
          {income.isReceived
            ? <CheckCircle size={24} className="text-primary" />
            : <Circle size={24} className="text-muted-foreground/60 group-hover:text-primary" />}
        </button>

        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h3 className="truncate text-lg font-bold leading-tight text-foreground sm:text-xl">
                {income.description}
              </h3>
              <p className="mt-1 truncate text-sm text-muted-foreground">
                {categoryLabel}
              </p>
            </div>

            <div className="flex shrink-0 items-start gap-3 text-right">
              <div>
                <div className="leading-none">{renderValue()}</div>
                <p className="mt-1 text-sm text-muted-foreground">{t('items.total')}</p>
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
    </Card>
  )
}
