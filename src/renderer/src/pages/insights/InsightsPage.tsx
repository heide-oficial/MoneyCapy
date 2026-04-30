import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { BarChart3, Users, AlertCircle } from 'lucide-react'
import { Card } from '../../components/ui/Card'
import { Button } from '../../components/ui/Button'
import { Toggle } from '../../components/ui/Toggle'
import { SectionLayout } from '../../components/layout/SectionLayout'
import { CurrencySelector } from '../../components/ui/CurrencyMonthNavigator'
import { useActivePerson } from '../../contexts/ActivePersonContext'
import { useStartCountingMonth } from '../../contexts/StartCountingMonthContext'
import { useColorSettings } from '../../contexts/ColorSettingsContext'
import { useTranslation } from '../../contexts/LanguageContext'
import { ROUTES } from '../../lib/constants'
import { presetToDateRange, getDefaultPreset } from '../../lib/insights-utils'
import { useFormatDate, getMonthLabel } from '../../lib/date'
import { InsightsToolbar } from './components/InsightsToolbar'
import { InsightsSummaryCards } from './components/InsightsSummaryCards'
import { InsightsLineChart } from './components/InsightsLineChart'
import { InsightsPieChart } from './components/InsightsPieChart'
import type { PieData, PieViewMode } from './components/InsightsPieChart'
import { TopItemsList } from './components/TopItemsList'
import { PeriodDetailModal } from './components/PeriodDetailModal'
import type {
  InsightsMode, TemporalGrouping, ComparisonGranularity,
  InsightsTemporalResult, InsightsComparativeResult
} from '../../../../../shared/insights-types'

