import { ipcMain } from 'electron'
import { WrappedDatabase } from '../database/connection'
import { IPC_CHANNELS } from '../../../shared/ipc-channels'
import { CurrenciesRepository } from '../database/repositories/currencies.repo'
import { SettingsRepository } from '../database/repositories/settings.repo'
import { fetchExchangeRates, fetchAvailableCurrencies, clearRatesCache } from '../services/frankfurter.service'
import { restartAutoUpdateRates } from '../services/auto-update-rates'

function mapCurrency(c: any) {
  return {
    id: c.id,
    code: c.code,
    name: c.name,
    symbol: c.symbol,
    exchangeRate: c.exchange_rate,
    isBase: c.is_base === 1,
    createdAt: c.created_at,
    updatedAt: c.updated_at
  }
}

export function registerCurrenciesHandlers(db: WrappedDatabase): void {
  const repo = new CurrenciesRepository(db)
  const settingsRepo = new SettingsRepository(db)

  ipcMain.handle(IPC_CHANNELS.CURRENCIES_LIST, () => {
    return (repo.findAll() as any[]).map(mapCurrency)
  })

  ipcMain.handle(IPC_CHANNELS.CURRENCIES_GET_BASE, () => {
    const base = repo.getBase() as any
    return base ? mapCurrency(base) : null
  })

  ipcMain.handle(IPC_CHANNELS.CURRENCIES_CREATE, (_, data) => {
    const currency = repo.create({
      code: data.code,
      name: data.name,
      symbol: data.symbol,
      exchange_rate: data.exchangeRate ?? 1.0
    }) as any
    return mapCurrency(currency)
  })

  ipcMain.handle(IPC_CHANNELS.CURRENCIES_UPDATE, (_, data) => {
    const updateData: Record<string, any> = {}
    if (data.code !== undefined) updateData.code = data.code
    if (data.name !== undefined) updateData.name = data.name
    if (data.symbol !== undefined) updateData.symbol = data.symbol
    if (data.exchangeRate !== undefined) updateData.exchange_rate = data.exchangeRate
    const currency = repo.update(data.id, updateData) as any
    return mapCurrency(currency)
  })

  ipcMain.handle(IPC_CHANNELS.CURRENCIES_DELETE, (_, id: number) => {
    return repo.delete(id)
  })

  ipcMain.handle(IPC_CHANNELS.CURRENCIES_SET_BASE, (_, id: number) => {
    const currency = repo.setAsBase(id) as any
    // Update the currencySettings symbol to match new base
    if (currency) {
      const configRaw = settingsRepo.get('currencySettings')
      if (configRaw) {
        try {
          const config = JSON.parse(configRaw)
          config.symbol = currency.symbol
          settingsRepo.set('currencySettings', JSON.stringify(config))
        } catch { /* ignore */ }
      }
    }
    return currency ? mapCurrency(currency) : null
  })

  ipcMain.handle(IPC_CHANNELS.CURRENCIES_FETCH_RATES, async (_, baseCode?: string, forceRefresh?: boolean) => {
    const enabled = settingsRepo.get('frankfurterEnabled')
    if (enabled !== 'true') return {}
    if (forceRefresh) clearRatesCache()
    const base = baseCode || ((repo.getBase() as any)?.code ?? 'USD')
    return fetchExchangeRates(base)
  })

  ipcMain.handle(IPC_CHANNELS.CURRENCIES_FETCH_AVAILABLE, async () => {
    const enabled = settingsRepo.get('frankfurterEnabled')
    if (enabled !== 'true') return {}
    return fetchAvailableCurrencies()
  })

  ipcMain.handle(IPC_CHANNELS.CURRENCIES_UPDATE_SNAPSHOTS, () => {
    repo.updateSnapshots()
  })

  ipcMain.handle(IPC_CHANNELS.CURRENCIES_RESTART_AUTO_UPDATE, () => {
    restartAutoUpdateRates(db)
  })
}
