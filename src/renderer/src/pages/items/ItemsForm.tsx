import { useState, useRef, useEffect } from 'react'
import { Button } from '../../components/ui/Button'
import { Modal } from '../../components/ui/Modal'
import { Input } from '../../components/ui/Input'
import { CurrencyInput } from '../../components/ui/CurrencyInput'
import { DatePicker } from '../../components/ui/DatePicker'
import { Select } from '../../components/ui/Select'
import { formatCurrency, formatCurrencyWith } from '../../lib/currency'
import { useFormatDate } from '../../lib/date'
import { useCurrencySettings } from '../../contexts/CurrencySettingsContext'
import { Plus, X, FastForward, Undo2, Check, Palette } from 'lucide-react'
import type { TagData, CardSplit, SectionItem } from '../../types/entities'
import { DayPicker } from '../../components/ui/DayPicker'
import { ColorPicker } from '../../components/ui/ColorPicker'
import { useTranslation } from '../../contexts/LanguageContext'
import { toast } from 'sonner'
import { createNoteBlock, formatNoteBlockDate, parseNoteBlocks, serializeNoteBlocks } from '../../lib/note-blocks'
import { addMonths } from '../../lib/interruptions'

export interface FormSplit {
  cardId: string
  value: number
  totalInstallments: number
  paymentMethod?: string
}

export type ModalTab = 'detalhes' | 'valores' | 'parcelas' | 'interrupcoes' | 'classificacao' | 'observacoes'

interface MonthlyValueOverride {
  month: string
  value: number
}

export function getTypeOptions(t: (key: string) => string) {
  return [
    { value: 'common', label: t('itemTypes.common') },
    { value: 'installment', label: t('itemTypes.installment') },
    { value: 'subscription', label: t('itemTypes.subscription') },
    { value: 'emprestimo', label: t('itemTypes.emprestimo') }
  ] as const
}

export type CardMode = 'none' | 'single' | 'multi'

export const defaultForm = {
  description: '', type: 'common' as string, value: 0, baseValue: 0,
  dueDay: '' as string,
  dueDayLabel: '' as string,
  dueDayType: '' as string,
  dueDayMonthOffset: 0 as number,
  billingDay: '' as string,
  billingDayType: '' as string,
  billingDayMonthOffset: 0 as number,
  categoryId: '' as string | number, subcategoryId: '' as string | number, cardId: '' as string | number,
  notes: '', tagIds: [] as number[],
  cardMode: 'none' as CardMode,
  splits: [] as FormSplit[],
  storeId: '' as string | number,
  interestRate: '' as string,
  bankAccountId: '' as string | number,
  startMonth: '',
  endMonth: '',
  isPaid: false,
  paidAt: '',
  paymentMethod: '' as string,
  currencyId: '' as string | number,
  exchangeRateSnapshot: 1.0
}

export type ItemForm = typeof defaultForm

interface Category { id: number; name: string; icon: string; color: string; scope?: 'expense' | 'income' | 'both' }
interface Subcategory { id: number; name: string; color: string; scope?: 'expense' | 'income' | 'both'; categoryIds?: number[] }
interface StoreData2 { id: number; name: string }
interface CardData { id: number; name: string; personId: number | null; bankAccountId: number | null; billingCloseDay?: number; cardType?: 'credit' | 'debit' | 'both' }
interface BankAccountData { id: number; name: string; nomeBanco: string | null }

function addMonths(month: string, offset: number): string {
  const [year, monthIndex] = month.split('-').map(Number)
  if (!year || !monthIndex) return ''
  const total = year * 12 + monthIndex - 1 + offset
  const nextYear = Math.floor(total / 12)
  const nextMonth = (total % 12) + 1
  return `${nextYear}-${String(nextMonth).padStart(2, '0')}`
}

export interface ItemsFormProps {
  open: boolean
  onClose: () => void
  editing: SectionItem | null
  month: string
  typeFilter?: string
  form: ItemForm
  setForm: React.Dispatch<React.SetStateAction<ItemForm>>
  categories: Category[]
  setCategories: React.Dispatch<React.SetStateAction<Category[]>>
  subcategories: Subcategory[]
  setSubcategories: React.Dispatch<React.SetStateAction<Subcategory[]>>
  cards: CardData[]
  bankAccounts: BankAccountData[]
  stores: StoreData2[]
  setStores: React.Dispatch<React.SetStateAction<StoreData2[]>>
  allTags: TagData[]
  setAllTags: React.Dispatch<React.SetStateAction<TagData[]>>
  handleSave: () => Promise<void>
  handleAnticipate: (splitId?: number, discountedTotal?: number) => Promise<void>
  handleUndoAnticipation: (anticipationId: number) => Promise<void>
  handleReactivate: (interruptionId: number) => void
  setInterruptItem: (item: SectionItem | null) => void
  onValuesChanged?: () => void
  showParcelasTab: boolean
  initialTab?: ModalTab
  anticipateCounts: Record<string, string>
  setAnticipateCounts: React.Dispatch<React.SetStateAction<Record<string, string>>>
}