export default function InsightsPage() {
  const navigate = useNavigate()
  const { activePerson } = useActivePerson()
  const { startCountingMonth } = useStartCountingMonth()
  const { fmtDate, fmtMonth } = useFormatDate()
  const { colors } = useColorSettings()
  const { t } = useTranslation()
  const gastosColor = colors.gastos || '#ef4444'
  const receitasColor = colors.receitas || '#10b981'
  const saldoColor = colors.saldo || '#3b82f6'
  const fmtLabel = (l: string) => {
    if (l.length === 10) return fmtDate(l)
    if (l.length === 7) return fmtMonth(l)
    return l
  }

  const SENTINEL_KEYS: Record<string, string> = {
    '__no_category__': 'categories.noCategory',
    '__no_tag__': 'tags.noTag',
    '__card__': 'cards.card'
  }
  const tName = (name: string) => SENTINEL_KEYS[name] ? t(SENTINEL_KEYS[name]) : name

  // Mode
  const [mode, setMode] = useState<InsightsMode>('temporal')

  // Temporal state
  const [grouping, setGrouping] = useState<TemporalGrouping>('day')
  const [visualization, setVisualization] = useState<TemporalGrouping>('day')
  const [activePreset, setActivePreset] = useState(getDefaultPreset('day'))

  // Comparative state
  const now = new Date()
  const y = now.getFullYear()
  const m = String(now.getMonth() + 1).padStart(2, '0')
  const [granularity, setGranularity] = useState<ComparisonGranularity>('month')
  const [periodA, setPeriodA] = useState(`${y}-${m}`)
  const [periodB, setPeriodB] = useState(() => {
    const prevM = now.getMonth() === 0 ? 12 : now.getMonth()
    const prevY = now.getMonth() === 0 ? y - 1 : y
    return `${prevY}-${String(prevM).padStart(2, '0')}`
  })

  // Bank account toggle (balance chart)
  const [includeBankAccounts, setIncludeBankAccounts] = useState(false)
  // Account balance in income toggle
  const [includeAccountInIncome, setIncludeAccountInIncome] = useState(false)
  useEffect(() => {
    window.api.settings.get('insightsIncludeBankAccounts').then(val => {
      if (val === 'true') setIncludeBankAccounts(true)
    })
    window.api.settings.get('insightsIncludeAccountInIncome').then(val => {
      if (val === 'true') setIncludeAccountInIncome(true)
    })
  }, [])
  const handleBankAccountToggle = (checked: boolean) => {
    setIncludeBankAccounts(checked)
    window.api.settings.set('insightsIncludeBankAccounts', String(checked))
  }
  const handleAccountInIncomeToggle = (checked: boolean) => {
    setIncludeAccountInIncome(checked)
    window.api.settings.set('insightsIncludeAccountInIncome', String(checked))
  }

  // Data
  const [temporalData, setTemporalData] = useState<InsightsTemporalResult | null>(null)
  const [comparativeData, setComparativeData] = useState<InsightsComparativeResult | null>(null)
  const [loading, setLoading] = useState(false)

  // Modal state
  const [modalOpen, setModalOpen] = useState(false)
  const [modalConfig, setModalConfig] = useState<{
    periodLabel: string; startDate: string; endDate: string
    categoryId?: number | null; tagId?: number | null
    filterType: 'expenses' | 'income' | 'both'
  } | null>(null)

  // Load data
  useEffect(() => {
    if (!activePerson) return

    let cancelled = false
    setLoading(true)

    if (mode === 'temporal') {
      const range = presetToDateRange(grouping, activePreset)
      window.api.insights.temporal(activePerson.id, visualization, range.startDate, range.endDate).then(data => {
        if (!cancelled) { setTemporalData(data); setLoading(false) }
      })
    } else {
      if (!periodA || !periodB) { setLoading(false); return }
      window.api.insights.comparative(activePerson.id, granularity, periodA, periodB).then(data => {
        if (!cancelled) { setComparativeData(data); setLoading(false) }
      })
    }

    return () => { cancelled = true }
  }, [activePerson, mode, grouping, visualization, activePreset, granularity, periodA, periodB])

  // Handlers
  const handleGroupingChange = (g: TemporalGrouping) => {
    setGrouping(g)
    setVisualization(g)
    setActivePreset(getDefaultPreset(g))
  }

  const handleComparativeChange = (g: ComparisonGranularity, a: string, b: string) => {
    setGranularity(g)
    setPeriodA(a)
    setPeriodB(b)
  }

  /** Convert a bucket label to a date range based on grouping */
  const bucketLabelToDateRange = (label: string, g: TemporalGrouping): { startDate: string; endDate: string } => {
    switch (g) {
      case 'day':
        return { startDate: label, endDate: label }
      case 'week': {
        // label is the Monday YYYY-MM-DD
        const d = new Date(label + 'T00:00:00')
        d.setDate(d.getDate() + 6)
        const sun = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
        return { startDate: label, endDate: sun }
      }
      case 'month': {
        // label is YYYY-MM
        const [yr, mo] = label.split('-').map(Number)
        const lastDay = new Date(yr, mo, 0).getDate()
        return { startDate: `${label}-01`, endDate: `${label}-${String(lastDay).padStart(2, '0')}` }
      }
      case 'year':
        return { startDate: `${label}-01-01`, endDate: `${label}-12-31` }
    }
  }

  const handleLineChartClick = (label: string, dataKey: string) => {
    if (!activePerson) return
    const range = bucketLabelToDateRange(label, visualization)
    const filterType = dataKey === 'expenses' ? 'expenses' as const
      : dataKey === 'income' ? 'income' as const
      : 'both' as const
    let formattedLabel = fmtLabel(label)
    if (visualization === 'week') {
      formattedLabel = `${fmtDate(range.startDate)} — ${fmtDate(range.endDate)}`
    }
    setModalConfig({
      periodLabel: formattedLabel,
      startDate: range.startDate,
      endDate: range.endDate,
      filterType
    })
    setModalOpen(true)
  }

  const handlePieSliceClick = (entry: PieData, type: 'category' | 'tag', viewMode: PieViewMode) => {
    if (!activePerson) return
    const range = presetToDateRange(grouping, activePreset)
    setModalConfig({
      periodLabel: entry.name,
      startDate: range.startDate,
      endDate: range.endDate,
      categoryId: type === 'category' ? (entry.categoryId ?? null) : undefined,
      tagId: type === 'tag' ? (entry.tagId ?? null) : undefined,
      filterType: viewMode
    })
    setModalOpen(true)
  }

  if (!activePerson) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <BarChart3 size={24} className="text-primary" />
          <h1 className="text-2xl font-bold">{t('insights.title')}</h1>
        </div>
        <Card className="p-8 text-center">
          <Users size={48} className="mx-auto text-muted-foreground/30 mb-3" />
          <p className="text-muted-foreground mb-4">{t('insights.createProfilePrompt')}</p>
          <Button onClick={() => navigate(ROUTES.PEOPLE)}>{t('insights.createProfile')}</Button>
        </Card>
      </div>
    )
  }

  // Determine chart type for comparative mode
  const getChartType = (): 'line' | 'bar' => {
    if (granularity === 'year') return 'line'
    return 'bar'
  }

  // Check if period includes months before start counting month
  const dateRange = mode === 'temporal' ? presetToDateRange(grouping, activePreset) : null
  const periodStartMonth = dateRange ? dateRange.startDate.substring(0, 7) : null
  const showStartWarning = !!(startCountingMonth && periodStartMonth && periodStartMonth < startCountingMonth)

  return (
    <SectionLayout
      icon={BarChart3}
      title={t('insights.title')}
      monthNav={<CurrencySelector />}
      controls={
        <>
          <InsightsToolbar
            mode={mode}
            onModeChange={setMode}
            grouping={grouping}
            visualization={visualization}
            activePreset={activePreset}
            onGroupingChange={handleGroupingChange}
            onVisualizationChange={setVisualization}
            onPresetChange={setActivePreset}
            granularity={granularity}
            periodA={periodA}
            periodB={periodB}
            onComparativeChange={handleComparativeChange}
          />
          {showStartWarning && (
            <div className="ml-auto flex items-center gap-1.5 text-amber-500">
              <AlertCircle size={14} className="shrink-0" />
              <span className="text-[11px] whitespace-nowrap">{t('insights.dataFromMonth', { month: getMonthLabel(startCountingMonth) })}</span>
            </div>
          )}
        </>
      }
    >
      {loading ? (
        <div className="text-center py-12 text-muted-foreground">{t('common.loading')}</div>
      ) : mode === 'temporal' && temporalData ? (
        <div className="space-y-4">
          <InsightsSummaryCards mode="temporal" data={temporalData} includeAccountBalance={includeAccountInIncome} onToggleAccountBalance={handleAccountInIncomeToggle} />

          <InsightsLineChart
            mode="temporal"
            data={temporalData.timeline}
            dataKey="expenses"
            title={t('insights.expensesEvolution')}
            color={gastosColor}
            grouping={visualization}
            onDataPointClick={handleLineChartClick}
          />
          <InsightsLineChart
            mode="temporal"
            data={temporalData.timeline}
            dataKey="income"
            title={t('insights.incomeEvolution')}
            color={receitasColor}
            grouping={visualization}
            onDataPointClick={handleLineChartClick}
          />
          <InsightsLineChart
            mode="temporal"
            data={includeBankAccounts
              ? temporalData.timeline.map(p => ({ ...p, balance: p.balance + p.bankAccountBalance }))
              : temporalData.timeline}
            dataKey="balance"
            title={t('insights.balanceEvolution')}
            color={saldoColor}
            grouping={visualization}
            onDataPointClick={handleLineChartClick}
            showBankBalance={includeBankAccounts}
            headerExtra={
              <Toggle checked={includeBankAccounts} onChange={handleBankAccountToggle} label={t('insights.includeBankBalance')} />
            }
          />

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <InsightsPieChart
              title={t('insights.byCategory')}
              data={temporalData.topCategories.map(c => ({
                name: tName(c.categoryName) || t('insights.noCategory'),
                value: c.total,
                count: c.count,
                color: c.categoryColor || undefined,
                categoryId: c.categoryId
              }))}
              incomeData={temporalData.topIncomeCategories.map(c => ({
                name: tName(c.categoryName) || t('insights.noCategory'),
                value: c.total,
                count: c.count,
                color: c.categoryColor || undefined,
                categoryId: c.categoryId
              }))}
              onSliceClick={(entry, viewMode) => handlePieSliceClick(entry, 'category', viewMode)}
            />
            <InsightsPieChart
              title={t('insights.byTag')}
              data={temporalData.topTags.map(t => ({
                name: tName(t.tagName),
                value: t.total,
                count: t.count,
                color: t.tagColor,
                tagId: t.tagId
              }))}
              incomeData={temporalData.topIncomeTags.map(t => ({
                name: tName(t.tagName),
                value: t.total,
                count: t.count,
                color: t.tagColor,
                tagId: t.tagId
              }))}
              onSliceClick={(entry, viewMode) => handlePieSliceClick(entry, 'tag', viewMode)}
            />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <TopItemsList items={temporalData.topItems} title={t('insights.topExpenses')} />
            <TopItemsList items={temporalData.topIncomes} title={t('insights.topIncomes')} variant="income" />
          </div>
        </div>
      ) : mode === 'comparative' && comparativeData ? (
        <div className="space-y-4">
          <InsightsSummaryCards mode="comparative" data={comparativeData} includeAccountBalance={includeAccountInIncome} onToggleAccountBalance={handleAccountInIncomeToggle} />

          <InsightsLineChart
            mode="comparative"
            dataA={comparativeData.a.timeline}
            dataB={comparativeData.b.timeline}
            labelA={comparativeData.periodALabel}
            labelB={comparativeData.periodBLabel}
            dataKey="expenses"
            title={t('insights.expensesAvsB')}
            chartType={getChartType()}
          />
          <InsightsLineChart
            mode="comparative"
            dataA={comparativeData.a.timeline}
            dataB={comparativeData.b.timeline}
            labelA={comparativeData.periodALabel}
            labelB={comparativeData.periodBLabel}
            dataKey="income"
            title={t('insights.incomeAvsB')}
            chartType={getChartType()}
          />
          <InsightsLineChart
            mode="comparative"
            dataA={includeBankAccounts
              ? comparativeData.a.timeline.map(p => ({ ...p, balance: p.balance + p.bankAccountBalance }))
              : comparativeData.a.timeline}
            dataB={includeBankAccounts
              ? comparativeData.b.timeline.map(p => ({ ...p, balance: p.balance + p.bankAccountBalance }))
              : comparativeData.b.timeline}
            labelA={comparativeData.periodALabel}
            labelB={comparativeData.periodBLabel}
            dataKey="balance"
            title={t('insights.balanceAvsB')}
            chartType={getChartType()}
            showBankBalance={includeBankAccounts}
          />

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <InsightsPieChart
              title={t('insights.categoriesPeriod', { period: fmtLabel(comparativeData.periodALabel) })}
              data={comparativeData.a.topCategories.map(c => ({
                name: tName(c.categoryName) || t('insights.noCategory'),
                value: c.total,
                count: c.count,
                color: c.categoryColor || undefined
              }))}
              incomeData={comparativeData.a.topIncomeCategories.map(c => ({
                name: tName(c.categoryName) || t('insights.noCategory'),
                value: c.total,
                count: c.count,
                color: c.categoryColor || undefined
              }))}
            />
            <InsightsPieChart
              title={t('insights.categoriesPeriod', { period: fmtLabel(comparativeData.periodBLabel) })}
              data={comparativeData.b.topCategories.map(c => ({
                name: tName(c.categoryName) || t('insights.noCategory'),
                value: c.total,
                count: c.count,
                color: c.categoryColor || undefined
              }))}
              incomeData={comparativeData.b.topIncomeCategories.map(c => ({
                name: tName(c.categoryName) || t('insights.noCategory'),
                value: c.total,
                count: c.count,
                color: c.categoryColor || undefined
              }))}
            />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <TopItemsList
              items={comparativeData.a.topItems}
              title={t('insights.topExpensesPeriod', { period: fmtLabel(comparativeData.periodALabel) })}
            />
            <TopItemsList
              items={comparativeData.b.topItems}
              title={t('insights.topExpensesPeriod', { period: fmtLabel(comparativeData.periodBLabel) })}
            />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <TopItemsList
              items={comparativeData.a.topIncomes}
              title={t('insights.topIncomesPeriod', { period: fmtLabel(comparativeData.periodALabel) })}
              variant="income"
            />
            <TopItemsList
              items={comparativeData.b.topIncomes}
              title={t('insights.topIncomesPeriod', { period: fmtLabel(comparativeData.periodBLabel) })}
              variant="income"
            />
          </div>
        </div>
      ) : (
        <div className="text-center py-12 text-muted-foreground">{t('insights.selectFilters')}</div>
      )}

      {activePerson && modalConfig && (
        <PeriodDetailModal
          open={modalOpen}
          onClose={() => setModalOpen(false)}
          personId={activePerson.id}
          startDate={modalConfig.startDate}
          endDate={modalConfig.endDate}
          periodLabel={modalConfig.periodLabel}
          categoryId={modalConfig.categoryId}
          tagId={modalConfig.tagId}
          filterType={modalConfig.filterType}
        />
      )}
    </SectionLayout>
  )
}
