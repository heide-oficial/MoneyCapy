export type DayType = 'static' | 'business_day' | 'last_day' | 'last_business_day'

export interface DaySpec {
  day: number | null
  dayType: DayType
}

export interface BusinessDayConfig {
  mode: 'manual' | 'api'
  weekdays: number[]       // 0=Sun..6=Sat, default [1,2,3,4,5] (Mon-Fri)
  countryCode: string      // used when mode='api', default 'BR'
}

export const DEFAULT_BUSINESS_DAY_CONFIG: BusinessDayConfig = {
  mode: 'manual',
  weekdays: [1, 2, 3, 4, 5],
  countryCode: 'BR'
}

export function daysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate()
}

export function isBusinessDay(date: Date, weekdays: number[], holidays?: string[]): boolean {
  const dow = date.getDay()
  if (!weekdays.includes(dow)) return false
  if (holidays && holidays.length > 0) {
    const dateStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
    if (holidays.includes(dateStr)) return false
  }
  return true
}

export function resolveDay(
  spec: DaySpec,
  year: number,
  month: number,
  businessDayConfig: BusinessDayConfig,
  holidays?: string[]
): number | null {
  const dim = daysInMonth(year, month)
  const effectiveHolidays = businessDayConfig.mode === 'api' ? (holidays || []) : []

  switch (spec.dayType) {
    case 'static': {
      if (spec.day == null) return null
      return Math.min(spec.day, dim)
    }
    case 'business_day': {
      if (spec.day == null || spec.day <= 0) return null
      let count = 0
      for (let d = 1; d <= dim; d++) {
        const date = new Date(year, month - 1, d)
        if (isBusinessDay(date, businessDayConfig.weekdays, effectiveHolidays)) {
          count++
          if (count === spec.day) return d
        }
      }
      // If nth business day exceeds available days, return last business day
      for (let d = dim; d >= 1; d--) {
        const date = new Date(year, month - 1, d)
        if (isBusinessDay(date, businessDayConfig.weekdays, effectiveHolidays)) return d
      }
      return dim
    }
    case 'last_day': {
      return dim
    }
    case 'last_business_day': {
      for (let d = dim; d >= 1; d--) {
        const date = new Date(year, month - 1, d)
        if (isBusinessDay(date, businessDayConfig.weekdays, effectiveHolidays)) return d
      }
      return dim
    }
  }
}

export function formatDayLabel(day: number | null, dayType: DayType | string | null, prefix: string): string {
  if (!dayType || dayType === 'none' || dayType === 'static') {
    if (day == null) return ''
    return `${prefix} dia ${day}`
  }
  if (dayType === 'random') {
    return `${prefix} dia aleatorio`
  }
  if (dayType === 'business_day') {
    if (day == null) return ''
    return `${prefix} ${day}o dia util`
  }
  if (dayType === 'last_day') {
    return `${prefix} ultimo dia`
  }
  if (dayType === 'last_business_day') {
    return `${prefix} ultimo dia util`
  }
  if (day == null) return ''
  return `${prefix} dia ${day}`
}

/** Like formatDayLabel but resolves logical days to their actual calendar day for a given month.
 *  Shows DD/MM format for clarity. */
export function formatDayLabelResolved(
  day: number | null, dayType: DayType | string | null, prefix: string,
  year: number, month: number, config: BusinessDayConfig, holidays?: string[],
  monthOffset = 0
): string {
  if (!dayType || dayType === 'none') {
    if (day == null) return ''
    let m = month + monthOffset
    if (m > 12) m -= 12
    if (m < 1) m += 12
    return `${prefix} dia ${String(day).padStart(2, '0')}/${String(m).padStart(2, '0')}`
  }
  if (dayType === 'random') return `${prefix} dia aleatorio`

  // Apply month offset for resolution
  let resolveMonth = month + monthOffset
  let resolveYear = year
  if (resolveMonth > 12) { resolveYear++; resolveMonth -= 12 }
  if (resolveMonth < 1) { resolveYear--; resolveMonth += 12 }

  if (dayType === 'static') {
    if (day == null) return ''
    return `${prefix} dia ${String(day).padStart(2, '0')}/${String(resolveMonth).padStart(2, '0')}`
  }
  // Resolve logical day types to actual calendar day
  const resolved = resolveDay({ day, dayType: dayType as DayType }, resolveYear, resolveMonth, config, holidays)
  if (resolved == null) return ''
  return `${prefix} dia ${String(resolved).padStart(2, '0')}/${String(resolveMonth).padStart(2, '0')}`
}
