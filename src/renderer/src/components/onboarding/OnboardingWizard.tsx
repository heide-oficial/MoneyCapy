import { useState } from 'react'
import { Check, ChevronRight, ChevronLeft } from 'lucide-react'
import { useTranslation, useLocaleArray } from '../../contexts/LanguageContext'
import { useActivePerson } from '../../contexts/ActivePersonContext'
import { useBusinessDayConfig } from '../../contexts/BusinessDayContext'
import { useAccentColor, ACCENT_PRESETS, hslToHex } from '../../contexts/AccentColorContext'
import { Button } from '../ui/Button'
import { Input } from '../ui/Input'
import { Select } from '../ui/Select'
import { Toggle } from '../ui/Toggle'
import { PRESET_COLORS } from '../../lib/constants'
import { toast } from 'sonner'

interface Props {
  onComplete: () => void
}

const TOTAL_STEPS = 5

export function OnboardingWizard({ onComplete }: Props) {
  const { t, language, setLanguage, availableLanguages } = useTranslation()
  const { accentColor, setAccentColor } = useAccentColor()
  const { reloadPeople } = useActivePerson()
  const { setBusinessDayConfig } = useBusinessDayConfig()
  const weekdayLabels = useLocaleArray('weekdays.short')

  const [step, setStep] = useState(0)
  const [saving, setSaving] = useState(false)

  // Step 1: Profile
  const [name, setName] = useState('')
  const [color, setColor] = useState(PRESET_COLORS[0])

  // Step 2: Business days
  const [bdMode, setBdMode] = useState<'manual' | 'api'>('manual')
  const [bdWeekdays, setBdWeekdays] = useState([1, 2, 3, 4, 5])
  const [bdCountry, setBdCountry] = useState('BR')

  // Step 3: Currency rates
  const [frankfurterEnabled, setFrankfurterEnabled] = useState(false)
  const [updateOnStartup, setUpdateOnStartup] = useState(false)
  const [updateByInterval, setUpdateByInterval] = useState(false)
  const [intervalMode, setIntervalMode] = useState('6h')

  // Step 4: System preferences
  const [autoStart, setAutoStart] = useState(false)
  const [minimizeToTray, setMinimizeToTray] = useState(false)

  const toggleWeekday = (day: number) => {
    setBdWeekdays(prev =>
      prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day].sort()
    )
  }

  const handleNext = async () => {
    if (step === 0) {
      // Language + accent already saved live; just advance
      setStep(1)
    } else if (step === 1) {
      if (!name.trim()) {
        toast.error(t('common.nameRequired'))
        return
      }
      setSaving(true)
      try {
        await window.api.people.create({ name: name.trim(), color })
        await reloadPeople()
      } finally {
        setSaving(false)
      }
      setStep(2)
    } else if (step === 2) {
      setBusinessDayConfig({ mode: bdMode, weekdays: bdWeekdays, countryCode: bdCountry })
      setStep(3)
    } else if (step === 3) {
      setSaving(true)
      try {
        await window.api.settings.set('frankfurterEnabled', frankfurterEnabled ? 'true' : 'false')
        await window.api.settings.set('autoUpdateOnStartup', updateOnStartup ? 'true' : 'false')
        await window.api.settings.set('autoUpdateInterval', updateByInterval ? intervalMode : 'off')
        if (frankfurterEnabled) {
          ;(window.api as any).currencies.restartAutoUpdate()
        }
      } finally {
        setSaving(false)
      }
      setStep(4)
    } else {
      // Step 4: save system preferences and finish
      setSaving(true)
      try {
        await window.api.app.setAutoStart(autoStart)
        await window.api.app.setMinimizeToTray(minimizeToTray)
        await window.api.settings.set('onboardingCompleted', 'true')
        onComplete()
      } finally {
        setSaving(false)
      }
    }
  }

  const stepKeys = ['languageTitle', 'profileTitle', 'businessDaysTitle', 'currencyTitle', 'appSettingsTitle']

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background">
      <div className="w-full max-w-lg px-4">
        {/* Header */}
        <div className="mb-8 text-center">
          <div className="mb-3 flex justify-center">
            <img src="/icon.png" alt="MoneyCapy" className="h-14 w-14 rounded-2xl" onError={e => { (e.target as HTMLImageElement).style.display = 'none' }} />
          </div>
          <h1 className="text-2xl font-bold text-foreground">MoneyCapy</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {t(`onboarding.${stepKeys[step]}`)}
          </p>
        </div>

        {/* Step indicator */}
        <div className="mb-6 flex items-center justify-center gap-2">
          {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
            <div key={i} className="flex items-center gap-2">
              <div className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold transition-all ${
                i < step
                  ? 'bg-primary text-primary-foreground'
                  : i === step
                  ? 'bg-primary text-primary-foreground ring-2 ring-primary ring-offset-2 ring-offset-background'
                  : 'bg-muted text-muted-foreground'
              }`}>
                {i < step ? <Check size={12} /> : i + 1}
              </div>
              {i < TOTAL_STEPS - 1 && (
                <div className={`h-px w-8 transition-all ${i < step ? 'bg-primary' : 'bg-border'}`} />
              )}
            </div>
          ))}
        </div>

        {/* Card */}
        <div className="rounded-xl border border-border bg-card p-6 shadow-lg">

          {/* Step 0: Language + Accent color */}
          {step === 0 && (
            <div className="space-y-5">
              <p className="text-sm text-muted-foreground">{t('onboarding.languageSubtitle')}</p>

              <Select
                label={t('settings.language')}
                value={language}
                onChange={e => setLanguage(e.target.value)}
                options={availableLanguages.map(l => ({ value: l.code, label: l.label }))}
              />

              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">{t('settings.accentColor')}</label>
                <div className="flex flex-wrap gap-2">
                  {ACCENT_PRESETS.map(preset => {
                    const hex = hslToHex(preset.hsl)
                    const isSelected = accentColor === preset.hsl
                    return (
                      <button
                        key={preset.hsl}
                        type="button"
                        title={t(preset.label)}
                        onClick={() => setAccentColor(preset.hsl)}
                        className={`h-8 w-8 rounded-full border-2 transition-all hover:scale-110 ${
                          isSelected ? 'border-foreground scale-110 shadow-md' : 'border-transparent'
                        }`}
                        style={{ backgroundColor: hex }}
                      >
                        {isSelected && (
                          <span className="flex h-full w-full items-center justify-center">
                            <Check size={12} className="text-white drop-shadow" />
                          </span>
                        )}
                      </button>
                    )
                  })}
                </div>
              </div>
            </div>
          )}

          {/* Step 1: Create profile */}
          {step === 1 && (
            <div className="space-y-5">
              <p className="text-sm text-muted-foreground">{t('onboarding.profileSubtitle')}</p>
              <Input
                label={t('common.name')}
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder={t('onboarding.namePlaceholder')}
                autoFocus
                onKeyDown={e => { if (e.key === 'Enter') handleNext() }}
              />
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">{t('onboarding.colorLabel')}</label>
                <div className="flex flex-wrap gap-2">
                  {PRESET_COLORS.map(c => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setColor(c)}
                      className={`h-8 w-8 rounded-full border-2 transition-all hover:scale-105 ${
                        color === c ? 'border-foreground scale-110 shadow-md' : 'border-transparent'
                      }`}
                      style={{ backgroundColor: c }}
                    />
                  ))}
                </div>
                {name.trim() && (
                  <div className="mt-3 flex items-center gap-3">
                    <div
                      className="flex h-9 w-9 items-center justify-center rounded-full text-sm font-bold text-white shadow"
                      style={{ backgroundColor: color }}
                    >
                      {name.trim()[0].toUpperCase()}
                    </div>
                    <span className="text-sm font-medium text-foreground">{name.trim()}</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Step 2: Business days */}
          {step === 2 && (
            <div className="space-y-5">
              <p className="text-sm text-muted-foreground">{t('onboarding.businessDaysSubtitle')}</p>

              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{t('settings.mode')}</p>
                <div className="flex rounded-lg border border-input p-0.5 bg-muted/30">
                  <button type="button" onClick={() => setBdMode('manual')}
                    className={`flex-1 py-1.5 text-sm font-medium rounded-md transition-all ${
                      bdMode === 'manual' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
                    }`}>
                    {t('settings.manual')}
                  </button>
                  <button type="button" onClick={() => setBdMode('api')}
                    className={`flex-1 py-1.5 text-sm font-medium rounded-md transition-all ${
                      bdMode === 'api' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
                    }`}>
                    {t('settings.withHolidaysApi')}
                  </button>
                </div>
                <p className="text-xs text-muted-foreground">
                  {bdMode === 'manual' ? t('settings.manualDesc') : t('settings.apiDesc')}
                </p>
              </div>

              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{t('settings.weekdays')}</p>
                <div className="flex gap-2">
                  {weekdayLabels.map((label, day) => {
                    const isSelected = bdWeekdays.includes(day)
                    return (
                      <button
                        key={day}
                        type="button"
                        onClick={() => toggleWeekday(day)}
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

              {bdMode === 'api' && (
                <Select
                  label={t('settings.countryHolidays')}
                  value={bdCountry}
                  onChange={e => setBdCountry(e.target.value)}
                  options={[
                    { value: 'BR', label: t('settings.brazil') },
                    { value: 'US', label: t('settings.usa') },
                    { value: 'PT', label: t('settings.portugal') },
                    { value: 'AR', label: t('settings.argentina') },
                    { value: 'DE', label: t('settings.germany') },
                    { value: 'FR', label: t('settings.france') },
                    { value: 'ES', label: t('settings.spain') },
                    { value: 'GB', label: t('settings.uk') },
                    { value: 'JP', label: t('settings.japan') },
                  ]}
                />
              )}
            </div>
          )}

          {/* Step 3: Currency rates */}
          {step === 3 && (
            <div className="space-y-5">
              <p className="text-sm text-muted-foreground">{t('onboarding.currencySubtitle')}</p>

              <Toggle
                checked={frankfurterEnabled}
                onChange={setFrankfurterEnabled}
                label={t('currencyManagement.useApiForRates')}
              />

              {frankfurterEnabled && (
                <div className="space-y-3 border-l-2 border-border pl-3">
                  <Toggle
                    checked={updateOnStartup}
                    onChange={setUpdateOnStartup}
                    label={t('currencyManagement.updateOnStartup')}
                  />
                  <div className="space-y-2">
                    <Toggle
                      checked={updateByInterval}
                      onChange={setUpdateByInterval}
                      label={t('currencyManagement.updateByInterval')}
                    />
                    {updateByInterval && (
                      <Select
                        label=""
                        value={intervalMode}
                        onChange={e => setIntervalMode(e.target.value)}
                        options={[
                          { value: '3h', label: t('currencyManagement.every3h') },
                          { value: '6h', label: t('currencyManagement.every6h') },
                          { value: '9h', label: t('currencyManagement.every9h') },
                          { value: '12h', label: t('currencyManagement.every12h') },
                          { value: '24h', label: t('currencyManagement.every24h') },
                        ]}
                      />
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Step 4: System preferences */}
          {step === 4 && (
            <div className="space-y-5">
              <p className="text-sm text-muted-foreground">{t('onboarding.appSettingsSubtitle')}</p>
              <div className="space-y-4">
                <Toggle
                  checked={autoStart}
                  onChange={setAutoStart}
                  label={t('settings.autoStart')}
                />
                <Toggle
                  checked={minimizeToTray}
                  onChange={setMinimizeToTray}
                  label={t('settings.minimizeToTray')}
                />
              </div>
            </div>
          )}
        </div>

        {/* Navigation */}
        <div className="mt-4 flex justify-between">
          <Button
            variant="ghost"
            onClick={() => setStep(s => s - 1)}
            disabled={step === 0}
          >
            <ChevronLeft size={16} /> {t('onboarding.back')}
          </Button>
          <Button onClick={handleNext} disabled={saving}>
            {step < TOTAL_STEPS - 1 ? (
              <>{t('onboarding.next')} <ChevronRight size={16} /></>
            ) : (
              t('onboarding.finish')
            )}
          </Button>
        </div>

        {/* Step label */}
        <p className="mt-3 text-center text-xs text-muted-foreground">
          {t('onboarding.step', { current: String(step + 1), total: String(TOTAL_STEPS) })}
        </p>
      </div>
    </div>
  )
}
