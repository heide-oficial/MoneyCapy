import type { ReactNode } from 'react'
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend
} from 'recharts'
import { Card } from '../../../components/ui/Card'
import { formatCurrency } from '../../../lib/currency'
import { useFormatDate } from '../../../lib/date'
import { useTranslation } from '../../../contexts/LanguageContext'
import { ComparativeTooltip } from './ComparativeTooltip'
import type { TimePoint, TemporalGrouping } from '../../../../../../shared/insights-types'

interface TemporalLineChartProps {
  mode: 'temporal'
  data: TimePoint[]
  dataKey: 'expenses' | 'income' | 'balance'
  title: string
  color: string
  grouping: TemporalGrouping
  onDataPointClick?: (label: string, dataKey: string) => void
  showBankBalance?: boolean
  headerExtra?: ReactNode
}

interface ComparativeLineChartProps {
  mode: 'comparative'
  dataA: TimePoint[]
  dataB: TimePoint[]
  labelA: string
  labelB: string
  dataKey: 'expenses' | 'income' | 'balance'
  title: string
  chartType: 'line' | 'bar'
  colorA?: string
  colorB?: string
  onDataPointClick?: (label: string, dataKey: string) => void
  showBankBalance?: boolean
}

type Props = TemporalLineChartProps | ComparativeLineChartProps

function getISOWeekNumber(dateStr: string): number {
  const d = new Date(dateStr + 'T00:00:00')
  d.setDate(d.getDate() + 3 - ((d.getDay() + 6) % 7))
  const yearStart = new Date(d.getFullYear(), 0, 4)
  return Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7)
}

