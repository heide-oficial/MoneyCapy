import { useState, useCallback, useRef } from 'react'
import type { NavigateFunction } from 'react-router-dom'
import { Card } from '../../components/ui/Card'
import { formatCurrency } from '../../lib/currency'
import { getItemCardLabels } from '../../lib/card-utils'
import { getMonthLabel } from '../../lib/date'
import { ROUTES } from '../../lib/constants'
import { WidgetListCard, ListWidgetRow } from './components/WidgetListCard'
import type {
  DashboardWidgetsData,
  DashboardListItem,
  DashboardIncomeItem
} from '../../../../../shared/dashboard-types'
import {
  CreditCard, Wallet, ChevronRight, Landmark,
  CircleDot, Layers, Repeat, Receipt,
  CalendarClock, CircleAlert, TrendingUp, TrendingDown, AlertTriangle, BarChart3,
  HandCoins, Minus, CheckCircle2, Activity, PieChart, CalendarDays, CalendarMinus, CalendarPlus
} from 'lucide-react'

// ── Types ──

interface TypeTotal { type: string; label?: string; total: number }
interface CardSummary { id: number; name: string; totalLimit: number; usedLimit: number }
interface BankAccountSummary { id: number; name: string; balance: number; icon: string; color: string }

export interface Summary {
  typeTotals: TypeTotal[]; cardsTotal: number; cardSummaries: CardSummary[]
  incomeTotal: number; grandTotal: number; bankAccountsTotal: number; bankAccounts: BankAccountSummary[]
}

export type WidgetType =
  | { kind: 'expenses-total' } | { kind: 'income-total' } | { kind: 'balance-total' }
  | { kind: 'type-total'; type: string } | { kind: 'cards-total' } | { kind: 'card'; cardId: number }
  | { kind: 'bank-accounts-total' } | { kind: 'bank-account'; accountId: number }
  | { kind: 'upcoming-expenses' } | { kind: 'unpaid-items' } | { kind: 'top-expenses' }
  | { kind: 'pending-incomes' } | { kind: 'ending-installments' }
  | { kind: 'month-comparison' } | { kind: 'overdue-items' } | { kind: 'payment-summary' }
  | { kind: 'financial-health' } | { kind: 'type-distribution' }
  | { kind: 'current-month-summary' } | { kind: 'previous-month-summary' } | { kind: 'next-month-summary' }
  | { kind: 'overall-balance' }
  | { kind: 'balance-with-accounts' }
  | { kind: 'category-distribution' }
  | { kind: 'tag-distribution' }
  | { kind: 'income-type-distribution' }
  | { kind: 'income-category-distribution' }
  | { kind: 'upcoming-billing' }

export interface AvailableWidget {
  id: string
  type: WidgetType
  category: string
}

// ── Constants ──

export const TYPE_ICON_MAP: Record<string, any> = { common: CircleDot, installment: Layers, subscription: Repeat, emprestimo: Landmark }
export const TYPE_COLOR_MAP: Record<string, string> = { common: '#0ea5e9', installment: '#f59e0b', subscription: '#8b5cf6', emprestimo: '#ef4444' }
export const TYPE_TAB_MAP: Record<string, string> = { common: 'common', installment: 'installment', subscription: 'subscription', emprestimo: 'emprestimo' }

// ── Helpers ──

function groupSmallEntries(items: { name: string; color: string; total: number }[], total: number, othersLabel = 'Outros'): { name: string; color: string; total: number }[] {
  if (total <= 0) return items
  const main: typeof items = []
  let othersTotal = 0
  for (const entry of items) {
    const pct = (entry.total / total) * 100
    if (Math.round(pct) <= 1) {
      othersTotal += entry.total
    } else {
      main.push(entry)
    }
  }
  const othersPct = total > 0 ? Math.round((othersTotal / total) * 100) : 0
  if (othersTotal > 0 && othersPct > 0) {
    main.push({ name: othersLabel, color: '#6b7280', total: othersTotal })
  }
  return main
}

function DistributionBar({ segments, showMarginBottom, onSegmentClick }: { segments: { key: string; name: string; pct: number; color: string; total: number }[]; showMarginBottom: boolean; onSegmentClick?: (key: string) => void }) {
  const [hover, setHover] = useState<{ key: string; x: number; y: number } | null>(null)
  const barRef = useRef<HTMLDivElement>(null)

  const onMove = useCallback((e: React.MouseEvent, seg: typeof segments[0]) => {
    const rect = barRef.current?.getBoundingClientRect()
    if (!rect) return
    setHover({ key: seg.key, x: e.clientX - rect.left, y: e.clientY - rect.top })
  }, [])

  const activeSeg = hover ? segments.find(s => s.key === hover.key) : null

  return (
    <div ref={barRef} className={`relative ${showMarginBottom ? 'mb-3' : ''}`}>
      <div className="h-2.5 rounded-full bg-muted/50 overflow-hidden flex">
        {segments.map(seg => seg.pct === 0 ? null : (
          <div key={seg.key} className="h-full transition-all duration-300 first:rounded-l-full last:rounded-r-full"
            style={{ width: `${seg.pct}%`, backgroundColor: seg.color }} />
        ))}
      </div>
      <div className="absolute inset-0 flex">
        {segments.map(seg => seg.pct === 0 ? null : (
          <div key={seg.key} className="h-full cursor-pointer"
            style={{ width: `${seg.pct}%` }}
            onClick={() => onSegmentClick?.(seg.key)}
            onMouseMove={e => onMove(e, seg)}
            onMouseLeave={() => setHover(null)} />
        ))}
      </div>
      {activeSeg && hover && (
        <div className="absolute z-50 pointer-events-none"
          style={{ left: hover.x, top: hover.y - 8, transform: 'translate(-50%, -100%)' }}>
          <div className="text-xs rounded-lg shadow-lg border border-border px-3 py-2 whitespace-nowrap bg-zinc-900 text-zinc-100 dark:bg-zinc-800 dark:text-zinc-100">
            <div className="flex items-center gap-1.5">
              <div className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: activeSeg.color }} />
              <span className="font-semibold">{activeSeg.name}</span>
            </div>
            <div className="text-zinc-400 mt-0.5">{formatCurrency(activeSeg.total)} · {activeSeg.pct.toFixed(0)}%</div>
          </div>
        </div>
      )}
    </div>
  )
}

