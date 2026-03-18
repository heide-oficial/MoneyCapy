import { useState, useEffect, useRef, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { Layers, Repeat, Landmark, CircleDot, CreditCard, Calendar, Store, Building2 } from 'lucide-react'
import { Modal } from '../../../components/ui/Modal'
import { formatCurrency } from '../../../lib/currency'
import { formatCardLabel } from '../../../lib/card-utils'
import { useColorSettings } from '../../../contexts/ColorSettingsContext'
import { useTranslation, useLocaleArray } from '../../../contexts/LanguageContext'
import type { PeriodDetailResult, PeriodDetailItem, PeriodDetailIncome, ValueRange } from '../../../../../../shared/insights-types'

interface PeriodDetailModalProps {
  open: boolean
  onClose: () => void
  personId: number
  startDate: string
  endDate: string
  periodLabel: string
  categoryId?: number | null
  tagId?: number | null
  filterType: 'expenses' | 'income' | 'both'
}

function getTypeLabels(t: (key: string) => string): Record<string, string> {
  return {
    common: t('insights.typeUnique'),
    installment: t('insights.typeInstallment'),
    subscription: t('insights.typeRecurring'),
    emprestimo: t('insights.typeLoan')
  }
}

const TYPE_ICONS: Record<string, any> = {
  common: CircleDot,
  installment: Layers,
  subscription: Repeat,
  emprestimo: Landmark
}

function fmtMonthShort(m: string, monthLabels: string[]): string {
  const [y, mo] = m.split('-')
  return `${monthLabels[parseInt(mo) - 1]}/${y}`
}

function ValueHistoryBlock({ ranges, t, monthLabels }: { ranges: ValueRange[]; t: (key: string) => string; monthLabels: string[] }) {
  if (ranges.length <= 1) return null
  return (
    <div className="space-y-0.5">
      <p className="text-[11px] font-medium text-muted-foreground">{t('insights.valueHistory')}</p>
      {ranges.map((r, i) => (
        <p key={i} className="text-[11px] text-muted-foreground">
          {fmtMonthShort(r.startMonth, monthLabels)}
          {r.startMonth !== r.endMonth && ` — ${fmtMonthShort(r.endMonth, monthLabels)}`}
          {' = '}{formatCurrency(r.value)}
        </p>
      ))}
    </div>
  )
}

/** Tooltip that follows the mouse cursor */
function MouseTooltip({ mouseX, mouseY, children }: { mouseX: number; mouseY: number; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null)
  const [adjust, setAdjust] = useState<{ above: boolean; shiftLeft: number }>({ above: false, shiftLeft: 0 })

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const h = el.offsetHeight
    const w = el.offsetWidth
    const above = mouseY + h + 16 > window.innerHeight && mouseY - h - 16 > 0
    const shiftLeft = Math.max(0, mouseX + w + 8 - window.innerWidth)
    setAdjust({ above, shiftLeft })
  }, [mouseX, mouseY])

  return createPortal(
    <div
      ref={ref}
      className="fixed z-[100] rounded-lg border border-border bg-muted p-3 shadow-2xl text-xs space-y-2 pointer-events-none max-w-xs"
      style={{
        left: mouseX + 12 - adjust.shiftLeft,
        top: adjust.above ? mouseY - (ref.current?.offsetHeight || 0) - 12 : mouseY + 16,
      }}
    >
      {children}
    </div>,
    document.body
  )
}

