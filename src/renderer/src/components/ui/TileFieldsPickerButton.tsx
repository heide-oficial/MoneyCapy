import { useState } from 'react'
import { Eye } from 'lucide-react'
import { Modal } from './Modal'
import { Toggle } from './Toggle'
import { useTileFields, type GastosFieldVisibility, type ReceitasFieldVisibility } from '../../contexts/TileFieldsContext'
import { useTranslation } from '../../contexts/LanguageContext'

const GASTOS_FIELDS: { key: keyof GastosFieldVisibility; tKey: string }[] = [
  { key: 'type', tKey: 'tileFields.type' },
  { key: 'billingDay', tKey: 'tileFields.billingDay' },
  { key: 'dueDay', tKey: 'tileFields.dueDay' },
  { key: 'card', tKey: 'tileFields.card' },
  { key: 'store', tKey: 'tileFields.store' },
  { key: 'category', tKey: 'tileFields.category' },
  { key: 'interestRate', tKey: 'tileFields.interestRate' },
  { key: 'installments', tKey: 'tileFields.installments' }
]

const RECEITAS_FIELDS: { key: keyof ReceitasFieldVisibility; tKey: string }[] = [
  { key: 'type', tKey: 'tileFields.type' },
  { key: 'dueDay', tKey: 'tileFields.receivingDay' }
]

interface TileFieldsPickerButtonProps {
  page: string
  showGastos?: boolean
  showReceitas?: boolean
}

export function TileFieldsPickerButton({ page, showGastos = true, showReceitas = true }: TileFieldsPickerButtonProps) {
  const [open, setOpen] = useState(false)
  const { gastosFields, receitasFields, setGastosField, setReceitasField } = useTileFields(page)
  const { t } = useTranslation()

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center justify-center h-7 w-7 rounded-md hover:bg-accent transition-colors"
        title={t('tileFields.title')}
      >
        <Eye size={14} className="text-muted-foreground" />
      </button>

      <Modal open={open} onClose={() => setOpen(false)} title={t('tileFields.title')} maxWidth="max-w-sm">
        <div className="space-y-5">
          {showGastos && (
            <div className="space-y-2">
              <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{t('tileFields.expenses')}</h4>
              <div className="rounded-lg border border-border bg-card p-3 space-y-2.5">
                {GASTOS_FIELDS.map(f => (
                  <div key={f.key} className="flex items-center justify-between">
                    <span className="text-sm text-foreground">{t(f.tKey)}</span>
                    <Toggle checked={gastosFields[f.key]} onChange={v => setGastosField(f.key, v)} />
                  </div>
                ))}
              </div>
            </div>
          )}

          {showReceitas && (
            <div className="space-y-2">
              <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{t('tileFields.income')}</h4>
              <div className="rounded-lg border border-border bg-card p-3 space-y-2.5">
                {RECEITAS_FIELDS.map(f => (
                  <div key={f.key} className="flex items-center justify-between">
                    <span className="text-sm text-foreground">{t(f.tKey)}</span>
                    <Toggle checked={receitasFields[f.key]} onChange={v => setReceitasField(f.key, v)} />
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </Modal>
    </>
  )
}