export function formatItemMeta(item: DashboardListItem, month: string, t?: (key: string, params?: Record<string, string | number>) => string): string {
  const parts: string[] = []
  const [y, m] = month.split('-').map(Number)
  if (item.currentInstallment && item.totalInstallments) parts.push(`${item.currentInstallment}/${item.totalInstallments}`)
  const dueOff = item.dueDayMonthOffset || 0
  if (item.dueDayType === 'card_due' && item.cardDueDays && item.cardDueDays.length > 0) {
    let dm = m + dueOff; if (dm > 12) dm -= 12
    const mm = String(dm).padStart(2, '0')
    const uniqueDays = [...new Set(item.cardDueDays)]
    parts.push(t ? t('widgetRenderer.dueDayCardLabel', { days: uniqueDays.map(d => `${String(d).padStart(2, '0')}/${mm}`).join(` ${t('insights.andConjunction')} `) }) : `vencimento dia ${uniqueDays.map(d => `${String(d).padStart(2, '0')}/${mm}`).join(' e ')} (venc. cartão)`)
  } else {
    let dm = m + dueOff; if (dm > 12) dm -= 12
    const effectiveDueDay = item.resolvedDueDay ?? item.dueDay
    if (effectiveDueDay != null) {
      parts.push(t ? t('widgetRenderer.dueDay', { day: String(effectiveDueDay).padStart(2, '0'), month: String(dm).padStart(2, '0') }) : `vencimento dia ${String(effectiveDueDay).padStart(2, '0')}/${String(dm).padStart(2, '0')}`)
    }
  }
  const billOff = item.billingDayMonthOffset || 0
  let bm = m + billOff; if (bm > 12) bm -= 12; if (bm < 1) bm += 12
  if (item.resolvedBillingDay != null) {
    parts.push(t ? t('widgetRenderer.billingDay', { day: String(item.resolvedBillingDay).padStart(2, '0'), month: String(bm).padStart(2, '0') }) : `cobranca dia ${String(item.resolvedBillingDay).padStart(2, '0')}/${String(bm).padStart(2, '0')}`)
  } else if (item.billingDay) {
    parts.push(t ? t('widgetRenderer.billingDay', { day: String(item.billingDay).padStart(2, '0'), month: String(bm).padStart(2, '0') }) : `cobranca dia ${String(item.billingDay).padStart(2, '0')}/${String(bm).padStart(2, '0')}`)
  }
  const cardLabels = getItemCardLabels(item)
  if (cardLabels.length > 0) parts.push(cardLabels.join(', '))
  return parts.join(' · ')
}

