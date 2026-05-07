import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { Card } from '../../components/ui/Card'
import { Button } from '../../components/ui/Button'
import { Modal } from '../../components/ui/Modal'
import { Input } from '../../components/ui/Input'
import { CurrencyMonthNavigator } from '../../components/ui/CurrencyMonthNavigator'
import { SearchInput } from '../../components/ui/SearchInput'
import { SectionLayout } from '../../components/layout/SectionLayout'
import { FilterDropdown } from '../../components/ui/FilterDropdown'
import { SimpleDropdown } from '../../components/ui/SimpleDropdown'
import { useColumnsPicker } from '../../components/ui/ColumnsPickerDropdown'
import { formatCurrency } from '../../lib/currency'
import { getItemCardLabels, formatCardLabel } from '../../lib/card-utils'
import { getCurrentMonth, useFormatDate } from '../../lib/date'
import {
  getNonInterruptedExpenses,
  sumActiveMonthlyExpenses,
  sumMonthlyIncomes
} from '../../lib/monthly-finance'
import { usePageMonth } from '../../contexts/DefaultMonthContext'
import {
  Tags, Plus, Pencil, Trash2, CheckCircle, Circle,
  ToggleLeft, ToggleRight, ChevronDown, ChevronRight,
  CalendarClock, CalendarCheck, CreditCard, Store,
  CircleDot, Layers, Repeat, ChevronsUpDown, Filter,
  Wallet, DollarSign, Landmark, Palette, EyeOff
} from 'lucide-react'
import { toast } from 'sonner'
import { useActivePerson } from '../../contexts/ActivePersonContext'
import { useUndoableDelete } from '../../hooks/useUndoableDelete'
import { useColorSettings } from '../../contexts/ColorSettingsContext'
import { useColorMode } from '../../contexts/ColorModeContext'
import { useDimPaid } from '../../contexts/DimPaidContext'
import { useDisplayCurrency } from '../../contexts/DisplayCurrencyContext'
import { KebabMenu } from '../../components/ui/KebabMenu'
import { ColorPicker } from '../../components/ui/ColorPicker'
import { TileFieldsPickerButton } from '../../components/ui/TileFieldsPickerButton'
import { FilterGroup } from '../../components/ui/FilterGroup'
import { useTileFields } from '../../contexts/TileFieldsContext'
import { useTranslation } from '../../contexts/LanguageContext'
import { ItemsTile } from '../items/ItemsTile'
import { IncomeTile } from '../income/IncomeTile'

/* ─── Types ─── */
import type { TagData, SectionItem, IncomeRecord } from '../../types/entities'

interface StoreData { id: number; name: string; color: string }
interface Category { id: number; name: string; icon: string; color: string }
interface Subcategory { id: number; name: string; color: string }
interface CardData { id: number; name: string; bankAccountId: number | null }
interface BankAccountData { id: number; name: string }

type ViewMode = 'all' | 'gastos' | 'receitas'
import { type ItemSortMode, sortItems, getItemSortOptions, getSortLabelMap } from '../../hooks/useSortItems'
import { useDefaultSortMode } from '../../hooks/useDefaultSortMode'

import { PRESET_COLORS } from '../../lib/constants'
import {
  ENTITY_ITEM_TYPE_FILTERS,
  getEntityItemTypeOptions,
  matchesExpenseType,
  matchesIncomeType,
  type EntityItemTypeFilter
} from '../../lib/entity-item-type-filters'

