import { Card } from '../../../components/ui/Card'
import { formatCurrency } from '../../../lib/currency'
import { useFormatDate } from '../../../lib/date'
import { useTranslation } from '../../../contexts/LanguageContext'
import { Receipt, Wallet, Scale, TrendingUp, TrendingDown, Landmark } from 'lucide-react'
import type { InsightsTemporalResult, InsightsComparativeResult } from '../../../../../../shared/insights-types'

interface TemporalProps {
  mode: 'temporal'
  data: InsightsTemporalResult
  includeAccountBalance?: boolean
  onToggleAccountBalance?: (v: boolean) => void
}

interface ComparativeProps {
  mode: 'comparative'
  data: InsightsComparativeResult
  includeAccountBalance?: boolean
  onToggleAccountBalance?: (v: boolean) => void
}

type Props = TemporalProps | ComparativeProps

function DeltaBadge({ valueA, valueB, invertColor }: { valueA: number; valueB: number; invertColor?: boolean }) {
  if (valueA === 0 && valueB === 0) return null
  const delta = valueB - valueA
  const pct = valueA !== 0 ? ((delta / Math.abs(valueA)) * 100) : 0
  const isPositive = delta > 0
  const isGood = invertColor ? !isPositive : isPositive

  return (
    <div
      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold"
      style={{
        backgroundColor: isGood ? 'color-mix(in srgb, var(--color-receitas, #10b981) 10%, transparent)' : 'color-mix(in srgb, var(--color-gastos, #ef4444) 10%, transparent)',
        color: isGood ? 'var(--color-receitas, #22c55e)' : 'var(--color-gastos, #ef4444)'
      }}
    >
      {isGood ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
      {isPositive ? '+' : ''}{pct.toFixed(1)}%
    </div>
  )
}

function formatPeriodLabel(label: string, fmtDate: (d: string) => string, fmtMonth: (m: string) => string): string {
  if (label.length === 10) return fmtDate(label)
  if (label.length === 7) return fmtMonth(label)
  return label
}

export function InsightsSummaryCards(props: Props) {
  const { t } = useTranslation()
  const { fmtDate, fmtMonth } = useFormatDate()

  if (props.mode === 'temporal') {
    const { data, includeAccountBalance, onToggleAccountBalance } = props
    const accountBalance = data.timeline.length > 0 ? data.timeline[data.timeline.length - 1].bankAccountBalance : 0
    const displayIncome = includeAccountBalance ? data.totalIncome + accountBalance : data.totalIncome
    const displayBalance = includeAccountBalance ? data.totalBalance + accountBalance : data.totalBalance
    return (
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg" style={{ backgroundColor: 'color-mix(in srgb, var(--color-gastos, #ef4444) 10%, transparent)' }}>
              <Receipt size={20} style={{ color: 'var(--color-gastos, #ef4444)' }} />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">{t('insights.totalExpenses')}</p>
              <p className="text-lg font-bold">{formatCurrency(data.totalExpenses)}</p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg" style={{ backgroundColor: 'color-mix(in srgb, var(--color-receitas, #10b981) 10%, transparent)' }}>
              <Wallet size={20} style={{ color: 'var(--color-receitas, #22c55e)' }} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm text-muted-foreground">{t('insights.totalIncome')}</p>
              <p className="text-lg font-bold">{formatCurrency(displayIncome)}</p>
            </div>
            {onToggleAccountBalance && (
              <button
                onClick={() => onToggleAccountBalance(!includeAccountBalance)}
                title={t('insights.includeAccountBalance')}
                className="flex h-8 w-8 items-center justify-center rounded-md transition-colors hover:bg-muted"
                style={includeAccountBalance ? { color: 'var(--color-receitas, #22c55e)' } : { color: 'var(--color-muted-foreground, #888)' }}
              >
                <Landmark size={16} />
              </button>
            )}
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg" style={{ backgroundColor: 'color-mix(in srgb, var(--color-saldo, #3b82f6) 10%, transparent)' }}>
              <Scale size={20} style={{ color: 'var(--color-saldo, #3b82f6)' }} />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">{t('insights.periodBalance')}</p>
              <p className="text-lg font-bold" style={{ color: displayBalance >= 0 ? 'var(--color-receitas, #22c55e)' : 'var(--color-gastos, #ef4444)' }}>
                {formatCurrency(displayBalance)}
              </p>
            </div>
          </div>
        </Card>
      </div>
    )
  }

  // Comparative mode
  const { data, includeAccountBalance, onToggleAccountBalance } = props
  const fmtLabel = (l: string) => formatPeriodLabel(l, fmtDate, fmtMonth)

  const balA = data.a.timeline.length > 0 ? data.a.timeline[data.a.timeline.length - 1].bankAccountBalance : 0
  const balB = data.b.timeline.length > 0 ? data.b.timeline[data.b.timeline.length - 1].bankAccountBalance : 0

  const cards = [
    {
      label: t('insights.totalExpenses'),
      icon: Receipt,
      iconStyle: { color: 'var(--color-gastos, #ef4444)' } as React.CSSProperties,
      iconBgStyle: { backgroundColor: 'color-mix(in srgb, var(--color-gastos, #ef4444) 10%, transparent)' } as React.CSSProperties,
      valA: data.a.totalExpenses,
      valB: data.b.totalExpenses,
      invertColor: true,
    },
    {
      label: t('insights.totalIncome'),
      icon: Wallet,
      iconStyle: { color: 'var(--color-receitas, #22c55e)' } as React.CSSProperties,
      iconBgStyle: { backgroundColor: 'color-mix(in srgb, var(--color-receitas, #10b981) 10%, transparent)' } as React.CSSProperties,
      valA: includeAccountBalance ? data.a.totalIncome + balA : data.a.totalIncome,
      valB: includeAccountBalance ? data.b.totalIncome + balB : data.b.totalIncome,
      invertColor: false,
      showAccountToggle: true,
    },
    {
      label: t('insights.periodBalance'),
      icon: Scale,
      iconStyle: { color: 'var(--color-saldo, #3b82f6)' } as React.CSSProperties,
      iconBgStyle: { backgroundColor: 'color-mix(in srgb, var(--color-saldo, #3b82f6) 10%, transparent)' } as React.CSSProperties,
      valA: includeAccountBalance ? data.a.totalBalance + balA : data.a.totalBalance,
      valB: includeAccountBalance ? data.b.totalBalance + balB : data.b.totalBalance,
      invertColor: false,
      colorBySign: true,
    },
  ]

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      {cards.map(c => {
        const Icon = c.icon
        return (
          <Card key={c.label} className="p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2.5">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg" style={c.iconBgStyle}>
                  <Icon size={18} style={c.iconStyle} />
                </div>
                <p className="text-sm font-medium">{c.label}</p>
              </div>
              <div className="flex items-center gap-1.5">
                {c.showAccountToggle && onToggleAccountBalance && (
                  <button
                    onClick={() => onToggleAccountBalance(!includeAccountBalance)}
                    title={t('insights.includeAccountBalance')}
                    className="flex h-7 w-7 items-center justify-center rounded-md transition-colors hover:bg-muted"
                    style={includeAccountBalance ? { color: 'var(--color-receitas, #22c55e)' } : { color: 'var(--color-muted-foreground, #888)' }}
                  >
                    <Landmark size={14} />
                  </button>
                )}
                <DeltaBadge valueA={c.valA} valueB={c.valB} invertColor={c.invertColor} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-md bg-muted/30 p-2.5">
                <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-0.5">{fmtLabel(data.periodALabel)}</p>
                <p className="text-base font-bold tabular-nums" style={c.colorBySign ? { color: c.valA >= 0 ? 'var(--color-receitas, #22c55e)' : 'var(--color-gastos, #ef4444)' } : undefined}>
                  {formatCurrency(c.valA)}
                </p>
              </div>
              <div className="rounded-md bg-muted/30 p-2.5">
                <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-0.5">{fmtLabel(data.periodBLabel)}</p>
                <p className="text-base font-bold tabular-nums" style={c.colorBySign ? { color: c.valB >= 0 ? 'var(--color-receitas, #22c55e)' : 'var(--color-gastos, #ef4444)' } : undefined}>
                  {formatCurrency(c.valB)}
                </p>
              </div>
            </div>
          </Card>
        )
      })}
    </div>
  )
}
