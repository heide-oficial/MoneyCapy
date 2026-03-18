import { SettingsRepository } from '../database/repositories/settings.repo'

export function getStartCountingMonth(settingsRepo: SettingsRepository, personId: number): string | null {
  const raw = settingsRepo.get(`start-counting-month-${personId}`)
  return raw || null
}

export function isMonthBeforeStart(month: string, startCountingMonth: string | null): boolean {
  if (!startCountingMonth) return false
  return month < startCountingMonth
}
