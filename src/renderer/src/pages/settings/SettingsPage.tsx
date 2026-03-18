import { useState, useEffect } from 'react'
import { Card, CardHeader, CardTitle, CardContent } from '../../components/ui/Card'
import { Button } from '../../components/ui/Button'
import { Input } from '../../components/ui/Input'
import { Select } from '../../components/ui/Select'
import { Toggle } from '../../components/ui/Toggle'
import { ConfirmDialog } from '../../components/ui/ConfirmDialog'
import { useTheme } from '../../contexts/ThemeContext'
import { useSession } from '../../contexts/SessionContext'
import { useActivePerson } from '../../contexts/ActivePersonContext'
import { useDateFormat } from '../../contexts/DateFormatContext'
import { useDefaultMonth } from '../../contexts/DefaultMonthContext'
import { useStartCountingMonth } from '../../contexts/StartCountingMonthContext'
import { useColorSettings, type PageKey, type SectionKey, type ColorApplyAt } from '../../contexts/ColorSettingsContext'
import { useToastPosition } from '../../contexts/ToastPositionContext'
import { useColorMode } from '../../contexts/ColorModeContext'
import { useBusinessDayConfig } from '../../contexts/BusinessDayContext'
import { useAccentColor, ACCENT_PRESETS, hslToHex } from '../../contexts/AccentColorContext'
import { useDimPaid } from '../../contexts/DimPaidContext'
import { useFilterDisplayMode, type FilterDisplayMode } from '../../contexts/FilterDisplayModeContext'
import { Modal } from '../../components/ui/Modal'
import { useCurrencySettings } from '../../contexts/CurrencySettingsContext'
import CurrencyManagement from './CurrencyManagement'
import { formatDate } from '../../lib/date'
import { formatCurrency } from '../../lib/currency'
import { DatePicker } from '../../components/ui/DatePicker'
import { ColorPicker } from '../../components/ui/ColorPicker'
import { Settings, Lock, Moon, Sun, Download, Upload, Shield, FileSpreadsheet, Trash2, AlertTriangle, Calendar, CalendarClock, CalendarRange, Palette, RotateCcw, DollarSign, X, Briefcase, PanelLeftClose, Monitor, FolderOpen } from 'lucide-react'
import { toast } from 'sonner'
import { useTranslation, useLocaleArray } from '../../contexts/LanguageContext'

function getComputedColor(varName: string): string {
  const el = document.createElement('div')
  el.style.color = `var(${varName})`
  document.body.appendChild(el)
  const computed = getComputedStyle(el).color
  document.body.removeChild(el)
  // Convert rgb(r, g, b) to hex
  const match = computed.match(/(\d+)/g)
  if (match && match.length >= 3) {
    return '#' + match.slice(0, 3).map(n => Number(n).toString(16).padStart(2, '0')).join('')
  }
  return '#ffffff'
}