function ItemPopoverContent({ item }: { item: PeriodDetailItem }) {
  const { t } = useTranslation()
  const monthLabels = useLocaleArray('months.short')
  const isInstallment = item.type === 'installment' || item.type === 'emprestimo'
  const isSubscription = item.type === 'subscription'

  return (
    <>
      {/* Months present */}
      <div className="flex items-center gap-1.5 text-muted-foreground">
        <Calendar size={11} className="shrink-0" />
        <span>{item.allMonths.length} {item.allMonths.length === 1 ? t('insights.monthSingular') : t('insights.monthPlural')}: {fmtMonthShort(item.firstMonth, monthLabels)}{item.firstMonth !== item.lastMonth ? ` — ${fmtMonthShort(item.lastMonth, monthLabels)}` : ''}</span>
      </div>

      {/* Installment details -- single card (no splits) */}
      {isInstallment && item.totalInstallments && item.cardSplits.length === 0 && (
        <div className="space-y-0.5">
          <p className="text-muted-foreground">
            {item.cardName && (
              <span className="inline-flex items-center gap-1 mr-1.5">
                <CreditCard size={11} />
                {formatCardLabel(item.cardName, item.cardType, item.paymentMethod)}:
              </span>
            )}
            {t('insights.installmentOf', { count: item.totalInstallments, value: formatCurrency(item.baseValue / item.totalInstallments) })}
          </p>
          {item.anticipations.length > 0 && (
            <div>
              <p className="text-[11px] font-medium text-muted-foreground">{t('insights.anticipations')}</p>
              {item.anticipations.map((a, i) => (
                <p key={i} className="text-[11px] text-muted-foreground">
                  {fmtMonthShort(a.month, monthLabels)}: +{a.count} {a.count === 1 ? t('insights.installmentSingular') : t('insights.installmentPlural')}
                </p>
              ))}
              <p className="text-[11px] text-amber-500 mt-0.5">
                {t('insights.totalAnticipated')} {formatCurrency(item.totalAnticipatedValue)}
              </p>
            </div>
          )}
        </div>
      )}

      {/* Installment details -- multiple cards (splits) */}
      {isInstallment && item.cardSplits.length > 0 && (
        <div className="space-y-1">
          {item.cardSplits.map(sp => (
            <div key={sp.splitId} className="text-[11px] text-muted-foreground">
              <p className="flex items-center gap-1">
                <CreditCard size={11} className="shrink-0" />
                <span>{formatCardLabel(sp.cardName, sp.cardType || 'credit')}: {t('insights.installmentOf', { count: sp.totalInstallments, value: formatCurrency(sp.splitValue / sp.totalInstallments) })}</span>
              </p>
              {sp.anticipations.length > 0 && (
                <p className="text-amber-500 ml-4">
                  {t('insights.anticipated')} {formatCurrency(sp.totalAnticipatedValue)}
                </p>
              )}
            </div>
          ))}
          {item.anticipations.length > 0 && (
            <p className="text-[11px] text-amber-500 mt-0.5">
              {t('insights.totalAnticipated')} {formatCurrency(item.totalAnticipatedValue)}
            </p>
          )}
        </div>
      )}

      {/* Subscription value history */}
      {isSubscription && <ValueHistoryBlock ranges={item.valueHistory} t={t} monthLabels={monthLabels} />}

      {/* Simple items: just show value per month */}
      {!isInstallment && !isSubscription && item.allMonths.length === 1 && (
        <p className="text-muted-foreground">{t('insights.value')} {formatCurrency(item.effectiveValue)}</p>
      )}
    </>
  )
}

function IncomePopoverContent({ income }: { income: PeriodDetailIncome }) {
  const { t } = useTranslation()
  const monthLabels = useLocaleArray('months.short')
  return (
    <>
      <div className="flex items-center gap-1.5 text-muted-foreground">
        <Calendar size={11} className="shrink-0" />
        <span>{income.allMonths.length} {income.allMonths.length === 1 ? t('insights.monthSingular') : t('insights.monthPlural')}: {fmtMonthShort(income.firstMonth, monthLabels)}{income.firstMonth !== income.lastMonth ? ` — ${fmtMonthShort(income.lastMonth, monthLabels)}` : ''}</span>
      </div>
      {income.isRecurring && <ValueHistoryBlock ranges={income.valueHistory} t={t} monthLabels={monthLabels} />}
      {!income.isRecurring && (
        <p className="text-muted-foreground">{t('insights.value')} {formatCurrency(income.effectiveValue)}</p>
      )}
    </>
  )
}

