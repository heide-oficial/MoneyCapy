import { Select } from './Select'
import { Input } from './Input'
import { useTranslation } from '../../contexts/LanguageContext'

function getDayTypeOptions(t: (key: string) => string) {
  return [
    { value: '', label: t('dayPicker.none') },
    { value: 'random', label: t('dayPicker.random') },
    { value: 'static', label: t('dayPicker.fixedDay') },
    { value: 'business_day', label: t('dayPicker.businessDay') },
    { value: 'last_day', label: t('dayPicker.lastDay') },
    { value: 'last_business_day', label: t('dayPicker.lastBusinessDay') }
  ]
}

function getDayTypeOptionsWithCard(t: (key: string) => string) {
  return [
    ...getDayTypeOptions(t),
    { value: 'card_due', label: t('dayPicker.cardDueDay') }
  ]
}

interface DayPickerProps {
  label: string
  day: string
  dayType: string
  monthOffset?: number
  showMonthOffsetOptions?: boolean
  showCardDueOption?: boolean
  monthOffsetOptions?: { value: string; label: string }[]
  onChange: (day: string, dayType: string, monthOffset?: number) => void
}

export function DayPicker({ label, day, dayType, monthOffset = 0, showMonthOffsetOptions, showCardDueOption, monthOffsetOptions, onChange }: DayPickerProps) {
  const { t } = useTranslation()
  const isCardDue = dayType === 'card_due'
  const needsNumber = !isCardDue && (dayType === 'static' || dayType === 'business_day')
  const maxDay = dayType === 'business_day' ? 20 : 31
  const options = showCardDueOption ? getDayTypeOptionsWithCard(t) : getDayTypeOptions(t)
  const showMonthSelector = showMonthOffsetOptions && dayType && dayType !== 'random'
  const moOptions = monthOffsetOptions || [
    { value: '0', label: t('dayPicker.currentMonth') },
    { value: '1', label: t('dayPicker.nextMonth') }
  ]

  return (
    <div className="space-y-1.5">
      <label className="text-sm font-medium text-foreground">{label}</label>
      <div className={`grid gap-2 ${needsNumber && showMonthSelector ? 'grid-cols-3' : (needsNumber || showMonthSelector) ? 'grid-cols-2' : 'grid-cols-1'}`}>
        <Select
          value={dayType}
          onChange={e => {
            const val = e.target.value
            if (val === '' || val === 'random' || val === 'last_day' || val === 'last_business_day' || val === 'card_due') {
              onChange('', val, showMonthOffsetOptions ? (val === '' || val === 'random' ? 0 : monthOffset) : undefined)
            } else {
              onChange(day, val, showMonthOffsetOptions ? monthOffset : undefined)
            }
          }}
          options={options}
        />
        {needsNumber && (
          <Input
            type="number"
            min={1}
            max={maxDay}
            value={day}
            onChange={e => onChange(e.target.value, dayType, showMonthOffsetOptions ? monthOffset : undefined)}
            placeholder={dayType === 'business_day' ? t('dayPicker.businessDayPlaceholder') : t('dayPicker.dayPlaceholder')}
          />
        )}
        {showMonthSelector && (
          <Select
            value={String(monthOffset)}
            onChange={e => onChange(day, dayType, parseInt(e.target.value))}
            options={moOptions}
          />
        )}
      </div>
    </div>
  )
}