export default function SettingsPage() {
  const { theme, toggleTheme } = useTheme()
  const { hasPassword, isUnlocked } = useSession()
  const { activePerson, reloadPeople } = useActivePerson()
  const { order, separator, setOrder, setSeparator } = useDateFormat()
  const { offset, setOffset } = useDefaultMonth()
  const { startCountingMonth, setStartCountingMonth } = useStartCountingMonth()
  const { colors, applyAt, setColor, setApplyAt, gastosStyle, receitasStyle, saldoStyle } = useColorSettings()
  const { config: currencyConfig, updateConfig: updateCurrencyConfig } = useCurrencySettings()
  const { position: toastPosition, setPosition: setToastPosition } = useToastPosition()
  const { colorMode, setColorMode } = useColorMode()
  const { accentColor, setAccentColor } = useAccentColor()
  const { businessDayConfig, setBusinessDayConfig } = useBusinessDayConfig()
  const { dimPaid, setDimPaid } = useDimPaid()
  const { filterDisplayMode, setFilterDisplayMode } = useFilterDisplayMode()
  const { t, language, setLanguage, availableLanguages } = useTranslation()
  const weekdayLabels = useLocaleArray('weekdays.short')
  const [showAccentPicker, setShowAccentPicker] = useState(false)
  const [showPasswordSection, setShowPasswordSection] = useState(false)
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [passwordError, setPasswordError] = useState('')
  const [resetConfirm, setResetConfirm] = useState<'person' | 'all' | 'app' | null>(null)
  const [colorModal, setColorModal] = useState<'gastos' | 'receitas' | 'saldo' | null>(null)
  const [colorPickerKey, setColorPickerKey] = useState<'gastos' | 'receitas' | 'saldo' | null>(null)
  const [sidebarCollapsed, setSidebarCollapsedState] = useState(false)
  const [minimizeToTray, setMinimizeToTray] = useState(false)
  const [autoStart, setAutoStart] = useState(false)
  const [exportModal, setExportModal] = useState(false)
  const [exportMode, setExportMode] = useState<'all' | 'period'>('all')
  const [exportFrom, setExportFrom] = useState('')
  const [exportTo, setExportTo] = useState('')
  const [isExporting, setIsExporting] = useState(false)
  const [isImporting, setIsImporting] = useState(false)
  const [restoreSuccess, setRestoreSuccess] = useState(false)
  useEffect(() => {
    window.api.settings.get('sidebarCollapsed').then((val: string | null) => {
      if (val === 'true') setSidebarCollapsedState(true)
    })
    window.api.settings.get('minimizeToTray').then((val: string | null) => {
      if (val === 'true') setMinimizeToTray(true)
    })
    window.api.settings.get('autoStart').then((val: string | null) => {
      if (val === 'true') setAutoStart(true)
    })
  }, [])
  const handleChangePassword = async () => {
    setPasswordError('')
    if (!hasPassword) {
      if (newPassword.length < 4) {
        setPasswordError(t('settings.passwordMinChars'))
        return
      }
      if (newPassword !== confirmPassword) {
        setPasswordError(t('settings.passwordMismatch'))
        return
      }
      const result = await window.api.settings.setPassword(newPassword)
      if (result) {
        toast.success(t('settings.passwordSetSuccess'))
        setShowPasswordSection(false)
        setNewPassword('')
        setConfirmPassword('')
      }
    } else {
      if (!currentPassword) {
        setPasswordError(t('settings.enterCurrentPassword'))
        return
      }
      if (newPassword.length < 4) {
        setPasswordError(t('settings.newPasswordMinChars'))
        return
      }
      if (newPassword !== confirmPassword) {
        setPasswordError(t('settings.passwordMismatch'))
        return
      }
      const result = await window.api.settings.changePassword(currentPassword, newPassword)
      if (result) {
        toast.success(t('settings.passwordChangedSuccess'))
        setShowPasswordSection(false)
        setCurrentPassword('')
        setNewPassword('')
        setConfirmPassword('')
      } else {
        setPasswordError(t('settings.incorrectCurrentPassword'))
      }
    }
  }

  const handleExportBackup = async () => {
    setExportModal(true)
    setExportMode('all')
    setExportFrom('')
    setExportTo('')
  }

  const handleExportConfirm = async () => {
    setExportModal(false)
    if (exportMode === 'all') {
      setIsExporting(true)
      try {
        const result = await window.api.backup.export()
        if (result.success) {
          toast.success(t('settings.backupSuccess'))
        } else if (result.error) {
          toast.error(t('settings.backupExportError') + result.error)
        }
      } finally {
        setIsExporting(false)
      }
    } else {
      if (!exportFrom || !exportTo) {
        toast.error(t('common.requiredField'))
        return
      }
      setIsExporting(true)
      try {
        const result = await window.api.backup.exportFiltered(exportFrom, exportTo)
        if (result.success) {
          toast.success(t('settings.filteredBackupSuccess'))
        } else if (result.error) {
          toast.error(t('settings.backupExportError') + result.error)
        }
      } finally {
        setIsExporting(false)
      }
    }
  }

  const handleOpenDataFolder = async () => {
    await window.api.backup.openDataFolder()
  }

  const handleImportBackup = async () => {
    setIsImporting(true)
    try {
      const result = await window.api.backup.import()
      if (result.success) {
        setRestoreSuccess(true)
      } else if (result.error) {
        toast.error(t('settings.backupRestoreError') + result.error)
      }
    } finally {
      setIsImporting(false)
    }
  }

  const handleRelaunch = () => {
    window.api.app.relaunch()
  }

  const handleExportCsv = async () => {
    const result = await window.api.backup.exportCsv()
    if (result.success) {
      toast.success(t('settings.csvSuccess'))
    } else if (result.error) {
      toast.error(t('settings.csvError') + result.error)
    }
  }

  const handleReset = async () => {
    if (resetConfirm === 'person' && activePerson) {
      await window.api.settings.resetPerson(activePerson.id)
      toast.success(t('settings.profileDataDeleted'))
    } else if (resetConfirm === 'all') {
      await window.api.settings.resetAllData()
      toast.success(t('settings.allDataDeleted'))
    } else if (resetConfirm === 'app') {
      await window.api.settings.resetApp()
      toast.success(t('settings.appReset'))
    }
    setResetConfirm(null)
    await reloadPeople()
    setTimeout(() => window.location.reload(), 1000)
  }

  const resetMessages: Record<string, string> = {
    person: t('settings.deleteProfileConfirm', { name: activePerson?.name || '' }),
    all: t('settings.deleteAllConfirm'),
    app: t('settings.resetAppConfirm')
  }

  return (
    <div className="space-y-6">
      <Card className="p-5">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 shrink-0">
            <Settings size={20} className="text-primary" />
          </div>
          <h1 className="text-xl font-bold">{t('settings.title')}</h1>
        </div>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* ── Row 1 ── */}

        {/* Aparência */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              {theme === 'dark' ? <Moon size={16} /> : <Sun size={16} />}
              {t('settings.appearance')}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            <Toggle
              checked={theme === 'dark'}
              onChange={toggleTheme}
              label={theme === 'dark' ? t('settings.darkThemeOn') : t('settings.lightThemeOn')}
            />
            <Toggle
              checked={sidebarCollapsed}
              onChange={() => {
                const next = !sidebarCollapsed
                setSidebarCollapsedState(next)
                window.api.settings.set('sidebarCollapsed', String(next))
              }}
              label={sidebarCollapsed ? t('settings.sidebarCollapsed') : t('settings.sidebarExpanded')}
            />
            <Toggle
              checked={dimPaid}
              onChange={() => setDimPaid(!dimPaid)}
              label={dimPaid ? t('settings.dimPaidOn') : t('settings.dimPaidOff')}
            />

            <div className="space-y-3">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{t('settings.accentColor')}</p>
              <div className="flex flex-wrap gap-2">
                {ACCENT_PRESETS.map((preset) => (
                  <button
                    key={preset.hsl}
                    onClick={() => setAccentColor(preset.hsl)}
                    className={`h-8 w-8 rounded-full transition-all ${
                      accentColor === preset.hsl ? 'ring-2 ring-offset-2 ring-offset-card ring-primary scale-110' : 'hover:scale-105'
                    }`}
                    style={{ backgroundColor: hslToHex(preset.hsl) }}
                    title={preset.label}
                  />
                ))}
                <button
                  onClick={() => setShowAccentPicker(true)}
                  className={`h-8 w-8 rounded-full border-2 border-dashed border-border hover:border-primary flex items-center justify-center transition-all hover:scale-105 ${
                    !ACCENT_PRESETS.some(p => p.hsl === accentColor) ? 'ring-2 ring-offset-2 ring-offset-card ring-primary scale-110' : ''
                  }`}
                  style={!ACCENT_PRESETS.some(p => p.hsl === accentColor) ? { backgroundColor: hslToHex(accentColor) } : undefined}
                  title={t('common.customColor')}
                >
                  {ACCENT_PRESETS.some(p => p.hsl === accentColor) && <Palette size={14} className="text-muted-foreground" />}
                </button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Comportamento */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Monitor size={16} />
              {t('settings.behavior')}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Toggle
              checked={minimizeToTray}
              onChange={() => {
                const next = !minimizeToTray
                setMinimizeToTray(next)
                window.api.settings.set('minimizeToTray', String(next))
                window.api.app.setMinimizeToTray(next)
              }}
              label={t('settings.minimizeToTray')}
            />
            <Toggle
              checked={autoStart}
              onChange={() => {
                const next = !autoStart
                setAutoStart(next)
                window.api.settings.set('autoStart', String(next))
                window.api.app.setAutoStart(next)
              }}
              label={t('settings.autoStart')}
            />
            <Select
              label={t('settings.toastPosition')}
              value={toastPosition}
              onChange={e => setToastPosition(e.target.value as any)}
              options={[
                { value: 'top-right', label: t('settings.topRight') },
                { value: 'bottom-right', label: t('settings.bottomRight') },
                { value: 'top-left', label: t('settings.topLeft') },
                { value: 'bottom-left', label: t('settings.bottomLeft') }
              ]}
            />
            <Select
              label={t('settings.language')}
              value={language}
              onChange={e => setLanguage(e.target.value)}
              options={availableLanguages.map(l => ({ value: l.code, label: l.label }))}
            />
            <Select
              label={t('settings.toolbarFilters')}
              value={filterDisplayMode}
              onChange={e => setFilterDisplayMode(e.target.value as FilterDisplayMode)}
              options={[
                { value: 'unified', label: t('settings.unifiedFilters') },
                { value: 'primary-more', label: t('settings.primaryMoreFilters') },
                { value: 'compact', label: t('settings.compactIcons') }
              ]}
            />
          </CardContent>
        </Card>

        {/* ── Row 2 ── */}

        {/* Cores */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Palette size={16} />
              {t('settings.colors')}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="space-y-3">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{t('settings.valueColors')}</p>
              <div className="space-y-2.5">
                {([
                  { key: 'gastos' as const, label: t('settings.expenses'), preview: 1250 },
                  { key: 'receitas' as const, label: t('settings.incomeLabel'), preview: 3500 },
                  { key: 'saldo' as const, label: t('settings.balance'), preview: 2250 }
                ]).map(({ key, label, preview }) => (
                  <div key={key} className="flex items-center gap-3">
                    <div
                      className="h-7 w-7 rounded-full border-2 border-border cursor-pointer shrink-0"
                      style={{ backgroundColor: colors[key] || getComputedColor(`--color-${key}`) }}
                      onClick={() => setColorPickerKey(key)}
                    />
                    <div className="flex flex-col min-w-0">
                      <span className="text-sm font-medium leading-tight">{label}</span>
                      <span className="text-xs font-semibold tabular-nums" style={{ color: `var(--color-${key})` }}>{formatCurrency(preview)}</span>
                    </div>
                    <div className="flex items-center gap-1.5 ml-auto shrink-0">
                      {colors[key] && (
                        <button
                          onClick={() => setColor(key, null)}
                          className="h-7 w-7 inline-flex items-center justify-center rounded-md border border-input hover:bg-accent text-muted-foreground transition-colors"
                          title={t('settings.restoreDefault')}
                        >
                          <RotateCcw size={12} />
                        </button>
                      )}
                      <button
                        onClick={() => setColorPickerKey(key)}
                        className="inline-flex items-center gap-1 h-7 px-2 text-xs font-medium rounded-md border border-input hover:bg-accent transition-colors"
                      >
                        <Palette size={12} /> {t('settings.changeColor')}
                      </button>
                      <button
                        onClick={() => setColorModal(key)}
                        className="h-7 w-7 inline-flex items-center justify-center rounded-md border border-input hover:bg-accent text-muted-foreground transition-colors"
                        title={t('settings.configureApply')}
                      >
                        <Settings size={12} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <hr className="border-border" />

            <div className="space-y-3">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{t('settings.entityColorMode')}</p>
              <div className="flex rounded-lg border border-input p-0.5 bg-muted/30">
                <button type="button" onClick={() => setColorMode('preset')}
                  className={`flex-1 py-1.5 text-sm font-medium rounded-md transition-all ${
                    colorMode === 'preset' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
                  }`}>
                  {t('settings.presetColors')}
                </button>
                <button type="button" onClick={() => setColorMode('custom')}
                  className={`flex-1 py-1.5 text-sm font-medium rounded-md transition-all ${
                    colorMode === 'custom' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
                  }`}>
                  {t('settings.customColors')}
                </button>
              </div>
              <p className="text-xs text-muted-foreground">
                {colorMode === 'preset'
                  ? t('settings.presetDesc')
                  : t('settings.customDesc')}
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Padrões */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Settings size={16} />
              {t('settings.defaults')}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="space-y-4">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{t('settings.dateFormat')}</p>
              <div className="grid grid-cols-2 gap-3">
                <Select
                  label={t('settings.format')}
                  value={order}
                  onChange={e => setOrder(e.target.value as 'DMY' | 'YMD' | 'MDY')}
                  options={[
                    { value: 'DMY', label: `DD${separator}MM${separator}YYYY` },
                    { value: 'YMD', label: `YYYY${separator}MM${separator}DD` },
                    { value: 'MDY', label: `MM${separator}DD${separator}YYYY` }
                  ]}
                />
                <Select
                  label={t('settings.separator')}
                  value={separator}
                  onChange={e => setSeparator(e.target.value as '/' | '-')}
                  options={[
                    { value: '/', label: t('settings.slashSeparator') },
                    { value: '-', label: t('settings.dashSeparator') }
                  ]}
                />
              </div>
              <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-muted/40 text-sm">
                <span className="text-muted-foreground">Preview:</span>
                <span className="font-semibold">{formatDate(new Date().toISOString().substring(0, 10), order, separator)}</span>
              </div>
            </div>

            <hr className="border-border" />

            <div className="space-y-4">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{t('settings.currencyFormat')}</p>
              <div className="grid grid-cols-2 gap-3">
                <Select
                  label={t('settings.decimalSep')}
                  value={currencyConfig.decimalSep}
                  onChange={e => {
                    const dec = e.target.value as ',' | '.'
                    const thou = dec === ',' ? '.' : ','
                    updateCurrencyConfig({ ...currencyConfig, decimalSep: dec, thousandSep: thou })
                  }}
                  options={[
                    { value: ',', label: t('settings.commaLabel') },
                    { value: '.', label: t('settings.dotLabel') }
                  ]}
                />
                <Select
                  label={t('settings.thousandSep')}
                  value={currencyConfig.thousandSep}
                  onChange={e => {
                    const thou = e.target.value as '.' | ','
                    const dec = thou === '.' ? ',' : '.'
                    updateCurrencyConfig({ ...currencyConfig, thousandSep: thou, decimalSep: dec })
                  }}
                  options={[
                    { value: '.', label: t('settings.dotLabel') },
                    { value: ',', label: t('settings.commaLabel') }
                  ]}
                />
              </div>
              <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-muted/40 text-sm">
                <span className="text-muted-foreground">Preview:</span>
                <span className="font-semibold">{formatCurrency(1234567.89)}</span>
              </div>
            </div>

            <hr className="border-border" />

            <div className="space-y-4">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{t('settings.defaultMonth')}</p>
              <Select
                label={t('settings.defaultMonthDesc')}
                value={offset}
                onChange={e => setOffset(e.target.value as 'current' | 'previous' | 'next')}
                options={[
                  { value: 'current', label: t('settings.currentMonth') },
                  { value: 'next', label: t('settings.nextMonth') }
                ]}
              />
            </div>
          </CardContent>
        </Card>

        {/* ── Row 3 ── */}

        {/* Moedas */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <DollarSign size={16} />
              {t('settings.currencies')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <CurrencyManagement />
          </CardContent>
        </Card>

        {/* Período */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CalendarRange size={16} />
              {t('settings.period')}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="space-y-4">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{t('settings.businessDays')}</p>
              <p className="text-sm text-muted-foreground">
                {t('settings.businessDaysDesc')}
              </p>
              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{t('settings.mode')}</p>
                <div className="flex rounded-lg border border-input p-0.5 bg-muted/30">
                  <button type="button" onClick={() => setBusinessDayConfig({ ...businessDayConfig, mode: 'manual' })}
                    className={`flex-1 py-1.5 text-sm font-medium rounded-md transition-all ${
                      businessDayConfig.mode === 'manual' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
                    }`}>
                    {t('settings.manual')}
                  </button>
                  <button type="button" onClick={() => setBusinessDayConfig({ ...businessDayConfig, mode: 'api' })}
                    className={`flex-1 py-1.5 text-sm font-medium rounded-md transition-all ${
                      businessDayConfig.mode === 'api' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
                    }`}>
                    {t('settings.withHolidaysApi')}
                  </button>
                </div>
                <p className="text-xs text-muted-foreground">
                  {businessDayConfig.mode === 'manual'
                    ? t('settings.manualDesc')
                    : t('settings.apiDesc')}
                </p>
              </div>
              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{t('settings.weekdays')}</p>
                <div className="flex gap-2">
                  {weekdayLabels.map((label, day) => {
                    const isSelected = businessDayConfig.weekdays.includes(day)
                    return (
                      <button
                        key={day}
                        type="button"
                        onClick={() => {
                          const newWeekdays = isSelected
                            ? businessDayConfig.weekdays.filter(d => d !== day)
                            : [...businessDayConfig.weekdays, day].sort()
                          setBusinessDayConfig({ ...businessDayConfig, weekdays: newWeekdays })
                        }}
                        className={`flex-1 py-2 text-xs font-medium rounded-md border transition-all ${
                          isSelected
                            ? 'bg-primary text-primary-foreground border-primary'
                            : 'bg-muted/30 text-muted-foreground border-input hover:text-foreground'
                        }`}
                      >
                        {label}
                      </button>
                    )
                  })}
                </div>
              </div>
              {businessDayConfig.mode === 'api' && (
                <div className="space-y-2">
                  <Select
                    label={t('settings.countryHolidays')}
                    value={businessDayConfig.countryCode}
                    onChange={e => setBusinessDayConfig({ ...businessDayConfig, countryCode: e.target.value })}
                    options={[
                      { value: 'BR', label: t('settings.brazil') },
                      { value: 'US', label: t('settings.usa') },
                      { value: 'PT', label: t('settings.portugal') },
                      { value: 'AR', label: t('settings.argentina') },
                      { value: 'DE', label: t('settings.germany') },
                      { value: 'FR', label: t('settings.france') },
                      { value: 'ES', label: t('settings.spain') },
                      { value: 'GB', label: t('settings.uk') },
                      { value: 'JP', label: t('settings.japan') }
                    ]}
                  />
                  <p className="text-xs text-muted-foreground">
                    {t('settings.countryHolidaysDesc')}
                  </p>
                </div>
              )}
            </div>

            <hr className="border-border" />

            <div className="space-y-4">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{t('settings.startCountingMonth')}</p>
              <p className="text-sm text-muted-foreground">
                {t('settings.startCountingMonthDesc')}
              </p>
              {activePerson ? (
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <DatePicker
                      mode="month"
                      value={startCountingMonth || ''}
                      onChange={v => setStartCountingMonth(v || null)}
                      placeholder={t('common.selectMonth')}
                    />
                    {startCountingMonth && (
                      <button
                        onClick={() => setStartCountingMonth(null)}
                        className="p-1.5 rounded hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
                        title={t('common.removeLimit')}
                      >
                        <X size={14} />
                      </button>
                    )}
                  </div>
                  {!startCountingMonth && (
                    <p className="text-xs text-muted-foreground">{t('settings.noMonthDefined')}</p>
                  )}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground italic">{t('settings.selectProfileToConfigure')}</p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* ── Row 4 (3 cards) ── */}

        {/* Segurança */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield size={16} />
              {t('settings.security')}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              {hasPassword
                ? t('settings.passwordSet')
                : t('settings.noPassword')}
            </p>
            {!showPasswordSection ? (
              <Button variant="outline" size="sm" onClick={() => setShowPasswordSection(true)}>
                <Lock size={14} />
                {hasPassword ? t('settings.changePassword') : t('settings.setPassword')}
              </Button>
            ) : (
              <div className="space-y-3">
                {hasPassword && (
                  <Input
                    type="password"
                    placeholder={t('settings.currentPasswordPlaceholder')}
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                  />
                )}
                <Input
                  type="password"
                  placeholder={t('settings.newPasswordPlaceholder')}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                />
                <Input
                  type="password"
                  placeholder={t('settings.confirmPasswordPlaceholder')}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                />
                {passwordError && <p className="text-sm text-destructive">{passwordError}</p>}
                <div className="flex gap-2">
                  <Button size="sm" onClick={handleChangePassword}>{t('common.save')}</Button>
                  <Button variant="outline" size="sm" onClick={() => {
                    setShowPasswordSection(false)
                    setPasswordError('')
                    setCurrentPassword('')
                    setNewPassword('')
                    setConfirmPassword('')
                  }}>
                    {t('common.cancel')}
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Backup e Restauração */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Download size={16} />
              {t('settings.backupRestore')}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {restoreSuccess ? (
              <div className="space-y-3">
                <div className="rounded-lg border border-green-500/30 bg-green-500/10 p-4 space-y-2">
                  <p className="text-sm font-semibold text-green-600 dark:text-green-400">{t('settings.backupRestored')}</p>
                  <p className="text-sm text-muted-foreground">{t('settings.backupRestoreDesc')}</p>
                </div>
                <Button onClick={handleRelaunch} className="w-full">
                  <RotateCcw size={14} /> {t('settings.restartNow')}
                </Button>
              </div>
            ) : (
              <>
                <p className="text-sm text-muted-foreground">
                  {t('settings.backupDesc')}
                </p>
                {(isExporting || isImporting) && (
                  <div className="space-y-1.5">
                    <p className="text-xs text-muted-foreground">
                      {isExporting ? t('settings.backupInProgress') : t('settings.restoreInProgress')}
                    </p>
                    <div className="relative h-1.5 w-full overflow-hidden rounded-full bg-muted">
                      <style>{`@keyframes mc-progress{0%{transform:translateX(-100%)}100%{transform:translateX(350%)}}`}</style>
                      <div className="absolute top-0 h-full w-[30%] rounded-full bg-primary" style={{ animation: 'mc-progress 1.4s ease-in-out infinite' }} />
                    </div>
                  </div>
                )}
                <div className="flex flex-wrap gap-2">
                  <Button variant="outline" size="sm" onClick={handleExportBackup} disabled={isExporting || isImporting}>
                    <Download size={14} /> {t('settings.exportBackup')}
                  </Button>
                  <Button variant="outline" size="sm" onClick={handleImportBackup} disabled={isExporting || isImporting}>
                    <Upload size={14} /> {t('settings.restoreBackup')}
                  </Button>
                  <Button variant="outline" size="sm" onClick={handleExportCsv} disabled={isExporting || isImporting}>
                    <FileSpreadsheet size={14} /> {t('settings.exportCsv')}
                  </Button>
                  <Button variant="outline" size="sm" onClick={handleOpenDataFolder} disabled={isExporting || isImporting}>
                    <FolderOpen size={14} /> {t('settings.openDataFolder')}
                  </Button>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Zona de Perigo */}
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle size={16} />
              {t('settings.dangerZone')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {activePerson && (
                <Button variant="outline" size="sm" className="border-destructive/30 text-destructive hover:bg-destructive/10" onClick={() => setResetConfirm('person')}>
                  <Trash2 size={14} /> {t('settings.deleteProfileData')}
                </Button>
              )}
              <Button variant="outline" size="sm" className="border-destructive/30 text-destructive hover:bg-destructive/10" onClick={() => setResetConfirm('all')}>
                <Trash2 size={14} /> {t('settings.deleteAllData')}
              </Button>
              <Button variant="outline" size="sm" className="border-destructive/30 text-destructive hover:bg-destructive/10" onClick={() => setResetConfirm('app')}>
                <Trash2 size={14} /> {t('settings.resetApp')}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Color per-page modal */}
      {colorModal && (() => {
        const colorLabels: Record<string, string> = { gastos: t('settings.expenses'), receitas: t('settings.incomeLabel'), saldo: t('settings.balance') }
        const pages: { page: PageKey; label: string; sections: SectionKey[] }[] = [
          { page: 'dashboard', label: t('sidebar.dashboard'), sections: ['widgets'] },
          { page: 'items', label: t('settings.expenses'), sections: ['hero', 'itens'] },
          { page: 'income', label: t('settings.incomeLabel'), sections: ['hero', 'itens'] },
          { page: 'accounts', label: t('sidebar.accounts'), sections: ['hero', 'itens'] },
          { page: 'cards', label: t('sidebar.cards'), sections: ['hero', 'itens'] },
          { page: 'categories', label: t('sidebar.categories'), sections: ['hero', 'itens'] },
          { page: 'stores', label: t('sidebar.stores'), sections: ['hero', 'itens'] },
          { page: 'tags', label: t('sidebar.tags'), sections: ['hero', 'itens'] }
        ]
        const sectionLabels: Record<SectionKey, string> = { hero: t('settings.heroSummary'), itens: t('settings.itemsLists'), widgets: t('settings.widgets') }
        const allEnabled = pages.every(({ page, sections }) => sections.every(sec => applyAt[colorModal]?.[page]?.[sec] ?? true))
        return (
          <Modal open={true} onClose={() => setColorModal(null)} title={t('settings.colorOfPage', { color: colorLabels[colorModal] })}>
            <div className="space-y-1">
              <label className="flex items-center gap-2 cursor-pointer px-2 py-2 rounded-md hover:bg-muted/30 border-b border-border mb-1">
                <input
                  type="checkbox"
                  checked={allEnabled}
                  onChange={e => {
                    const next: ColorApplyAt = JSON.parse(JSON.stringify(applyAt))
                    for (const { page, sections } of pages) {
                      for (const sec of sections) {
                        next[colorModal][page][sec] = e.target.checked
                      }
                    }
                    setApplyAt(next)
                  }}
                  className="rounded border-border accent-primary h-4 w-4"
                />
                <span className="text-sm font-semibold">{t('settings.allPages')}</span>
              </label>
              {pages.map(({ page, label: pageLabel, sections }) => (
                <div key={page} className="flex items-center gap-3 px-2 py-1.5 rounded-md hover:bg-muted/30">
                  <span className="text-sm font-medium w-24 shrink-0">{pageLabel}</span>
                  <div className="flex gap-4">
                    {sections.map(sec => (
                      <label key={sec} className="flex items-center gap-1.5 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={applyAt[colorModal]?.[page]?.[sec] ?? true}
                          onChange={e => {
                            const next: ColorApplyAt = JSON.parse(JSON.stringify(applyAt))
                            next[colorModal][page][sec] = e.target.checked
                            setApplyAt(next)
                          }}
                          className="rounded border-border accent-primary h-3.5 w-3.5"
                        />
                        <span className="text-xs text-muted-foreground">{sectionLabels[sec]}</span>
                      </label>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </Modal>
        )
      })()}

      <ColorPicker
        open={colorPickerKey !== null}
        onClose={() => setColorPickerKey(null)}
        value={colorPickerKey ? (colors[colorPickerKey] || getComputedColor(`--color-${colorPickerKey}`)) : '#ffffff'}
        onConfirm={c => { if (colorPickerKey) setColor(colorPickerKey, c); setColorPickerKey(null) }}
      />

      <ColorPicker
        open={showAccentPicker}
        onClose={() => setShowAccentPicker(false)}
        value={hslToHex(accentColor)}
        onConfirm={c => {
          // Convert hex to HSL string
          const r = parseInt(c.slice(1, 3), 16) / 255
          const g = parseInt(c.slice(3, 5), 16) / 255
          const b = parseInt(c.slice(5, 7), 16) / 255
          const max = Math.max(r, g, b), min = Math.min(r, g, b)
          const l = (max + min) / 2
          let h = 0, s = 0
          if (max !== min) {
            const d = max - min
            s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
            if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6
            else if (max === g) h = ((b - r) / d + 2) / 6
            else h = ((r - g) / d + 4) / 6
          }
          const hsl = `${Math.round(h * 360)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`
          setAccentColor(hsl)
          setShowAccentPicker(false)
        }}
      />

      <Modal open={exportModal} onClose={() => setExportModal(false)} title={t('settings.exportOptions')}>
        <div className="space-y-4">
          <div className="flex rounded-lg border border-input p-0.5 bg-muted/30">
            <button type="button" onClick={() => setExportMode('all')}
              className={`flex-1 py-2 text-sm font-medium rounded-md transition-all ${
                exportMode === 'all' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
              }`}>
              {t('settings.exportAll')}
            </button>
            <button type="button" onClick={() => setExportMode('period')}
              className={`flex-1 py-2 text-sm font-medium rounded-md transition-all ${
                exportMode === 'period' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
              }`}>
              {t('settings.exportPeriod')}
            </button>
          </div>

          {exportMode === 'period' && (
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">{t('settings.exportFrom')}</label>
                <DatePicker mode="month" value={exportFrom} onChange={v => setExportFrom(v)} placeholder={t('common.selectMonth')} />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">{t('settings.exportTo')}</label>
                <DatePicker mode="month" value={exportTo} onChange={v => setExportTo(v)} placeholder={t('common.selectMonth')} />
              </div>
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" size="sm" onClick={() => setExportModal(false)}>
              {t('common.cancel')}
            </Button>
            <Button size="sm" onClick={handleExportConfirm} disabled={exportMode === 'period' && (!exportFrom || !exportTo)}>
              <Download size={14} /> {t('settings.exportBackup')}
            </Button>
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        open={resetConfirm !== null}
        onClose={() => setResetConfirm(null)}
        onConfirm={handleReset}
        title={t('settings.confirmDeletion')}
        message={resetConfirm ? resetMessages[resetConfirm] : ''}
      />

      <p className="text-center text-xs text-muted-foreground pt-2 pb-4">
        MoneyCapy 1.0.0 — {t('settings.createdBy')} Matheus Heidemann
      </p>
    </div>
  )
}
