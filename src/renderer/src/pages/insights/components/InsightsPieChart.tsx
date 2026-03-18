import { useState, useEffect } from 'react'
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts'
import { Eye, EyeOff } from 'lucide-react'
import { Card } from '../../../components/ui/Card'
import { formatCurrency } from '../../../lib/currency'
import { useTranslation } from '../../../contexts/LanguageContext'
import { stableColor } from '../../../lib/insights-utils'

export type PieViewMode = 'expenses' | 'income'

export interface PieData {
  name: string
  value: number
  count: number
  color?: string
  categoryId?: number | null
  tagId?: number | null
}

interface InsightsPieChartProps {
  data: PieData[]
  incomeData?: PieData[]
  title: string
  onSliceClick?: (entry: PieData, viewMode: PieViewMode) => void
}

const GRAY = '#6b7280'

function getColor(entry: PieData, noCategoryLabel: string, noTagLabel: string): string {
  if (entry.name === noCategoryLabel || entry.name === noTagLabel) return GRAY
  if (entry.color) return entry.color
  return stableColor(entry.name)
}

function CustomTooltip({ active, payload, t }: any) {
  if (!active || !payload || !payload[0]) return null
  const { name, value, count } = payload[0].payload
  return (
    <div className="rounded-lg border border-border bg-card p-2 shadow-md text-sm">
      <p className="font-medium">{name}</p>
      <p className="text-muted-foreground">{formatCurrency(value)}</p>
      <p className="text-xs text-muted-foreground">{count} {count === 1 ? t('insights.itemSingular') : t('insights.itemPlural')}</p>
    </div>
  )
}

export function InsightsPieChart({ data, incomeData, title, onSliceClick }: InsightsPieChartProps) {
  const { t } = useTranslation()
  const noCategoryLabel = t('insights.noCategory')
  const noTagLabel = t('tags.noTag')
  const hasToggle = !!incomeData
  const [viewMode, setViewMode] = useState<PieViewMode>('expenses')
  const [disabled, setDisabled] = useState<Set<string>>(new Set())

  // Reset disabled set when switching mode
  useEffect(() => { setDisabled(new Set()) }, [viewMode])

  const activeData = viewMode === 'income' && incomeData ? incomeData : data
  const allData = activeData.filter(d => d.value > 0)
  const chartData = allData.filter(d => !disabled.has(d.name))
  const total = chartData.reduce((s, d) => s + d.value, 0)

  const toggleEntry = (name: string) => {
    setDisabled(prev => {
      const next = new Set(prev)
      if (next.has(name)) next.delete(name)
      else next.add(name)
      return next
    })
  }

  return (
    <Card className="p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold">{title}</h3>
        {hasToggle && (
          <div className="flex rounded-md border border-border overflow-hidden text-[11px]">
            <button
              type="button"
              onClick={() => setViewMode('expenses')}
              className={`px-2.5 py-0.5 font-medium transition-colors ${
                viewMode === 'expenses'
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:text-foreground hover:bg-accent/50'
              }`}
            >
              {t('insights.expensesLabel')}
            </button>
            <button
              type="button"
              onClick={() => setViewMode('income')}
              className={`px-2.5 py-0.5 font-medium transition-colors ${
                viewMode === 'income'
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:text-foreground hover:bg-accent/50'
              }`}
            >
              {t('insights.incomeLabel')}
            </button>
          </div>
        )}
      </div>
      {allData.length === 0 ? (
        <p className="text-xs text-muted-foreground py-8 text-center">{t('insights.noData')}</p>
      ) : (
        <>
          {chartData.length > 0 && (
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie
                  data={chartData}
                  cx="50%"
                  cy="50%"
                  outerRadius={85}
                  innerRadius={40}
                  dataKey="value"
                  stroke="none"
                  cursor={onSliceClick ? 'pointer' : undefined}
                  onClick={(_, index) => {
                    if (onSliceClick && chartData[index]) onSliceClick(chartData[index], viewMode)
                  }}
                >
                  {chartData.map((entry, index) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={getColor(entry, noCategoryLabel, noTagLabel)}
                      />
                  ))}
                </Pie>
                <Tooltip content={<CustomTooltip t={t} />} />
              </PieChart>
            </ResponsiveContainer>
          )}

          {/* Custom legend with values */}
          <div className="space-y-1 mt-2">
            {allData.map((entry) => {
              const color = getColor(entry, noCategoryLabel, noTagLabel)
              const isDisabled = disabled.has(entry.name)
              const pct = total > 0 && !isDisabled ? ((entry.value / total) * 100).toFixed(1) : '0.0'

              return (
                <div key={entry.name} className="group flex items-center">
                  <button
                    type="button"
                    onClick={() => onSliceClick ? onSliceClick(entry, viewMode) : toggleEntry(entry.name)}
                    className={`flex items-center gap-2 flex-1 min-w-0 px-2 py-1 rounded hover:bg-accent/50 transition-colors text-left ${
                      isDisabled ? 'opacity-35' : ''
                    }`}
                  >
                    <span
                      className="h-2.5 w-2.5 rounded-full shrink-0"
                      style={{ backgroundColor: isDisabled ? GRAY : color }}
                    />
                    <span className="text-xs flex-1 truncate">{entry.name}</span>
                    <span className="text-xs text-muted-foreground tabular-nums">{pct}%</span>
                    <span className="text-xs font-medium tabular-nums">{formatCurrency(entry.value)}</span>
                    <span className="text-[10px] text-muted-foreground">({entry.count})</span>
                  </button>
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); toggleEntry(entry.name) }}
                    className="p-1 rounded hover:bg-accent transition-all shrink-0"
                    title={isDisabled ? t('insights.show') : t('insights.hide')}
                  >
                    {isDisabled
                      ? <EyeOff size={12} className="text-muted-foreground" />
                      : <Eye size={12} className="text-muted-foreground" />
                    }
                  </button>
                </div>
              )
            })}
          </div>
        </>
      )}
    </Card>
  )
}