function sundayOf(mondayStr: string): string {
  const d = new Date(mondayStr + 'T00:00:00')
  d.setDate(d.getDate() + 6)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function formatWeekLabel(mondayStr: string, fmtDate: (d: string) => string, t: (key: string, params?: any) => string): string {
  const weekNum = getISOWeekNumber(mondayStr)
  return t('insights.weekLabel', { weekNum, start: fmtDate(mondayStr), end: fmtDate(sundayOf(mondayStr)) })
}

function getISOWeekYear(dateStr: string): number {
  const d = new Date(dateStr + 'T00:00:00')
  d.setDate(d.getDate() + 3 - ((d.getDay() + 6) % 7))
  return d.getFullYear()
}

function formatWeekTickShort(mondayStr: string, fmtDate: (d: string) => string, t: (key: string, params?: any) => string): string {
  return t('insights.weekShort', { weekNum: getISOWeekNumber(mondayStr), year: getISOWeekYear(mondayStr) })
}

function TemporalTooltip({ active, payload, label, dataKey, grouping, fmtDate, fmtMonth, lineColor, showBankBalance, t }: any) {
  if (!active || !payload || !payload[0]) return null
  const point = payload[0].payload as TimePoint

  const formatLabel = (lbl: string) => {
    if (!lbl) return lbl
    if (grouping === 'day' && lbl.length === 10) return fmtDate(lbl)
    if (grouping === 'week' && lbl.length === 10) return formatWeekLabel(lbl, fmtDate, t)
    if (grouping === 'month' && lbl.length === 7) return fmtMonth(lbl)
    return lbl
  }

  return (
    <div className="rounded-lg border border-border bg-card p-2.5 shadow-md text-sm">
      <p className="text-muted-foreground mb-1.5 font-medium">{formatLabel(label)}</p>
      {dataKey === 'expenses' && (
        <>
          <p style={{ color: lineColor }} className="font-semibold">{t('insights.expensesLabel')}: {formatCurrency(point.expenses)}</p>
          <p className="text-xs text-muted-foreground">{point.expenseCount} {point.expenseCount === 1 ? t('insights.itemSingular') : t('insights.itemPlural')}</p>
        </>
      )}
      {dataKey === 'income' && (
        <>
          <p style={{ color: lineColor }} className="font-semibold">{t('insights.incomeLabel')}: {formatCurrency(point.income)}</p>
          <p className="text-xs text-muted-foreground">{point.incomeCount === 1 ? t('items.incomeCount', { count: point.incomeCount }) : t('items.incomeCountPlural', { count: point.incomeCount })}</p>
        </>
      )}
      {dataKey === 'balance' && (
        <>
          <p style={{ color: lineColor }} className="font-semibold">{t('insights.balanceLabel')}: {formatCurrency(point.balance)}</p>
          {showBankBalance && point.bankAccountBalance !== undefined && (
            <div className="border-t border-border mt-1.5 pt-1.5 space-y-0.5">
              <p className="text-xs text-muted-foreground">{t('insights.operationalBalance')} {formatCurrency((point as any).operationalBalance ?? point.balance)}</p>
              <p className="text-xs text-muted-foreground">{t('insights.cashInAccount')} {formatCurrency(point.bankAccountBalance)}</p>
            </div>
          )}
          {(point.expenses > 0 || point.income > 0) && (
            <div className="border-t border-border mt-1.5 pt-1.5 space-y-0.5">
              <p className="text-xs text-muted-foreground">{t('insights.expensesLabel')}: {formatCurrency(point.expenses)} ({point.expenseCount})</p>
              <p className="text-xs text-muted-foreground">{t('insights.incomeLabel')}: {formatCurrency(point.income)} ({point.incomeCount})</p>
            </div>
          )}
        </>
      )}
    </div>
  )
}

export function InsightsLineChart(props: Props) {
  const { fmtDate, fmtMonth } = useFormatDate()
  const { t } = useTranslation()

  if (props.mode === 'temporal') {
    const { data, dataKey, title, color, grouping, onDataPointClick, showBankBalance, headerExtra } = props
    if (data.length === 0) {
      return (
        <Card className="p-4">
          <h3 className="text-sm font-semibold mb-3">{title}</h3>
          <p className="text-xs text-muted-foreground py-8 text-center">{t('insights.noData')}</p>
        </Card>
      )
    }

    const formatTickLabel = (lbl: string) => {
      if (!lbl) return lbl
      if (grouping === 'day' && lbl.length === 10) return fmtDate(lbl)
      if (grouping === 'week' && lbl.length === 10) return formatWeekTickShort(lbl, fmtDate, t)
      if (grouping === 'month' && lbl.length === 7) return fmtMonth(lbl)
      return lbl
    }

    return (
      <Card className="p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold">{title}</h3>
          {headerExtra}
        </div>
        <ResponsiveContainer width="100%" height={250}>
          <LineChart
            data={data}
            onClick={(state: any) => {
              if (onDataPointClick && state?.activeLabel) {
                onDataPointClick(state.activeLabel, dataKey)
              }
            }}
            style={{ cursor: 'pointer' }}
          >
            <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
            <XAxis
              dataKey="label"
              tick={{ fontSize: 11 }}
              className="text-muted-foreground"
              tickFormatter={formatTickLabel}
              interval="preserveStartEnd"
            />
            <YAxis tick={{ fontSize: 11 }} className="text-muted-foreground" tickFormatter={v => formatCurrency(v)} />
            <Tooltip content={<TemporalTooltip dataKey={dataKey} grouping={grouping} fmtDate={fmtDate} fmtMonth={fmtMonth} lineColor={color} showBankBalance={showBankBalance} t={t} />} />
            <Line
              type="linear"
              dataKey={dataKey}
              stroke={color}
              strokeWidth={2}
              dot={data.length <= 31 ? { r: 3 } : false}
              activeDot={{ r: 5 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </Card>
    )
  }

  // Comparative mode
  const { dataA, dataB, labelA, labelB, dataKey, title, chartType, colorA: propColorA, colorB: propColorB, onDataPointClick } = props

  // Format comparative labels with app settings
  const formatCompLabel = (lbl: string) => {
    if (!lbl) return lbl
    if (lbl.length === 10) return fmtDate(lbl)
    if (lbl.length === 7) return fmtMonth(lbl)
    return lbl
  }

  // Normalize: use longest timeline, merge by index
  const maxLen = Math.max(dataA.length, dataB.length)
  const merged = Array.from({ length: maxLen }, (_, i) => ({
    label: dataA[i]?.label || dataB[i]?.label || String(i),
    a: dataA[i]?.[dataKey] ?? 0,
    b: dataB[i]?.[dataKey] ?? 0,
    aFull: dataA[i] || null,
    bFull: dataB[i] || null
  }))

  if (merged.length === 0) {
    return (
      <Card className="p-4">
        <h3 className="text-sm font-semibold mb-3">{title}</h3>
        <p className="text-xs text-muted-foreground py-8 text-center">{t('insights.noData')}</p>
      </Card>
    )
  }

  const colorA = propColorA || '#3b82f6'
  const colorB = propColorB || '#f59e0b'

  const fmtLabelA = formatCompLabel(labelA)
  const fmtLabelB = formatCompLabel(labelB)

  const tooltipContent = (p: any) => (
    <ComparativeTooltip
      active={p.active}
      payload={p.payload}
      label={p.label}
      labelA={fmtLabelA}
      labelB={fmtLabelB}
      dataKey={dataKey}
      fmtDate={fmtDate}
      fmtMonth={fmtMonth}
    />
  )

  return (
    <Card className="p-4">
      <h3 className="text-sm font-semibold mb-3">{title}</h3>
      <ResponsiveContainer width="100%" height={250}>
        {chartType === 'line' ? (
          <LineChart data={merged}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
            <XAxis dataKey="label" tick={{ fontSize: 11 }} tickFormatter={formatCompLabel} />
            <YAxis tick={{ fontSize: 11 }} tickFormatter={v => formatCurrency(v)} />
            <Tooltip content={tooltipContent} />
            <Legend formatter={(value: string) => (
              <span className="text-xs">{value === 'a' ? fmtLabelA : fmtLabelB}</span>
            )} />
            <Line type="linear" dataKey="a" name="a" stroke={colorA} strokeWidth={2} dot={{ r: 3 }} />
            <Line type="linear" dataKey="b" name="b" stroke={colorB} strokeWidth={2} dot={{ r: 3 }} />
          </LineChart>
        ) : (
          <BarChart data={merged}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
            <XAxis dataKey="label" tick={{ fontSize: 11 }} tickFormatter={formatCompLabel} />
            <YAxis tick={{ fontSize: 11 }} tickFormatter={v => formatCurrency(v)} />
            <Tooltip content={tooltipContent} cursor={{ fill: 'currentColor', opacity: 0.05 }} />
            <Legend formatter={(value: string) => (
              <span className="text-xs">{value === 'a' ? fmtLabelA : fmtLabelB}</span>
            )} />
            <Bar dataKey="a" name="a" fill={colorA} radius={[4, 4, 0, 0]} cursor="pointer"
              onClick={(data: any) => { if (onDataPointClick && data?.label) onDataPointClick(data.label, dataKey) }} />
            <Bar dataKey="b" name="b" fill={colorB} radius={[4, 4, 0, 0]} cursor="pointer"
              onClick={(data: any) => { if (onDataPointClick && data?.label) onDataPointClick(data.label, dataKey) }} />
          </BarChart>
        )}
      </ResponsiveContainer>
    </Card>
  )
}
