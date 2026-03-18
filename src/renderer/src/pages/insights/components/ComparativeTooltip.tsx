import { formatCurrency } from '../../../lib/currency'
import { useTranslation } from '../../../contexts/LanguageContext'

interface ComparativeTooltipProps {
  active?: boolean
  payload?: any[]
  label?: string
  labelA: string
  labelB: string
  dataKey: 'expenses' | 'income' | 'balance'
  fmtDate?: (d: string) => string
  fmtMonth?: (m: string) => string
}

function formatLabel(lbl: string, fmtDate?: (d: string) => string, fmtMonth?: (m: string) => string): string {
  if (!lbl) return lbl
  if (lbl.length === 10 && fmtDate) return fmtDate(lbl)
  if (lbl.length === 7 && fmtMonth) return fmtMonth(lbl)
  return lbl
}

export function ComparativeTooltip({ active, payload, label, labelA, labelB, dataKey, fmtDate, fmtMonth }: ComparativeTooltipProps) {
  const { t } = useTranslation()
  if (!active || !payload || payload.length < 2) return null

  const valA = payload[0]?.value ?? 0
  const valB = payload[1]?.value ?? 0
  const delta = valB - valA
  const deltaPct = valA !== 0 ? ((delta / Math.abs(valA)) * 100) : 0

  // For expenses, lower = improvement. For income/balance, higher = improvement.
  const isImprovement = dataKey === 'expenses' ? delta < 0 : delta > 0

  const pointA = payload[0]?.payload?.aFull
  const pointB = payload[0]?.payload?.bFull

  const displayLabel = label ? formatLabel(label, fmtDate, fmtMonth) : null

  return (
    <div className="rounded-lg border border-border bg-card p-3 shadow-md text-sm">
      {displayLabel && (
        <p className="text-muted-foreground mb-1.5 font-medium">{displayLabel}</p>
      )}
      <div className="flex items-center gap-2 mb-1">
        <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: payload[0]?.color }} />
        <span className="text-muted-foreground">{labelA}:</span>
        <span className="font-semibold">{formatCurrency(valA)}</span>
      </div>
      {pointA && dataKey === 'balance' && (
        <div className="ml-5 text-xs text-muted-foreground">
          {t('insights.expensesLabel')}: {formatCurrency(pointA.expenses)} ({pointA.expenseCount}) | {t('insights.incomeLabel')}: {formatCurrency(pointA.income)} ({pointA.incomeCount})
        </div>
      )}
      <div className="flex items-center gap-2 mb-1 mt-1">
        <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: payload[1]?.color }} />
        <span className="text-muted-foreground">{labelB}:</span>
        <span className="font-semibold">{formatCurrency(valB)}</span>
      </div>
      {pointB && dataKey === 'balance' && (
        <div className="ml-5 text-xs text-muted-foreground">
          {t('insights.expensesLabel')}: {formatCurrency(pointB.expenses)} ({pointB.expenseCount}) | {t('insights.incomeLabel')}: {formatCurrency(pointB.income)} ({pointB.incomeCount})
        </div>
      )}
      <div className="border-t border-border pt-1 mt-1">
        <span className="font-semibold" style={{ color: isImprovement ? 'var(--color-receitas, #22c55e)' : 'var(--color-gastos, #ef4444)' }}>
          {delta > 0 ? '+' : ''}{formatCurrency(delta)} ({deltaPct > 0 ? '+' : ''}{deltaPct.toFixed(1)}%)
        </span>
      </div>
    </div>
  )
}