function ExpenseRow({ item }: { item: PeriodDetailItem }) {
  const [hovered, setHovered] = useState(false)
  const [mouse, setMouse] = useState({ x: 0, y: 0 })
  const { gastosStyle } = useColorSettings()
  const { t } = useTranslation()
  const typeLabels = getTypeLabels(t)
  const TypeIcon = TYPE_ICONS[item.type] || CircleDot
  const isInstallment = item.type === 'installment' || item.type === 'emprestimo'

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onMouseMove={e => setMouse({ x: e.clientX, y: e.clientY })}
    >
      <div className="py-2.5 px-3 rounded-lg border border-border/60 bg-card hover:bg-accent/20 transition-colors cursor-default">
        {/* First line: description + category + value */}
        <div className="flex items-center gap-2">
          {item.categoryColor && (
            <span className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: item.categoryColor }} />
          )}
          <span className="text-sm truncate min-w-0">{item.description}</span>
          {item.categoryName && (
            <span className="text-[10px] text-muted-foreground whitespace-nowrap shrink-0">{item.categoryName}</span>
          )}
          {item.tags.slice(0, 2).map(tag => (
            <span
              key={tag.id}
              className="text-[10px] px-1.5 py-0.5 rounded-full font-medium whitespace-nowrap shrink-0"
              style={{ backgroundColor: `${tag.color}20`, color: tag.color }}
            >
              {tag.name}
            </span>
          ))}
          <span className="text-sm font-semibold tabular-nums shrink-0 ml-auto" style={gastosStyle('tags', 'itens')}>
            {formatCurrency(item.effectiveValue)}
          </span>
        </div>
        {/* Second line: metadata */}
        <div className="flex items-center gap-2.5 mt-1 ml-4 flex-wrap">
          <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground">
            <TypeIcon size={10} />
            {typeLabels[item.type]}
            {isInstallment && item.cardSplits.length > 0
              ? <> {item.cardSplits.map(sp => `${sp.totalInstallments}x`).join(` ${t('insights.andConjunction')} `)}</>
              : isInstallment && item.totalInstallments
                ? <> {item.totalInstallments}x</>
                : null
            }
          </span>
          {item.store && (
            <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground">
              <Store size={9} />
              {item.store}
            </span>
          )}
          {item.cardSplits.length > 0 ? (
            item.cardSplits.map((sp, i) => sp.cardName && (
              <span key={i} className="inline-flex items-center gap-1 text-[10px] text-muted-foreground">
                <CreditCard size={9} />
                {formatCardLabel(sp.cardName, sp.cardType || 'credit')}
              </span>
            ))
          ) : item.cardName ? (
            <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground">
              <CreditCard size={9} />
              {formatCardLabel(item.cardName, item.cardType, item.paymentMethod)}
            </span>
          ) : null}
          {item.bankAccountName && (
            <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground">
              <Building2 size={9} />
              {item.bankAccountName}
            </span>
          )}
        </div>
      </div>
      {hovered && (
        <MouseTooltip mouseX={mouse.x} mouseY={mouse.y}>
          <ItemPopoverContent item={item} />
        </MouseTooltip>
      )}
    </div>
  )
}

function IncomeRow({ income }: { income: PeriodDetailIncome }) {
  const [hovered, setHovered] = useState(false)
  const [mouse, setMouse] = useState({ x: 0, y: 0 })
  const { receitasStyle } = useColorSettings()
  const { t } = useTranslation()

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onMouseMove={e => setMouse({ x: e.clientX, y: e.clientY })}
    >
      <div className="py-2.5 px-3 rounded-lg border border-border/60 bg-card hover:bg-accent/20 transition-colors cursor-default">
        <div className="flex items-center gap-2">
          {income.categoryColor && (
            <span className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: income.categoryColor }} />
          )}
          <span className="text-sm truncate min-w-0">{income.description}</span>
          {income.categoryName && (
            <span className="text-[10px] text-muted-foreground whitespace-nowrap shrink-0">{income.categoryName}</span>
          )}
          {income.tags.slice(0, 2).map(tag => (
            <span
              key={tag.id}
              className="text-[10px] px-1.5 py-0.5 rounded-full font-medium whitespace-nowrap shrink-0"
              style={{ backgroundColor: `${tag.color}20`, color: tag.color }}
            >
              {tag.name}
            </span>
          ))}
          <span className="text-sm font-semibold tabular-nums shrink-0 ml-auto" style={receitasStyle('tags', 'itens')}>
            {formatCurrency(income.effectiveValue)}
          </span>
        </div>
        <div className="flex items-center gap-2.5 mt-1 ml-4">
          {income.isRecurring && (
            <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground">
              <Repeat size={10} /> {t('insights.recurringLabel')}
            </span>
          )}
        </div>
      </div>
      {hovered && (
        <MouseTooltip mouseX={mouse.x} mouseY={mouse.y}>
          <IncomePopoverContent income={income} />
        </MouseTooltip>
      )}
    </div>
  )
}