function dueDayDiff(item: DashboardListItem, month: string): number | null {
  const rawOffset = item.dueDayMonthOffset || 0
  const day = item.dueDayType === 'card_due'
    ? (item.cardDueDays?.[0] ?? item.resolvedDueDay ?? item.dueDay)
    : (item.resolvedDueDay ?? item.dueDay)
  if (day == null) return null
  const [y, m] = month.split('-').map(Number)
  let dm = m + rawOffset, dy = y
  if (dm > 12) { dy++; dm -= 12 }
  const dueDate = new Date(dy, dm - 1, day)
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  return Math.round((dueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
}

function billingDayDiff(item: DashboardListItem, month: string): number | null {
  const day = item.resolvedBillingDay ?? item.billingDay
  if (day == null) return null
  const [y, m] = month.split('-').map(Number)
  const billOff = item.billingDayMonthOffset || 0
  let bm = m + billOff, by = y
  if (bm > 12) { by++; bm -= 12 }
  if (bm < 1) { by--; bm += 12 }
  const billingDate = new Date(by, bm - 1, day)
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  return Math.round((billingDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
}

function formatBillingMeta(item: DashboardListItem, month: string, t: (key: string, params?: Record<string, string | number>) => string): string {
  const base = formatItemMetaNoDueDay(item)
  const diff = billingDayDiff(item, month)
  if (diff === null) return base
  let label: string
  if (diff === 0) label = t('widgetRenderer.billingToday')
  else if (diff === 1) label = t('widgetRenderer.billingIn1Day')
  else if (diff > 1) label = t('widgetRenderer.billingInDays', { days: diff })
  else label = Math.abs(diff) !== 1 ? t('widgetRenderer.billedAgoDays', { days: Math.abs(diff) }) : t('widgetRenderer.billedAgo', { days: Math.abs(diff) })
  return base ? `${base} · ${label}` : label
}

function formatItemMetaNoDueDay(item: DashboardListItem): string {
  const parts: string[] = []
  if (item.currentInstallment && item.totalInstallments) parts.push(`${item.currentInstallment}/${item.totalInstallments}`)
  const cardLabels = getItemCardLabels(item)
  if (cardLabels.length > 0) parts.push(cardLabels.join(', '))
  return parts.join(' · ')
}

function formatOverdueMeta(item: DashboardListItem, month: string, t: (key: string, params?: Record<string, string | number>) => string): string {
  const base = formatItemMetaNoDueDay(item)
  const diff = dueDayDiff(item, month)
  if (diff === null) return base
  const days = Math.abs(diff)
  const label = days === 1 ? t('widgetRenderer.overdueAgo1Day') : t('widgetRenderer.overdueAgoDays', { days })
  return base ? `${base} · ${label}` : label
}

function formatUpcomingMeta(item: DashboardListItem, month: string, t: (key: string, params?: Record<string, string | number>) => string): string {
  const base = formatItemMetaNoDueDay(item)
  const diff = dueDayDiff(item, month)
  if (diff === null) return base
  if (diff === 0) {
    const label = t('widgetRenderer.duesToday')
    return base ? `${base} · ${label}` : label
  }
  const label = diff === 1 ? t('widgetRenderer.duesIn1Day') : t('widgetRenderer.duesInDays', { days: diff })
  return base ? `${base} · ${label}` : label
}

export function effectiveValue(item: DashboardListItem): string {
  const snapshot = (item as any).exchangeRateSnapshot || 1.0
  if ((item.type === 'installment' || item.type === 'emprestimo') && item.totalInstallments) {
    return formatCurrency(Math.round((item.value / item.totalInstallments) * 100) / 100 * snapshot)
  }
  return formatCurrency(item.value * snapshot)
}

function getSpanFromWidth(widthPercent: number): number {
  if (widthPercent >= 75) return 4
  if (widthPercent >= 50) return 3
  if (widthPercent >= 35) return 2
  return 1
}

export const sz = (span: number) => ({
  pad: span >= 3 ? 'p-8' : span === 2 ? 'p-6' : 'p-5',
  icon: span >= 3 ? 'h-14 w-14' : span === 2 ? 'h-12 w-12' : 'h-10 w-10',
  iconPx: span >= 3 ? 28 : span === 2 ? 24 : 20,
  gap: span >= 3 ? 'gap-4' : 'gap-3',
  label: span >= 3 ? 'text-base' : 'text-sm',
  value: span >= 3 ? 'text-3xl' : span === 2 ? 'text-2xl' : 'text-lg',
  centerValue: span >= 3 ? 'text-4xl' : span === 2 ? 'text-3xl' : 'text-xl',
  chevron: span >= 3 ? 20 : 16
})

export const widgetCard = (
  span: number,
  { icon: Icon, iconBg, iconColor, label, value, valueStyle, subtitle, onClick }:
  { icon: any; iconBg?: string; iconColor?: string; label: string; value: string; valueStyle?: React.CSSProperties; subtitle?: string; onClick?: () => void }
) => {
  const s = sz(span)
  if (span >= 2) {
    return (
      <Card hover={!!onClick} className={s.pad} onClick={onClick}>
        <div className="flex flex-col items-center text-center gap-2">
          <div className={`flex ${s.icon} items-center justify-center rounded-lg ${!iconBg ? 'bg-primary/10' : ''}`}
            style={iconBg ? { backgroundColor: iconBg } : undefined}>
            <Icon size={s.iconPx} style={iconColor ? { color: iconColor } : undefined}
              className={!iconColor ? 'text-primary' : undefined} />
          </div>
          <p className={`${s.label} font-medium text-muted-foreground`}>{label}</p>
          <p className={`${s.centerValue} font-bold`} style={valueStyle}>{value}</p>
          {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
        </div>
      </Card>
    )
  }
  return (
    <Card hover={!!onClick} className={s.pad} onClick={onClick}>
      <div className="flex items-center justify-between">
        <div className={`flex items-center ${s.gap}`}>
          <div className={`flex ${s.icon} items-center justify-center rounded-lg shrink-0 ${!iconBg ? 'bg-primary/10' : ''}`}
            style={iconBg ? { backgroundColor: iconBg } : undefined}>
            <Icon size={s.iconPx} style={iconColor ? { color: iconColor } : undefined}
              className={!iconColor ? 'text-primary' : undefined} />
          </div>
          <div>
            <p className={`${s.label} font-medium`}>{label}</p>
            <div className="flex items-baseline gap-2">
              <p className={`${s.value} font-bold`} style={valueStyle}>{value}</p>
              {subtitle && <p className="text-xs text-muted-foreground truncate">{subtitle}</p>}
            </div>
          </div>
        </div>
        {onClick && <ChevronRight size={s.chevron} className="text-muted-foreground shrink-0" />}
      </div>
    </Card>
  )
}

// ── Context for renderWidgetContent ──

export interface WidgetRenderContext {
  summary: Summary
  widgetsData: DashboardWidgetsData | null
  expenseTotal: number
  month: string
  navigate: NavigateFunction
  gastosStyle: (page: string, section: string) => React.CSSProperties
  receitasStyle: (page: string, section: string) => React.CSSProperties
  saldoStyle: (page: string, section: string, value: number) => React.CSSProperties
  startCountingMonth: string | null
  availableWidgets: AvailableWidget[]
  t: (key: string, params?: Record<string, string | number>) => string
}

// ── Main render function ──

export function renderWidgetContent(
  widgetId: string,
  widthPercent: number,
  ctx: WidgetRenderContext,
  displayPrefs?: Record<string, any>
): React.ReactNode {
  const { summary, widgetsData, expenseTotal, month, navigate, gastosStyle, receitasStyle, saldoStyle, startCountingMonth, availableWidgets, t: tr } = ctx

  const SENTINEL_KEYS: Record<string, string> = {
    '__no_category__': 'categories.noCategory',
    '__no_tag__': 'tags.noTag',
    '__recurring__': 'income.recurring',
    '__non_recurring__': 'income.nonRecurring',
    '__card__': 'cards.card'
  }
  const tName = (name: string) => SENTINEL_KEYS[name] ? tr(SENTINEL_KEYS[name]) : name

  const aw = availableWidgets.find(w => w.id === widgetId)
  if (!aw) return null
  const span = getSpanFromWidth(widthPercent)
  const t = aw.type
  const vis = (field: string, def = true) => displayPrefs?.[field] ?? def

  switch (t.kind) {
    case 'expenses-total':
      return widgetCard(span, {
        icon: Receipt, label: tr('dashboard.widgetExpensesTotal'),
        value: formatCurrency(expenseTotal), valueStyle: gastosStyle('dashboard', 'widgets'),
        onClick: () => navigate(ROUTES.ITEMS)
      })
    case 'income-total':
      return widgetCard(span, {
        icon: Wallet, label: tr('dashboard.widgetIncome'),
        value: formatCurrency(summary.incomeTotal), valueStyle: receitasStyle('dashboard', 'widgets'),
        onClick: () => navigate(ROUTES.INCOME)
      })
    case 'balance-total': {
      const balance = summary.incomeTotal - expenseTotal
      return widgetCard(span, {
        icon: Wallet, iconBg: 'color-mix(in srgb, var(--color-saldo, #10b981) 12%, transparent)', iconColor: 'var(--color-saldo, #10b981)',
        label: tr('dashboard.widgetBalance'), value: formatCurrency(balance),
        valueStyle: saldoStyle('dashboard', 'widgets', balance)
      })
    }
    case 'type-total': {
      const tt = summary.typeTotals.find(x => x.type === t.type)
      if (!tt) return null
      const Icon = TYPE_ICON_MAP[tt.type] || CircleDot
      const color = TYPE_COLOR_MAP[tt.type] || '#3b82f6'
      const tab = TYPE_TAB_MAP[tt.type] || 'all'
      return widgetCard(span, {
        icon: Icon, iconBg: `${color}20`, iconColor: color,
        label: tr('itemTypes.' + tt.type), value: formatCurrency(tt.total),
        onClick: () => navigate(ROUTES.ITEMS, { state: { tab } })
      })
    }
    case 'cards-total': {
      const allCards = widgetsData?.cardDetails ?? []
      const totalUsed = allCards.reduce((s, c) => s + c.usedLimit, 0)
      const totalLimitSum = allCards.reduce((s, c) => s + c.totalLimit, 0)
      const totalAvail = allCards.reduce((s, c) => s + c.availableLimit, 0)
      const usedPct = totalLimitSum > 0 ? (totalUsed / totalLimitSum) * 100 : 0
      const pctColor = usedPct > 80 ? 'text-destructive' : usedPct > 60 ? 'text-amber-500' : 'text-primary'
      const barColor = usedPct > 80 ? 'bg-destructive' : 'bg-primary'
      return (
        <Card hover className="p-4 cursor-pointer" onClick={() => navigate(ROUTES.ACCOUNTS)}>
          <div className="flex items-center gap-2 mb-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 shrink-0">
              <CreditCard size={16} className="text-primary" />
            </div>
            <h3 className="text-sm font-semibold">{tr('widgetRenderer.cards')}</h3>
            {vis('cardCount') && (
              <span className="text-[10px] text-muted-foreground ml-auto bg-muted/50 px-1.5 py-0.5 rounded-full tabular-nums font-medium">
                {allCards.length} {allCards.length === 1 ? tr('widgetRenderer.cardSingular') : tr('widgetRenderer.cardPlural')}
              </span>
            )}
          </div>
          {vis('totalUsed') && (
            <p className="text-2xl font-bold tabular-nums mb-2" style={gastosStyle('dashboard', 'widgets')}>{formatCurrency(totalUsed)}</p>
          )}
          {vis('progressBar') && totalLimitSum > 0 && (
            <div className="h-2 rounded-full bg-muted overflow-hidden mb-1">
              <div className={`h-full rounded-full transition-all ${barColor}`} style={{ width: `${Math.min(usedPct, 100)}%` }} />
            </div>
          )}
          {(vis('totalLimit') || vis('availableLimit') || vis('usagePercent')) && (
            <div className="flex items-center justify-between text-xs text-muted-foreground mb-2">
              <span>
                {vis('totalLimit') && tr('widgetRenderer.limit', { value: formatCurrency(totalLimitSum) })}
                {vis('totalLimit') && vis('availableLimit') && ' · '}
                {vis('availableLimit') && tr('widgetRenderer.available', { value: formatCurrency(totalAvail) })}
              </span>
              {vis('usagePercent') && totalLimitSum > 0 && (
                <span className={`font-semibold tabular-nums ${pctColor}`}>{usedPct.toFixed(0)}%</span>
              )}
            </div>
          )}
          {vis('cardList') && allCards.length > 0 && (
            <div className="border-t border-border/50 pt-2 mt-1 space-y-1.5">
              {allCards.map(c => {
                const cPct = c.totalLimit > 0 ? (c.usedLimit / c.totalLimit) * 100 : 0
                const cBar = cPct > 80 ? 'bg-destructive' : 'bg-primary'
                return (
                  <div key={c.id} className="flex items-center gap-2">
                    <span className="text-xs truncate flex-1 min-w-0">{c.name}</span>
                    {c.totalLimit > 0 && (
                      <div className="w-16 h-1.5 rounded-full bg-muted overflow-hidden shrink-0">
                        <div className={`h-full rounded-full ${cBar}`} style={{ width: `${Math.min(cPct, 100)}%` }} />
                      </div>
                    )}
                    <span className="text-xs tabular-nums text-muted-foreground shrink-0">{formatCurrency(c.usedLimit)}</span>
                  </div>
                )
              })}
            </div>
          )}
        </Card>
      )
    }
    case 'card': {
      const card = widgetsData?.cardDetails?.find(c => c.id === t.cardId)
      if (!card) return null
      const usedPct = card.totalLimit > 0 ? (card.usedLimit / card.totalLimit) * 100 : 0
      const pctColor = usedPct > 80 ? 'text-destructive' : usedPct > 60 ? 'text-amber-500' : 'text-primary'
      const barColor = usedPct > 80 ? 'bg-destructive' : 'bg-primary'
      return (
        <Card hover className="p-4 cursor-pointer" onClick={() => navigate(`${ROUTES.ITEMS}?cardId=${card.id}`)}>
          <div className="flex items-center gap-2 mb-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 shrink-0">
              <CreditCard size={16} className="text-primary" />
            </div>
            <h3 className="text-sm font-semibold truncate">{card.name}</h3>
            {vis('cardType') && card.cardType !== 'both' && (
              <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium shrink-0 ${
                card.cardType === 'credit' ? 'bg-blue-500/15 text-blue-500' : 'bg-green-500/15 text-green-500'
              }`}>
                {card.cardType === 'credit' ? tr('widgetRenderer.credit') : tr('widgetRenderer.debit')}
              </span>
            )}
          </div>
          {vis('usedLimit') && (
            <div className="flex justify-between text-sm mb-1">
              <span className="text-muted-foreground">{tr('widgetRenderer.usedOverLimit')}</span>
              <span className="font-medium tabular-nums">
                {formatCurrency(card.usedLimit)} / {card.totalLimit === 0 ? tr('widgetRenderer.unlimited') : formatCurrency(card.totalLimit)}
              </span>
            </div>
          )}
          {vis('progressBar') && (
            card.totalLimit > 0 ? (
              <div className="flex items-center gap-2 mb-1">
                <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
                  <div className={`h-full rounded-full transition-all ${barColor}`} style={{ width: `${Math.min(usedPct, 100)}%` }} />
                </div>
                {vis('usagePercent') && (
                  <span className={`text-xs font-semibold tabular-nums shrink-0 ${pctColor}`}>{usedPct.toFixed(0)}%</span>
                )}
              </div>
            ) : (
              <div className="h-2 rounded-full overflow-hidden mb-1" style={{
                backgroundImage: 'repeating-linear-gradient(135deg, hsl(var(--muted-foreground) / 0.18) 0px, hsl(var(--muted-foreground) / 0.18) 3px, transparent 3px, transparent 6px)'
              }} />
            )
          )}
          {vis('availableLimit') && card.totalLimit > 0 && (
            <p className="text-xs text-muted-foreground mb-2">
              {tr('widgetRenderer.availableLabel')} <span className="font-medium">{formatCurrency(card.availableLimit)}</span>
            </p>
          )}
          {(vis('dueDay') || vis('closeDay')) && (
            <div className="flex justify-between text-xs text-muted-foreground mb-2">
              {vis('dueDay') && <span>{tr('widgetRenderer.duesDay', { day: card.dueDay })}</span>}
              {vis('closeDay') && <span>{tr('widgetRenderer.closesDay', { day: card.billingCloseDay })}</span>}
            </div>
          )}
          {vis('bankAccount') && card.bankAccountName && (
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-2">
              <Landmark size={12} />
              <span>{card.bankAccountName}</span>
            </div>
          )}
          {(vis('commonItems') || vis('installmentItems') || vis('subscriptionItems')) && (
            <div className="border-t border-border/50 pt-2 mt-1 space-y-1">
              {vis('commonItems') && (
                <p className="text-xs text-muted-foreground">
                  {card.commonCount !== 1 ? tr('widgetRenderer.uniqueCountPlural', { count: card.commonCount }) : tr('widgetRenderer.uniqueCount', { count: card.commonCount })} ({formatCurrency(card.commonTotal)})
                </p>
              )}
              {vis('installmentItems') && (
                <p className="text-xs text-muted-foreground">
                  {card.installmentCount !== 1 ? tr('widgetRenderer.installmentCountPlural', { count: card.installmentCount }) : tr('widgetRenderer.installmentCount', { count: card.installmentCount })} ({formatCurrency(card.installmentTotal)})
                </p>
              )}
              {vis('subscriptionItems') && (
                <p className="text-xs text-muted-foreground">
                  {card.subscriptionCount !== 1 ? tr('widgetRenderer.recurringCountPlural', { count: card.subscriptionCount }) : tr('widgetRenderer.recurringCount', { count: card.subscriptionCount })} ({formatCurrency(card.subscriptionTotal)})
                </p>
              )}
            </div>
          )}
        </Card>
      )
    }
    case 'bank-accounts-total':
      return widgetCard(span, {
        icon: Landmark, label: tr('dashboard.widgetBankMoney'),
        value: formatCurrency(summary.bankAccountsTotal),
        valueStyle: saldoStyle('dashboard', 'widgets', summary.bankAccountsTotal),
        onClick: () => navigate(ROUTES.ACCOUNTS)
      })
    case 'bank-account': {
      const ba = summary.bankAccounts.find(a => a.id === t.accountId)
      if (!ba) return null
      return widgetCard(span, {
        icon: Landmark, iconBg: `${ba.color}20`, iconColor: ba.color,
        label: ba.name, value: formatCurrency(ba.balance),
        valueStyle: saldoStyle('dashboard', 'widgets', ba.balance),
        onClick: () => navigate(`${ROUTES.ITEMS}?bankAccountId=${ba.id}`)
      })
    }

    case 'upcoming-expenses': {
      const ps = displayPrefs?.pageSize ?? 5
      return (
        <WidgetListCard<DashboardListItem>
          icon={CalendarClock} label={tr('dashboard.widgetUpcomingExpenses')}
          items={widgetsData?.upcomingExpenses ?? []} paginated pageSize={ps}
          emptyMessage={tr('widgetRenderer.upcomingExpensesEmpty')}
          renderItem={(item) => (
            <ListWidgetRow key={item.id} description={item.description} meta={formatUpcomingMeta(item, month, tr)} value={effectiveValue(item)} />
          )}
        />
      )
    }

    case 'unpaid-items': {
      const ps = displayPrefs?.pageSize ?? 5
      return (
        <WidgetListCard<DashboardListItem>
          icon={CircleAlert} label={tr('dashboard.widgetUnpaidItems')}
          items={widgetsData?.unpaidItems ?? []} paginated pageSize={ps}
          emptyMessage={tr('widgetRenderer.unpaidItemsEmpty')}
          renderItem={(item) => (
            <ListWidgetRow key={item.id} description={item.description} meta={formatItemMeta(item, month, tr)} value={effectiveValue(item)} />
          )}
        />
      )
    }

    case 'top-expenses': {
      const ps = displayPrefs?.pageSize ?? 5
      return (
        <WidgetListCard<DashboardListItem>
          icon={BarChart3} label={tr('dashboard.widgetTopExpenses')}
          items={widgetsData?.topExpenses ?? []} paginated pageSize={ps}
          emptyMessage={tr('widgetRenderer.topExpensesEmpty')}
          renderItem={(item, idx) => (
            <ListWidgetRow key={item.id} rank={idx + 1} description={item.description} meta={formatItemMeta(item, month, tr)} value={effectiveValue(item)} />
          )}
        />
      )
    }

    case 'pending-incomes': {
      const ps = displayPrefs?.pageSize ?? 5
      return (
        <WidgetListCard<DashboardIncomeItem>
          icon={HandCoins} label={tr('dashboard.widgetPendingIncomes')}
          items={widgetsData?.pendingIncomes ?? []} paginated pageSize={ps}
          emptyMessage={tr('widgetRenderer.pendingIncomesEmpty')}
          renderItem={(item) => (
            <ListWidgetRow key={item.id} description={item.description} meta={item.categoryName || undefined}
              value={formatCurrency(item.effectiveValue)} valueStyle={receitasStyle('dashboard', 'widgets')} rankColor="var(--color-receitas)" />
          )}
        />
      )
    }

    case 'ending-installments': {
      const ps = displayPrefs?.pageSize ?? 5
      return (
        <WidgetListCard<DashboardListItem>
          icon={Layers} label={tr('dashboard.widgetEndingInstallments')}
          items={widgetsData?.endingInstallments ?? []} paginated pageSize={ps}
          emptyMessage={tr('widgetRenderer.endingInstallmentsEmpty')}
          renderItem={(item) => (
            <ListWidgetRow key={item.id} description={item.description}
              meta={item.remainingInstallments != null ? (item.remainingInstallments !== 1 ? tr('widgetRenderer.remainingCountPlural', { count: item.remainingInstallments }) : tr('widgetRenderer.remainingCount', { count: item.remainingInstallments })) : undefined}
              value={effectiveValue(item)} />
          )}
        />
      )
    }

    case 'month-comparison': {
      const cmp = widgetsData?.monthComparison
      if (!cmp) return null
      const isUp = cmp.delta > 0
      const isDown = cmp.delta < 0
      const DeltaIcon = isUp ? TrendingUp : isDown ? TrendingDown : Minus
      const deltaColorStyle = isUp ? { color: 'var(--color-gastos, #ef4444)' } : isDown ? { color: 'var(--color-receitas, #22c55e)' } : {}
      const deltaBgStyle = isUp
        ? { backgroundColor: 'color-mix(in srgb, var(--color-gastos, #ef4444) 10%, transparent)' }
        : isDown ? { backgroundColor: 'color-mix(in srgb, var(--color-receitas, #22c55e) 10%, transparent)' }
        : {}
      const deltaBgClass = !isUp && !isDown ? 'bg-muted/50' : ''
      const deltaColor = ''
      const percentText = cmp.previousTotal !== 0 ? `${isUp ? '+' : ''}${cmp.deltaPercent.toFixed(1)}%` : null
      return (
        <Card className="p-4">
          <div className="flex items-center gap-2 mb-3">
            <BarChart3 size={16} className="text-primary shrink-0" />
            <h3 className="text-sm font-semibold">{tr('widgetRenderer.monthComparisonTitle')}</h3>
            {percentText && (
              <span className={`text-xs font-semibold ml-auto px-2 py-0.5 rounded-full ${deltaBgClass}`} style={{ ...deltaBgStyle, ...deltaColorStyle }}>
                <DeltaIcon size={12} className="inline -mt-0.5 mr-0.5" />{percentText}
              </span>
            )}
          </div>
          <div className="flex items-end gap-3">
            <div className="flex-1 min-w-0">
              <p className="text-[11px] text-muted-foreground mb-0.5">{tr('widgetRenderer.currentMonth')}</p>
              <p className="text-xl font-bold tabular-nums">{formatCurrency(cmp.currentTotal)}</p>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[11px] text-muted-foreground mb-0.5">{tr('widgetRenderer.previousMonth')}</p>
              <p className="text-xl font-bold tabular-nums text-muted-foreground">{formatCurrency(cmp.previousTotal)}</p>
            </div>
            <div className="shrink-0 text-right">
              <p className="text-[11px] text-muted-foreground mb-0.5">{tr('widgetRenderer.difference')}</p>
              <p className={`text-xl font-bold tabular-nums ${deltaColor}`}>{isUp ? '+' : ''}{formatCurrency(cmp.delta)}</p>
            </div>
          </div>
        </Card>
      )
    }

    case 'overdue-items': {
      const ps = displayPrefs?.pageSize ?? 5
      return (
        <WidgetListCard<DashboardListItem>
          icon={AlertTriangle} label={tr('dashboard.widgetOverdueItems')}
          items={widgetsData?.overdueItems ?? []} paginated pageSize={ps}
          emptyMessage={tr('widgetRenderer.overdueItemsEmpty')}
          renderItem={(item) => (
            <ListWidgetRow key={item.id} description={item.description} meta={formatOverdueMeta(item, month, tr)} value={effectiveValue(item)} valueStyle={gastosStyle('dashboard', 'widgets')} />
          )}
        />
      )
    }

    case 'payment-summary': {
      const ps = widgetsData?.paymentSummary
      if (!ps) return null
      const pct = ps.totalItems > 0 ? (ps.paidItems / ps.totalItems) * 100 : 0
      return (
        <Card className="p-4">
          <div className="flex items-center gap-2 mb-3">
            <CheckCircle2 size={16} className="text-primary shrink-0" />
            <h3 className="text-sm font-semibold">{tr('widgetRenderer.paymentSummaryTitle')}</h3>
            <span className="text-[10px] text-muted-foreground ml-auto bg-muted/50 px-1.5 py-0.5 rounded-full tabular-nums font-medium">
              {ps.paidItems}/{ps.totalItems}
            </span>
          </div>
          <div className="flex items-end gap-3">
            <div className="flex-1 min-w-0">
              <p className="text-[11px] text-muted-foreground mb-0.5">{tr('widgetRenderer.paidLabel')}</p>
              <p className="text-xl font-bold tabular-nums" style={receitasStyle('dashboard', 'widgets')}>{formatCurrency(ps.paidValue)}</p>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[11px] text-muted-foreground mb-0.5">{tr('widgetRenderer.pendingLabel')}</p>
              <p className="text-xl font-bold tabular-nums" style={gastosStyle('dashboard', 'widgets')}>{formatCurrency(ps.pendingValue)}</p>
            </div>
            <div className="shrink-0 text-right">
              <p className="text-[11px] text-muted-foreground mb-0.5">{tr('widgetRenderer.progressLabel')}</p>
              <p className="text-xl font-bold tabular-nums">{pct.toFixed(0)}%</p>
            </div>
          </div>
        </Card>
      )
    }

    case 'financial-health': {
      const income = summary.incomeTotal
      const ratio = income > 0 ? expenseTotal / income : 0
      const color = ratio < 0.7 ? '#10b981' : ratio < 0.9 ? '#f59e0b' : '#ef4444'
      const label = ratio < 0.7 ? tr('widgetRenderer.healthy') : ratio < 0.9 ? tr('widgetRenderer.warning') : tr('widgetRenderer.critical')
      const bgColor = ratio < 0.7 ? 'bg-green-500/10' : ratio < 0.9 ? 'bg-yellow-500/10' : 'bg-red-500/10'
      return (
        <Card className="p-4">
          <div className="flex items-center gap-2 mb-3">
            <Activity size={16} className="text-primary shrink-0" />
            <h3 className="text-sm font-semibold">{tr('widgetRenderer.financialHealthTitle')}</h3>
            <span className={`text-[10px] font-semibold ml-auto px-1.5 py-0.5 rounded-full ${bgColor}`} style={{ color }}>{label}</span>
          </div>
          <div className="flex items-end gap-3">
            <div className="flex-1 min-w-0">
              <p className="text-[11px] text-muted-foreground mb-0.5">{tr('widgetRenderer.revenueLabel')}</p>
              <p className="text-xl font-bold tabular-nums" style={receitasStyle('dashboard', 'widgets')}>{formatCurrency(income)}</p>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[11px] text-muted-foreground mb-0.5">{tr('widgetRenderer.expensesLabel')}</p>
              <p className="text-xl font-bold tabular-nums" style={gastosStyle('dashboard', 'widgets')}>{formatCurrency(expenseTotal)}</p>
            </div>
            <div className="shrink-0 text-right">
              <p className="text-[11px] text-muted-foreground mb-0.5">{tr('widgetRenderer.committedLabel')}</p>
              <p className="text-xl font-bold tabular-nums" style={{ color }}>{(ratio * 100).toFixed(0)}%</p>
            </div>
          </div>
        </Card>
      )
    }

    case 'type-distribution': {
      const typeColors = TYPE_COLOR_MAP
      const total = summary.typeTotals.reduce((s, t) => s + t.total, 0)
      const showValues = vis('showValues', false)
      const showLegend = vis('showLegend')
      const truncate = vis('truncateNames', false)
      const segs = summary.typeTotals.map(tt => ({ key: tt.type, name: tr('itemTypes.' + tt.type), pct: total > 0 ? (tt.total / total) * 100 : 0, color: typeColors[tt.type] || '#6b7280', total: tt.total }))
      const onTypeClick = (key: string) => navigate(ROUTES.ITEMS, { state: { tab: key } })
      return (
        <Card className="p-4">
          <div className="flex items-center gap-2 mb-3">
            <PieChart size={16} className="text-primary shrink-0" />
            <h3 className="text-sm font-semibold">{tr('widgetRenderer.typeDistributionTitle')}</h3>
          </div>
          {vis('progressBar') && <DistributionBar segments={segs} showMarginBottom={showLegend} onSegmentClick={onTypeClick} />}
          {showLegend && (
            <div className="flex items-center gap-4 flex-wrap">
              {segs.map(s => (
                <div key={s.key} className="flex items-center gap-1.5 cursor-pointer" title={s.name} onClick={() => onTypeClick(s.key)}>
                  <div className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: s.color }} />
                  <span className={`text-xs text-muted-foreground ${truncate ? 'max-w-[80px] truncate' : ''}`}>{s.name}</span>
                  <span className="text-xs font-bold tabular-nums shrink-0">{s.pct.toFixed(0)}%</span>
                  {showValues && <span className="text-xs tabular-nums text-muted-foreground shrink-0">({formatCurrency(s.total)})</span>}
                </div>
              ))}
            </div>
          )}
        </Card>
      )
    }

    case 'category-distribution': {
      const othersLabel = tr('widgetRenderer.others')
      const rawItems = widgetsData?.categoryDistribution ?? []
      const total = rawItems.reduce((s, e) => s + e.total, 0)
      const items = groupSmallEntries(rawItems, total, othersLabel)
      const showValues = vis('showValues', false)
      const showLegend = vis('showLegend')
      const truncate = vis('truncateNames', false)
      const segs = items.map(e => ({ key: e.name, name: tName(e.name), pct: total > 0 ? (e.total / total) * 100 : 0, color: e.color, total: e.total }))
      const onCatClick = (key: string) => { if (key !== othersLabel) navigate(ROUTES.ITEMS, { state: { categoryName: key } }) }
      return (
        <Card className="p-4">
          <div className="flex items-center gap-2 mb-3">
            <PieChart size={16} className="text-primary shrink-0" />
            <h3 className="text-sm font-semibold">{tr('widgetRenderer.categoryDistributionTitle')}</h3>
          </div>
          {vis('progressBar') && total > 0 && <DistributionBar segments={segs} showMarginBottom={showLegend} onSegmentClick={onCatClick} />}
          {showLegend && (
            <div className="flex items-center gap-4 flex-wrap">
              {segs.map(s => (
                <div key={s.key} className={`flex items-center gap-1.5 ${s.key !== othersLabel ? 'cursor-pointer' : ''}`} title={s.name} onClick={() => onCatClick(s.key)}>
                  <div className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: s.color }} />
                  <span className={`text-xs text-muted-foreground ${truncate ? 'max-w-[80px] truncate' : ''}`}>{s.name}</span>
                  <span className="text-xs font-bold tabular-nums shrink-0">{s.pct.toFixed(0)}%</span>
                  {showValues && <span className="text-xs tabular-nums text-muted-foreground shrink-0">({formatCurrency(s.total)})</span>}
                </div>
              ))}
            </div>
          )}
        </Card>
      )
    }

    case 'tag-distribution': {
      const items = widgetsData?.tagDistribution ?? []
      const total = items.reduce((s, e) => s + e.total, 0)
      const showValues = vis('showValues', false)
      const showLegend = vis('showLegend')
      const truncate = vis('truncateNames', false)
      const segs = items.map(e => ({ key: e.name, name: tName(e.name), pct: total > 0 ? (e.total / total) * 100 : 0, color: e.color, total: e.total }))
      const onTagClick = (key: string) => navigate(ROUTES.ITEMS, { state: { tagName: key } })
      return (
        <Card className="p-4">
          <div className="flex items-center gap-2 mb-3">
            <PieChart size={16} className="text-primary shrink-0" />
            <h3 className="text-sm font-semibold">{tr('widgetRenderer.tagDistributionTitle')}</h3>
          </div>
          {vis('progressBar') && total > 0 && <DistributionBar segments={segs} showMarginBottom={showLegend} onSegmentClick={onTagClick} />}
          {showLegend && (
            <div className="flex items-center gap-4 flex-wrap">
              {segs.map(s => (
                <div key={s.key} className="flex items-center gap-1.5 cursor-pointer" title={s.name} onClick={() => onTagClick(s.key)}>
                  <div className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: s.color }} />
                  <span className={`text-xs text-muted-foreground ${truncate ? 'max-w-[80px] truncate' : ''}`}>{s.name}</span>
                  <span className="text-xs font-bold tabular-nums shrink-0">{s.pct.toFixed(0)}%</span>
                  {showValues && <span className="text-xs tabular-nums text-muted-foreground shrink-0">({formatCurrency(s.total)})</span>}
                </div>
              ))}
            </div>
          )}
        </Card>
      )
    }

    case 'income-type-distribution': {
      const items = widgetsData?.incomeTypeDistribution ?? []
      const total = items.reduce((s, e) => s + e.total, 0)
      const showValues = vis('showValues', false)
      const showLegend = vis('showLegend')
      const truncate = vis('truncateNames', false)
      const segs = items.map(e => ({ key: e.name, name: tName(e.name), pct: total > 0 ? (e.total / total) * 100 : 0, color: e.color, total: e.total }))
      const incTypeMap: Record<string, string> = { '__recurring__': 'recurring', '__non_recurring__': 'non-recurring' }
      const onIncTypeClick = (key: string) => { const rf = incTypeMap[key]; if (rf) navigate(ROUTES.INCOME, { state: { recurringFilter: rf } }) }
      return (
        <Card className="p-4">
          <div className="flex items-center gap-2 mb-3">
            <PieChart size={16} className="text-primary shrink-0" />
            <h3 className="text-sm font-semibold">{tr('widgetRenderer.incomeTypeDistributionTitle')}</h3>
          </div>
          {vis('progressBar') && total > 0 && <DistributionBar segments={segs} showMarginBottom={showLegend} onSegmentClick={onIncTypeClick} />}
          {showLegend && (
            <div className="flex items-center gap-4 flex-wrap">
              {segs.map(s => (
                <div key={s.key} className="flex items-center gap-1.5 cursor-pointer" title={s.name} onClick={() => onIncTypeClick(s.key)}>
                  <div className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: s.color }} />
                  <span className={`text-xs text-muted-foreground ${truncate ? 'max-w-[80px] truncate' : ''}`}>{s.name}</span>
                  <span className="text-xs font-bold tabular-nums shrink-0">{s.pct.toFixed(0)}%</span>
                  {showValues && <span className="text-xs tabular-nums text-muted-foreground shrink-0">({formatCurrency(s.total)})</span>}
                </div>
              ))}
            </div>
          )}
        </Card>
      )
    }

    case 'income-category-distribution': {
      const othersLabel = tr('widgetRenderer.others')
      const rawItems = widgetsData?.incomeCategoryDistribution ?? []
      const total = rawItems.reduce((s, e) => s + e.total, 0)
      const items = groupSmallEntries(rawItems, total, othersLabel)
      const showValues = vis('showValues', false)
      const showLegend = vis('showLegend')
      const truncate = vis('truncateNames', false)
      const segs = items.map(e => ({ key: e.name, name: tName(e.name), pct: total > 0 ? (e.total / total) * 100 : 0, color: e.color, total: e.total }))
      const onIncCatClick = (key: string) => { if (key !== othersLabel) navigate(ROUTES.INCOME, { state: { categoryName: key } }) }
      return (
        <Card className="p-4">
          <div className="flex items-center gap-2 mb-3">
            <PieChart size={16} className="text-primary shrink-0" />
            <h3 className="text-sm font-semibold">{tr('widgetRenderer.incomeCategoryDistributionTitle')}</h3>
          </div>
          {vis('progressBar') && total > 0 && <DistributionBar segments={segs} showMarginBottom={showLegend} onSegmentClick={onIncCatClick} />}
          {showLegend && (
            <div className="flex items-center gap-4 flex-wrap">
              {segs.map(s => (
                <div key={s.key} className={`flex items-center gap-1.5 ${s.key !== othersLabel ? 'cursor-pointer' : ''}`} title={s.name} onClick={() => onIncCatClick(s.key)}>
                  <div className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: s.color }} />
                  <span className={`text-xs text-muted-foreground ${truncate ? 'max-w-[80px] truncate' : ''}`}>{s.name}</span>
                  <span className="text-xs font-bold tabular-nums shrink-0">{s.pct.toFixed(0)}%</span>
                  {showValues && <span className="text-xs tabular-nums text-muted-foreground shrink-0">({formatCurrency(s.total)})</span>}
                </div>
              ))}
            </div>
          )}
        </Card>
      )
    }

    case 'current-month-summary': {
      const curBalance = summary.incomeTotal - expenseTotal
      return (
        <Card className="p-4">
          <div className="flex items-center gap-2 mb-3">
            <CalendarDays size={16} className="text-primary shrink-0" />
            <h3 className="text-sm font-semibold">{tr('widgetRenderer.currentMonthSummaryTitle')}</h3>
            <span className="text-[10px] text-muted-foreground ml-auto bg-muted/50 px-1.5 py-0.5 rounded-full font-medium">{getMonthLabel(month)}</span>
          </div>
          <div className="flex items-end gap-3">
            <div className="flex-1 min-w-0">
              <p className="text-[11px] text-muted-foreground mb-0.5">{tr('widgetRenderer.expensesLabel')}</p>
              <p className="text-xl font-bold tabular-nums" style={gastosStyle('dashboard', 'widgets')}>{formatCurrency(expenseTotal)}</p>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[11px] text-muted-foreground mb-0.5">{tr('widgetRenderer.incomeLabel')}</p>
              <p className="text-xl font-bold tabular-nums" style={receitasStyle('dashboard', 'widgets')}>{formatCurrency(summary.incomeTotal)}</p>
            </div>
            <div className="shrink-0 text-right">
              <p className="text-[11px] text-muted-foreground mb-0.5">{tr('widgetRenderer.balanceLabel')}</p>
              <p className="text-xl font-bold tabular-nums" style={saldoStyle('dashboard', 'widgets', curBalance)}>{formatCurrency(curBalance)}</p>
            </div>
          </div>
        </Card>
      )
    }

    case 'previous-month-summary': {
      const ms = widgetsData?.previousMonthSummary
      if (!ms) return null
      if (ms.isBeforeStart) {
        return (
          <Card className="p-4">
            <div className="flex items-center gap-2 mb-3">
              <CalendarMinus size={16} className="text-primary shrink-0" />
              <h3 className="text-sm font-semibold">{tr('widgetRenderer.previousMonthSummaryTitle')}</h3>
              <span className="text-[10px] text-muted-foreground ml-auto bg-muted/50 px-1.5 py-0.5 rounded-full font-medium">{getMonthLabel(ms.month)}</span>
            </div>
            <p className="text-xs text-muted-foreground py-4 text-center">
              {tr('widgetRenderer.monthUnavailable', { month: getMonthLabel(startCountingMonth) })}
            </p>
          </Card>
        )
      }
      return (
        <Card className="p-4">
          <div className="flex items-center gap-2 mb-3">
            <CalendarMinus size={16} className="text-primary shrink-0" />
            <h3 className="text-sm font-semibold">{tr('widgetRenderer.previousMonthSummaryTitle')}</h3>
            <span className="text-[10px] text-muted-foreground ml-auto bg-muted/50 px-1.5 py-0.5 rounded-full font-medium">{getMonthLabel(ms.month)}</span>
          </div>
          <div className="flex items-end gap-3">
            <div className="flex-1 min-w-0">
              <p className="text-[11px] text-muted-foreground mb-0.5">{tr('widgetRenderer.expensesLabel')}</p>
              <p className="text-xl font-bold tabular-nums" style={gastosStyle('dashboard', 'widgets')}>{formatCurrency(ms.expensesTotal)}</p>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[11px] text-muted-foreground mb-0.5">{tr('widgetRenderer.incomeLabel')}</p>
              <p className="text-xl font-bold tabular-nums" style={receitasStyle('dashboard', 'widgets')}>{formatCurrency(ms.incomeTotal)}</p>
            </div>
            <div className="shrink-0 text-right">
              <p className="text-[11px] text-muted-foreground mb-0.5">{tr('widgetRenderer.balanceLabel')}</p>
              <p className="text-xl font-bold tabular-nums" style={saldoStyle('dashboard', 'widgets', ms.balance)}>{formatCurrency(ms.balance)}</p>
            </div>
          </div>
        </Card>
      )
    }

    case 'next-month-summary': {
      const ms = widgetsData?.nextMonthSummary
      if (!ms) return null
      if (ms.isBeforeStart) {
        return (
          <Card className="p-4">
            <div className="flex items-center gap-2 mb-3">
              <CalendarPlus size={16} className="text-primary shrink-0" />
              <h3 className="text-sm font-semibold">{tr('widgetRenderer.nextMonthSummaryTitle')}</h3>
              <span className="text-[10px] text-muted-foreground ml-auto bg-muted/50 px-1.5 py-0.5 rounded-full font-medium">{getMonthLabel(ms.month)}</span>
            </div>
            <p className="text-xs text-muted-foreground py-4 text-center">
              {tr('widgetRenderer.monthUnavailable', { month: getMonthLabel(startCountingMonth) })}
            </p>
          </Card>
        )
      }
      return (
        <Card className="p-4">
          <div className="flex items-center gap-2 mb-3">
            <CalendarPlus size={16} className="text-primary shrink-0" />
            <h3 className="text-sm font-semibold">{tr('widgetRenderer.nextMonthSummaryTitle')}</h3>
            <span className="text-[10px] text-muted-foreground ml-auto bg-muted/50 px-1.5 py-0.5 rounded-full font-medium">{getMonthLabel(ms.month)}</span>
          </div>
          <div className="flex items-end gap-3">
            <div className="flex-1 min-w-0">
              <p className="text-[11px] text-muted-foreground mb-0.5">{tr('widgetRenderer.expensesLabel')}</p>
              <p className="text-xl font-bold tabular-nums" style={gastosStyle('dashboard', 'widgets')}>{formatCurrency(ms.expensesTotal)}</p>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[11px] text-muted-foreground mb-0.5">{tr('widgetRenderer.incomeLabel')}</p>
              <p className="text-xl font-bold tabular-nums" style={receitasStyle('dashboard', 'widgets')}>{formatCurrency(ms.incomeTotal)}</p>
            </div>
            <div className="shrink-0 text-right">
              <p className="text-[11px] text-muted-foreground mb-0.5">{tr('widgetRenderer.balanceLabel')}</p>
              <p className="text-xl font-bold tabular-nums" style={saldoStyle('dashboard', 'widgets', ms.balance)}>{formatCurrency(ms.balance)}</p>
            </div>
          </div>
        </Card>
      )
    }

    case 'balance-with-accounts': {
      const bal = summary.incomeTotal - expenseTotal + summary.bankAccountsTotal
      return widgetCard(span, {
        icon: Landmark, iconBg: 'color-mix(in srgb, var(--color-saldo, #10b981) 12%, transparent)', iconColor: 'var(--color-saldo, #10b981)',
        label: tr('widgetRenderer.balanceWithAccountsLabel'), value: formatCurrency(bal),
        valueStyle: saldoStyle('dashboard', 'widgets', bal)
      })
    }

    case 'overall-balance': {
      const balance = summary.incomeTotal - expenseTotal
      const includeBankAccounts = vis('includeBankAccounts', true)
      const overallBalance = includeBankAccounts ? balance + summary.bankAccountsTotal : balance
      return (
        <Card className="p-4">
          <div className="flex items-center gap-2 mb-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 shrink-0">
              <Wallet size={16} className="text-primary" />
            </div>
            <h3 className="text-sm font-semibold">{tr('widgetRenderer.overallBalanceTitle')}</h3>
          </div>
          <p className="text-2xl font-bold tabular-nums mb-2" style={saldoStyle('dashboard', 'widgets', overallBalance)}>
            {formatCurrency(overallBalance)}
          </p>
          <div className="space-y-1 text-xs text-muted-foreground">
            <div className="flex justify-between">
              <span>{tr('widgetRenderer.incomeLabel')}</span>
              <span className="font-medium tabular-nums" style={receitasStyle('dashboard', 'widgets')}>{formatCurrency(summary.incomeTotal)}</span>
            </div>
            <div className="flex justify-between">
              <span>{tr('widgetRenderer.expensesLabel')}</span>
              <span className="font-medium tabular-nums" style={gastosStyle('dashboard', 'widgets')}>{formatCurrency(expenseTotal)}</span>
            </div>
            {includeBankAccounts && (
              <div className="flex justify-between">
                <span>{tr('widgetRenderer.bankMoneyLabel')}</span>
                <span className="font-medium tabular-nums">{formatCurrency(summary.bankAccountsTotal)}</span>
              </div>
            )}
          </div>
        </Card>
      )
    }

    case 'upcoming-billing': {
      const ps = displayPrefs?.pageSize ?? 5
      const lookAhead = displayPrefs?.lookAheadDays ?? 7
      const allBilling = widgetsData?.upcomingBilling ?? []
      const todayNow = new Date()
      const todayDayNum = todayNow.getDate()
      const todayMonthStr = `${todayNow.getFullYear()}-${String(todayNow.getMonth() + 1).padStart(2, '0')}`
      const isCurrentMonth = month === todayMonthStr
      const filtered = isCurrentMonth
        ? allBilling.filter(i => {
            const bd = i.resolvedBillingDay ?? i.billingDay
            return bd != null && bd >= todayDayNum && bd <= todayDayNum + lookAhead
          })
        : allBilling
      return (
        <WidgetListCard<DashboardListItem>
          icon={Receipt} label={tr('dashboard.widgetUpcomingBilling')}
          items={filtered} paginated pageSize={ps}
          emptyMessage={tr('widgetRenderer.upcomingBillingEmpty')}
          renderItem={(item) => (
            <ListWidgetRow key={item.id} description={item.description} meta={formatBillingMeta(item, month, tr)} value={effectiveValue(item)} />
          )}
        />
      )
    }
  }
}
