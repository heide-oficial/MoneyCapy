import type { TemporalGrouping } from '../../../../shared/insights-types'

export interface TemporalPreset {
  value: string
  label: string
  count: number
}

export const TEMPORAL_PRESETS: Record<TemporalGrouping, TemporalPreset[]> = {
  day: [
    { value: 'today', label: 'Hoje', count: 0 },
    { value: '7d', label: '7 dias', count: 7 },
    { value: '14d', label: '14 dias', count: 14 },
    { value: '30d', label: '30 dias', count: 30 },
    { value: '60d', label: '60 dias', count: 60 },
    { value: '90d', label: '90 dias', count: 90 },
  ],
  week: [
    { value: 'this-week', label: 'Semana atual', count: 0 },
    { value: '2w', label: '2 sem', count: 2 },
    { value: '4w', label: '4 sem', count: 4 },
    { value: '8w', label: '8 sem', count: 8 },
    { value: '12w', label: '12 sem', count: 12 },
    { value: '24w', label: '24 sem', count: 24 },
  ],
  month: [
    { value: 'this-month', label: 'Mês atual', count: 0 },
    { value: '2m', label: '2 meses', count: 2 },
    { value: '3m', label: '3 meses', count: 3 },
    { value: '6m', label: '6 meses', count: 6 },
    { value: '12m', label: '12 meses', count: 12 },
  ],
  year: [
    { value: 'this-year', label: 'Ano atual', count: 0 },
    { value: '3y', label: '3 anos', count: 3 },
    { value: '5y', label: '5 anos', count: 5 },
    { value: '10y', label: '10 anos', count: 10 },
  ],
}

function toDateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export function presetToDateRange(
  grouping: TemporalGrouping,
  presetValue: string
): { startDate: string; endDate: string } {
  const presets = TEMPORAL_PRESETS[grouping]
  const preset = presets.find(p => p.value === presetValue)
  if (!preset) {
    // fallback
    return { startDate: toDateStr(new Date()), endDate: toDateStr(new Date()) }
  }

  const now = new Date()
  const endDate = toDateStr(now)

  // Handle "current period" presets (count === 0)
  if (preset.count === 0) {
    switch (grouping) {
      case 'day':
        return { startDate: endDate, endDate }
      case 'week': {
        const dayOfWeek = now.getDay()
        const diffToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1
        const monday = new Date(now)
        monday.setDate(monday.getDate() - diffToMonday)
        return { startDate: toDateStr(monday), endDate }
      }
      case 'month': {
        const firstDay = new Date(now.getFullYear(), now.getMonth(), 1)
        return { startDate: toDateStr(firstDay), endDate }
      }
      case 'year':
        return { startDate: `${now.getFullYear()}-01-01`, endDate }
    }
  }

  switch (grouping) {
    case 'day': {
      const start = new Date(now)
      start.setDate(start.getDate() - (preset.count - 1))
      return { startDate: toDateStr(start), endDate }
    }
    case 'week': {
      const start = new Date(now)
      start.setDate(start.getDate() - (preset.count * 7 - 1))
      return { startDate: toDateStr(start), endDate }
    }
    case 'month': {
      const start = new Date(now.getFullYear(), now.getMonth() - (preset.count - 1), 1)
      return { startDate: toDateStr(start), endDate }
    }
    case 'year': {
      const startYear = now.getFullYear() - (preset.count - 1)
      return { startDate: `${startYear}-01-01`, endDate }
    }
  }
}

export function getTemporalPresets(t: (key: string) => string): Record<TemporalGrouping, TemporalPreset[]> {
  return {
    day: [
      { value: 'today', label: t('insightsPresets.today'), count: 0 },
      { value: '7d', label: t('insightsPresets.7d'), count: 7 },
      { value: '14d', label: t('insightsPresets.14d'), count: 14 },
      { value: '30d', label: t('insightsPresets.30d'), count: 30 },
      { value: '60d', label: t('insightsPresets.60d'), count: 60 },
      { value: '90d', label: t('insightsPresets.90d'), count: 90 },
    ],
    week: [
      { value: 'this-week', label: t('insightsPresets.thisWeek'), count: 0 },
      { value: '2w', label: t('insightsPresets.2w'), count: 2 },
      { value: '4w', label: t('insightsPresets.4w'), count: 4 },
      { value: '8w', label: t('insightsPresets.8w'), count: 8 },
      { value: '12w', label: t('insightsPresets.12w'), count: 12 },
      { value: '24w', label: t('insightsPresets.24w'), count: 24 },
    ],
    month: [
      { value: 'this-month', label: t('insightsPresets.thisMonth'), count: 0 },
      { value: '2m', label: t('insightsPresets.2m'), count: 2 },
      { value: '3m', label: t('insightsPresets.3m'), count: 3 },
      { value: '6m', label: t('insightsPresets.6m'), count: 6 },
      { value: '12m', label: t('insightsPresets.12m'), count: 12 },
    ],
    year: [
      { value: 'this-year', label: t('insightsPresets.thisYear'), count: 0 },
      { value: '3y', label: t('insightsPresets.3y'), count: 3 },
      { value: '5y', label: t('insightsPresets.5y'), count: 5 },
      { value: '10y', label: t('insightsPresets.10y'), count: 10 },
    ],
  }
}

export function getDefaultPreset(grouping: TemporalGrouping): string {
  switch (grouping) {
    case 'day': return '30d'
    case 'week': return '8w'
    case 'month': return '6m'
    case 'year': return '3y'
  }
}

// 24 visually distinct colors, spread across hues to avoid adjacent duplicates
export const CHART_COLORS = [
  '#3b82f6', // blue
  '#ef4444', // red
  '#10b981', // emerald
  '#f59e0b', // amber
  '#8b5cf6', // violet
  '#ec4899', // pink
  '#06b6d4', // cyan
  '#f97316', // orange
  '#14b8a6', // teal
  '#6366f1', // indigo
  '#84cc16', // lime
  '#e11d48', // rose
  '#0ea5e9', // sky
  '#a855f7', // purple
  '#22c55e', // green
  '#d946ef', // fuchsia
  '#eab308', // yellow
  '#2563eb', // blue-600
  '#dc2626', // red-600
  '#059669', // emerald-600
  '#7c3aed', // violet-600
  '#db2777', // pink-600
  '#0891b2', // cyan-600
  '#ea580c', // orange-600
]

/**
 * Deterministic color for a given name.
 * Same name always produces the same color, avoiding index-based instability.
 */
export function stableColor(name: string): string {
  let hash = 0
  for (let i = 0; i < name.length; i++) {
    hash = ((hash << 5) - hash + name.charCodeAt(i)) | 0
  }
  const idx = ((hash % CHART_COLORS.length) + CHART_COLORS.length) % CHART_COLORS.length
  return CHART_COLORS[idx]
}