export default function StoresPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { activePerson, bumpItems } = useActivePerson()
  const { gastosStyle, receitasStyle } = useColorSettings()
  const { colorMode, resolveEntityColor } = useColorMode()
  const { dimPaid } = useDimPaid()
  const { formatDisplayCurrency } = useDisplayCurrency()
  const { gastosFields, receitasFields } = useTileFields('stores')
  const { fmtMonth, fmtDate } = useFormatDate()

  // Month
  const { month, setMonth } = usePageMonth()

  // Data
  const [stores, setStores] = useState<StoreData[]>([])
  const [items, setItems] = useState<SectionItem[]>([])
  const [incomes, setIncomes] = useState<IncomeRecord[]>([])
  const [cards, setCards] = useState<CardData[]>([])
  const [bankAccounts, setBankAccounts] = useState<BankAccountData[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [subcategories, setSubcategories] = useState<Subcategory[]>([])

  // View mode
  const [viewMode, setViewMode] = useState<ViewMode>('all')
  const [showViewMenu, setShowViewMenu] = useState(false)
  const viewBtnRef = useRef<HTMLButtonElement>(null)
  const viewDropRef = useRef<HTMLDivElement>(null)

  // Expanded groups
  const [expandedStores, setExpandedStores] = useState<Set<number | 'none'>>(new Set())

  // Filters
  const [filterActive, setFilterActive] = useState<'all' | 'active' | 'inactive'>('all')
  const [showActiveMenu, setShowActiveMenu] = useState(false)
  const activeBtnRef = useRef<HTMLButtonElement>(null)
  const activeDropRef = useRef<HTMLDivElement>(null)
  const [filterPaid, setFilterPaid] = useState<'all' | 'paid' | 'unpaid'>('all')
  const [showPaidMenu, setShowPaidMenu] = useState(false)
  const paidBtnRef = useRef<HTMLButtonElement>(null)
  const paidDropRef = useRef<HTMLDivElement>(null)
  const [filterPayMethod, setFilterPayMethod] = useState('all')
  const [showPayMethodMenu, setShowPayMethodMenu] = useState(false)
  const payMethodBtnRef = useRef<HTMLButtonElement>(null)
  const payMethodDropRef = useRef<HTMLDivElement>(null)
  const [filterCategoryKeys, setFilterCategoryKeys] = useState<string[]>([])
  const [showCatFilter, setShowCatFilter] = useState(false)
  const catFilterRef = useRef<HTMLButtonElement>(null)
  const catDropRef = useRef<HTMLDivElement>(null)
  const [filterSubcategoryKeys, setFilterSubcategoryKeys] = useState<string[]>([])
  const [showSubcatFilter, setShowSubcatFilter] = useState(false)
  const subcatFilterRef = useRef<HTMLButtonElement>(null)
  const subcatDropRef = useRef<HTMLDivElement>(null)
  const [filterCardKeys, setFilterCardKeys] = useState<string[]>([])
  const [showCardFilter, setShowCardFilter] = useState(false)
  const cardFilterRef = useRef<HTMLButtonElement>(null)
  const cardDropRef = useRef<HTMLDivElement>(null)
  const [filterBankKeys, setFilterBankKeys] = useState<string[]>([])
  const [showBankFilter, setShowBankFilter] = useState(false)
  const bankFilterRef = useRef<HTMLButtonElement>(null)
  const bankDropRef = useRef<HTMLDivElement>(null)
  const [filterItemTypes, setFilterItemTypes] = useState<EntityItemTypeFilter[]>([...ENTITY_ITEM_TYPE_FILTERS])
  const [showItemTypeMenu, setShowItemTypeMenu] = useState(false)
  const itemTypeBtnRef = useRef<HTMLButtonElement>(null)
  const itemTypeDropRef = useRef<HTMLDivElement>(null)
  const [hideEmpty, setHideEmpty] = useState(false)
  const [search, setSearch] = useState('')
  const itemSortOptions = getItemSortOptions(t)
  const { sortMode, setSortMode, defaultSortMode, setDefaultSortMode } = useDefaultSortMode<ItemSortMode>('stores', 'az', itemSortOptions.map(option => option.key))
  const [showSortMenu, setShowSortMenu] = useState(false)
  const sortBtnRef = useRef<HTMLButtonElement>(null)
  const sortDropRef = useRef<HTMLDivElement>(null)

  // Columns
  const { columns, gridClass, pickerButton } = useColumnsPicker('item-columns')

  // CRUD state (stores)
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<StoreData | null>(null)
  const [formName, setFormName] = useState('')
  const [formColor, setFormColor] = useState(PRESET_COLORS[0])
  const [showColorPicker, setShowColorPicker] = useState(false)

  const loadData = async () => {
    const strs = await window.api.stores.list()
    setStores(strs)
    if (!activePerson) return
    const [its, incs, cds, accs, cats, subcats] = await Promise.all([
      window.api.items.list(activePerson.id, month),
      window.api.personIncome.listByMonth(activePerson.id, month),
      window.api.cards.list(activePerson.id, month),
      window.api.bankAccounts.list(activePerson.id),
      window.api.categories.list(),
      window.api.subcategories.list()
    ])
    setItems(its)
    setIncomes(incs)
    setCards(cds)
    setBankAccounts(accs)
    setCategories(cats)
    setSubcategories(subcats)
  }

  useEffect(() => { loadData() }, [activePerson, month])

  // CRUD handlers
  const openCreate = () => { setEditing(null); setFormName(''); setFormColor(PRESET_COLORS[0]); setShowForm(true) }
  const openEdit = (store: StoreData) => { setEditing(store); setFormName(store.name); setFormColor(store.color || PRESET_COLORS[0]); setShowForm(true) }

  const handleSave = async () => {
    if (!formName.trim()) { toast.error(t('common.nameIsRequired')); return }
    try {
      if (editing) {
        await window.api.stores.update({ id: editing.id, name: formName.trim(), color: formColor })
        toast.success(t('stores.storeUpdated'))
      } else {
        await window.api.stores.create({ name: formName.trim(), color: formColor })
        toast.success(t('stores.storeCreated'))
      }
      setShowForm(false)
      loadData()
    } catch (err: any) {
      toast.error(err.message || t('stores.errorSaving'))
    }
  }

  const { requestDelete: requestDeleteStore, isPending: isStoreDeletePending } = useUndoableDelete({
    onDelete: async (id) => { await window.api.stores.delete(id); loadData() },
    toastLabel: t('stores.storeDeleted')
  })

  const { requestDelete: requestDeleteItem, isPending: isItemDeletePending } = useUndoableDelete({
    onDelete: async (id) => { await window.api.items.delete(id); bumpItems(); loadData() },
    toastLabel: t('items.itemDeleted')
  })

  const { requestDelete: requestDeleteIncome, isPending: isIncomeDeletePending } = useUndoableDelete({
    onDelete: async (id) => { await window.api.personIncome.delete(id); loadData() },
    toastLabel: t('income.incomeDeleted')
  })

  const [deactivateItem, setDeactivateItem] = useState<SectionItem | null>(null)

  const toggleActive = async (itemId: number) => {
    await window.api.items.toggleActive(itemId)
    loadData()
  }

  const handleToggleActive = (item: SectionItem) => {
    if (item.type === 'common') {
      toggleActive(item.id)
    } else if (!item.isActive && item.isMonthlyDeactivated) {
      window.api.items.setMonthlyActive(item.id, month, null).then(loadData)
    } else if (!item.isActive) {
      toggleActive(item.id)
    } else {
      setDeactivateItem(item)
    }
  }

  const handleDeactivateMonth = async () => {
    if (!deactivateItem) return
    await window.api.items.setMonthlyActive(deactivateItem.id, month, false)
    setDeactivateItem(null)
    loadData()
  }

  const handleDeactivateGlobal = async () => {
    if (!deactivateItem) return
    await window.api.items.toggleActive(deactivateItem.id)
    setDeactivateItem(null)
    loadData()
  }

  const togglePaid = async (itemId: number) => {
    await window.api.items.togglePaid(itemId, month)
    loadData()
  }

  const toggleReceived = async (incomeId: number) => {
    await window.api.personIncome.toggleReceived(incomeId, month)
    loadData()
  }

  const reactivateItem = async (interruptionId: number) => {
    await window.api.items.reactivate(interruptionId)
    toast.success(t('items.interruptionUndone'))
    loadData()
  }

  const reactivateIncome = async (interruptionId: number) => {
    await window.api.personIncome.reactivate(interruptionId)
    toast.success(t('items.interruptionUndone'))
    loadData()
  }

  const toggleExpand = (key: number | 'none') => {
    setExpandedStores(prev => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  // Filter & sort items
  const filterAndSort = (arr: SectionItem[]) => {
    let result = arr.filter(item => {
      if (filterActive === 'active' && !item.isActive) return false
      if (filterActive === 'inactive' && item.isActive) return false
      if (filterPaid === 'paid' && !item.isPaid) return false
      if (filterPaid === 'unpaid' && item.isPaid) return false
      if (filterPayMethod === 'no-card' && item.cardId) return false
      if (filterPayMethod === 'card-both' && !item.cardId) return false
      if (filterPayMethod === 'credit') {
        if (item.type === 'installment' || item.type === 'emprestimo') {
          if (!item.cardId) return false
        } else {
          if (item.paymentMethod !== 'credit') return false
        }
      }
      if (filterPayMethod === 'debit' && item.paymentMethod !== 'debit') return false
      return true
    })
    return sortItems(result, sortMode, month)
  }

  // Pre-filter items by category, card, bank account, and item type
  const preFilteredItems = items.filter(item => {
    if (!matchesExpenseType(filterItemTypes, item.type)) return false
    if (filterCardKeys.length > 0) {
      const none = filterCardKeys.includes('none')
      const ids = filterCardKeys.filter(x => x !== 'none')
      const match = (none && !item.cardId) || (ids.length > 0 && item.cardId && ids.includes(String(item.cardId)))
      if (!match) return false
    }
    if (filterBankKeys.length > 0) {
      const none = filterBankKeys.includes('none')
      const ids = filterBankKeys.filter(x => x !== 'none')
      const baCardIds = ids.length > 0 ? new Set(cards.filter(c => c.bankAccountId && ids.includes(String(c.bankAccountId))).map(c => String(c.id))) : null
      const match = (none && !item.cardId) || (baCardIds && item.cardId && baCardIds.has(String(item.cardId)))
      if (!match) return false
    }
    if (filterCategoryKeys.length > 0) {
      const none = filterCategoryKeys.includes('none')
      const ids = filterCategoryKeys.filter(x => x !== 'none')
      const match = (none && !item.categoryId) || (ids.length > 0 && item.categoryId && ids.includes(String(item.categoryId)))
      if (!match) return false
    }
    if (filterSubcategoryKeys.length > 0) {
      const none = filterSubcategoryKeys.includes('none')
      const ids = filterSubcategoryKeys.filter(x => x !== 'none')
      const match = (none && !item.subcategoryId) || (ids.length > 0 && item.subcategoryId && ids.includes(String(item.subcategoryId)))
      if (!match) return false
    }
    return true
  })

  // Pre-filter incomes by recurring type and category
  const preFilteredIncomes = incomes.filter(i => {
    if (!matchesIncomeType(filterItemTypes, !!i.isRecurring)) return false
    if (filterCategoryKeys.length > 0) {
      const none = filterCategoryKeys.includes('none')
      const ids = filterCategoryKeys.filter(x => x !== 'none')
      const match = (none && !i.categoryId) || (ids.length > 0 && i.categoryId && ids.includes(String(i.categoryId)))
      if (!match) return false
    }
    if (filterSubcategoryKeys.length > 0) {
      const none = filterSubcategoryKeys.includes('none')
      const ids = filterSubcategoryKeys.filter(x => x !== 'none')
      const match = (none && !i.subcategoryId) || (ids.length > 0 && i.subcategoryId && ids.includes(String(i.subcategoryId)))
      if (!match) return false
    }
    return true
  })

  // Build groups — always include "Sem loja"
  const groups = (() => {
    const searchLower = search.trim().toLowerCase()
    const storeGroups: { key: number | 'none'; name: string; store: StoreData | null; items: SectionItem[]; incomes: IncomeRecord[] }[] = stores.map(st => {
      const storeNameMatches = searchLower && st.name.toLowerCase().includes(searchLower)
      const allItems = viewMode === 'receitas' ? [] : filterAndSort(preFilteredItems.filter(i => i.storeId === st.id))
      const allIncomes = viewMode === 'gastos' ? [] : preFilteredIncomes.filter(i => i.storeId === st.id)
      return {
        key: st.id as number | 'none',
        name: st.name,
        store: st,
        items: storeNameMatches || !searchLower ? allItems : allItems.filter(i => i.description.toLowerCase().includes(searchLower)),
        incomes: storeNameMatches || !searchLower ? allIncomes : allIncomes.filter(i => i.description.toLowerCase().includes(searchLower))
      }
    })
    const noStoreLabel = t('stores.noStore')
    const noneNameMatches = searchLower && noStoreLabel.toLowerCase().includes(searchLower)
    const noneItems = viewMode === 'receitas' ? [] : filterAndSort(preFilteredItems.filter(i => !i.storeId))
    const noneIncomes = viewMode === 'gastos' ? [] : preFilteredIncomes.filter(i => !i.storeId)
    storeGroups.push({
      key: 'none',
      name: noStoreLabel,
      store: null,
      items: noneNameMatches || !searchLower ? noneItems : noneItems.filter(i => i.description.toLowerCase().includes(searchLower)),
      incomes: noneNameMatches || !searchLower ? noneIncomes : noneIncomes.filter(i => i.description.toLowerCase().includes(searchLower))
    })
    let result = storeGroups
    if (hideEmpty || searchLower) {
      result = result.filter(g => g.items.length > 0 || g.incomes.length > 0)
    }
    return result
  })()

  // Filter dropdown items
  const catFilterItems = [
    { id: 'none', name: t('filters.noCategory'), color: '#6b7280' },
    ...categories.map(c => ({ id: String(c.id), name: c.name, color: c.color }))
  ]
  const subcatFilterItems = [
    { id: 'none', name: t('itemsForm.noSubcategoryPlaceholder'), color: '#6b7280' },
    ...subcategories.map(s => ({ id: String(s.id), name: s.name, color: s.color || '#6b7280' }))
  ]
  const cardFilterItems = [{ id: 'none', name: t('filters.noCard'), color: '#6b7280' }, ...cards.map(c => ({ id: String(c.id), name: c.name, color: '#8b5cf6' }))]
  const bankFilterItems = [{ id: 'none', name: t('filters.noAccount'), color: '#6b7280' }, ...bankAccounts.map(a => ({ id: String(a.id), name: a.name, color: '#3b82f6' }))]
  const itemTypeFilterItems = getEntityItemTypeOptions(t)

  // Tile helpers
  const computeInstallmentValue = (item: SectionItem) => {
    const hasSplits = item.cardSplits && item.cardSplits.length > 0
    const raw = hasSplits
      ? item.cardSplits!.reduce((acc, sp) => acc + Math.round((sp.value / sp.totalInstallments) * 100) / 100, 0)
      : ((item.type === 'installment' || item.type === 'emprestimo') && item.totalInstallments
        ? Math.round((item.value / item.totalInstallments) * 100) / 100
        : item.value)
    return raw * (item.exchangeRateSnapshot || 1.0)
  }

  const allFilteredItems = groups.flatMap(g => g.items)
  const allFilteredIncomes = groups.flatMap(g => g.incomes)
  const grandTotalItems = sumActiveMonthlyExpenses(allFilteredItems, month)
  const grandTotalIncomes = sumMonthlyIncomes(allFilteredIncomes, month)
  const activeMonthlyItems = getNonInterruptedExpenses(allFilteredItems, month)
  const interruptedItemsCount = allFilteredItems.length - activeMonthlyItems.length
  const paidCount = activeMonthlyItems.filter(i => i.isPaid).length
  const receivedCount = allFilteredIncomes.filter(i => i.isReceived).length
  const expenseStatLabel = [
    activeMonthlyItems.length === 1 ? t('items.itemCount', { count: activeMonthlyItems.length }) : t('items.itemCountPlural', { count: activeMonthlyItems.length }),
    t('items.unpaidCount', { count: activeMonthlyItems.length - paidCount }),
    interruptedItemsCount > 0 ? t('items.interruptedCount', { count: interruptedItemsCount }) : ''
  ].filter(Boolean).join(' - ')
  const expenseStat = {
    label: expenseStatLabel,
    value: formatDisplayCurrency(grandTotalItems),
    style: gastosStyle('stores', 'hero')
  }
  const incomeStat = {
    label: `${allFilteredIncomes.length === 1 ? t('items.incomeCount', { count: allFilteredIncomes.length }) : t('items.incomeCountPlural', { count: allFilteredIncomes.length })} · ${t('items.unreceived', { count: allFilteredIncomes.length - receivedCount })}`,
    value: formatDisplayCurrency(grandTotalIncomes),
    style: receitasStyle('stores', 'hero')
  }

  // Dynamic stats based on viewMode
  const stats = (() => {
    if (viewMode === 'gastos') {
      return [expenseStat]
    }
    if (viewMode === 'receitas') {
      return [incomeStat]
    }
    return [expenseStat, incomeStat]
  })()

  const buildMeta = (item: SectionItem) => {
    const hasSplits = item.cardSplits && item.cardSplits.length > 0
    const metaItems: { icon: any; text: string }[] = []
    const typeIcon = item.type === 'emprestimo' ? Landmark : item.type === 'installment' ? Layers : item.type === 'subscription' ? Repeat : CircleDot
    const typeText = item.type === 'emprestimo' ? t('itemTypes.emprestimo') : item.type === 'installment' ? t('itemTypes.installment') : item.type === 'subscription' ? t('itemTypes.subscription') : t('itemTypes.common')
    if (gastosFields.type) metaItems.push({ icon: typeIcon, text: typeText })
    if (gastosFields.dueDay && item.dueDay) {
      const label = item.dueDayLabel === 'cobranca' ? t('items.billingDayLabel') : t('items.dueDayLabel')
      metaItems.push({ icon: CalendarClock, text: t('items.dueDayText', { label, day: item.dueDay }) })
    }
    if (gastosFields.card) {
      const cardLabels = getItemCardLabels(item)
      if (cardLabels.length > 0) {
        for (const label of cardLabels) metaItems.push({ icon: CreditCard, text: label })
      } else {
        metaItems.push({ icon: Wallet, text: t('items.noCard') })
      }
    }
    if (gastosFields.category && item.categoryName) metaItems.push({ icon: Tags, text: `${item.categoryName}${item.subcategoryName ? `/${item.subcategoryName}` : ''}` })
    if (gastosFields.interestRate && item.interestRate && item.interestRate > 0) metaItems.push({ icon: Landmark, text: t('items.interestRate', { rate: item.interestRate }) })
    return metaItems
  }

  const buildInstallmentCards = (item: SectionItem) => {
    const hasSplits = item.cardSplits && item.cardSplits.length > 0
    const isInstallment = (item.type === 'installment' || item.type === 'emprestimo') && item.totalInstallments && item.currentInstallment
    const cards: { name: string; current: number; total: number; monthly: number }[] = []
    if (isInstallment) {
      if (hasSplits && item.type !== 'emprestimo') {
        for (const sp of item.cardSplits!) {
          const cur = Math.min(item.currentInstallment!, sp.totalInstallments)
          const spLabel = sp.cardName ? formatCardLabel(sp.cardName, sp.cardType) : t('items.cardFallback', { id: sp.cardId })
          cards.push({ name: spLabel, current: cur, total: sp.totalInstallments, monthly: sp.value / sp.totalInstallments })
        }
      } else {
        cards.push({
          name: item.type === 'emprestimo' ? t('items.installments') : (item.cardName || t('items.installments')),
          current: item.currentInstallment!,
          total: item.totalInstallments!,
          monthly: item.value / item.totalInstallments!
        })
      }
    }
    return cards
  }

  const renderMeta = (metaItems: { icon: any; text: string }[]) => (
    <div className="flex items-center gap-2.5 flex-wrap">
      {metaItems.map((m, i) => {
        const MIcon = m.icon
        return (
          <span key={i} className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
            <MIcon size={10} className="shrink-0 opacity-60" />
            {m.text}
          </span>
        )
      })}
    </div>
  )

  const paidCheckbox = (item: SectionItem, size = 18) => (
    <button onClick={() => togglePaid(item.id)} className="shrink-0" title={item.isPaid ? t('items.markUnpaid') : t('items.markPaid')}>
      {item.isPaid
        ? <CheckCircle size={size} className="text-primary" />
        : <Circle size={size} className="text-muted-foreground/40 hover:text-primary transition-colors" />}
    </button>
  )

  const kebabItems = (item: SectionItem) => [
    { label: t('common.edit'), icon: Pencil, onClick: () => navigate('/items', { state: { editItemId: item.id } }) },
    { label: item.isPaid ? t('items.markUnpaid') : t('items.markPaid'), icon: item.isPaid ? Circle : CheckCircle, onClick: () => togglePaid(item.id) },
    { label: item.isActive ? t('common.deactivate') : t('common.activate'), icon: item.isActive ? ToggleRight : ToggleLeft, onClick: () => handleToggleActive(item) },
    { label: t('common.delete'), icon: Trash2, onClick: () => requestDeleteItem(item.id), destructive: true }
  ]

  const renderTile = (item: SectionItem) => {
    const installmentValue = computeInstallmentValue(item)
    const metaItems = buildMeta(item)
    const installmentCards = buildInstallmentCards(item)
    const isInstallment = (item.type === 'installment' || item.type === 'emprestimo') && item.totalInstallments && item.currentInstallment
    const hasSplits = item.cardSplits && item.cardSplits.length > 0

    return (
      <Card
        key={item.id}
        className={`group relative overflow-hidden transition-all flex flex-col ${!item.isActive && dimPaid ? 'opacity-50 hover:opacity-100' : ''} ${item.isPaid && dimPaid ? 'opacity-50 hover:opacity-100' : item.isActive || !dimPaid ? 'hover:shadow-md' : ''}`}
      >
        {/* Inactive stripes */}
        {!item.isActive && (
          <div className="absolute inset-0 z-[1] pointer-events-none select-none" style={{ backgroundImage: 'repeating-linear-gradient(135deg, transparent, transparent 8px, hsl(var(--muted)) 8px, hsl(var(--muted)) 9px)', opacity: 0.3 }} />
        )}
        {/* Hover: undo paid button */}
        {dimPaid && item.isPaid && item.isActive && (
          <div className="absolute inset-0 z-20 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-card/50 backdrop-blur-[1px]">
            <button
              onClick={() => togglePaid(item.id)}
              className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-semibold shadow-md hover:bg-primary/90 transition-colors"
            >
              {t('items.undoPayment')}
            </button>
          </div>
        )}
        {/* Hover: edit + activate buttons (inactive items) */}
        {dimPaid && !item.isActive && (
          <div className="absolute inset-0 z-20 flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity bg-card/50 backdrop-blur-[1px]">
            <button
              onClick={() => navigate('/items', { state: { editItemId: item.id } })}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-accent text-foreground text-sm font-semibold shadow-md hover:bg-accent/80 transition-colors"
            >
              <Pencil size={14} /> {t('common.edit')}
            </button>
            <button
              onClick={() => handleToggleActive(item)}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-semibold shadow-md hover:bg-primary/90 transition-colors"
            >
              <ToggleRight size={14} /> {t('items.activateItem')}
            </button>
          </div>
        )}

        {/* Top bar */}
        <div className="flex items-center gap-2 px-4 py-2.5 border-b border-border/50 overflow-hidden">
          {paidCheckbox(item)}
          <p className="text-base font-bold truncate flex-1 min-w-0">
            {item.description}
            {item.categoryName && (
              <span className="text-[11px] font-normal text-muted-foreground ml-1.5"> - {item.categoryName}{item.subcategoryName ? `/${item.subcategoryName}` : ''}</span>
            )}
          </p>
          {item.tags && item.tags.length > 0 && (
            <div className="flex items-center gap-1 overflow-hidden">
              {item.tags.map(tag => (
                <span key={tag.id} className="text-[11px] px-2 py-0.5 rounded-full font-medium whitespace-nowrap" style={{ backgroundColor: `${tag.color}20`, color: tag.color }}>{tag.name}</span>
              ))}
            </div>
          )}
          {item.isPaid && (
            <span className="flex items-center gap-1 px-2 py-0.5 rounded-full whitespace-nowrap shrink-0" style={{ backgroundColor: 'color-mix(in srgb, #22c55e 15%, transparent)', borderWidth: '1px', borderColor: 'color-mix(in srgb, #22c55e 30%, transparent)' }}>
              <CheckCircle size={11} style={{ color: '#22c55e' }} />
              <span className="text-[10px] font-semibold" style={{ color: '#22c55e' }}>{item.paidAt ? t('items.paidAt', { date: fmtDate(item.paidAt) }) : t('items.paid')}</span>
            </span>
          )}
          {!item.isActive && (
            <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-muted-foreground/10 border border-muted-foreground/20 whitespace-nowrap shrink-0">
              <ToggleLeft size={11} className="text-muted-foreground" />
              <span className="text-[10px] font-semibold text-muted-foreground">{t('common.disabled')}</span>
            </span>
          )}
          <KebabMenu items={kebabItems(item)} size={16} />
        </div>

        {/* Body */}
        <div className="flex gap-3 flex-1 min-h-0 p-4">
          <div className="flex-1 min-w-0 flex flex-col">
            <div className="flex items-baseline gap-2 mb-1 flex-wrap">
              <span className="text-2xl font-bold tabular-nums" style={gastosStyle('stores', 'itens')}>
                {formatCurrency(installmentValue)}
              </span>
              {isInstallment && (
                <span className="text-xs text-muted-foreground">{t('items.ofTotal', { value: formatCurrency(item.value) })}</span>
              )}
            </div>
            {metaItems.length > 0 && (
              <div className="mb-1">{renderMeta(metaItems)}</div>
            )}
          </div>

          {/* Installment cards */}
          {gastosFields.installments && isInstallment && item.isActive && installmentCards.length > 0 && (
            <div className="flex gap-1.5 shrink-0 items-start">
              {installmentCards.map((card, i) => {
                const done = card.current >= card.total
                return columns >= 3 ? (
                  <div key={i} className="rounded-md border border-border/60 px-2 py-1.5 bg-muted/20 text-center">
                    <p className="text-[10px] text-muted-foreground truncate max-w-[80px]">{card.name}</p>
                    <span className={`text-xs font-bold tabular-nums ${done ? 'text-green-500' : 'text-foreground/70'}`}>{card.current}/{card.total}</span>
                  </div>
                ) : (
                  <div key={i} className="rounded-lg border border-border/60 px-3 py-2 w-[150px] bg-muted/20">
                    <p className="text-[11px] font-semibold truncate">{card.name}</p>
                    <div className="flex items-center justify-between mt-1">
                      <span className={`text-xs font-bold tabular-nums ${done ? 'text-green-500' : 'text-foreground/70'}`}>{card.current}/{card.total}</span>
                      <span className="text-[11px] text-muted-foreground tabular-nums">{formatCurrency(card.monthly)}{t('cards.perMonth')}</span>
                    </div>
                    <div className="h-1.5 rounded-full bg-muted overflow-hidden mt-1.5">
                      <div className={`h-full rounded-full transition-all ${done ? 'bg-green-500' : 'bg-primary'}`} style={{ width: `${Math.min((card.current / card.total) * 100, 100)}%` }} />
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </Card>
    )
  }

  const formatMonthLabel = (m: string) => fmtMonth(m)

  const renderIncomeTile = (inc: IncomeRecord) => {
    const metaItems: { icon: any; text: string }[] = []
    if (receitasFields.type) metaItems.push({ icon: inc.isRecurring ? Repeat : CircleDot, text: inc.isRecurring ? t('income.recurring') : t('income.nonRecurring') })

    return (
      <Card
        key={`income-${inc.id}`}
        className={`group relative overflow-hidden transition-all flex flex-col ${inc.isReceived && dimPaid ? 'opacity-50 hover:opacity-100' : 'hover:shadow-md'}`}
      >
        {dimPaid && inc.isReceived && (
          <div className="absolute inset-0 z-[1] flex items-center justify-center pointer-events-none select-none group-hover:opacity-0 transition-opacity">
            <span className="text-4xl font-black text-primary/15 uppercase tracking-[0.3em] -rotate-12">{t('items.received')}</span>
          </div>
        )}
        {dimPaid && inc.isReceived && (
          <div className="absolute inset-0 z-20 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-card/50 backdrop-blur-[1px]">
            <button
              onClick={() => toggleReceived(inc.id)}
              className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-semibold shadow-md hover:bg-primary/90 transition-colors"
            >
              {t('items.undoReceipt')}
            </button>
          </div>
        )}

        <div className="flex items-center gap-2.5 px-4 py-2.5 border-b border-border/50">
          <button onClick={() => toggleReceived(inc.id)} className="shrink-0" title={inc.isReceived ? t('items.markNotReceived') : t('items.markReceived')}>
            {inc.isReceived
              ? <CheckCircle size={18} className="text-primary" />
              : <Circle size={18} className="text-muted-foreground/40 hover:text-primary transition-colors" />}
          </button>
          <Wallet size={14} className="text-primary/60 shrink-0" />
          <p className="text-base font-bold truncate flex-1 min-w-0">
            {inc.description}
            {inc.categoryName && (
              <span className="text-[11px] font-normal text-muted-foreground ml-1.5"> - {inc.categoryName}{inc.subcategoryName ? `/${inc.subcategoryName}` : ''}</span>
            )}
          </p>
          {inc.tags && inc.tags.length > 0 && (
            <div className="flex items-center gap-1 overflow-hidden">
              {inc.tags.map(tag => (
                <span key={tag.id} className="text-[11px] px-2 py-0.5 rounded-full font-medium whitespace-nowrap" style={{ backgroundColor: `${tag.color}20`, color: tag.color }}>{tag.name}</span>
              ))}
            </div>
          )}
        </div>

        <div className="flex-1 p-4">
          <div className="flex items-baseline gap-2 mb-1">
            <span className="text-2xl font-bold tabular-nums" style={receitasStyle('stores', 'itens')}>
              {formatCurrency(inc.effectiveValue)}
            </span>
          </div>
          <div className="flex items-center gap-2.5 flex-wrap">
            {metaItems.map((m, i) => {
              const MIcon = m.icon
              return (
                <span key={i} className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
                  <MIcon size={10} className="shrink-0 opacity-60" />
                  {m.text}
                </span>
              )
            })}
          </div>
        </div>
      </Card>
    )
  }

  const renderExpandableItemTile = (item: SectionItem) => (
    <ItemsTile
      key={`item-${item.id}`}
      item={item}
      month={month}
      columns={columns}
      fieldsPage="stores"
      styleScope="stores"
      gastosStyle={gastosStyle}
      onEdit={nextItem => navigate('/items', { state: { editItemId: nextItem.id } })}
      onToggleActive={handleToggleActive}
      onTogglePaid={togglePaid}
      onDelete={id => requestDeleteItem(id)}
      onEditValue={nextItem => navigate('/items', { state: { editItemId: nextItem.id, initialTab: 'valores' } })}
      onReactivate={reactivateItem}
      onInterrupt={nextItem => navigate('/items', { state: { editItemId: nextItem.id, initialTab: 'interrupcoes' } })}
      onViewInterruptions={nextItem => navigate('/items', { state: { editItemId: nextItem.id, initialTab: 'interrupcoes' } })}
    />
  )

  const renderExpandableIncomeTile = (inc: IncomeRecord) => (
    <IncomeTile
      key={`income-${inc.id}`}
      income={inc}
      month={month}
      fieldsPage="stores"
      styleScope="stores"
      receitasStyle={receitasStyle}
      onEdit={nextIncome => navigate('/income', { state: { editIncomeId: nextIncome.id } })}
      onToggleReceived={toggleReceived}
      onDelete={id => requestDeleteIncome(id)}
      onEditValue={nextIncome => navigate('/income', { state: { editIncomeId: nextIncome.id, initialTab: 'valores' } })}
      onInterrupt={nextIncome => navigate('/income', { state: { editIncomeId: nextIncome.id, initialTab: 'interrupcoes' } })}
      onReactivate={reactivateIncome}
    />
  )

  // Group heading counts
  const groupCountLabel = (group: typeof groups[number]) => {
    const ic = group.items.length
    const rc = group.incomes.length
    if (viewMode === 'gastos') return ic === 1 ? t('items.itemCount', { count: ic }) : t('items.itemCountPlural', { count: ic })
    if (viewMode === 'receitas') return rc === 1 ? t('items.incomeCount', { count: rc }) : t('items.incomeCountPlural', { count: rc })
    const parts: string[] = []
    if (ic > 0) parts.push(ic === 1 ? t('items.itemCount', { count: ic }) : t('items.itemCountPlural', { count: ic }))
    if (rc > 0) parts.push(rc === 1 ? t('items.incomeCount', { count: rc }) : t('items.incomeCountPlural', { count: rc }))
    return parts.join(' · ') || t('items.itemCountPlural', { count: 0 })
  }

  const groupTotal = (group: typeof groups[number]) => {
            const itemTotal = sumActiveMonthlyExpenses(group.items, month)
            const incomeTotal = sumMonthlyIncomes(group.incomes, month)
    if (viewMode === 'gastos') return itemTotal
    if (viewMode === 'receitas') return incomeTotal
    return itemTotal + incomeTotal
  }

  if (!activePerson) {
    return (
      <SectionLayout icon={Store} title={t('stores.title')}>
        <Card className="p-8 text-center">
          <p className="text-muted-foreground">{t('items.selectProfileToSee')}</p>
        </Card>
      </SectionLayout>
    )
  }

  return (
    <SectionLayout
      icon={Store}
      title={t('stores.title')}
      monthNav={<CurrencyMonthNavigator month={month} onChange={setMonth} />}
      actionButton={<Button size="sm" onClick={openCreate}><Plus size={16} /> {t('stores.newStore')}</Button>}
      controls={
        <>
          <SearchInput value={search} onChange={setSearch} />

          <button type="button" title={t('categories.hideEmpty')} onClick={() => setHideEmpty(v => !v)}
            className={`inline-flex items-center gap-1.5 h-7 px-2.5 text-xs font-medium rounded-md border transition-colors ${hideEmpty ? 'bg-primary text-primary-foreground border-primary' : 'bg-transparent text-foreground border-input hover:bg-accent'}`}>
            <EyeOff size={11} />
            <span data-filter-label>{t('categories.hideEmpty')}</span>
          </button>

          <FilterGroup
            activeCount={
              (viewMode !== 'all' ? 1 : 0) + (filterItemTypes.length < ENTITY_ITEM_TYPE_FILTERS.length ? 1 : 0) +
              (filterCategoryKeys.length > 0 ? 1 : 0) + (filterSubcategoryKeys.length > 0 ? 1 : 0) + (filterBankKeys.length > 0 ? 1 : 0) +
              (filterCardKeys.length > 0 ? 1 : 0) +
              (filterActive !== 'all' ? 1 : 0) + (filterPaid !== 'all' ? 1 : 0) +
              (filterPayMethod !== 'all' ? 1 : 0)
            }
            onClear={() => { setViewMode('all'); setFilterActive('all'); setFilterPaid('all'); setFilterPayMethod('all'); setFilterItemTypes([...ENTITY_ITEM_TYPE_FILTERS]); setFilterCategoryKeys([]); setFilterSubcategoryKeys([]); setFilterCardKeys([]); setFilterBankKeys([]); setHideEmpty(false) }}
            primaryCount={3}
          >
            <div className="relative">
              <button ref={viewBtnRef} type="button"
                onClick={() => setShowViewMenu(f => !f)}
                className="inline-flex items-center gap-1.5 h-7 px-2.5 text-xs font-medium rounded-md border border-input hover:bg-accent transition-colors">
                <span data-filter-label>{t('tileFields.type')}</span>
                <ChevronDown size={12} className="text-muted-foreground" />
              </button>
              {showViewMenu && (
                <SimpleDropdown
                  anchorRef={viewBtnRef}
                  dropRef={viewDropRef}
                  options={[
                    { key: 'all', label: t('filters.expensesAndIncome') },
                    { key: 'gastos', label: t('filters.expenses') },
                    { key: 'receitas', label: t('filters.income') }
                  ]}
                  current={viewMode}
                  onChange={v => { setViewMode(v as ViewMode); setShowViewMenu(false) }}
                  onClose={() => setShowViewMenu(false)}
                />
              )}
            </div>

            <div className="relative">
              <button ref={itemTypeBtnRef} type="button" title={t('filters.itemType')}
                onClick={() => setShowItemTypeMenu(f => !f)}
                className={`inline-flex items-center gap-1.5 h-7 px-2.5 text-xs font-medium rounded-md border transition-colors ${
                  filterItemTypes.length < ENTITY_ITEM_TYPE_FILTERS.length
                    ? 'bg-primary text-primary-foreground border-primary'
                    : 'bg-transparent text-foreground border-input hover:bg-accent'
                }`}>
                <Layers size={11} />
                <span data-filter-label>{t('filters.itemType')}</span>
                {filterItemTypes.length < ENTITY_ITEM_TYPE_FILTERS.length && (
                  <span className="bg-primary-foreground text-primary text-[10px] rounded-full h-4 min-w-[16px] flex items-center justify-center font-bold">{filterItemTypes.length}</span>
                )}
                <ChevronDown size={12} className="text-muted-foreground" />
              </button>
              {showItemTypeMenu && (
                <FilterDropdown
                  anchorRef={itemTypeBtnRef}
                  dropRef={itemTypeDropRef}
                  onClose={() => setShowItemTypeMenu(false)}
                  items={itemTypeFilterItems}
                  selected={filterItemTypes}
                  onToggle={id => setFilterItemTypes(current => current.includes(id) ? (current.length === 1 ? current : current.filter(type => type !== id)) : [...current, id])}
                  searchable={false}
                />
              )}
            </div>

            <div className="relative">
              <button ref={catFilterRef} type="button" title={t('filters.category')}
                onClick={() => { setShowCatFilter(f => !f); setShowCardFilter(false); setShowBankFilter(false) }}
                className={`inline-flex items-center gap-1.5 h-7 px-2.5 text-xs font-medium rounded-md border transition-colors ${
                  filterCategoryKeys.length > 0
                    ? 'bg-primary text-primary-foreground border-primary'
                    : 'bg-transparent text-foreground border-input hover:bg-accent'
                }`}>
                <Tags size={11} />
                <span data-filter-label>{t('filters.category')}</span>
                {filterCategoryKeys.length > 0 && (
                  <span className="bg-primary-foreground text-primary text-[10px] rounded-full h-4 min-w-[16px] flex items-center justify-center font-bold">{filterCategoryKeys.length}</span>
                )}
                <ChevronDown size={12} className="text-muted-foreground" />
              </button>
              {showCatFilter && (
                <FilterDropdown
                  anchorRef={catFilterRef}
                  dropRef={catDropRef}
                  onClose={() => setShowCatFilter(false)}
                  items={catFilterItems}
                  selected={filterCategoryKeys}
                  onToggle={id => setFilterCategoryKeys(f => f.includes(id) ? f.filter(x => x !== id) : [...f, id])}
                />
              )}
            </div>

            <div className="relative">
              <button ref={subcatFilterRef} type="button" title={t('itemsForm.subcategory')}
                onClick={() => { setShowSubcatFilter(f => !f); setShowCatFilter(false); setShowCardFilter(false); setShowBankFilter(false) }}
                className={`inline-flex items-center gap-1.5 h-7 px-2.5 text-xs font-medium rounded-md border transition-colors ${
                  filterSubcategoryKeys.length > 0
                    ? 'bg-primary text-primary-foreground border-primary'
                    : 'bg-transparent text-foreground border-input hover:bg-accent'
                }`}>
                <Tags size={11} />
                <span data-filter-label>{t('itemsForm.subcategory')}</span>
                {filterSubcategoryKeys.length > 0 && (
                  <span className="bg-primary-foreground text-primary text-[10px] rounded-full h-4 min-w-[16px] flex items-center justify-center font-bold">{filterSubcategoryKeys.length}</span>
                )}
                <ChevronDown size={12} className="text-muted-foreground" />
              </button>
              {showSubcatFilter && (
                <FilterDropdown
                  anchorRef={subcatFilterRef}
                  dropRef={subcatDropRef}
                  onClose={() => setShowSubcatFilter(false)}
                  items={subcatFilterItems}
                  selected={filterSubcategoryKeys}
                  onToggle={id => setFilterSubcategoryKeys(f => f.includes(id) ? f.filter(x => x !== id) : [...f, id])}
                  emptyText={t('subcategories.noSubcategories')}
                />
              )}
            </div>

            <div className="relative">
              <button ref={bankFilterRef} type="button" title={t('filters.accounts')}
                onClick={() => { setShowBankFilter(f => !f); setShowCatFilter(false); setShowCardFilter(false) }}
                className={`inline-flex items-center gap-1.5 h-7 px-2.5 text-xs font-medium rounded-md border transition-colors ${
                  filterBankKeys.length > 0
                    ? 'bg-primary text-primary-foreground border-primary'
                    : 'bg-transparent text-foreground border-input hover:bg-accent'
                }`}>
                <Wallet size={11} />
                <span data-filter-label>{t('filters.accounts')}</span>
                {filterBankKeys.length > 0 && (
                  <span className="bg-primary-foreground text-primary text-[10px] rounded-full h-4 min-w-[16px] flex items-center justify-center font-bold">{filterBankKeys.length}</span>
                )}
                <ChevronDown size={12} className="text-muted-foreground" />
              </button>
              {showBankFilter && (
                <FilterDropdown
                  anchorRef={bankFilterRef}
                  dropRef={bankDropRef}
                  onClose={() => setShowBankFilter(false)}
                  items={bankFilterItems}
                  selected={filterBankKeys}
                  onToggle={id => setFilterBankKeys(f => f.includes(id) ? f.filter(x => x !== id) : [...f, id])}
                  emptyText={t('filters.noAccountRegistered')}
                />
              )}
            </div>

            <div className="relative">
              <button ref={cardFilterRef} type="button" title={t('filters.cards')}
                onClick={() => { setShowCardFilter(f => !f); setShowCatFilter(false); setShowBankFilter(false) }}
                className={`inline-flex items-center gap-1.5 h-7 px-2.5 text-xs font-medium rounded-md border transition-colors ${
                  filterCardKeys.length > 0
                    ? 'bg-primary text-primary-foreground border-primary'
                    : 'bg-transparent text-foreground border-input hover:bg-accent'
                }`}>
                <CreditCard size={11} />
                <span data-filter-label>{t('filters.cards')}</span>
                {filterCardKeys.length > 0 && (
                  <span className="bg-primary-foreground text-primary text-[10px] rounded-full h-4 min-w-[16px] flex items-center justify-center font-bold">{filterCardKeys.length}</span>
                )}
                <ChevronDown size={12} className="text-muted-foreground" />
              </button>
              {showCardFilter && (
                <FilterDropdown
                  anchorRef={cardFilterRef}
                  dropRef={cardDropRef}
                  onClose={() => setShowCardFilter(false)}
                  items={cardFilterItems}
                  selected={filterCardKeys}
                  onToggle={id => setFilterCardKeys(f => f.includes(id) ? f.filter(x => x !== id) : [...f, id])}
                  emptyText={t('filters.noCardRegistered')}
                />
              )}
            </div>


            {viewMode !== 'receitas' && (
              <>
                <div className="relative">
                  <button ref={activeBtnRef} type="button" title={t('filters.activeOnly')}
                    onClick={() => setShowActiveMenu(f => !f)}
                    className="inline-flex items-center gap-1.5 h-7 px-2.5 text-xs font-medium rounded-md border border-input hover:bg-accent transition-colors">
                    <ToggleLeft size={11} />
                    <span data-filter-label>{filterActive === 'all' ? t('filters.activeAndInactive') : filterActive === 'active' ? t('filters.activeOnly') : t('filters.inactiveOnly')}</span>
                    <ChevronDown size={12} className="text-muted-foreground" />
                  </button>
                  {showActiveMenu && (
                    <SimpleDropdown
                      anchorRef={activeBtnRef}
                      dropRef={activeDropRef}
                      options={[
                        { key: 'all', label: t('filters.activeAndInactive') },
                        { key: 'active', label: t('filters.activeOnly') },
                        { key: 'inactive', label: t('filters.inactiveOnly') }
                      ]}
                      current={filterActive}
                      onChange={v => { setFilterActive(v as 'all' | 'active' | 'inactive'); setShowActiveMenu(false) }}
                      onClose={() => setShowActiveMenu(false)}
                    />
                  )}
                </div>

                <div className="relative">
                  <button ref={paidBtnRef} type="button" title={t('filters.paidOnly')}
                    onClick={() => setShowPaidMenu(f => !f)}
                    className="inline-flex items-center gap-1.5 h-7 px-2.5 text-xs font-medium rounded-md border border-input hover:bg-accent transition-colors">
                    <CheckCircle size={11} />
                    <span data-filter-label>{filterPaid === 'all' ? t('filters.paidAndUnpaid') : filterPaid === 'paid' ? t('filters.paidOnly') : t('filters.unpaidOnly')}</span>
                    <ChevronDown size={12} className="text-muted-foreground" />
                  </button>
                  {showPaidMenu && (
                    <SimpleDropdown
                      anchorRef={paidBtnRef}
                      dropRef={paidDropRef}
                      options={[
                        { key: 'all', label: t('filters.paidAndUnpaid') },
                        { key: 'paid', label: t('filters.paidOnly') },
                        { key: 'unpaid', label: t('filters.unpaidOnly') }
                      ]}
                      current={filterPaid}
                      onChange={v => { setFilterPaid(v as 'all' | 'paid' | 'unpaid'); setShowPaidMenu(false) }}
                      onClose={() => setShowPaidMenu(false)}
                    />
                  )}
                </div>

                <div className="relative">
                  <button ref={payMethodBtnRef} type="button" title={t('filters.paymentMethod')}
                    onClick={() => setShowPayMethodMenu(f => !f)}
                    className="inline-flex items-center gap-1.5 h-7 px-2.5 text-xs font-medium rounded-md border border-input hover:bg-accent transition-colors">
                    <Wallet size={11} />
                    <span data-filter-label>{{ 'all': t('filters.allPaymentMethods'), 'no-card': t('filters.noCardOnly'), 'card-both': t('filters.creditAndDebit'), 'credit': t('filters.creditCardOnly'), 'debit': t('filters.debitCardOnly') }[filterPayMethod]}</span>
                    <ChevronDown size={12} className="text-muted-foreground" />
                  </button>
                  {showPayMethodMenu && (
                    <SimpleDropdown
                      anchorRef={payMethodBtnRef}
                      dropRef={payMethodDropRef}
                      options={[
                        { key: 'all', label: t('filters.allPaymentMethods') },
                        { key: 'no-card', label: t('filters.noCardOnly') },
                        { key: 'card-both', label: t('filters.creditAndDebit') },
                        { key: 'credit', label: t('filters.creditCardOnly') },
                        { key: 'debit', label: t('filters.debitCardOnly') }
                      ]}
                      current={filterPayMethod}
                      onChange={v => { setFilterPayMethod(v); setShowPayMethodMenu(false) }}
                      onClose={() => setShowPayMethodMenu(false)}
                    />
                  )}
                </div>
              </>
            )}
          </FilterGroup>



          <div className="h-6 w-px bg-border shrink-0 ml-auto" />

          <button
            type="button"
            onClick={() => {
              const allKeys = groups.map(g => g.key)
              const allExpanded = allKeys.every(k => expandedStores.has(k))
              setExpandedStores(allExpanded ? new Set() : new Set(allKeys))
            }}
            className="inline-flex items-center gap-1.5 h-7 px-2.5 text-xs font-medium rounded-md hover:bg-accent transition-colors"
            title={expandedStores.size === groups.length ? t('settings.collapseAll') : t('settings.expandAll')}
          >
            <ChevronsUpDown size={14} />
          </button>

          {pickerButton}
          <TileFieldsPickerButton page="stores" />

          <div className="relative">
            <button ref={sortBtnRef} type="button" onClick={() => setShowSortMenu(f => !f)}
              className="inline-flex items-center gap-1.5 h-7 px-2.5 text-xs font-medium rounded-md border border-input hover:bg-accent transition-colors">
              {getSortLabelMap(t)[sortMode]}
              <ChevronDown size={12} className="text-muted-foreground" />
            </button>
            {showSortMenu && (
              <SimpleDropdown anchorRef={sortBtnRef} dropRef={sortDropRef}
                options={itemSortOptions}
                current={sortMode} onChange={v => { setSortMode(v as ItemSortMode); setShowSortMenu(false) }} onClose={() => setShowSortMenu(false)}
                defaultKey={defaultSortMode} onDefaultChange={v => setDefaultSortMode(v as ItemSortMode)} defaultTitle={t('sort.setAsDefault')} />
            )}
          </div>
        </>
      }
      stats={stats}
    >
      {/* ─── Groups ─── */}
      {groups.length === 0 ? (
        <Card className="p-8 text-center">
          <Store size={48} className="mx-auto text-muted-foreground/30 mb-3" />
          <p className="text-muted-foreground">{t('stores.noStores')}</p>
          <Button size="sm" className="mt-4" onClick={openCreate}><Plus size={16} /> {t('stores.newStore')}</Button>
        </Card>
      ) : (
        <div className="space-y-4">
          {groups.filter(g => !g.store || !isStoreDeletePending(g.store.id)).map(group => {
            const isExpanded = expandedStores.has(group.key)
            const total = groupTotal(group)
            const hasContent = group.items.length > 0 || group.incomes.length > 0
            const storeIdx = stores.findIndex(s => s.id === group.key)
            const groupColor = group.key === 'none' ? '#6b7280' : resolveEntityColor(group.store?.color || PRESET_COLORS[0], storeIdx >= 0 ? storeIdx : 0)
            return (
              <div key={group.key}>
                {/* Group heading */}
                <Card className="p-0 overflow-hidden">
                  <button
                    onClick={() => toggleExpand(group.key)}
                    className="flex items-center gap-3 w-full text-left px-4 py-3 hover:bg-accent/50 transition-colors"
                  >
                    <ChevronRight size={16} className={`text-muted-foreground transition-transform ${isExpanded ? 'rotate-90' : ''}`} />
                    <div className="flex h-8 w-8 items-center justify-center rounded-full shrink-0" style={{ backgroundColor: `${groupColor}20` }}>
                      <Store size={14} style={{ color: groupColor }} />
                    </div>
                    <span className="text-sm font-semibold flex-1">{group.name}</span>
                    <span className="text-xs text-muted-foreground">{groupCountLabel(group)}</span>
                    <span className="text-sm font-bold tabular-nums" style={gastosStyle('stores', 'itens')}>{formatCurrency(total)}</span>
                    {group.store && (
                      <KebabMenu size={16} items={[
                        { label: t('common.edit'), icon: Pencil, onClick: () => openEdit(group.store!) },
                        { label: t('common.delete'), icon: Trash2, onClick: () => requestDeleteStore(group.store!.id), destructive: true }
                      ]} />
                    )}
                  </button>
                </Card>

                {/* Group content */}
                {isExpanded && hasContent && (
                  <div className={`grid ${gridClass} gap-3 mt-2`}>
                    {group.items.filter(item => !isItemDeletePending(item.id)).map(item => renderExpandableItemTile(item))}
                    {group.incomes.filter(inc => !isIncomeDeletePending(inc.id)).map(inc => renderExpandableIncomeTile(inc))}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* ─── CRUD Modals ─── */}
      <Modal
        open={showForm}
        onClose={() => setShowForm(false)}
        title={editing ? t('stores.editStore') : t('stores.newStore')}
        maxWidth="max-w-sm"
      >
        <div className="space-y-4">
          <Input
            label={t('common.name')}
            value={formName}
            onChange={(e) => setFormName(e.target.value)}
            placeholder={t('stores.placeholder')}
            autoFocus
          />

          {colorMode === 'custom' && (
            <div className="space-y-1">
              <label className="text-sm font-medium text-foreground">{t('common.color')}</label>
              <div className="flex flex-wrap gap-2">
                {PRESET_COLORS.map((c) => (
                  <button
                    key={c}
                    onClick={() => setFormColor(c)}
                    className={`h-8 w-8 rounded-full transition-all ${
                      formColor === c ? 'ring-2 ring-offset-2 ring-offset-card ring-primary scale-110' : 'hover:scale-105'
                    }`}
                    style={{ backgroundColor: c }}
                  />
                ))}
                <button
                  onClick={() => setShowColorPicker(true)}
                  className={`h-8 w-8 rounded-full border-2 border-dashed border-border hover:border-primary flex items-center justify-center transition-all hover:scale-105 ${
                    !PRESET_COLORS.includes(formColor) ? 'ring-2 ring-offset-2 ring-offset-card ring-primary scale-110' : ''
                  }`}
                  style={!PRESET_COLORS.includes(formColor) ? { backgroundColor: formColor } : undefined}
                  title={t('common.customColor')}
                >
                  {PRESET_COLORS.includes(formColor) && <Palette size={14} className="text-muted-foreground" />}
                </button>
              </div>
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setShowForm(false)}>{t('common.cancel')}</Button>
            <Button onClick={handleSave}>{editing ? t('common.save') : t('common.create')}</Button>
          </div>
        </div>
      </Modal>
      <ColorPicker
        open={showColorPicker}
        onClose={() => setShowColorPicker(false)}
        value={formColor}
        onConfirm={c => { setFormColor(c); setShowColorPicker(false) }}
      />


      <Modal open={deactivateItem !== null} onClose={() => setDeactivateItem(null)} title={t('items.deactivateItem')} maxWidth="max-w-sm">
        <p className="text-sm text-muted-foreground mb-4">
          {t('items.howToDeactivate', { name: deactivateItem?.description || '' })}
        </p>
        <div className="flex flex-col gap-2">
          <Button variant="outline" onClick={handleDeactivateMonth}>
            {t('items.deactivateThisMonthOnly', { month: fmtMonth(month) })}
          </Button>
          <Button variant="destructive" onClick={handleDeactivateGlobal}>
            {t('items.deactivateAllMonths')}
          </Button>
        </div>
      </Modal>
    </SectionLayout>
  )
}
