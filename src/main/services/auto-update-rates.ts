import { BrowserWindow } from 'electron'
import { WrappedDatabase } from '../database/connection'
import { CurrenciesRepository } from '../database/repositories/currencies.repo'
import { SettingsRepository } from '../database/repositories/settings.repo'
import { fetchExchangeRates, clearRatesCache } from './frankfurter.service'

let autoUpdateTimer: ReturnType<typeof setInterval> | null = null
let currentDb: WrappedDatabase | null = null

const INTERVAL_MS: Record<string, number> = {
  '3h':  10800000,
  '6h':  21600000,
  '9h':  32400000,
  '12h': 43200000,
  '24h': 86400000
}

async function doUpdateRates(db: WrappedDatabase): Promise<void> {
  try {
    const settingsRepo = new SettingsRepository(db)
    const enabled = settingsRepo.get('frankfurterEnabled')
    if (enabled !== 'true') return

    const repo = new CurrenciesRepository(db)
    const base = repo.getBase() as any
    if (!base) return

    clearRatesCache()
    const rates = await fetchExchangeRates(base.code)
    if (!rates || Object.keys(rates).length === 0) return

    // Frankfurter returns "1 base = X foreign", we store "1 foreign = Y base" (inverted)
    const all = repo.findAll() as any[]
    for (const c of all) {
      if (c.is_base === 1) continue
      const rawRate = rates[c.code]
      if (rawRate !== undefined && rawRate !== 0) {
        repo.update(c.id, { exchange_rate: 1 / rawRate })
      }
    }

    // Update all snapshots to match current rates
    repo.updateSnapshots()

    const win = BrowserWindow.getAllWindows()[0]
    if (win) {
      win.webContents.send('currencies-updated')
    }
  } catch {
    // Silently fail - auto update should not crash the app
  }
}

export function startAutoUpdateRates(db: WrappedDatabase): void {
  currentDb = db
  const settingsRepo = new SettingsRepository(db)

  const frankfurterEnabled = settingsRepo.get('frankfurterEnabled')
  if (frankfurterEnabled !== 'true') return

  const onStartup = settingsRepo.get('autoUpdateOnStartup') === 'true'
  const intervalMode = settingsRepo.get('autoUpdateInterval') || 'off'
  const intervalMs = INTERVAL_MS[intervalMode]

  // Update immediately on startup if either mode is active
  if (onStartup || intervalMs) {
    doUpdateRates(db)
  }

  // Schedule periodic updates
  if (intervalMs) {
    autoUpdateTimer = setInterval(() => doUpdateRates(db), intervalMs)
  }
}

export function restartAutoUpdateRates(db: WrappedDatabase): void {
  stopAutoUpdateRates()
  startAutoUpdateRates(db)
}

export function stopAutoUpdateRates(): void {
  if (autoUpdateTimer) {
    clearInterval(autoUpdateTimer)
    autoUpdateTimer = null
  }
}
