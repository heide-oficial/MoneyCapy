import { useState, type CSSProperties, type MouseEvent } from 'react'
import { formatCurrency, formatCurrencyWith } from '../../lib/currency'
import { useFormatDate } from '../../lib/date'
import { formatDayLabelResolved } from '../../../../../shared/day-utils'
import { useBusinessDayConfig } from '../../contexts/BusinessDayContext'
import { useDimPaid } from '../../contexts/DimPaidContext'
import { useTileFields } from '../../contexts/TileFieldsContext'
import { useTranslation } from '../../contexts/LanguageContext'
import {
  CalendarClock, CheckCircle, Circle, CircleDot, CreditCard,
  Info, Repeat, Settings, Store
} from 'lucide-react'
import { Card } from '../../components/ui/Card'
import { CurrencyTooltip } from '../../components/ui/CurrencyTooltip'
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

interface ChipItem {
  icon: any
  text: string
}

function previousMonth(month: string) {
  const [year, monthNumber] = month.split('-').map(Number)
  const date = new Date(year, monthNumber - 2, 1)
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
}

function stop(event: MouseEvent) {
  event.stopPropagation()
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
  const [infoOpen, setInfoOpen] = useState(false)
  const [mYear, mMonth] = month.split('-').map(Number)

  const isForeign = !!(income.currencySymbol && income.exchangeRateSnapshot && income.exchangeRateSnapshot !== 1.0)
  const snap = income.exchangeRateSnapshot || 1.0
  const fmtVal = (value: number) => isForeign ? formatCurrencyWith(value, income.currencySymbol || '') : formatCurrency(value)
  const fmtBase = (value: number) => formatCurrency(value * snap)
  const categoryLabel = income.categoryName ? `${income.categoryName}${income.subcategoryName ? `/${income.subcategoryName}` : ''}` : t('items.noCategoryDefined')
  const typeText = income.isRecurring ? t('income.recurring') : t('income.nonRecurring')
  const typeIcon = income.isRecurring ? Repeat : CircleDot
  const receivingDayText = formatDayLabelResolved(income.dueDay ?? null, income.dueDayType || null, t('income.receivingDay'), mYear, mMonth, businessDayConfig)

  const chips: ChipItem[] = []
  if (receitasFields.type) chips.push({ icon: typeIcon, text: typeText })
  if (receitasFields.dueDay && receivingDayText) chips.push({ icon: CalendarClock, text: receivingDayText })
  if (income.storeName) chips.push({ icon: Store, text: income.storeName })

  const activeInterruption = income.interruptions?.find(interruption => {
    if (interruption.resumeMonth) return month >= interruption.endMonth && month < interruption.resumeMonth
    return month >= interruption.endMonth
  })
  const interruptionSummary = activeInterruption
    ? activeInterruption.resumeMonth
      ? t('items.interruptionRange', { start: fmtMonth(activeInterruption.endMonth), end: fmtMonth(previousMonth(activeInterruption.resumeMonth)) })
      : t('items.interruptedPermanentlySince', { start: fmtMonth(activeInterruption.endMonth) })
    : t('items.notInterrupted')

  const tagsSummary = income.tags && income.tags.length > 0 ? income.tags.map(tag => tag.name).join(', ') : t('items.noTags')
  const statusSummary = income.isReceived
    ? (income.receivedAt ? t('items.receivedAt', { date: fmtDate(income.receivedAt) }) : t('items.received'))
    : t('income.notReceivedYet')
  const tooltipItems = chips.map(chip => chip.text)

  const toggleReceived = (event: MouseEvent) => {
    stop(event)
    onToggleReceived(income.id)
  }

  const openEdit = (event: MouseEvent) => {
    stop(event)
    onEdit(income)
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

  return (
    <Card
      className={`group relative overflow-visible transition-all duration-200 ease-out ${income.isReceived && dimPaid ? 'opacity-60 hover:opacity-100' : 'hover:shadow-md'}`}
    >
      <div className="relative z-[2] flex items-center gap-3 px-3 py-3 sm:px-4">
        <button
          type="button"
          onClick={toggleReceived}
          className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full transition-colors hover:bg-accent"
          title={income.isReceived ? t('items.markNotReceived') : t('items.markReceived')}
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
          <div className="flex items-center gap-2 px-3 py-3 text-sm text-muted-foreground">
            <CreditCard size={14} className="shrink-0 opacity-70" />
            {t('items.noLinkedCard')}
          </div>
        </div>
      </div>
    </Card>
  )
}