export function ItemsForm({
  open, onClose, editing, month, typeFilter,
  form, setForm,
  categories, setCategories, subcategories, setSubcategories, cards, bankAccounts, stores, setStores,
  allTags, setAllTags,
  handleSave, handleAnticipate, handleUndoAnticipation,
  handleReactivate, setInterruptItem,
  onValuesChanged,
  showParcelasTab, initialTab,
  anticipateCounts, setAnticipateCounts
}: ItemsFormProps) {
  const { fmtMonth, fmtDate } = useFormatDate()
  const { currencies, baseCurrency } = useCurrencySettings()
  const { t } = useTranslation()
  const typeOptions = getTypeOptions(t)
  const expenseCategories = categories
  const availableSubcategories = form.categoryId
    ? subcategories.filter(s => s.scope !== 'income' && (s.categoryIds || []).includes(Number(form.categoryId)))
    : []
  const [modalTab, setModalTab] = useState<ModalTab>('detalhes')
  const [modalScrollFade, setModalScrollFade] = useState({ top: false, bottom: false })
  const modalScrollRef = useRef<HTMLDivElement>(null)
  const [discountStates, setDiscountStates] = useState<Record<string, { mode: 'total' | 'perParcel' | 'percent'; total: number }>>({})
  const [valueOverrides, setValueOverrides] = useState<MonthlyValueOverride[]>([])
  const [showValueOverrideModal, setShowValueOverrideModal] = useState(false)
  const [valueOverrideMonth, setValueOverrideMonth] = useState('')
  const [valueOverrideValue, setValueOverrideValue] = useState(0)

  // Inline creation modals
  const INLINE_COLORS = ['#3b82f6', '#22c55e', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#f97316', '#14b8a6', '#6366f1']
  const [showStoreCreate, setShowStoreCreate] = useState(false)
  const [storeCreateName, setStoreCreateName] = useState('')
  const [storeCreateColor, setStoreCreateColor] = useState(INLINE_COLORS[0])
  const [showStoreColorPicker, setShowStoreColorPicker] = useState(false)
  const [showCatCreate, setShowCatCreate] = useState(false)
  const [catCreateName, setCatCreateName] = useState('')
  const [catCreateColor, setCatCreateColor] = useState(INLINE_COLORS[0])
  const [showCatColorPicker, setShowCatColorPicker] = useState(false)
  const [showSubcatCreate, setShowSubcatCreate] = useState(false)
  const [subcatCreateName, setSubcatCreateName] = useState('')
  const [subcatCreateColor, setSubcatCreateColor] = useState(INLINE_COLORS[0])
  const [showSubcatColorPicker, setShowSubcatColorPicker] = useState(false)
  const [showTagCreate, setShowTagCreate] = useState(false)
  const [tagCreateName, setTagCreateName] = useState('')
  const [tagCreateColor, setTagCreateColor] = useState(INLINE_COLORS[0])
  const [showTagColorPicker, setShowTagColorPicker] = useState(false)

  // Reset tab and discount state when opening
  useEffect(() => {
    if (open) {
      setModalTab(initialTab || 'detalhes')
      setDiscountStates({})
    }
  }, [open])

  const loadValueOverrides = async () => {
    if (!editing || form.type !== 'subscription') {
      setValueOverrides([])
      return
    }
    const rows = await window.api.items.listMonthValues(editing.id)
    setValueOverrides(rows)
  }

  useEffect(() => {
    if (open && editing && form.type === 'subscription') {
      loadValueOverrides()
    } else if (!open) {
      setValueOverrides([])
    }
  }, [open, editing?.id, form.type])

  const openValueOverrideModal = (entry?: MonthlyValueOverride) => {
    setValueOverrideMonth(entry?.month || month)
    setValueOverrideValue(entry?.value ?? editing?.effectiveValue ?? form.value)
    setShowValueOverrideModal(true)
  }

  const handleSaveValueOverride = async () => {
    if (!editing || !valueOverrideMonth) return
    await window.api.items.setMonthValue(editing.id, valueOverrideMonth, valueOverrideValue)
    toast.success(t('valueOverrides.saved'))
    setShowValueOverrideModal(false)
    await loadValueOverrides()
    onValuesChanged?.()
  }

  const handleRemoveValueOverride = async (targetMonth: string) => {
    if (!editing) return
    await window.api.items.removeMonthValue(editing.id, targetMonth)
    toast.success(t('valueOverrides.removed'))
    await loadValueOverrides()
    onValuesChanged?.()
  }

  const handleModalScroll = () => {
    const el = modalScrollRef.current
    if (!el) return
    setModalScrollFade({
      top: el.scrollTop > 8,
      bottom: el.scrollTop + el.clientHeight < el.scrollHeight - 8
    })
  }

  useEffect(() => {
    if (open) {
      requestAnimationFrame(handleModalScroll)
    }
  }, [open, modalTab])

  const toggleTag = (tagId: number) => {
    setForm(f => ({
      ...f,
      tagIds: f.tagIds.includes(tagId)
        ? f.tagIds.filter(id => id !== tagId)
        : [...f.tagIds, tagId]
    }))
  }

  const addCard = () => {
    setForm(f => {
      const ref = f.splits[0] || { cardId: '', value: 0, totalInstallments: 1, paymentMethod: 'credit' }
      return {
        ...f,
        splits: [...f.splits, { cardId: '', value: 0, totalInstallments: ref.totalInstallments, paymentMethod: ref.paymentMethod || 'credit' }]
      }
    })
  }

  const removeCard = (index: number) => {
    setForm(f => ({ ...f, splits: f.splits.filter((_, i) => i !== index) }))
  }

  const getCardPaymentAvailability = (cardIds: string[]) => {
    const selectedCards = cardIds
      .filter(Boolean)
      .map(id => cards.find(c => String(c.id) === String(id)))
      .filter(Boolean) as CardData[]
    return {
      canCredit: !selectedCards.some(card => card.cardType === 'debit'),
      canDebit: !selectedCards.some(card => card.cardType === 'credit')
    }
  }

  const normalizePaymentMethodForCards = (current: string, cardIds: string[]) => {
    const { canCredit, canDebit } = getCardPaymentAvailability(cardIds)
    if (current === 'credit' && canCredit) return current
    if (current === 'debit' && canDebit) return current
    if (canCredit) return 'credit'
    if (canDebit) return 'debit'
    return current || 'credit'
  }

  const normalizePaymentMethodForCard = (current: string | undefined, cardId: string | number) =>
    normalizePaymentMethodForCards(current || 'credit', cardId ? [String(cardId)] : [])

  const getLastInstallmentMonth = () => {
    if (!form.startMonth || !(form.type === 'installment' || form.type === 'emprestimo')) return ''
    if (form.type === 'emprestimo' || form.cardMode !== 'multi') {
      const totalInstallments = Number(form.splits[0]?.totalInstallments || editing?.totalInstallments) || 0
      const effectiveTotal = Math.max(totalInstallments - (editing?.totalAnticipated || 0), 0)
      return effectiveTotal > 0 ? addMonths(form.startMonth, effectiveTotal - 1) : ''
    }
    const totals = form.splits.length > 0
      ? form.splits.map(split => {
        const savedSplit = editing?.cardSplits?.find(sp => String(sp.cardId) === String(split.cardId))
        return Math.max((Number(split.totalInstallments) || 0) - (savedSplit?.totalAnticipated || 0), 0)
      })
      : [Math.max((Number(form.splits[0]?.totalInstallments || editing?.totalInstallments) || 0) - (editing?.totalAnticipated || 0), 0)]
    const effectiveTotal = Math.max(...totals, 0)
    return effectiveTotal > 0 ? addMonths(form.startMonth, effectiveTotal - 1) : ''
  }

  const updateSplit = (index: number, field: keyof FormSplit, val: any) => {
    setForm(f => {
      const splits = f.splits.map((s, i) => {
        if (i !== index) return s
        const updated = { ...s, [field]: val }
        return field === 'cardId'
          ? { ...updated, paymentMethod: normalizePaymentMethodForCard(updated.paymentMethod, val) }
          : updated
      })
      return {
        ...f,
        splits,
        paymentMethod: field === 'cardId'
          ? normalizePaymentMethodForCards(f.paymentMethod, splits.map(s => String(s.cardId)))
          : f.paymentMethod
      }
    })
  }

  const handleTypeChange = (newType: string) => {
    setForm(f => {
      if (newType === 'emprestimo') {
        return {
          ...f,
          type: newType,
          cardMode: 'none' as CardMode,
          cardId: '',
          splits: [{ cardId: '', value: f.value, totalInstallments: f.splits[0]?.totalInstallments || 1, paymentMethod: 'credit' }],
          paymentMethod: 'credit'
        }
      }
      const isInstType = newType === 'installment'
      return {
        ...f,
        type: newType,
        cardMode: isInstType ? f.cardMode : 'none' as CardMode,
        splits: isInstType
          ? (f.splits.length > 0 ? f.splits : [{ cardId: '', value: f.value, totalInstallments: 1, paymentMethod: 'credit' }])
          : [],
        cardId: !isInstType ? f.cardId : '',
        interestRate: newType !== 'emprestimo' ? '' : f.interestRate,
        paymentMethod: isInstType ? 'credit' : (newType === 'common' || newType === 'subscription' ? '' : f.paymentMethod)
      }
    })
  }

  // Currency helpers (shared across tabs)
  const selectedCurrency = currencies.find(c => c.id === Number(form.currencyId)) || baseCurrency
  const currencySymbol = selectedCurrency?.symbol || undefined
  const isForeign = !!(selectedCurrency && !selectedCurrency.isBase)
  const fmtVal = (v: number) => isForeign && currencySymbol ? formatCurrencyWith(v, currencySymbol) : formatCurrency(v)

  /* ─── Tab: Detalhes ─── */
  const renderTabDetalhes = () => {
    const isInstallment = form.type === 'installment'
    const isEmprestimo = form.type === 'emprestimo'
    const installmentCardIds = form.splits.map(s => String(s.cardId)).filter(Boolean)
    const paymentAvailability = getCardPaymentAvailability(installmentCardIds)

    const setCardMode = (mode: CardMode) => {
      setForm(f => {
        const baseSplit = f.splits[0] || { cardId: '', value: f.value, totalInstallments: 1, paymentMethod: 'credit' }
        if (mode === 'none') return { ...f, cardMode: mode, splits: [{ ...baseSplit, cardId: '' }], paymentMethod: '' }
        if (mode === 'single') {
          const splits = [{ ...baseSplit, value: f.value }]
          return { ...f, cardMode: mode, splits, paymentMethod: normalizePaymentMethodForCards(f.paymentMethod || 'credit', splits.map(s => String(s.cardId))) }
        }
        if (f.splits.length < 2) {
          const splits = [
            { ...baseSplit, value: baseSplit.value || f.value },
            { cardId: '', value: 0, totalInstallments: baseSplit.totalInstallments, paymentMethod: baseSplit.paymentMethod || 'credit' }
          ]
          return { ...f, cardMode: mode, splits: [
            ...splits
          ], paymentMethod: normalizePaymentMethodForCards(f.paymentMethod || 'credit', splits.map(s => String(s.cardId)))}
        }
        return { ...f, cardMode: mode, paymentMethod: normalizePaymentMethodForCards(f.paymentMethod || 'credit', f.splits.map(s => String(s.cardId))) }
      })
    }

    const renderPaymentMethodSelector = () => (
      <div className="space-y-1.5">
        <label className="text-sm font-medium text-foreground">{t('itemsForm.paymentMethod')}</label>
        <div className="flex rounded-lg border border-input p-0.5 bg-muted/30">
          <button type="button" onClick={() => setForm(f => ({ ...f, paymentMethod: 'credit' }))}
            disabled={!paymentAvailability.canCredit}
            className={`flex-1 py-1.5 text-sm font-medium rounded-md transition-all ${
              form.paymentMethod === 'credit' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
            } ${!paymentAvailability.canCredit ? 'opacity-30 cursor-not-allowed' : ''}`}>
            {t('itemsForm.credit')}
          </button>
          <button type="button" onClick={() => setForm(f => ({ ...f, paymentMethod: 'debit' }))}
            disabled={!paymentAvailability.canDebit}
            className={`flex-1 py-1.5 text-sm font-medium rounded-md transition-all ${
              form.paymentMethod === 'debit' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
            } ${!paymentAvailability.canDebit ? 'opacity-30 cursor-not-allowed' : ''}`}>
            {t('itemsForm.debit')}
          </button>
        </div>
      </div>
    )

    const renderSplitPaymentMethodSelector = (sp: FormSplit, idx: number) => {
      const selectedCard = cards.find(c => String(c.id) === String(sp.cardId))
      const canCredit = selectedCard?.cardType !== 'debit'
      const canDebit = selectedCard?.cardType !== 'credit'
      const paymentMethod = normalizePaymentMethodForCard(sp.paymentMethod, sp.cardId)

      return (
        <div className="space-y-1.5">
          <label className="text-sm font-medium text-foreground">{t('itemsForm.paymentMethod')}</label>
          <div className="flex rounded-lg border border-input p-0.5 bg-muted/30">
            <button type="button" onClick={() => updateSplit(idx, 'paymentMethod', 'credit')}
              disabled={!canCredit}
              className={`flex-1 py-1.5 text-sm font-medium rounded-md transition-all ${
                paymentMethod === 'credit' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
              } ${!canCredit ? 'opacity-30 cursor-not-allowed' : ''}`}>
              {t('itemsForm.credit')}
            </button>
            <button type="button" onClick={() => updateSplit(idx, 'paymentMethod', 'debit')}
              disabled={!canDebit}
              className={`flex-1 py-1.5 text-sm font-medium rounded-md transition-all ${
                paymentMethod === 'debit' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
              } ${!canDebit ? 'opacity-30 cursor-not-allowed' : ''}`}>
              {t('itemsForm.debit')}
            </button>
          </div>
        </div>
      )
    }

    const renderCardWidget = (sp: FormSplit, idx: number) => (
      <div key={idx} className="rounded-lg border border-border p-3 space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-foreground">{t('itemsForm.card')} {idx + 1}</span>
          <button type="button" onClick={() => removeCard(idx)} className="p-0.5 rounded hover:bg-destructive/10 transition-colors">
            <X size={12} className="text-destructive" />
          </button>
        </div>
        <Select value={sp.cardId} onChange={e => updateSplit(idx, 'cardId', e.target.value)} options={cards.map(c => ({ value: c.id, label: c.name }))} placeholder={t('itemsForm.selectCard')} />
        {sp.cardId && renderSplitPaymentMethodSelector(sp, idx)}
        <CurrencyInput label={t('itemsForm.valueRequired')} value={sp.value} onChange={v => updateSplit(idx, 'value', v)} symbol={currencySymbol} />
        <Input label={t('itemsForm.installments')} type="number" min={1} value={String(sp.totalInstallments)} onChange={e => updateSplit(idx, 'totalInstallments', parseInt(e.target.value) || 1)} />
        {sp.totalInstallments > 0 && sp.value > 0 && (
          <div className="flex items-center justify-between px-2 py-1.5 rounded bg-muted/40 text-xs">
            <span className="text-muted-foreground">{t('itemsForm.monthly')}</span>
            <span className="font-semibold text-foreground">{fmtVal(sp.value / sp.totalInstallments)}</span>
          </div>
        )}
      </div>
    )

    return (
      <div className="space-y-5">
        {/* Tipo */}
        <div className="space-y-1.5">
          <label className="text-sm font-medium text-foreground">{t('itemsForm.typeRequired')}</label>
          <div className="flex rounded-lg border border-input p-0.5 bg-muted/30">
            {typeOptions.map(opt => (
              <button key={opt.value} type="button" onClick={() => handleTypeChange(opt.value)}
                disabled={!!typeFilter && typeFilter !== opt.value}
                className={`flex-1 py-1.5 text-sm font-medium rounded-md transition-all ${
                  form.type === opt.value ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
                } ${!!typeFilter && typeFilter !== opt.value ? 'opacity-30 cursor-not-allowed' : ''}`}>
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* Seção: Informações */}
        <div className="space-y-2">
          <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{t('itemsForm.information')}</h4>
          <div className="rounded-lg border border-border bg-card p-4 space-y-3">
            <Input label={t('itemsForm.expenseName')} value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} placeholder={t('itemsForm.descriptionPlaceholder')} autoFocus />
            {currencies.length > 1 && (
              <div>
                <Select
                  label={t('itemsForm.currency')}
                  value={String(form.currencyId || baseCurrency?.id || '')}
                  onChange={e => {
                    const id = Number(e.target.value)
                    const cur = currencies.find(c => c.id === id)
                    setForm({ ...form, currencyId: id, exchangeRateSnapshot: cur?.exchangeRate ?? 1.0 })
                  }}
                  options={currencies.map(c => ({ value: String(c.id), label: `${c.code} — ${c.symbol}` }))}
                />
                {form.currencyId && !currencies.find(c => c.id === Number(form.currencyId))?.isBase && form.value > 0 && (
                  <p className="text-xs text-muted-foreground mt-1">
                    ≈ {formatCurrency(form.value * (form.exchangeRateSnapshot || 1.0))} {t('itemsForm.inBaseCurrency')}
                  </p>
                )}
              </div>
            )}
            {!isInstallment && !isEmprestimo && (
              <CurrencyInput label={t('itemsForm.valueRequired')} value={form.value} onChange={v => setForm({ ...form, value: v })} symbol={currencySymbol} />
            )}
            <DayPicker label={form.type === 'common' ? t('itemsForm.expenseDay') : t('itemsForm.billing')} day={form.billingDay} dayType={form.billingDayType}
              monthOffset={form.billingDayMonthOffset} showMonthOffsetOptions
              monthOffsetOptions={[{ value: '0', label: t('dayPicker.currentMonth') }, { value: '-1', label: t('monthNavigator.previousMonth') }]}
              onChange={(d, tp, mo) => setForm({ ...form, billingDay: d, billingDayType: tp, billingDayMonthOffset: mo ?? 0 })} />
            <DayPicker label={t('itemsForm.dueDay')} day={form.dueDay} dayType={form.dueDayType}
              monthOffset={form.dueDayMonthOffset} showMonthOffsetOptions showCardDueOption
              onChange={(d, tp, mo) => setForm({ ...form, dueDay: d, dueDayType: tp, dueDayMonthOffset: mo ?? 0 })} />
          </div>
        </div>

        {/* Seção: Parcelamento (installment) */}
        {isInstallment && (
          <div className="space-y-2">
            <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{t('itemsForm.installmentSection')}</h4>
            <div className="rounded-lg border border-border bg-card p-4 space-y-3">
              <div className="flex rounded-lg border border-input p-0.5 bg-muted/30">
                {([{ value: 'none', label: t('itemsForm.noCard') }, { value: 'single', label: t('itemsForm.oneCard') }, { value: 'multi', label: t('itemsForm.multipleCards') }] as const).map(opt => (
                  <button key={opt.value} type="button" onClick={() => setCardMode(opt.value)}
                    className={`flex-1 py-1.5 text-sm font-medium rounded-md transition-all ${
                      form.cardMode === opt.value ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
                    }`}>
                    {opt.label}
                  </button>
                ))}
              </div>

              {form.cardMode === 'single' && renderPaymentMethodSelector()}

              {form.cardMode === 'none' && form.splits.length > 0 && (
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <CurrencyInput label={t('itemsForm.totalValue')} value={form.value} onChange={v => setForm({ ...form, value: v })} symbol={currencySymbol} />
                    <Input label={t('itemsForm.installments')} type="number" min={1} value={String(form.splits[0].totalInstallments)} onChange={e => updateSplit(0, 'totalInstallments', parseInt(e.target.value) || 1)} />
                  </div>
                  {form.splits[0].totalInstallments > 0 && form.value > 0 && (
                    <div className="flex items-center justify-between px-2 py-1.5 rounded bg-muted/40 text-xs">
                      <span className="text-muted-foreground">{t('itemsForm.monthly')}</span>
                      <span className="font-semibold text-foreground">{fmtVal(form.value / form.splits[0].totalInstallments)}</span>
                    </div>
                  )}
                </div>
              )}

              {form.cardMode === 'single' && form.splits.length > 0 && (
                <div className="space-y-3">
                  <Select label={t('itemsForm.card')} value={form.splits[0].cardId} onChange={e => updateSplit(0, 'cardId', e.target.value)} options={cards.map(c => ({ value: c.id, label: c.name }))} placeholder={t('itemsForm.selectCard')} />
                  <div className="grid grid-cols-2 gap-3">
                    <CurrencyInput label={t('itemsForm.totalValue')} value={form.value} onChange={v => setForm({ ...form, value: v })} symbol={currencySymbol} />
                    <Input label={t('itemsForm.installments')} type="number" min={1} value={String(form.splits[0].totalInstallments)} onChange={e => updateSplit(0, 'totalInstallments', parseInt(e.target.value) || 1)} />
                  </div>
                  {form.splits[0].totalInstallments > 0 && form.value > 0 && (
                    <div className="flex items-center justify-between px-2 py-1.5 rounded bg-muted/40 text-xs">
                      <span className="text-muted-foreground">{t('itemsForm.monthly')}</span>
                      <span className="font-semibold text-foreground">{fmtVal(form.value / form.splits[0].totalInstallments)}</span>
                    </div>
                  )}
                </div>
              )}

              {form.cardMode === 'multi' && (
                <div className="space-y-3">
                  {form.splits.map((sp, idx) => renderCardWidget(sp, idx))}
                  <button type="button" onClick={addCard}
                    className="flex items-center justify-center gap-1.5 w-full py-2 text-sm text-primary hover:text-primary/80 rounded-lg border border-dashed border-border hover:border-primary/40 transition-colors">
                    <Plus size={14} /> {t('itemsForm.addCard')}
                  </button>
                  {form.splits.length >= 2 && (
                    <div className="flex items-center justify-between px-3 py-2 rounded-lg bg-muted/40">
                      <span className="text-sm text-muted-foreground">{t('itemsForm.total')}</span>
                      <span className="text-sm font-bold">{fmtVal(form.splits.reduce((s, sp) => s + sp.value, 0))}</span>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Seção: Empréstimo */}
        {isEmprestimo && (() => {
          const sp = form.splits[0] || { totalInstallments: 1 }
          const monthly = sp.totalInstallments > 0 && form.value > 0 ? form.value / sp.totalInstallments : 0
          return (
            <div className="space-y-2">
              <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{t('itemsForm.loanSection')}</h4>
              <div className="rounded-lg border border-border bg-card p-4 space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <CurrencyInput label={t('itemsForm.baseValue')} value={form.baseValue} onChange={v => setForm({ ...form, baseValue: v })} symbol={currencySymbol} />
                  <CurrencyInput label={t('itemsForm.valueWithInterest')} value={form.value} onChange={v => setForm({ ...form, value: v })} symbol={currencySymbol} />
                  <Input label={t('itemsForm.installmentsRequired')} type="number" min={1} value={String(sp.totalInstallments)} onChange={e => updateSplit(0, 'totalInstallments', parseInt(e.target.value) || 1)} />
                  <Input label={t('itemsForm.interestRate')} type="number" step="0.01" min={0} value={form.interestRate} onChange={e => setForm({ ...form, interestRate: e.target.value })} placeholder={t('itemsForm.interestPlaceholder')} />
                </div>
                {monthly > 0 && (
                  <div className="flex items-center justify-between px-2 py-1.5 rounded bg-muted/40 text-xs">
                    <span className="text-muted-foreground">{t('itemsForm.monthly')}</span>
                    <span className="font-semibold text-foreground">{fmtVal(monthly)}</span>
                  </div>
                )}
                {bankAccounts.length > 0 && (
                  <Select label={t('itemsForm.bankAccount')} value={String(form.bankAccountId)} onChange={e => setForm({ ...form, bankAccountId: e.target.value })} options={bankAccounts.map(a => ({ value: a.id, label: a.name }))} placeholder={t('itemsForm.nonePlaceholder')} />
                )}
              </div>
            </div>
          )
        })()}

        {/* Seção: Cartão (common/subscription only) */}
        {!isInstallment && !isEmprestimo && cards.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{t('itemsForm.cardSection')}</h4>
            <div className="rounded-lg border border-border bg-card p-4 space-y-3">
              <Select value={String(form.cardId)} onChange={e => {
                const newCardId = e.target.value
                const card = cards.find(c => String(c.id) === newCardId)
                const ct = card?.cardType || 'both'
                const pm = ct === 'credit' ? 'credit' : ct === 'debit' ? 'debit' : ''
                setForm(f => ({ ...f, cardId: newCardId, paymentMethod: newCardId ? pm : '' }))
              }} options={cards.map(c => ({ value: c.id, label: c.name }))} placeholder={t('itemsForm.noneCardPlaceholder')} />
              {form.cardId && (form.type === 'common' || form.type === 'subscription') && (() => {
                const selectedCard = cards.find(c => String(c.id) === String(form.cardId))
                const ct = selectedCard?.cardType || 'both'
                return (
                  <div className="flex rounded-lg border border-input p-0.5 bg-muted/30">
                    <button type="button" onClick={() => setForm(f => ({ ...f, paymentMethod: 'credit' }))}
                      disabled={ct === 'debit'}
                      className={`flex-1 py-1.5 text-sm font-medium rounded-md transition-all ${
                        form.paymentMethod === 'credit' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
                      } ${ct === 'debit' ? 'opacity-30 cursor-not-allowed' : ''}`}>
                      {t('itemsForm.credit')}
                    </button>
                    <button type="button" onClick={() => setForm(f => ({ ...f, paymentMethod: 'debit' }))}
                      disabled={ct === 'credit'}
                      className={`flex-1 py-1.5 text-sm font-medium rounded-md transition-all ${
                        form.paymentMethod === 'debit' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
                      } ${ct === 'credit' ? 'opacity-30 cursor-not-allowed' : ''}`}>
                      {t('itemsForm.debit')}
                    </button>
                  </div>
                )
              })()}
            </div>
          </div>
        )}

        {/* Seção: Período */}
        <div className="space-y-2">
          <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{t('itemsForm.period')}</h4>
          <div className="rounded-lg border border-border bg-card p-4 space-y-4">
            <div className="grid grid-cols-2 gap-3">
              {form.type === 'common' && (
                <DatePicker className="w-full justify-start" mode="month" label={t('itemsForm.expenseOccurredMonth')} value={form.startMonth} onChange={v => setForm({ ...form, startMonth: v })} />
              )}
              {(isInstallment || isEmprestimo) && (
                <>
                  <DatePicker className="w-full justify-start" mode="month" label={t('itemsForm.firstInstallment')} value={form.startMonth} onChange={v => setForm({ ...form, startMonth: v })} />
                  <Input label={t('itemsForm.lastInstallment')} value={getLastInstallmentMonth() ? fmtMonth(getLastInstallmentMonth()) : ''} readOnly disabled />
                </>
              )}
              {form.type === 'subscription' && (
                <>
                  <DatePicker className="w-full justify-start" mode="month" label={t('itemsForm.startMonth')} value={form.startMonth} onChange={v => setForm({ ...form, startMonth: v })} />
                  <DatePicker className="w-full justify-start" mode="month" label={t('itemsForm.endMonth')} value={form.endMonth} onChange={v => setForm({ ...form, endMonth: v })} placeholder={t('common.notDefined')} clearable clearLabel={t('common.clear')} />
                </>
              )}
            </div>
            <div className="grid grid-cols-2 gap-3 items-end">
              <div className="space-y-1.5 min-w-0">
                <label className="text-sm font-medium text-foreground">{t('itemsForm.status')}</label>
                <div className="flex h-9 rounded-lg border border-input p-0.5 bg-muted/30">
                  <button type="button" onClick={() => setForm({ ...form, isPaid: false, paidAt: '' })}
                    className={`flex-1 text-sm font-medium rounded-md transition-all ${
                      !form.isPaid ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
                    }`}>
                    {t('itemsForm.unpaid')}
                  </button>
                  <button type="button" onClick={() => setForm({ ...form, isPaid: true, paidAt: form.paidAt || new Date().toISOString().substring(0, 10) })}
                    className={`flex-1 text-sm font-medium rounded-md transition-all ${
                      form.isPaid ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
                    }`}>
                    {t('itemsForm.paid')}
                  </button>
                </div>
              </div>
              {form.isPaid && (
                <DatePicker className="w-full justify-start" mode="date" label={t('itemsForm.paymentDate')} value={form.paidAt}
                  onChange={v => setForm({ ...form, paidAt: v })} />
              )}
              {!form.isPaid && (
                <Input label={t('itemsForm.paymentDate')} value={t('itemsForm.notPaidYet')} disabled />
              )}
            </div>
          </div>
        </div>

        {/* Seção: Interrupções (subscription editing) */}
      </div>
    )
  }

  /* ─── Tab: Parcelas (only for editing installment/emprestimo) ─── */
  const renderTabInterrupcoes = () => {
    if (!editing) return null
    const canInterrupt = editing.type === 'installment' || editing.type === 'emprestimo' || editing.type === 'subscription'
    const hasPermanent = editing.interruptions?.some(i => !i.resumeMonth)

    return (
      <div className="space-y-4">
        {!canInterrupt && (
          <div className="rounded-lg border border-border bg-card p-4 text-sm text-muted-foreground">
            {t('itemsForm.interruptionsUnavailable')}
          </div>
        )}

        {canInterrupt && (
          <>
            <div className="rounded-lg border border-border bg-card p-4 space-y-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-foreground">{t('itemsForm.interruptionStatus')}</p>
                  <p className="text-xs text-muted-foreground">
                    {hasPermanent || editing.endReason ? t('itemsForm.interruptionBlocked') : t('itemsForm.interruptionAvailable')}
                  </p>
                </div>
                {!editing.endReason && !hasPermanent && (
                  <Button size="sm" variant="outline" onClick={() => { onClose(); setTimeout(() => setInterruptItem(editing), 50) }}>
                    <X size={14} /> {t('itemsForm.interrupt')}
                  </Button>
                )}
              </div>
            </div>

            <div className="space-y-2">
              <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{t('itemsForm.interruptionHistory')}</h4>
              <div className="rounded-lg border border-border bg-card p-3 space-y-2">
                {editing.interruptions && editing.interruptions.length > 0 ? (
                  editing.interruptions.map(int => (
                    <div key={int.id} className="flex items-center justify-between gap-3 rounded-md border border-border/60 bg-muted/20 px-3 py-2 text-sm">
                      <span>
                        {int.resumeMonth
                          ? t('itemsForm.pausedAt', { startMonth: fmtMonth(addMonths(int.endMonth, 1)), resumeMonth: fmtMonth(int.resumeMonth) })
                          : t('itemsForm.interruptedPermanently', { endMonth: fmtMonth(addMonths(int.endMonth, 1)) })}
                      </span>
                      <Button size="sm" variant="ghost" onClick={() => { handleReactivate(int.id); onClose() }}>
                        <Undo2 size={12} /> {t('common.undo')}
                      </Button>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-muted-foreground">{t('itemsForm.noInterruptions')}</p>
                )}
              </div>
            </div>
          </>
        )}
      </div>
    )
  }

  const renderTabParcelas = () => {
    if (!editing) return null

    function addMonthsFn(m: string, n: number): string {
      const [y, mo] = m.split('-').map(Number)
      const total = (y * 12 + mo - 1) + n
      const ny = Math.floor(total / 12)
      const nm = (total % 12) + 1
      return `${ny}-${String(nm).padStart(2, '0')}`
    }

    const hasSplits = form.type === 'installment' && editing.cardSplits && editing.cardSplits.length > 0

    // Render progress + anticipation for a single unit (item-level or per-split)
    const renderParcelBlock = (opts: {
      label: string
      totalInst: number
      currentInst: number
      totalAnticipated: number
      monthlyValue: number
      splitId?: number
    }) => {
      const effectiveTotal = opts.totalInst - opts.totalAnticipated
      const remaining = Math.max(effectiveTotal - opts.currentInst, 0)
      const maxAnticipate = remaining > 1 ? remaining - 1 : 0
      const effectiveEnd = addMonthsFn(editing.startMonth, effectiveTotal)
      const key = String(opts.splitId ?? 'item')
      const countStr = anticipateCounts[key] || ''
      const countNum = parseInt(countStr) || 0
      const done = opts.currentInst >= effectiveTotal
      const previewing = countNum > 0

      // Preview values
      const previewCurrent = opts.currentInst + countNum
      const previewEnd = previewing ? addMonthsFn(editing.startMonth, effectiveTotal - countNum) : effectiveEnd
      const previewMonthly = previewing && opts.monthlyValue > 0 ? opts.monthlyValue * (countNum + 1) : 0

      const paidPct = effectiveTotal > 0 ? Math.min((opts.currentInst / effectiveTotal) * 100, 100) : 0
      const previewPct = effectiveTotal > 0 && countNum > 0 ? Math.min((countNum / effectiveTotal) * 100, 100 - paidPct) : 0

      return (
        <div className="rounded-lg border border-border bg-card p-4 space-y-3">
          {/* Header: label + counter + preview extra */}
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold">{opts.label}</span>
            <span className="text-xs text-muted-foreground">
              {previewing ? (
                <><span className="text-yellow-500 font-semibold">{previewCurrent}</span>/{effectiveTotal}</>
              ) : (
                <>{opts.currentInst}/{effectiveTotal}</>
              )}
              {opts.totalAnticipated > 0 && <span className="text-primary"> (+{opts.totalAnticipated})</span>}
              {previewing && <span className="text-yellow-500"> (+{countNum})</span>}
            </span>
          </div>

          {/* Progress bar + anticipation controls */}
          <div className="flex items-center gap-2">
            <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
              <div className="h-full flex">
                <div
                  className={`h-full transition-all ${done ? 'bg-green-500' : 'bg-primary'}`}
                  style={{ width: `${paidPct}%` }}
                />
                {previewPct > 0 && (
                  <div className="h-full bg-yellow-500 transition-all" style={{ width: `${previewPct}%` }} />
                )}
              </div>
            </div>
            {!editing.endReason && !(editing.interruptions?.some(i => !i.resumeMonth)) && maxAnticipate > 0 && (
              <div className="flex items-center gap-1 shrink-0">
                <button type="button"
                  onClick={() => {
                    const newCount = Math.max(countNum - 1, 0)
                    setAnticipateCounts(c => ({ ...c, [key]: String(newCount) }))
                    if (newCount === 0) setDiscountStates(s => { const n = { ...s }; delete n[key]; return n })
                  }}
                  disabled={countNum <= 0}
                  className="h-6 w-6 flex items-center justify-center rounded border border-input text-xs font-bold text-muted-foreground hover:bg-accent disabled:opacity-30 transition-colors">
                  −
                </button>
                <span className="text-xs font-semibold tabular-nums w-5 text-center">{countNum}</span>
                <button type="button"
                  onClick={() => setAnticipateCounts(c => ({ ...c, [key]: String(Math.min(countNum + 1, maxAnticipate)) }))}
                  disabled={countNum >= maxAnticipate}
                  className="h-6 w-6 flex items-center justify-center rounded border border-input text-xs font-bold text-muted-foreground hover:bg-accent disabled:opacity-30 transition-colors">
                  +
                </button>
              </div>
            )}
          </div>

          {/* Discount section for anticipation */}
          {countNum > 0 && (() => {
            const fullTotal = countNum * opts.monthlyValue
            const ds = discountStates[key] || { mode: 'total' as const, total: fullTotal }
            const discountTotal = ds.total
            const economia = fullTotal - discountTotal
            const hasDiscount = Math.abs(economia) > 0.005

            const updateDiscount = (newDs: { mode: 'total' | 'perParcel' | 'percent'; total: number }) => {
              setDiscountStates(s => ({ ...s, [key]: newDs }))
            }

            return (
              <div className="rounded-md border border-border/60 bg-muted/20 p-3 space-y-2">
                <span className="text-xs font-semibold text-muted-foreground">{t('itemsForm.anticipationDiscount')}</span>
                <div className="flex rounded-md border border-input p-0.5 bg-muted/30">
                  {(['total', 'perParcel', 'percent'] as const).map(m => (
                    <button key={m} type="button"
                      onClick={() => updateDiscount({ ...ds, mode: m })}
                      className={`flex-1 py-1 text-xs font-medium rounded transition-all ${
                        ds.mode === m ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
                      }`}>
                      {m === 'total' ? t('itemsForm.discountTotal') : m === 'perParcel' ? t('itemsForm.discountPerInstallment') : t('itemsForm.discountPercent')}
                    </button>
                  ))}
                </div>
                {ds.mode === 'total' && (
                  <CurrencyInput label={t('itemsForm.totalOfInstallments', { count: String(countNum) })} value={discountTotal}
                    onChange={v => updateDiscount({ ...ds, total: v })} symbol={currencySymbol} />
                )}
                {ds.mode === 'perParcel' && (
                  <CurrencyInput label={t('itemsForm.valuePerInstallment')} value={countNum > 0 ? discountTotal / countNum : 0}
                    onChange={v => updateDiscount({ ...ds, total: v * countNum })} symbol={currencySymbol} />
                )}
                {ds.mode === 'percent' && (
                  <Input label={t('itemsForm.percentDiscount')} type="number" step="0.01" min={0} max={100}
                    value={fullTotal > 0 ? String(Math.round((1 - discountTotal / fullTotal) * 10000) / 100) : '0'}
                    onChange={e => {
                      const pct = parseFloat(e.target.value) || 0
                      updateDiscount({ ...ds, total: Math.round(fullTotal * (1 - pct / 100) * 100) / 100 })
                    }} />
                )}
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>{t('itemsForm.originalValue')}: {fmtVal(fullTotal)}</span>
                  {hasDiscount && <span className="font-semibold text-green-500">{t('itemsForm.savingsLabel')}: {fmtVal(economia)}</span>}
                </div>
                <button type="button"
                  onClick={() => {
                    const dt = hasDiscount ? discountTotal : undefined
                    handleAnticipate(opts.splitId, dt)
                  }}
                  disabled={countNum <= 0 || countNum > maxAnticipate}
                  className="w-full h-7 flex items-center justify-center rounded border border-input text-xs font-medium text-muted-foreground hover:bg-accent disabled:opacity-30 transition-colors gap-1">
                  <FastForward size={10} /> {t('itemsForm.anticipateCount', { count: String(countNum) })}
                </button>
              </div>
            )
          })()}

          {/* Info row: end date + monthly value */}
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>
              {t('itemsForm.end')}:{' '}
              {previewing ? (
                <><span className="text-yellow-500 font-semibold">{fmtMonth(previewEnd)}</span> <span className="line-through opacity-50">{fmtMonth(effectiveEnd)}</span></>
              ) : (
                fmtMonth(effectiveEnd)
              )}
            </span>
            {opts.monthlyValue > 0 && (
              previewing ? (
                <span className="font-semibold text-yellow-500">{fmtVal(previewMonthly)}{t('itemsForm.perMonth')}</span>
              ) : (
                <span className="font-semibold text-foreground">{fmtVal(opts.monthlyValue)}{t('itemsForm.perMonth')}</span>
              )
            )}
          </div>
        </div>
      )
    }

    // Use form values (from Detalhes tab) when available, fallback to saved editing values
    const formSplits = form.splits
    const formValue = form.value

    return (
      <div className="space-y-5">
        {/* Per-split blocks */}
        {hasSplits ? (
          editing.cardSplits!.map(sp => {
            const fs = formSplits.find(s => String(s.cardId) === String(sp.cardId))
            const totalInst = fs ? fs.totalInstallments : sp.totalInstallments
            const value = fs ? fs.value : sp.value
            return renderParcelBlock({
              label: sp.cardName || `${t('itemsForm.card')} #${sp.cardId}`,
              totalInst,
              currentInst: sp.currentInstallment || (editing.currentInstallment || 0),
              totalAnticipated: sp.totalAnticipated || 0,
              monthlyValue: totalInst > 0 ? value / totalInst : 0,
              splitId: sp.id
            })
          })
        ) : (
          (() => {
            const totalInst = formSplits.length > 0 ? formSplits[0].totalInstallments : (editing.totalInstallments || 0)
            const value = formValue || editing.value
            return renderParcelBlock({
              label: t('itemsForm.progress'),
              totalInst,
              currentInst: editing.currentInstallment || 0,
              totalAnticipated: editing.totalAnticipated || 0,
              monthlyValue: totalInst > 0 ? value / totalInst : 0
            })
          })()
        )}

        {/* Interrupções */}
        {/* Historico de antecipacoes */}
        {editing.anticipations && editing.anticipations.length > 0 && (
          <div className="rounded-lg border border-border bg-card p-4 space-y-3">
            <span className="text-sm font-semibold">{t('itemsForm.anticipationHistory')}</span>
            <div className="space-y-2">
              {editing.anticipations.map(a => {
                const splitName = a.splitId && hasSplits
                  ? editing.cardSplits!.find(sp => sp.id === a.splitId)?.cardName || `${t('itemsForm.card')} #${a.splitId}`
                  : null
                const splitData = a.splitId && hasSplits ? editing.cardSplits!.find(sp => sp.id === a.splitId) : null
                const monthly = splitData
                  ? splitData.value / splitData.totalInstallments
                  : (editing.totalInstallments ? editing.value / editing.totalInstallments : 0)
                const fullTotal = a.count * monthly
                const economia = a.discountedTotal != null ? fullTotal - a.discountedTotal : 0
                return (
                  <div key={a.id} className="flex items-center justify-between text-sm">
                    <span>
                      {t('itemsForm.installmentsAnticipated', { count: String(a.count), verb: a.count === 1 ? t('itemsForm.wasAnticipated') : t('itemsForm.wereAnticipated'), month: fmtMonth(a.month) })}
                      {splitName && <span className="text-muted-foreground text-xs ml-1">{t('itemsForm.forCard', { name: splitName })}</span>}
                      {a.discountedTotal != null && (
                        <span className="text-xs text-green-500 ml-1">({fmtVal(a.discountedTotal)} — {t('itemsForm.savings', { value: fmtVal(economia) })})</span>
                      )}
                    </span>
                    <Button size="sm" variant="outline" onClick={() => handleUndoAnticipation(a.id)}>
                      <Undo2 size={12} /> {t('common.undo')}
                    </Button>
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </div>
    )
  }

  /* ─── Tab: Classificação ─── */
  const renderTabValores = () => {
    if (!editing || form.type !== 'subscription') {
      return (
        <div className="rounded-lg border border-border bg-card p-4 text-sm text-muted-foreground">
          {t('valueOverrides.onlyRecurringExpenses')}
        </div>
      )
    }

    return (
      <div className="space-y-4">
        <div className="rounded-lg border border-border bg-card p-4 space-y-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-foreground">{t('valueOverrides.currentMonthValue', { month: fmtMonth(month) })}</p>
              <p className="text-xs text-muted-foreground">{t('valueOverrides.inheritsNearest')}</p>
            </div>
            <span className="text-sm font-bold tabular-nums">{fmtVal(editing.effectiveValue ?? form.value)}</span>
          </div>
          <Button size="sm" variant="outline" onClick={() => openValueOverrideModal()}>
            <Plus size={14} /> {t('valueOverrides.modifyExpenseSpecificMonth')}
          </Button>
        </div>

        <div className="space-y-2">
          <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{t('valueOverrides.configuredChanges')}</h4>
          <div className="rounded-lg border border-border bg-card p-3 space-y-2">
            {valueOverrides.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t('valueOverrides.noChanges')}</p>
            ) : (
              valueOverrides.map(entry => (
                <div key={entry.month} className="flex items-center justify-between gap-3 rounded-md bg-muted/30 px-3 py-2">
                  <button type="button" onClick={() => openValueOverrideModal(entry)} className="text-left">
                    <p className="text-sm font-medium text-foreground">{fmtMonth(entry.month)}</p>
                    <p className="text-xs text-muted-foreground">{fmtVal(entry.value)}</p>
                  </button>
                  <Button size="sm" variant="ghost" onClick={() => handleRemoveValueOverride(entry.month)}>
                    <X size={14} />
                  </Button>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    )
  }

  const renderTabClassificacao = () => (
    <div className="space-y-5">
      {/* Seção: Categoria */}
      <div className="space-y-2">
        <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{t('itemsForm.tabClassification')}</h4>
        <div className="rounded-lg border border-border bg-card p-4 space-y-4">
          <div className="grid grid-cols-[minmax(0,1fr)_2.25rem] items-end gap-1.5">
            <div>
              <Select
                label={t('itemsForm.category')}
                value={String(form.categoryId)}
                onChange={e => setForm({ ...form, categoryId: e.target.value, subcategoryId: '' })}
                options={expenseCategories.map(c => ({ value: c.id, label: c.name }))}
                placeholder={t('itemsForm.noCategoryPlaceholder')}
              />
            </div>
            <button type="button" onClick={() => { setCatCreateName(''); setCatCreateColor(INLINE_COLORS[0]); setShowCatCreate(true) }}
              className="h-9 w-9 flex items-center justify-center rounded-md border border-input hover:bg-accent transition-colors shrink-0" title={t('itemsForm.createCategory')}>
              <Plus size={14} />
            </button>
          </div>
          <div className="grid grid-cols-[minmax(0,1fr)_2.25rem] items-end gap-1.5">
            <div>
              <Select
                label={t('itemsForm.subcategory')}
                value={String(form.subcategoryId)}
                onChange={e => setForm({ ...form, subcategoryId: e.target.value })}
                options={availableSubcategories.map(s => ({ value: s.id, label: s.name }))}
                placeholder={form.categoryId ? t('itemsForm.noSubcategoryPlaceholder') : t('itemsForm.selectCategoryFirst')}
                disabled={!form.categoryId}
              />
            </div>
            <button type="button" onClick={() => { setSubcatCreateName(''); setSubcatCreateColor(INLINE_COLORS[0]); setShowSubcatCreate(true) }}
              disabled={!form.categoryId}
              className="h-9 w-9 flex items-center justify-center rounded-md border border-input hover:bg-accent transition-colors shrink-0 disabled:opacity-50 disabled:cursor-not-allowed" title={t('subcategories.createSubcategory')}>
              <Plus size={14} />
            </button>
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-foreground">{t('itemsForm.storeEntity')}</label>
            <div className="flex gap-1.5">
              <div className="flex-1">
                <Select value={String(form.storeId)} onChange={e => setForm({ ...form, storeId: e.target.value })} options={stores.map(s => ({ value: s.id, label: s.name }))} placeholder={t('common.none')} />
              </div>
              <button type="button" onClick={() => { setStoreCreateName(''); setStoreCreateColor(INLINE_COLORS[0]); setShowStoreCreate(true) }}
                className="h-9 w-9 flex items-center justify-center rounded-md border border-input hover:bg-accent transition-colors shrink-0" title={t('itemsForm.createStore')}>
                <Plus size={14} />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Seção: Tags */}
      <div className="space-y-2">
        <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{t('itemsForm.tags')}</h4>
        <div className="rounded-lg border border-border bg-card p-4">
          <div className="flex flex-wrap gap-1.5">
            {allTags.map(tag => (
              <button
                key={tag.id}
                type="button"
                onClick={() => toggleTag(tag.id)}
                className={`text-xs px-2.5 py-1 rounded-full font-medium transition-all border ${
                  form.tagIds.includes(tag.id)
                    ? 'ring-1 ring-offset-1 ring-offset-card'
                    : 'opacity-50 hover:opacity-100'
                }`}
                style={{
                  backgroundColor: `${tag.color}20`,
                  color: tag.color,
                  borderColor: form.tagIds.includes(tag.id) ? tag.color : 'transparent'
                }}
              >
                {tag.name}
              </button>
            ))}
            <button
              type="button"
              onClick={() => { setTagCreateName(''); setTagCreateColor(INLINE_COLORS[0]); setShowTagCreate(true) }}
              className="text-xs px-2.5 py-1 rounded-full font-medium transition-all border border-dashed border-muted-foreground/30 text-muted-foreground hover:text-foreground hover:border-foreground/30"
            >
              {t('itemsForm.newTag')}
            </button>
          </div>
        </div>
      </div>

      {/* Seção: Observações */}
    </div>
  )

  const renderTabObservacoes = () => {
    const blocks = parseNoteBlocks(form.notes)
    const updateBlocks = (next: ReturnType<typeof parseNoteBlocks>) => {
      setForm(f => ({ ...f, notes: serializeNoteBlocks(next) }))
    }

    return (
      <div className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{t('itemsForm.notes')}</h4>
          <Button size="sm" variant="outline" onClick={() => updateBlocks([createNoteBlock(), ...blocks])}>
            <Plus size={14} /> {t('notes.addBlock')}
          </Button>
        </div>
        {blocks.length === 0 ? (
          <div className="rounded-lg border border-border bg-card p-4 text-sm text-muted-foreground">
            {t('notes.noBlocks')}
          </div>
        ) : (
          <div className="space-y-3">
            {blocks.map(block => (
              <div key={block.id} className="rounded-lg border border-border bg-card p-4 space-y-2">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-sm font-medium text-foreground">
                    {formatNoteBlockDate(block.createdAt, t('notes.previousBlock'), fmtDate)}
                  </span>
                  <button type="button" onClick={() => updateBlocks(blocks.filter(b => b.id !== block.id))}
                    className="h-7 w-7 flex items-center justify-center rounded-md text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors">
                    <X size={14} />
                  </button>
                </div>
                <textarea
                  value={block.text}
                  onChange={e => updateBlocks(blocks.map(b => b.id === block.id ? { ...b, text: e.target.value } : b))}
                  className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  rows={3}
                  placeholder={t('itemsForm.notesPlaceholder')}
                />
              </div>
            ))}
          </div>
        )}
      </div>
    )
  }

  return (
    <>
    <Modal open={open} onClose={onClose} title={editing ? t('itemsForm.editItem') : t('itemsForm.newItem')} maxWidth="max-w-xl">
      <div className="flex flex-col overflow-hidden" style={{ maxHeight: '70vh' }}>
        {/* Tab bar */}
        <div className="flex gap-4 -mx-6 px-6 pb-3 mb-4 border-b border-border shrink-0">
          {([
            { key: 'detalhes' as ModalTab, label: t('itemsForm.tabDetails') },
            ...(editing && form.type === 'subscription' ? [{ key: 'valores' as ModalTab, label: t('itemsForm.tabValues') }] : []),
            ...(showParcelasTab ? [{ key: 'parcelas' as ModalTab, label: t('itemsForm.tabInstallments') }] : []),
            ...(editing ? [{ key: 'interrupcoes' as ModalTab, label: t('itemsForm.tabInterruptions') }] : []),
            { key: 'classificacao' as ModalTab, label: t('itemsForm.tabClassification') },
            { key: 'observacoes' as ModalTab, label: t('itemsForm.tabNotes') }
          ]).map(tab => (
            <button key={tab.key} type="button" onClick={() => setModalTab(tab.key)}
              className={`text-sm font-medium pb-1 border-b-2 transition-colors ${
                modalTab === tab.key
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}>
              {tab.label}
            </button>
          ))}
        </div>

        {/* Scrollable content */}
        <div
          ref={modalScrollRef}
          onScroll={handleModalScroll}
          className="flex-1 min-h-0 overflow-y-auto -mr-6 pr-6"
        >
          {/* Top fade (sticky) */}
          <div className={`sticky top-0 -mb-6 h-6 z-10 pointer-events-none bg-gradient-to-b from-background to-transparent transition-opacity ${modalScrollFade.top ? 'opacity-100' : 'opacity-0'}`} />

          {modalTab === 'detalhes' && renderTabDetalhes()}
          {modalTab === 'valores' && renderTabValores()}
          {modalTab === 'parcelas' && showParcelasTab && renderTabParcelas()}
          {modalTab === 'interrupcoes' && renderTabInterrupcoes()}
          {modalTab === 'classificacao' && renderTabClassificacao()}
          {modalTab === 'observacoes' && renderTabObservacoes()}

          {/* Bottom fade (sticky) */}
          <div className={`sticky bottom-0 -mt-6 h-6 z-10 pointer-events-none bg-gradient-to-t from-background to-transparent transition-opacity ${modalScrollFade.bottom ? 'opacity-100' : 'opacity-0'}`} />
        </div>

        <div className="flex items-center justify-end gap-2 pt-3 shrink-0">
          <Button variant="outline" onClick={onClose}>{t('common.cancel')}</Button>
          <Button onClick={handleSave}>{editing ? t('common.save') : t('common.create')} <Check size={14} /></Button>
        </div>
      </div>
    </Modal>

    <Modal open={showValueOverrideModal} onClose={() => setShowValueOverrideModal(false)} title={t('valueOverrides.modifyExpenseSpecificMonth')} maxWidth="max-w-sm">
      <div className="space-y-4">
        <DatePicker className="w-full justify-start" mode="month" label={t('valueOverrides.month')} value={valueOverrideMonth} onChange={setValueOverrideMonth} />
        <CurrencyInput label={t('valueOverrides.value')} value={valueOverrideValue} onChange={setValueOverrideValue} autoFocus symbol={currencySymbol} />
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={() => setShowValueOverrideModal(false)}>{t('common.cancel')}</Button>
          <Button onClick={handleSaveValueOverride}>{t('common.save')}</Button>
        </div>
      </div>
    </Modal>

    {/* Store creation modal */}
    <Modal open={showStoreCreate} onClose={() => setShowStoreCreate(false)} title={t('itemsForm.newStore')} maxWidth="max-w-sm">
      <div className="space-y-4">
        <Input label={t('common.name')} value={storeCreateName} onChange={e => setStoreCreateName(e.target.value)} placeholder={t('itemsForm.storePlaceholder')} autoFocus />
        <div className="space-y-1">
          <label className="text-sm font-medium text-foreground">{t('common.color')}</label>
          <div className="flex flex-wrap gap-2">
            {INLINE_COLORS.map(c => (
              <button key={c} type="button" onClick={() => setStoreCreateColor(c)}
                className={`h-7 w-7 rounded-full transition-all ${storeCreateColor === c ? 'ring-2 ring-offset-2 ring-offset-card ring-primary scale-110' : 'hover:scale-105'}`}
                style={{ backgroundColor: c }} />
            ))}
            <button type="button" onClick={() => setShowStoreColorPicker(true)}
              className={`h-7 w-7 rounded-full border-2 border-dashed border-border hover:border-primary flex items-center justify-center transition-all hover:scale-105 ${!INLINE_COLORS.includes(storeCreateColor) ? 'ring-2 ring-offset-2 ring-offset-card ring-primary scale-110' : ''}`}
              style={!INLINE_COLORS.includes(storeCreateColor) ? { backgroundColor: storeCreateColor } : undefined} title={t('common.customColor')}>
              {INLINE_COLORS.includes(storeCreateColor) && <Palette size={12} className="text-muted-foreground" />}
            </button>
          </div>
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={() => setShowStoreCreate(false)}>{t('common.cancel')}</Button>
          <Button onClick={async () => {
            if (!storeCreateName.trim()) return
            const created = await window.api.stores.create({ name: storeCreateName.trim(), color: storeCreateColor })
            const updated = await window.api.stores.list()
            setStores(updated)
            setForm(f => ({ ...f, storeId: created.id }))
            setShowStoreCreate(false)
          }}>{t('common.create')}</Button>
        </div>
      </div>
    </Modal>
    <ColorPicker open={showStoreColorPicker} onClose={() => setShowStoreColorPicker(false)} value={storeCreateColor}
      onConfirm={c => { setStoreCreateColor(c); setShowStoreColorPicker(false) }} />

    {/* Category creation modal */}
    <Modal open={showCatCreate} onClose={() => setShowCatCreate(false)} title={t('itemsForm.newCategory')} maxWidth="max-w-sm">
      <div className="space-y-4">
        <Input label={t('common.name')} value={catCreateName} onChange={e => setCatCreateName(e.target.value)} placeholder={t('itemsForm.categoryPlaceholder')} autoFocus />
        <div className="space-y-1">
          <label className="text-sm font-medium text-foreground">{t('common.color')}</label>
          <div className="flex flex-wrap gap-2">
            {INLINE_COLORS.map(c => (
              <button key={c} type="button" onClick={() => setCatCreateColor(c)}
                className={`h-7 w-7 rounded-full transition-all ${catCreateColor === c ? 'ring-2 ring-offset-2 ring-offset-card ring-primary scale-110' : 'hover:scale-105'}`}
                style={{ backgroundColor: c }} />
            ))}
            <button type="button" onClick={() => setShowCatColorPicker(true)}
              className={`h-7 w-7 rounded-full border-2 border-dashed border-border hover:border-primary flex items-center justify-center transition-all hover:scale-105 ${!INLINE_COLORS.includes(catCreateColor) ? 'ring-2 ring-offset-2 ring-offset-card ring-primary scale-110' : ''}`}
              style={!INLINE_COLORS.includes(catCreateColor) ? { backgroundColor: catCreateColor } : undefined} title={t('common.customColor')}>
              {INLINE_COLORS.includes(catCreateColor) && <Palette size={12} className="text-muted-foreground" />}
            </button>
          </div>
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={() => setShowCatCreate(false)}>{t('common.cancel')}</Button>
          <Button onClick={async () => {
            if (!catCreateName.trim()) return
            const created = await window.api.categories.create({ name: catCreateName.trim(), icon: 'Circle', color: catCreateColor })
            const updated = await window.api.categories.list()
            setCategories(updated)
            setForm(f => ({ ...f, categoryId: created.id }))
            setShowCatCreate(false)
          }}>{t('common.create')}</Button>
        </div>
      </div>
    </Modal>
    <ColorPicker open={showCatColorPicker} onClose={() => setShowCatColorPicker(false)} value={catCreateColor}
      onConfirm={c => { setCatCreateColor(c); setShowCatColorPicker(false) }} />

    {/* Subcategory creation modal */}
    <Modal open={showSubcatCreate} onClose={() => setShowSubcatCreate(false)} title={t('subcategories.createSubcategory')} maxWidth="max-w-sm">
      <div className="space-y-4">
        <Input label={t('common.name')} value={subcatCreateName} onChange={e => setSubcatCreateName(e.target.value)} placeholder={t('subcategories.placeholder')} autoFocus />
        <div className="space-y-1">
          <label className="text-sm font-medium text-foreground">{t('common.color')}</label>
          <div className="flex flex-wrap gap-2">
            {INLINE_COLORS.map(c => (
              <button key={c} type="button" onClick={() => setSubcatCreateColor(c)}
                className={`h-7 w-7 rounded-full transition-all ${subcatCreateColor === c ? 'ring-2 ring-offset-2 ring-offset-card ring-primary scale-110' : 'hover:scale-105'}`}
                style={{ backgroundColor: c }} />
            ))}
            <button type="button" onClick={() => setShowSubcatColorPicker(true)}
              className={`h-7 w-7 rounded-full border-2 border-dashed border-border hover:border-primary flex items-center justify-center transition-all hover:scale-105 ${!INLINE_COLORS.includes(subcatCreateColor) ? 'ring-2 ring-offset-2 ring-offset-card ring-primary scale-110' : ''}`}
              style={!INLINE_COLORS.includes(subcatCreateColor) ? { backgroundColor: subcatCreateColor } : undefined} title={t('common.customColor')}>
              {INLINE_COLORS.includes(subcatCreateColor) && <Palette size={12} className="text-muted-foreground" />}
            </button>
          </div>
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={() => setShowSubcatCreate(false)}>{t('common.cancel')}</Button>
          <Button onClick={async () => {
            if (!subcatCreateName.trim() || !form.categoryId) return
            const created = await window.api.subcategories.create({ name: subcatCreateName.trim(), color: subcatCreateColor, scope: 'expense', categoryIds: [Number(form.categoryId)] })
            const updated = await window.api.subcategories.list()
            setSubcategories(updated)
            setForm(f => ({ ...f, subcategoryId: created.id }))
            setShowSubcatCreate(false)
          }}>{t('common.create')}</Button>
        </div>
      </div>
    </Modal>
    <ColorPicker open={showSubcatColorPicker} onClose={() => setShowSubcatColorPicker(false)} value={subcatCreateColor}
      onConfirm={c => { setSubcatCreateColor(c); setShowSubcatColorPicker(false) }} />

    {/* Tag creation modal */}
    <Modal open={showTagCreate} onClose={() => setShowTagCreate(false)} title={t('itemsForm.newTagModal')} maxWidth="max-w-sm">
      <div className="space-y-4">
        <Input label={t('common.name')} value={tagCreateName} onChange={e => setTagCreateName(e.target.value)} placeholder={t('itemsForm.tagPlaceholder')} autoFocus />
        <div className="space-y-1">
          <label className="text-sm font-medium text-foreground">{t('common.color')}</label>
          <div className="flex flex-wrap gap-2">
            {INLINE_COLORS.map(c => (
              <button key={c} type="button" onClick={() => setTagCreateColor(c)}
                className={`h-7 w-7 rounded-full transition-all ${tagCreateColor === c ? 'ring-2 ring-offset-2 ring-offset-card ring-primary scale-110' : 'hover:scale-105'}`}
                style={{ backgroundColor: c }} />
            ))}
            <button type="button" onClick={() => setShowTagColorPicker(true)}
              className={`h-7 w-7 rounded-full border-2 border-dashed border-border hover:border-primary flex items-center justify-center transition-all hover:scale-105 ${!INLINE_COLORS.includes(tagCreateColor) ? 'ring-2 ring-offset-2 ring-offset-card ring-primary scale-110' : ''}`}
              style={!INLINE_COLORS.includes(tagCreateColor) ? { backgroundColor: tagCreateColor } : undefined} title={t('common.customColor')}>
              {INLINE_COLORS.includes(tagCreateColor) && <Palette size={12} className="text-muted-foreground" />}
            </button>
          </div>
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={() => setShowTagCreate(false)}>{t('common.cancel')}</Button>
          <Button onClick={async () => {
            if (!tagCreateName.trim()) return
            const created = await window.api.tags.create({ name: tagCreateName.trim(), color: tagCreateColor })
            const updated = await window.api.tags.list()
            setAllTags(updated)
            setForm(f => ({ ...f, tagIds: [...f.tagIds, created.id] }))
            setShowTagCreate(false)
          }}>{t('common.create')}</Button>
        </div>
      </div>
    </Modal>
    <ColorPicker open={showTagColorPicker} onClose={() => setShowTagColorPicker(false)} value={tagCreateColor}
      onConfirm={c => { setTagCreateColor(c); setShowTagColorPicker(false) }} />
    </>
  )
}