export function PeriodDetailModal({ open, onClose, personId, startDate, endDate, periodLabel, categoryId, tagId, filterType }: PeriodDetailModalProps) {
  const [data, setData] = useState<PeriodDetailResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [activeTab, setActiveTab] = useState<'expenses' | 'income'>('expenses')
  const { gastosStyle, receitasStyle } = useColorSettings()
  const { t } = useTranslation()

  useEffect(() => {
    if (!open) return
    setLoading(true)
    setData(null)
    setActiveTab(filterType === 'income' ? 'income' : 'expenses')
    window.api.insights.periodDetail(personId, startDate, endDate, categoryId, tagId, filterType).then(result => {
      setData(result)
      setLoading(false)
    })
  }, [open, personId, startDate, endDate, categoryId, tagId, filterType])

  const showTabs = filterType === 'both'
  const items = data?.items || []
  const incomes = data?.incomes || []

  return (
    <Modal open={open} onClose={onClose} title={periodLabel} maxWidth="max-w-2xl">
      {loading ? (
        <div className="text-center py-8 text-muted-foreground text-sm">{t('common.loading')}</div>
      ) : data ? (
        <div className="space-y-3">
          {/* Totals */}
          <div className="flex items-center gap-4 text-sm">
            {(filterType === 'expenses' || filterType === 'both') && (
              <span className="font-medium" style={gastosStyle('tags', 'itens')}>
                {t('insights.expensesLabel')}: {formatCurrency(data.totalExpenses)}
              </span>
            )}
            {(filterType === 'income' || filterType === 'both') && (
              <span className="font-medium" style={receitasStyle('tags', 'itens')}>
                {t('insights.incomeLabel')}: {formatCurrency(data.totalIncome)}
              </span>
            )}
          </div>

          {/* Tabs for balance */}
          {showTabs && (
            <div className="flex gap-1 border-b border-border">
              <button
                type="button"
                onClick={() => setActiveTab('expenses')}
                className={`px-3 py-1.5 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === 'expenses' ? 'border-current' : 'border-transparent text-muted-foreground hover:text-foreground'
                }`}
                style={activeTab === 'expenses' ? gastosStyle('tags', 'itens') : undefined}
              >
                {t('insights.expensesLabel')} ({items.length})
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('income')}
                className={`px-3 py-1.5 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === 'income' ? 'border-current' : 'border-transparent text-muted-foreground hover:text-foreground'
                }`}
                style={activeTab === 'income' ? receitasStyle('tags', 'itens') : undefined}
              >
                {t('insights.incomeLabel')} ({incomes.length})
              </button>
            </div>
          )}

          {/* Item list */}
          <div className="max-h-[50vh] overflow-y-auto -mx-1 px-1">
            {(activeTab === 'expenses' || !showTabs && filterType === 'expenses') && (
              items.length === 0 ? (
                <p className="text-xs text-muted-foreground py-6 text-center">{t('insights.noExpensesFound')}</p>
              ) : (
                <div className="space-y-2">
                  {items.map(item => <ExpenseRow key={item.id} item={item} />)}
                </div>
              )
            )}
            {(activeTab === 'income' || !showTabs && filterType === 'income') && (
              incomes.length === 0 ? (
                <p className="text-xs text-muted-foreground py-6 text-center">{t('insights.noIncomeFound')}</p>
              ) : (
                <div className="space-y-2">
                  {incomes.map(income => <IncomeRow key={income.id} income={income} />)}
                </div>
              )
            )}
          </div>
        </div>
      ) : null}
    </Modal>
  )
}
