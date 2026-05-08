import { useState, useEffect } from 'react'
import { Modal } from '../../../components/ui/Modal'
import { Button } from '../../../components/ui/Button'
import { RotateCcw } from 'lucide-react'
import { useTranslation } from '../../../contexts/LanguageContext'

type WidgetField =
  | { id: string; labelKey: string; type: 'boolean'; default: boolean }
  | { id: string; labelKey: string; type: 'number'; default: number; min: number; max: number }

function boolField(id: string, labelKey: string, def = true): WidgetField {
  return { id, labelKey, type: 'boolean', default: def }
}

function numField(id: string, labelKey: string, def: number, min: number, max: number): WidgetField {
  return { id, labelKey, type: 'number', default: def, min, max }
}

const LIST_PAGE_SIZE = numField('pageSize', 'widgetSettings.itemsPerPage', 5, 1, 50)

const WIDGET_FIELDS: Record<string, WidgetField[]> = {
  'cards-total': [
    boolField('totalUsed', 'widgetSettings.totalSpent'),
    boolField('totalLimit', 'widgetSettings.totalLimit'),
    boolField('availableLimit', 'widgetSettings.availableLimit'),
    boolField('progressBar', 'widgetSettings.progressBar'),
    boolField('usagePercent', 'widgetSettings.usagePercent'),
    boolField('cardCount', 'widgetSettings.cardCount'),
    boolField('cardList', 'widgetSettings.cardList'),
  ],
  'card': [
    boolField('usedLimit', 'widgetSettings.usedOverTotal'),
    boolField('availableLimit', 'widgetSettings.availableLimit'),
    boolField('progressBar', 'widgetSettings.progressBar'),
    boolField('usagePercent', 'widgetSettings.usagePercent'),
    boolField('dueDay', 'widgetSettings.dueDay'),
    boolField('closeDay', 'widgetSettings.closingDay'),
    boolField('cardType', 'widgetSettings.cardType'),
    boolField('bankAccount', 'widgetSettings.linkedBankAccount'),
    boolField('commonItems', 'widgetSettings.uniqueExpenses'),
    boolField('installmentItems', 'widgetSettings.installmentExpenses'),
    boolField('subscriptionItems', 'widgetSettings.recurringExpenses'),
  ],
  'type-distribution': [
    boolField('progressBar', 'widgetSettings.distributionBar'),
    boolField('showLegend', 'widgetSettings.legend'),
    boolField('showValues', 'widgetSettings.valuesByType', false),
    boolField('truncateNames', 'widgetSettings.truncateLongNames', false),
  ],
  'category-distribution': [
    boolField('progressBar', 'widgetSettings.distributionBar'),
    boolField('showLegend', 'widgetSettings.legend'),
    boolField('showValues', 'widgetSettings.valuesByCategory', false),
    boolField('truncateNames', 'widgetSettings.truncateLongNames', false),
  ],
  'subcategory-distribution': [
    boolField('progressBar', 'widgetSettings.distributionBar'),
    boolField('showLegend', 'widgetSettings.legend'),
    boolField('showValues', 'widgetSettings.valuesBySubcategory', false),
    boolField('truncateNames', 'widgetSettings.truncateLongNames', false),
  ],
  'tag-distribution': [
    boolField('progressBar', 'widgetSettings.distributionBar'),
    boolField('showLegend', 'widgetSettings.legend'),
    boolField('showValues', 'widgetSettings.valuesByTag', false),
    boolField('truncateNames', 'widgetSettings.truncateLongNames', false),
  ],
  'income-type-distribution': [
    boolField('progressBar', 'widgetSettings.distributionBar'),
    boolField('showLegend', 'widgetSettings.legend'),
    boolField('showValues', 'widgetSettings.valuesByType', false),
    boolField('truncateNames', 'widgetSettings.truncateLongNames', false),
  ],
  'income-category-distribution': [
    boolField('progressBar', 'widgetSettings.distributionBar'),
    boolField('showLegend', 'widgetSettings.legend'),
    boolField('showValues', 'widgetSettings.valuesByCategory', false),
    boolField('truncateNames', 'widgetSettings.truncateLongNames', false),
  ],
  'income-subcategory-distribution': [
    boolField('progressBar', 'widgetSettings.distributionBar'),
    boolField('showLegend', 'widgetSettings.legend'),
    boolField('showValues', 'widgetSettings.valuesBySubcategory', false),
    boolField('truncateNames', 'widgetSettings.truncateLongNames', false),
  ],
  'upcoming-expenses': [LIST_PAGE_SIZE],
  'unpaid-items': [LIST_PAGE_SIZE],
  'top-expenses': [LIST_PAGE_SIZE],
  'pending-incomes': [LIST_PAGE_SIZE],
  'ending-installments': [LIST_PAGE_SIZE],

  'overdue-items': [LIST_PAGE_SIZE],
  'upcoming-billing': [LIST_PAGE_SIZE, numField('lookAheadDays', 'widgetSettings.futureDays', 7, 1, 30)],
}

