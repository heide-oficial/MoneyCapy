import { useState } from 'react'
import { Button } from '../../components/ui/Button'
import { Input } from '../../components/ui/Input'
import { Select } from '../../components/ui/Select'
import { Toggle } from '../../components/ui/Toggle'
import { Modal } from '../../components/ui/Modal'
import { ConfirmDialog } from '../../components/ui/ConfirmDialog'
import { useCurrencySettings, type Currency } from '../../contexts/CurrencySettingsContext'
import { formatCurrency } from '../../lib/currency'
import { useTranslation } from '../../contexts/LanguageContext'
import { DollarSign, Plus, Pencil, Trash2, RefreshCw, Globe, Star } from 'lucide-react'
import { toast } from 'sonner'

export default function CurrencyManagement() {
  const { config: currencyConfig, updateConfig: updateCurrencyConfig, currencies, baseCurrency, defaultCurrencyId, reloadCurrencies } = useCurrencySettings()
  const { t } = useTranslation()

  const [showAddModal, setShowAddModal] = useState(false)
  const [showApiModal, setShowApiModal] = useState(false)
  const [editCurrency, setEditCurrency] = useState<Currency | null>(null)
  const [deleteConfirm, setDeleteConfirm] = useState<Currency | null>(null)
  const [baseConfirm, setBaseConfirm] = useState<Currency | null>(null)
  const [frankfurterEnabled, setFrankfurterEnabled] = useState(false)
  const [updateOnStartup, setUpdateOnStartup] = useState(false)
  const [updateByInterval, setUpdateByInterval] = useState(false)
  const [intervalMode, setIntervalMode] = useState('6h')

  // Add/Edit form state
  const [formCode, setFormCode] = useState('')
  const [formName, setFormName] = useState('')
  const [formSymbol, setFormSymbol] = useState('')
  const [formRate, setFormRate] = useState('1.0')

  // API modal state
  const [apiCurrencies, setApiCurrencies] = useState<Record<string, string>>({})
  const [apiSearch, setApiSearch] = useState('')
  const [apiLoading, setApiLoading] = useState(false)

  // Load update settings
  useState(() => {
    window.api.settings.get('frankfurterEnabled').then((val: string | null) => {
      setFrankfurterEnabled(val === 'true')
    })
    window.api.settings.get('autoUpdateOnStartup').then((val: string | null) => {
      setUpdateOnStartup(val === 'true')
    })
    window.api.settings.get('autoUpdateInterval').then((val: string | null) => {
      if (val && val !== 'off') {
        setUpdateByInterval(true)
        setIntervalMode(val)
      }
    })
  })

  const handleToggleFrankfurter = async (enabled: boolean) => {
    setFrankfurterEnabled(enabled)
    await window.api.settings.set('frankfurterEnabled', enabled ? 'true' : 'false')
    ;(window.api as any).currencies.restartAutoUpdate()
  }

  const handleToggleStartup = async (enabled: boolean) => {
    setUpdateOnStartup(enabled)
    await window.api.settings.set('autoUpdateOnStartup', enabled ? 'true' : 'false')
    ;(window.api as any).currencies.restartAutoUpdate()
  }

  const handleToggleByInterval = async (enabled: boolean) => {
    setUpdateByInterval(enabled)
    await window.api.settings.set('autoUpdateInterval', enabled ? intervalMode : 'off')
    ;(window.api as any).currencies.restartAutoUpdate()
  }

  const handleIntervalChange = async (value: string) => {
    setIntervalMode(value)
    await window.api.settings.set('autoUpdateInterval', value)
    ;(window.api as any).currencies.restartAutoUpdate()
  }

  const openAddModal = () => {
    setFormCode('')
    setFormName('')
    setFormSymbol('')
    setFormRate('1.0')
    setEditCurrency(null)
    setShowAddModal(true)
  }

  const openEditModal = (c: Currency) => {
    setFormCode(c.code)
    setFormName(c.name)
    setFormSymbol(c.symbol)
    setFormRate(String(c.exchangeRate))
    setEditCurrency(c)
    setShowAddModal(true)
  }

  const handleSave = async () => {
    if (!formCode || !formName || !formSymbol) {
      toast.error(t('currencyManagement.fillAllFields'))
      return
    }
    const rate = parseFloat(formRate)
    if (isNaN(rate) || rate <= 0) {
      toast.error(t('currencyManagement.invalidExchangeRate'))
      return
    }

    if (editCurrency) {
      await window.api.currencies.update({
        id: editCurrency.id,
        code: formCode.toUpperCase(),
        name: formName,
        symbol: formSymbol,
        exchangeRate: rate
      })
      toast.success(t('currencyManagement.currencyUpdated'))
    } else {
      await window.api.currencies.create({
        code: formCode.toUpperCase(),
        name: formName,
        symbol: formSymbol,
        exchangeRate: rate
      })
      toast.success(t('currencyManagement.currencyAdded'))
    }
    setShowAddModal(false)
    await reloadCurrencies()
  }

  const handleDelete = async () => {
    if (!deleteConfirm) return
    const result = await window.api.currencies.delete(deleteConfirm.id)
    if (result.success) {
      toast.success(t('currencyManagement.currencyRemoved'))
    } else {
      toast.error(result.error || t('currencyManagement.errorRemovingCurrency'))
    }
    setDeleteConfirm(null)
    await reloadCurrencies()
  }

  const handleSetBase = async () => {
    if (!baseConfirm) return
    await window.api.currencies.setBase(baseConfirm.id)
    toast.success(t('currencyManagement.nowBaseCurrency', { code: baseConfirm.code }))
    setBaseConfirm(null)
    await reloadCurrencies()
    // Reload currency config since symbol changed
    const saved = await window.api.settings.get('currencySettings')
    if (saved) {
      try {
        const parsed = JSON.parse(saved)
        updateCurrencyConfig(parsed)
      } catch { /* ignore */ }
    }
  }

  const handleFetchApi = async () => {
    setApiLoading(true)
    const available = await window.api.currencies.fetchAvailable()
    setApiCurrencies(available)
    setApiLoading(false)
    setShowApiModal(true)
  }

  const handleAddFromApi = async (code: string, name: string) => {
    // Determine symbol from common codes
    const symbolMap: Record<string, string> = {
      USD: '$', EUR: '\u20AC', GBP: '\u00A3', JPY: '\u00A5', BRL: 'R$', CAD: 'CA$', AUD: 'A$',
      CHF: 'CHF', CNY: '\u00A5', INR: '\u20B9', MXN: 'MX$', KRW: '\u20A9', SEK: 'kr', PLN: 'z\u0142',
      TRY: '\u20BA', ARS: 'AR$', CLP: 'CL$', COP: 'CO$', PEN: 'S/.'
    }
    const symbol = symbolMap[code] || code

    // Fetch rate — Frankfurter returns "1 base = X foreign", we need "1 foreign = Y base"
    let rate = 1.0
    if (baseCurrency) {
      const rates = await window.api.currencies.fetchRates(baseCurrency.code, true)
      if (rates[code] && rates[code] !== 0) rate = 1 / rates[code]
    }

    // Check if already exists
    const existing = currencies.find(c => c.code === code)
    if (existing) {
      await window.api.currencies.update({ id: existing.id, exchangeRate: rate })
      await (window.api as any).currencies.updateSnapshots()
      toast.success(t('currencyManagement.rateUpdated', { code, rate: rate.toFixed(4) }))
    } else {
      await window.api.currencies.create({ code, name, symbol, exchangeRate: rate })
      toast.success(t('currencyManagement.codeAdded', { code }))
    }
    await reloadCurrencies()
  }

  const handleUpdateRates = async () => {
    if (!baseCurrency) return
    const rates = await window.api.currencies.fetchRates(baseCurrency.code, true)
    if (Object.keys(rates).length === 0) {
      toast.error(t('currencyManagement.errorFetchingRates'))
      return
    }
    let updated = 0
    for (const c of currencies) {
      if (c.isBase) continue
      const rawRate = rates[c.code]
      if (rawRate !== undefined && rawRate !== 0) {
        const newRate = 1 / rawRate
        await window.api.currencies.update({ id: c.id, exchangeRate: newRate })
        updated++
      }
    }
    await (window.api as any).currencies.updateSnapshots()
    toast.success(t('currencyManagement.ratesUpdated', { count: updated }))
    await reloadCurrencies()
  }

  const handleDefaultCurrencyChange = (value: string) => {
    const id = parseInt(value, 10)
    window.api.settings.set('defaultCurrencyId', String(id))
  }

  const filteredApiCurrencies = Object.entries(apiCurrencies).filter(([code, name]) =>
    code.toLowerCase().includes(apiSearch.toLowerCase()) ||
    name.toLowerCase().includes(apiSearch.toLowerCase())
  )

  return (
    <div className="space-y-4">
      {/* Base currency */}
      {baseCurrency && (
        <div className="flex items-center gap-3 px-3 py-2 rounded-lg bg-primary/5 border border-primary/20">
          <Star size={14} className="text-primary shrink-0" />
          <div className="text-sm">
            <span className="font-medium">{t('currencyManagement.baseCurrency')}</span>
            <span>{baseCurrency.name} ({baseCurrency.code}) — {baseCurrency.symbol}</span>
          </div>
        </div>
      )}

      {/* Default currency for new items */}
      {currencies.length > 0 && (
        <Select
          label={t('currencyManagement.defaultCurrencyDesc')}
          value={String(defaultCurrencyId || baseCurrency?.id || '')}
          onChange={e => handleDefaultCurrencyChange(e.target.value)}
          options={currencies.map(c => ({
            value: String(c.id),
            label: `${c.name} (${c.code}) — ${c.symbol}`
          }))}
        />
      )}

      {/* Frankfurter toggle */}
      <Toggle
        checked={frankfurterEnabled}
        onChange={handleToggleFrankfurter}
        label={t('currencyManagement.useApiForRates')}
      />

      {/* Auto-update toggles */}
      {frankfurterEnabled && (
        <div className="space-y-3 border-l-2 border-border pl-3">
          <Toggle
            checked={updateOnStartup}
            onChange={handleToggleStartup}
            label={t('currencyManagement.updateOnStartup')}
          />
          <div className="space-y-2">
            <Toggle
              checked={updateByInterval}
              onChange={handleToggleByInterval}
              label={t('currencyManagement.updateByInterval')}
            />
            {updateByInterval && (
              <Select
                label=""
                value={intervalMode}
                onChange={e => handleIntervalChange(e.target.value)}
                options={[
                  { value: '3h', label: t('currencyManagement.every3h') },
                  { value: '6h', label: t('currencyManagement.every6h') },
                  { value: '9h', label: t('currencyManagement.every9h') },
                  { value: '12h', label: t('currencyManagement.every12h') },
                  { value: '24h', label: t('currencyManagement.every24h') }
                ]}
              />
            )}
          </div>
        </div>
      )}

      {/* Currency list */}
      {currencies.length > 0 && (
        <div className="border border-border rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/40">
              <tr>
                <th className="px-3 py-2 text-left font-medium">{t('currencyManagement.currency')}</th>
                <th className="px-3 py-2 text-left font-medium">{t('currencyManagement.code')}</th>
                <th className="px-3 py-2 text-left font-medium">{t('currencyManagement.symbol')}</th>
                <th className="px-3 py-2 text-right font-medium">{t('currencyManagement.rate')}</th>
                <th className="px-3 py-2 text-right font-medium">{t('currencyManagement.actions')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {currencies.map(c => (
                <tr key={c.id} className="hover:bg-muted/20">
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-1.5">
                      {c.isBase && <Star size={12} className="text-primary" />}
                      {c.name}
                    </div>
                  </td>
                  <td className="px-3 py-2 font-mono text-xs">{c.code}</td>
                  <td className="px-3 py-2">{c.symbol}</td>
                  <td className="px-3 py-2 text-right font-mono text-xs">{c.isBase ? '1.0000' : c.exchangeRate.toFixed(4)}</td>
                  <td className="px-3 py-2 text-right">
                    <div className="flex items-center justify-end gap-1">
                      {!c.isBase && (
                        <button
                          onClick={() => setBaseConfirm(c)}
                          className="p-1 rounded hover:bg-accent text-muted-foreground hover:text-foreground"
                          title={t('currencyManagement.setAsBase')}
                        >
                          <Star size={14} />
                        </button>
                      )}
                      <button
                        onClick={() => openEditModal(c)}
                        className="p-1 rounded hover:bg-accent text-muted-foreground hover:text-foreground"
                        title={t('common.edit')}
                      >
                        <Pencil size={14} />
                      </button>
                      {!c.isBase && (
                        <button
                          onClick={() => setDeleteConfirm(c)}
                          className="p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive"
                          title={t('common.delete')}
                        >
                          <Trash2 size={14} />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Action buttons */}
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" size="sm" onClick={openAddModal}>
          <Plus size={14} /> {t('currencyManagement.addManual')}
        </Button>
        {frankfurterEnabled && (
          <>
            <Button variant="outline" size="sm" onClick={handleFetchApi}>
              <Globe size={14} /> {t('currencyManagement.addViaApi')}
            </Button>
            <Button variant="outline" size="sm" onClick={handleUpdateRates}>
              <RefreshCw size={14} /> {t('currencyManagement.updateRates')}
            </Button>
          </>
        )}
      </div>

      {/* Add/Edit Modal */}
      <Modal open={showAddModal} onClose={() => setShowAddModal(false)} title={editCurrency ? t('currencyManagement.editCurrency') : t('currencyManagement.addCurrency')}>
        <div className="space-y-3">
          <Input label={t('currencyManagement.codePlaceholder')} value={formCode} onChange={e => setFormCode(e.target.value)} placeholder="USD" />
          <Input label={t('common.name')} value={formName} onChange={e => setFormName(e.target.value)} placeholder="US Dollar" />
          <Input label={t('currencyManagement.symbol')} value={formSymbol} onChange={e => setFormSymbol(e.target.value)} placeholder="$" />
          <Input label={t('currencyManagement.exchangeRate')} value={formRate} onChange={e => setFormRate(e.target.value)} placeholder="1.0" />
          <div className="flex justify-end gap-2">
            <Button variant="outline" size="sm" onClick={() => setShowAddModal(false)}>{t('common.cancel')}</Button>
            <Button size="sm" onClick={handleSave}>{t('common.save')}</Button>
          </div>
        </div>
      </Modal>

      {/* API Currencies Modal */}
      <Modal open={showApiModal} onClose={() => setShowApiModal(false)} title={t('currencyManagement.availableCurrencies')}>
        <div className="space-y-3">
          <Input placeholder={t('currencyManagement.searchCurrency')} value={apiSearch} onChange={e => setApiSearch(e.target.value)} />
          {apiLoading ? (
            <p className="text-sm text-muted-foreground">{t('common.loading')}</p>
          ) : (
            <div className="max-h-64 overflow-y-auto space-y-1">
              {filteredApiCurrencies.map(([code, name]) => {
                const exists = currencies.some(c => c.code === code)
                return (
                  <div key={code} className="flex items-center justify-between px-2 py-1.5 rounded hover:bg-muted/30">
                    <span className="text-sm">{code} — {name}</span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleAddFromApi(code, name)}
                    >
                      {exists ? t('currencyManagement.update') : t('currencyManagement.addCurrency')}
                    </Button>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </Modal>

      {/* Delete Confirm */}
      <ConfirmDialog
        open={deleteConfirm !== null}
        onClose={() => setDeleteConfirm(null)}
        onConfirm={handleDelete}
        title={t('currencyManagement.deleteCurrency')}
        message={t('currencyManagement.deleteCurrencyConfirm', { name: deleteConfirm?.name || '', code: deleteConfirm?.code || '' })}
      />

      {/* Set Base Confirm */}
      <ConfirmDialog
        open={baseConfirm !== null}
        onClose={() => setBaseConfirm(null)}
        onConfirm={handleSetBase}
        title={t('currencyManagement.changeBaseCurrency')}
        message={t('currencyManagement.changeBaseConfirm', { name: baseConfirm?.name || '', code: baseConfirm?.code || '' })}
      />
    </div>
  )
}
