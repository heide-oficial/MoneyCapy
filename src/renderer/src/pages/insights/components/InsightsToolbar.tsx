import { Select } from '../../../components/ui/Select'
import { DatePicker } from '../../../components/ui/DatePicker'
import { useTranslation } from '../../../contexts/LanguageContext'
import { getTemporalPresets } from '../../../lib/insights-utils'
import type { InsightsMode, TemporalGrouping, ComparisonGranularity } from '../../../../../../shared/insights-types'

interface InsightsToolbarProps {
  mode: InsightsMode
  onModeChange: (mode: InsightsMode) => void
  // Temporal
  grouping: TemporalGrouping
  visualization: TemporalGrouping
  activePreset: string
  onGroupingChange: (grouping: TemporalGrouping) => void
  onVisualizationChange: (visualization: TemporalGrouping) => void
  onPresetChange: (preset: string) => void
  // Comparative
  granularity: ComparisonGranularity
  periodA: string
  periodB: string
  onComparativeChange: (granularity: ComparisonGranularity, periodA: string, periodB: string) => void
}

function getGroupingOptions(t: (key: string) => string) {
  return [
    { value: 'day', label: t('insights.groupByDay') },
    { value: 'week', label: t('insights.groupByWeek') },
    { value: 'month', label: t('insights.groupByMonth') },
    { value: 'year', label: t('insights.groupByYear') },
  ]
}

function getVisualizationOptions(t: (key: string) => string) {
  return [
    { value: 'day', label: t('insights.viewByDay') },
    { value: 'week', label: t('insights.viewByWeek') },
    { value: 'month', label: t('insights.viewByMonth') },
    { value: 'year', label: t('insights.viewByYear') },
  ]
}

function getGranularityOptions(t: (key: string) => string) {
  return [
    { value: 'day', label: t('insights.compareByDay') },
    { value: 'week', label: t('insights.compareByWeek') },
    { value: 'month', label: t('insights.compareByMonth') },
    { value: 'year', label: t('insights.compareByYear') },
  ]
}

const MODE_MAP = { day: 'date', week: 'week', month: 'month', year: 'year' } as const

// Visualization must be equal or finer than the grouping
// day=0, week=1, month=2, year=3 — allowed: visualization index <= grouping index
const GRANULARITY_ORDER: Record<string, number> = { day: 0, week: 1, month: 2, year: 3 }

function getAllowedVisualization(grouping: string, t: (key: string) => string) {
  const maxIdx = GRANULARITY_ORDER[grouping] ?? 0
  return getVisualizationOptions(t).filter(o => GRANULARITY_ORDER[o.value] <= maxIdx)
}

const BTN = 'h-7 px-2.5 text-xs font-medium transition-colors whitespace-nowrap'
const BTN_ACTIVE = `${BTN} bg-primary text-primary-foreground`
const BTN_INACTIVE = `${BTN} hover:bg-accent text-muted-foreground`

export function InsightsToolbar(props: InsightsToolbarProps) {
  const { t } = useTranslation()
  const handleGranularityChange = (g: ComparisonGranularity) => {
    const now = new Date()
    const y = now.getFullYear()
    const m = String(now.getMonth() + 1).padStart(2, '0')
    const d = String(now.getDate()).padStart(2, '0')
    let newA = '', newB = ''
    switch (g) {
      case 'day': newA = `${y}-${m}-${d}`; newB = `${y}-${m}-${d}`; break
      case 'week': newA = `${y}-${m}-${d}`; newB = `${y}-${m}-${d}`; break
      case 'month': newA = `${y}-${m}`; newB = `${y}-${m}`; break
      case 'year': newA = String(y); newB = String(y - 1); break
    }
    props.onComparativeChange(g, newA, newB)
  }

  return (
    <>
      {/* Mode toggle */}
      <div className="flex rounded-md border border-input overflow-hidden h-7">
        <button
          type="button"
          onClick={() => props.onModeChange('temporal')}
          className={props.mode === 'temporal' ? BTN_ACTIVE : BTN_INACTIVE}
        >
          {t('insights.temporal')}
        </button>
        <button
          type="button"
          onClick={() => props.onModeChange('comparative')}
          className={props.mode === 'comparative' ? BTN_ACTIVE : BTN_INACTIVE}
        >
          {t('insights.comparative')}
        </button>
      </div>

      <div className="h-5 w-px bg-border shrink-0" />

      {props.mode === 'temporal' ? (
        <>
          <div className="w-48">
            <Select
              small
              options={getGroupingOptions(t)}
              value={props.grouping}
              onChange={e => props.onGroupingChange(e.target.value as TemporalGrouping)}
            />
          </div>
          <div className="flex rounded-md border border-input overflow-hidden h-7">
            {getTemporalPresets(t)[props.grouping].map(p => (
              <button
                key={p.value}
                type="button"
                onClick={() => props.onPresetChange(p.value)}
                className={props.activePreset === p.value ? BTN_ACTIVE : BTN_INACTIVE}
              >
                {p.label}
              </button>
            ))}
          </div>
          <div className="h-5 w-px bg-border shrink-0" />
          <div className="w-48">
            <Select
              small
              options={getAllowedVisualization(props.grouping, t)}
              value={props.visualization}
              onChange={e => props.onVisualizationChange(e.target.value as TemporalGrouping)}
            />
          </div>
        </>
      ) : (
        <>
          <div className="w-48">
            <Select
              small
              options={getGranularityOptions(t)}
              value={props.granularity}
              onChange={e => handleGranularityChange(e.target.value as ComparisonGranularity)}
            />
          </div>
          <span className="text-xs font-medium text-muted-foreground">A:</span>
          <DatePicker
            mode={MODE_MAP[props.granularity]}
            small
            value={props.periodA}
            onChange={v => props.onComparativeChange(props.granularity, v, props.periodB)}
          />
          <span className="text-xs text-muted-foreground">vs</span>
          <span className="text-xs font-medium text-muted-foreground">B:</span>
          <DatePicker
            mode={MODE_MAP[props.granularity]}
            small
            value={props.periodB}
            onChange={v => props.onComparativeChange(props.granularity, props.periodA, v)}
          />
        </>
      )}
    </>
  )
}