function getFieldsForWidget(widgetId: string): WidgetField[] | null {
  if (WIDGET_FIELDS[widgetId]) return WIDGET_FIELDS[widgetId]
  if (widgetId.startsWith('card-')) return WIDGET_FIELDS['card']
  return null
}

interface WidgetSettingsModalProps {
  open: boolean
  onClose: () => void
  widgetId: string
  widgetLabel: string
  displayPrefs?: Record<string, any>
  onSave: (prefs: Record<string, any>) => void
}

export function WidgetSettingsModal({ open, onClose, widgetId, widgetLabel, displayPrefs, onSave }: WidgetSettingsModalProps) {
  const { t } = useTranslation()
  const fields = getFieldsForWidget(widgetId)
  const [prefs, setPrefs] = useState<Record<string, any>>({})

  useEffect(() => {
    if (open && fields) {
      const initial: Record<string, any> = {}
      for (const f of fields) {
        initial[f.id] = displayPrefs?.[f.id] ?? f.default
      }
      setPrefs(initial)
    }
  }, [open, widgetId])

  if (!fields) return null

  const resetDefaults = () => {
    const defaults: Record<string, any> = {}
    for (const f of fields) {
      defaults[f.id] = f.default
    }
    setPrefs(defaults)
  }

  const handleSave = () => {
    onSave(prefs)
    onClose()
  }

  return (
    <Modal open={open} onClose={onClose} title={t('widgetSettings.customizeTitle', { name: widgetLabel })}>
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground">{t('widgetSettings.chooseInfo')}</p>

        <div className="space-y-1">
          {fields.map(f => {
            if (f.type === 'boolean') {
              return (
                <label
                  key={f.id}
                  className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-accent/50 cursor-pointer transition-colors"
                >
                  <input
                    type="checkbox"
                    checked={prefs[f.id] ?? f.default}
                    onChange={() => setPrefs(p => ({ ...p, [f.id]: !p[f.id] }))}
                    className="h-4 w-4 rounded border-input text-primary focus:ring-primary/30 accent-primary"
                  />
                  <span className="text-sm">{t(f.labelKey)}</span>
                </label>
              )
            }
            // number field
            return (
              <div key={f.id} className="flex items-center justify-between px-3 py-2 rounded-lg">
                <span className="text-sm">{t(f.labelKey)}</span>
                <input
                  type="number"
                  min={f.min}
                  max={f.max}
                  value={prefs[f.id] ?? f.default}
                  onChange={e => {
                    const v = parseInt(e.target.value)
                    if (!isNaN(v)) setPrefs(p => ({ ...p, [f.id]: Math.max(f.min, Math.min(f.max, v)) }))
                  }}
                  className="w-16 rounded-md border border-input bg-background px-2 py-1 text-sm text-center tabular-nums focus:outline-none focus:ring-2 focus:ring-primary/30"
                />
              </div>
            )
          })}
        </div>

        <div className="flex items-center justify-between pt-2">
          <button
            type="button"
            onClick={resetDefaults}
            className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            <RotateCcw size={12} />
            {t('widgetSettings.restoreDefault')}
          </button>
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose}>{t('common.cancel')}</Button>
            <Button onClick={handleSave}>{t('common.save')}</Button>
          </div>
        </div>
      </div>
    </Modal>
  )
}

export function hasWidgetSettings(widgetId: string): boolean {
  return getFieldsForWidget(widgetId) !== null
}
