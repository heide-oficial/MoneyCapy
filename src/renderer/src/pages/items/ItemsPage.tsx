import { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { Card } from '../../components/ui/Card'
import { Button } from '../../components/ui/Button'
import { Modal } from '../../components/ui/Modal'
import { CurrencyInput } from '../../components/ui/CurrencyInput'
import { ConfirmDialog } from '../../components/ui/ConfirmDialog'
import { SearchInput } from '../../components/ui/SearchInput'
import { CurrencyMonthNavigator } from '../../components/ui/CurrencyMonthNavigator'
import { SectionLayout } from '../../components/layout/SectionLayout'
import { formatCurrency } from '../../lib/currency'
import { addMonths, monthDiff, useFormatDate } from '../../lib/date'
import { getActiveInterruption } from '../../lib/interruptions'
import { getMonthlyExpenseValue } from '../../lib/monthly-finance'
import { usePageMonth } from '../../contexts/DefaultMonthContext'
import {
  Plus, ChevronDown, Check, Filter, Receipt, Download,
  Tags, Bookmark, Wallet, CreditCard, Store, ToggleLeft, CheckCircle as CheckCircleIcon, Layers
} from 'lucide-react'
import { toast } from 'sonner'
import { useActivePerson } from '../../contexts/ActivePersonContext'
import { useColorSettings } from '../../contexts/ColorSettingsContext'
import { useDisplayCurrency } from '../../contexts/DisplayCurrencyContext'
import { useTranslation } from '../../contexts/LanguageContext'
import { FilterDropdown } from '../../components/ui/FilterDropdown'
import { SimpleDropdown } from '../../components/ui/SimpleDropdown'
import { useColumnsPicker } from '../../components/ui/ColumnsPickerDropdown'
import { TileFieldsPickerButton } from '../../components/ui/TileFieldsPickerButton'
import { FilterGroup } from '../../components/ui/FilterGroup'
import { CsvExportModal, type CsvColumn } from '../../components/ui/CsvExportModal'

import type { TagData, CardSplit, ItemInterruption, SectionItem } from '../../types/entities'
import { type ItemSortMode, sortItems, getItemSortOptions, getSortLabelMap } from '../../hooks/useSortItems'
import { useDefaultSortMode } from '../../hooks/useDefaultSortMode'
import { useUndoableDelete } from '../../hooks/useUndoableDelete'
import { ItemsForm, defaultForm, type ItemForm, type CardMode, type FormSplit, type ModalTab } from './ItemsForm'
import { ItemsTile } from './ItemsTile'

type ItemTab = 'all' | 'common' | 'installment' | 'subscription' | 'emprestimo'
type ExpenseTypeFilter = 'common' | 'installment' | 'subscription' | 'emprestimo'
const EXPENSE_TYPE_FILTERS: ExpenseTypeFilter[] = ['common', 'installment', 'subscription', 'emprestimo']

function getItemTabs(t: (key: string) => string): { key: ItemTab; label: string; typeFilter?: string }[] {
  return [
    { key: 'all', label: t('topItems.all') },
    { key: 'common', label: t('topItems.singles'), typeFilter: 'common' },
    { key: 'installment', label: t('topItems.installments'), typeFilter: 'installment' },
    { key: 'subscription', label: t('topItems.recurring'), typeFilter: 'subscription' },
    { key: 'emprestimo', label: t('topItems.loans'), typeFilter: 'emprestimo' }
  ]
}

/* ─── Tab Dropdown (portal) ─── */
function TabDropdown({ anchorRef, dropRef, current, onChange, onClose, tabs }: {
  anchorRef: React.RefObject<HTMLButtonElement | null>
  dropRef: React.RefObject<HTMLDivElement | null>
  current: string
  onChange: (v: ItemTab) => void
  onClose: () => void
  tabs: { key: ItemTab; label: string; typeFilter?: string }[]
}) {
  const [pos, setPos] = useState({ top: 0, left: 0 })

  useEffect(() => {
    if (!anchorRef.current || !dropRef.current) return
    const anchor = anchorRef.current.getBoundingClientRect()
    const drop = dropRef.current.getBoundingClientRect()
    let top = anchor.bottom + 4, left = anchor.left
    if (left + drop.width > window.innerWidth) left = window.innerWidth - drop.width - 8
    if (top + drop.height > window.innerHeight) top = anchor.top - drop.height - 4
    if (left < 8) left = 8
    if (top < 8) top = 8
    setPos({ top, left })
  }, [anchorRef])

  useEffect(() => {
    const handle = (e: MouseEvent) => {
      const target = e.target as Node
      if (anchorRef.current?.contains(target)) return
      if (dropRef.current?.contains(target)) return
      onClose()
    }
    const handleKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('mousedown', handle)
    document.addEventListener('keydown', handleKey)
    return () => { document.removeEventListener('mousedown', handle); document.removeEventListener('keydown', handleKey) }
  }, [anchorRef, dropRef, onClose])

  return (
    <div ref={dropRef} className="fixed z-[9999] rounded-md border border-border bg-card shadow-lg py-1 min-w-[160px]"
      style={{ top: pos.top, left: pos.left }}>
      {tabs.map(tab => (
        <button key={tab.key} type="button"
          onClick={() => onChange(tab.key)}
          className={`flex w-full items-center gap-2 px-3 py-1.5 text-sm transition-colors hover:bg-accent hover:text-accent-foreground ${
            current === tab.key ? 'text-primary font-medium bg-primary/5' : 'text-card-foreground'
          }`}>
          {current === tab.key && <Check size={12} />}
          <span className={current !== tab.key ? 'ml-5' : ''}>{tab.label}</span>
        </button>
      ))}
    </div>
  )
}

interface Category { id: number; name: string; icon: string; color: string; scope?: 'expense' | 'income' | 'both' }
interface Subcategory { id: number; name: string; color: string; scope?: 'expense' | 'income' | 'both'; categoryIds?: number[] }
interface StoreData2 { id: number; name: string }
interface CardData { id: number; name: string; personId: number | null; bankAccountId: number | null; billingCloseDay?: number; cardType?: 'credit' | 'debit' | 'both' }
interface BankAccountData { id: number; name: string; nomeBanco: string | null }

export default function ItemsPage() {
  const location = useLocation()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const { activePerson, bumpItems, itemsVersion } = useActivePerson()
  const { gastosStyle } = useColorSettings()
  const { formatDisplayCurrency } = useDisplayCurrency()
  const { fmtMonth, fmtDate } = useFormatDate()
  const { month, setMonth } = usePageMonth()
  const { t } = useTranslation()

  const ITEM_TABS = getItemTabs(t)
  const ITEM_SORT_OPTIONS = getItemSortOptions(t)
  const SORT_LABEL_MAP = getSortLabelMap(t)

  const [activeTab, setActiveTab] = useState<ItemTab>(() => {
    const stateTab = (location.state as any)?.tab as string | undefined
    if (stateTab && ITEM_TABS.some(t => t.key === stateTab)) return stateTab as ItemTab
    return 'all'
  })
  const typeFilter = undefined

  const [items, setItems] = useState<SectionItem[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const expenseCategories = categories
  const [subcategories, setSubcategories] = useState<Subcategory[]>([])
  const [cards, setCards] = useState<CardData[]>([])
  const [bankAccounts, setBankAccounts] = useState<BankAccountData[]>([])
  const [stores, setStores] = useState<StoreData2[]>([])
  const [allTags, setAllTags] = useState<TagData[]>([])
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<SectionItem | null>(null)
  const [interruptItem, setInterruptItem] = useState<SectionItem | null>(null)
  const [editingInterruption, setEditingInterruption] = useState<ItemInterruption | null>(null)
  const [interruptMode, setInterruptMode] = useState<'permanent' | 'temporary'>('permanent')
  const [interruptMonths, setInterruptMonths] = useState(1)
  const [form, setForm] = useState<ItemForm>({ ...defaultForm })
  const [anticipateCounts, setAnticipateCounts] = useState<Record<string, string>>({})
  const [formInitialTab, setFormInitialTab] = useState<ModalTab | undefined>(undefined)

  // Credit billing confirm dialog
  const [showCreditConfirm, setShowCreditConfirm] = useState(false)

  // Month value edit modal (subscriptions)
  const [showValueEdit, setShowValueEdit] = useState(false)
  const [valueEditTarget, setValueEditTarget] = useState<SectionItem | null>(null)
  const [monthValue, setMonthValue] = useState(0)

  // Filters & Sort
  const [filterCategories, setFilterCategories] = useState<number[]>([])
  const [filterItemTypes, setFilterItemTypes] = useState<ExpenseTypeFilter[]>(() => {
    const stateTab = (location.state as any)?.tab as ItemTab | undefined
    return stateTab && stateTab !== 'all' && EXPENSE_TYPE_FILTERS.includes(stateTab as ExpenseTypeFilter)
      ? [stateTab as ExpenseTypeFilter]
      : [...EXPENSE_TYPE_FILTERS]
  })
  const [filterSubcategories, setFilterSubcategories] = useState<number[]>([])
  const [filterTags, setFilterTags] = useState<number[]>([])
  const [filterCards, setFilterCards] = useState<number[]>(() => {
    const p = searchParams.get('cardId')
    return p ? [parseInt(p)] : []
  })
  const [filterBankAccounts, setFilterBankAccounts] = useState<number[]>(() => {
    const p = searchParams.get('bankAccountId')
    return p ? [parseInt(p)] : []
  })
  const [search, setSearch] = useState('')
  const [filterActive, setFilterActive] = useState<'all' | 'active' | 'inactive'>('all')
  const [filterPaid, setFilterPaid] = useState<'all' | 'paid' | 'unpaid'>('all')
  const [showActiveMenu, setShowActiveMenu] = useState(false)
  const activeBtnRef = useRef<HTMLButtonElement>(null)
  const activeDropRef = useRef<HTMLDivElement>(null)
  const [showCatFilter, setShowCatFilter] = useState(false)
  const [showSubcatFilter, setShowSubcatFilter] = useState(false)
  const [showTagFilter, setShowTagFilter] = useState(false)
  const [showCardFilter, setShowCardFilter] = useState(false)
  const [showBankFilter, setShowBankFilter] = useState(false)
  const [filterStores, setFilterStores] = useState<number[]>([])
  const [showStoreFilter, setShowStoreFilter] = useState(false)
  const catFilterRef = useRef<HTMLButtonElement>(null)
  const subcatFilterRef = useRef<HTMLButtonElement>(null)
  const tagFilterRef = useRef<HTMLButtonElement>(null)
  const cardFilterRef = useRef<HTMLButtonElement>(null)
  const bankFilterRef = useRef<HTMLButtonElement>(null)
  const storeFilterRef = useRef<HTMLButtonElement>(null)
  const catDropRef = useRef<HTMLDivElement>(null)
  const subcatDropRef = useRef<HTMLDivElement>(null)
  const tagDropRef = useRef<HTMLDivElement>(null)
  const cardDropRef = useRef<HTMLDivElement>(null)
  const bankDropRef = useRef<HTMLDivElement>(null)
  const storeDropRef = useRef<HTMLDivElement>(null)
  const typeFilterRef = useRef<HTMLButtonElement>(null)
  const typeFilterDropRef = useRef<HTMLDivElement>(null)
  const [showTypeFilter, setShowTypeFilter] = useState(false)
  const { sortMode, setSortMode, defaultSortMode, setDefaultSortMode } = useDefaultSortMode<ItemSortMode>('items', 'az', ITEM_SORT_OPTIONS.map(option => option.key))
  const [showSortMenu, setShowSortMenu] = useState(false)
  const sortBtnRef = useRef<HTMLButtonElement>(null)
  const sortDropRef = useRef<HTMLDivElement>(null)

  // Tab dropdown
  const [showTabMenu, setShowTabMenu] = useState(false)
  const tabBtnRef = useRef<HTMLButtonElement>(null)
  const tabDropRef = useRef<HTMLDivElement>(null)

  // Paid dropdown
  const [showPaidMenu, setShowPaidMenu] = useState(false)
  const paidBtnRef = useRef<HTMLButtonElement>(null)
  const paidDropRef = useRef<HTMLDivElement>(null)

  // Payment method filter
  const [filterPayMethod, setFilterPayMethod] = useState('all')
  const [showPayMethodMenu, setShowPayMethodMenu] = useState(false)
  const payMethodBtnRef = useRef<HTMLButtonElement>(null)
  const payMethodDropRef = useRef<HTMLDivElement>(null)

  // Columns
  const { columns, gridClass, pickerButton } = useColumnsPicker('item-columns')
  const [showCsvExport, setShowCsvExport] = useState(false)

  const loadData = async () => {
    if (!activePerson) return
    const [its, cats, subcats, tags, cds, accs, strs] = await Promise.all([
      window.api.items.list(activePerson.id, month, typeFilter),
      window.api.categories.list(),
      window.api.subcategories.list(),
      window.api.tags.list(),
      window.api.cards.list(activePerson.id, month),
      window.api.bankAccounts.list(activePerson.id),
      window.api.stores.list()
    ])
    setItems(its)
    setCategories(cats)
    setSubcategories(subcats)
    setAllTags(tags)
    setCards(cds)
    setBankAccounts(accs)
    setStores(strs)
  }

  useEffect(() => { loadData() }, [activePerson, month, typeFilter, itemsVersion])

  // Handle tab/edit from external navigation
  const pendingEditId = (location.state as any)?.editItemId as number | undefined
  const pendingInitialTab = (location.state as any)?.initialTab as string | undefined
  const itemModalTabs: ModalTab[] = ['detalhes', 'valores', 'parcelas', 'interrupcoes', 'classificacao', 'observacoes']

  useEffect(() => {
    const stateTab = (location.state as any)?.tab as string | undefined
    if (stateTab && ITEM_TABS.some(t => t.key === stateTab)) {
      setActiveTab(stateTab as ItemTab)
      if (stateTab !== 'all' && EXPENSE_TYPE_FILTERS.includes(stateTab as ExpenseTypeFilter)) setFilterItemTypes([stateTab as ExpenseTypeFilter])
    }
  }, [location.state])

  // Apply category/subcategory/tag filters from navigation state
  useEffect(() => {
    const state = location.state as any
    if (!state) return
    const catName = state.categoryName as string | undefined
    const subcatName = state.subcategoryName as string | undefined
    const tagN = state.tagName as string | undefined
    if (catName && categories.length > 0) {
      if (catName === '__no_category__') {
        setFilterCategories([-1])
      } else {
        const cat = categories.find(c => c.name === catName)
        if (cat) setFilterCategories([cat.id])
      }
      window.history.replaceState({}, '')
    }
    if (subcatName && subcategories.length > 0) {
      if (subcatName === '__no_subcategory__') {
        setFilterSubcategories([-1])
      } else {
        const subcat = subcategories.find(s => s.name === subcatName)
        if (subcat) setFilterSubcategories([subcat.id])
      }
      window.history.replaceState({}, '')
    }
    if (tagN && allTags.length > 0) {
      if (tagN === '__no_tag__') {
        setFilterTags([-1])
      } else {
        const tag = allTags.find(t => t.name === tagN)
        if (tag) setFilterTags([tag.id])
      }
      window.history.replaceState({}, '')
    }
  }, [location.state, categories, subcategories, allTags])

  const { requestDelete, isPending: isDeletePending } = useUndoableDelete({
    onDelete: async (id) => { await window.api.items.delete(id); bumpItems(); loadData() },
    toastLabel: t('items.itemDeleted')
  })

  if (!activePerson) {
    return (
      <SectionLayout icon={Receipt} title={t('items.title')}>
        <Card className="p-8 text-center">
          <p className="text-muted-foreground">{t('items.selectProfileToSee')}</p>
        </Card>
      </SectionLayout>
    )
  }

  const filteredAndSortedItems = (() => {
    let result = items.filter(item => {
      if (isDeletePending(item.id)) return false
      if (!filterItemTypes.includes(item.type as ExpenseTypeFilter)) return false
      if (filterActive === 'active' && !item.isActive) return false
      if (filterActive === 'inactive' && item.isActive) return false
      if (filterCategories.length > 0) {
        const none = filterCategories.includes(-1)
        const ids = filterCategories.filter(x => x !== -1)
        const match = (none && !item.categoryId) || (ids.length > 0 && item.categoryId && ids.includes(item.categoryId))
        if (!match) return false
      }
      if (filterSubcategories.length > 0) {
        const none = filterSubcategories.includes(-1)
        const ids = filterSubcategories.filter(x => x !== -1)
        const match = (none && !item.subcategoryId) || (ids.length > 0 && item.subcategoryId && ids.includes(item.subcategoryId))
        if (!match) return false
      }
      if (filterTags.length > 0) {
        const none = filterTags.includes(-1)
        const ids = filterTags.filter(x => x !== -1)
        const match = (none && (!item.tags || item.tags.length === 0)) || (ids.length > 0 && item.tags && item.tags.some(t => ids.includes(t.id)))
        if (!match) return false
      }
      if (filterStores.length > 0) {
        const none = filterStores.includes(-1)
        const ids = filterStores.filter(x => x !== -1)
        const match = (none && !item.storeId) || (ids.length > 0 && item.storeId && ids.includes(item.storeId))
        if (!match) return false
      }
      if (filterCards.length > 0) {
        const none = filterCards.includes(-1)
        const ids = filterCards.filter(x => x !== -1)
        const directMatch = ids.length > 0 && item.cardId && ids.includes(item.cardId)
        const splitMatch = ids.length > 0 && item.cardSplits && item.cardSplits.some(sp => ids.includes(sp.cardId))
        const noneMatch = none && !item.cardId && (!item.cardSplits || item.cardSplits.length === 0)
        if (!directMatch && !splitMatch && !noneMatch) return false
      }
      if (filterBankAccounts.length > 0) {
        const none = filterBankAccounts.includes(-1)
        const ids = filterBankAccounts.filter(x => x !== -1)
        const baCardIds = ids.length > 0 ? new Set(cards.filter(c => c.bankAccountId && ids.includes(c.bankAccountId)).map(c => c.id)) : null
        const directMatch = baCardIds && item.cardId && baCardIds.has(item.cardId)
        const splitMatch = baCardIds && item.cardSplits && item.cardSplits.some(sp => baCardIds.has(sp.cardId))
        const noneMatch = none && !item.cardId && (!item.cardSplits || item.cardSplits.length === 0)
        if (!directMatch && !splitMatch && !noneMatch) return false
      }
      if (filterPaid === 'paid' && !item.isPaid) return false
      if (filterPaid === 'unpaid' && item.isPaid) return false
      const splitPaymentMethods = item.cardSplits?.map(sp => sp.paymentMethod || sp.cardType).filter(Boolean) || []
      const hasAnyCard = !!item.cardId || splitPaymentMethods.length > 0
      if (filterPayMethod === 'no-card' && hasAnyCard) return false
      if (filterPayMethod === 'card-both' && !hasAnyCard) return false
      if (filterPayMethod === 'credit') {
        const matchesCredit = item.paymentMethod === 'credit' || splitPaymentMethods.includes('credit')
        if (!matchesCredit) return false
      }
      if (filterPayMethod === 'debit' && item.paymentMethod !== 'debit' && !splitPaymentMethods.includes('debit')) return false
      if (search && !item.description.toLowerCase().includes(search.toLowerCase())) return false
      return true
    })
    const sorted = sortItems(result, sortMode, month)
    return [
      ...sorted.filter(item => !getActiveInterruption(item.interruptions, month)),
      ...sorted.filter(item => getActiveInterruption(item.interruptions, month))
    ]
  })()

  const total = filteredAndSortedItems
    .filter(i => i.isActive && !getActiveInterruption(i.interruptions, month))
    .reduce((s, i) => s + getMonthlyExpenseValue(i), 0)
  const interruptedItemsCount = filteredAndSortedItems.filter(i => getActiveInterruption(i.interruptions, month)).length
  const activeMonthlyItems = filteredAndSortedItems.filter(i => !getActiveInterruption(i.interruptions, month))
  const unpaidActiveItemsCount = activeMonthlyItems.filter(i => !i.isPaid).length
  const itemsStatLabel = [
    t(activeMonthlyItems.length === 1 ? 'items.itemCount' : 'items.itemCountPlural', { count: activeMonthlyItems.length }),
    t('items.unpaidCount', { count: unpaidActiveItemsCount }),
    interruptedItemsCount > 0 ? t('items.interruptedCount', { count: interruptedItemsCount }) : ''
  ].filter(Boolean).join(' · ')
  const csvColumns: CsvColumn<SectionItem>[] = [
    { id: 'description', label: t('csvExport.columns.description'), value: i => i.description },
    { id: 'type', label: t('csvExport.columns.type'), value: i => t(`itemTypes.${i.type}`) },
    { id: 'monthValue', label: t('csvExport.columns.monthValue'), value: i => formatCurrency(getMonthlyExpenseValue(i)) },
    { id: 'totalValue', label: t('csvExport.columns.totalValue'), value: i => formatCurrency(i.value * (i.exchangeRateSnapshot || 1.0)) },
    { id: 'category', label: t('csvExport.columns.category'), value: i => i.categoryName || '' },
    { id: 'tags', label: t('csvExport.columns.tags'), value: i => i.tags?.map(tag => tag.name).join(', ') || '' },
    { id: 'store', label: t('csvExport.columns.store'), value: i => i.storeName || '' },
    { id: 'card', label: t('csvExport.columns.card'), value: i => i.cardName || i.cardSplits?.map(sp => sp.cardName).filter(Boolean).join(', ') || '' },
    { id: 'bankAccount', label: t('csvExport.columns.bankAccount'), value: i => i.bankAccountName || '' },
    { id: 'paymentMethod', label: t('csvExport.columns.paymentMethod'), value: i => i.paymentMethod || '' },
    { id: 'dueDay', label: t('csvExport.columns.dueDay'), value: i => i.dueDay ?? '' },
    { id: 'billingDay', label: t('csvExport.columns.billingDay'), value: i => i.billingDay ?? '' },
    { id: 'startMonth', label: t('csvExport.columns.startMonth'), value: i => fmtMonth(i.startMonth) },
    { id: 'endMonth', label: t('csvExport.columns.endMonth'), value: i => i.endMonth ? fmtMonth(i.endMonth) : '' },
    { id: 'status', label: t('csvExport.columns.status'), value: i => i.isPaid ? t('items.paid') : t('items.unpaid') },
    { id: 'paidAt', label: t('csvExport.columns.paidAt'), value: i => i.paidAt ? fmtDate(i.paidAt) : '' },
    { id: 'installments', label: t('csvExport.columns.installments'), value: i => i.totalInstallments || '' },
    { id: 'currentInstallment', label: t('csvExport.columns.currentInstallment'), value: i => i.currentInstallment || '' },
    { id: 'currency', label: t('csvExport.columns.currency'), value: i => i.currencyCode || '' },
    { id: 'notes', label: t('csvExport.columns.notes'), value: i => i.notes || '' }
  ]

  const showParcelasTab = form.type === 'installment' || form.type === 'emprestimo'

  const openCreate = () => {
    setEditing(null)
    setFormInitialTab(undefined)
    const type = filterItemTypes.length === 1 ? filterItemTypes[0] : 'common'
    setForm({
      ...defaultForm,
      type,
      startMonth: month,
      endMonth: '',
      paymentMethod: (type === 'installment' || type === 'emprestimo') ? 'credit' : ''
    })
    setShowForm(true)
  }

  const openEdit = (item: SectionItem, tab?: ModalTab) => {
    setFormInitialTab(tab)
    setEditing(item)
    const hasSplits = item.cardSplits && item.cardSplits.length > 0

    let splits: FormSplit[] = []
    let cardMode: CardMode = 'none'
    if (item.type === 'installment') {
      if (hasSplits) {
        cardMode = 'multi'
        splits = item.cardSplits!.map(s => ({
          cardId: String(s.cardId),
          value: s.value,
          totalInstallments: s.totalInstallments,
          paymentMethod: s.paymentMethod || item.paymentMethod || 'credit'
        }))
      } else if (item.cardId) {
        cardMode = 'single'
        splits = [{
          cardId: String(item.cardId),
          value: item.value,
          totalInstallments: item.totalInstallments || 1,
          paymentMethod: item.paymentMethod || 'credit'
        }]
      } else {
        cardMode = 'none'
        splits = [{
          cardId: '',
          value: item.value,
          totalInstallments: item.totalInstallments || 1,
          paymentMethod: item.paymentMethod || 'credit'
        }]
      }
    } else if (item.type === 'emprestimo') {
      cardMode = 'none'
      splits = [{
        cardId: '',
        value: item.value,
        totalInstallments: item.totalInstallments || 1,
        paymentMethod: item.paymentMethod || 'credit'
      }]
    }

    setForm({
      description: item.description, type: item.type, value: item.value,
      dueDay: item.dueDay?.toString() || '',
      dueDayLabel: item.dueDayLabel || '',
      dueDayType: (item.dueDayType === 'static' || !item.dueDayType) && item.dueDay == null ? '' : (item.dueDayType || ''),
      dueDayMonthOffset: item.dueDayMonthOffset || 0,
      billingDay: item.billingDay?.toString() || '',
      billingDayType: (item.billingDayType === 'static' || !item.billingDayType) && item.billingDay == null ? '' : (item.billingDayType || ''),
      billingDayMonthOffset: item.billingDayMonthOffset || 0,
      categoryId: item.categoryId || '',
      subcategoryId: item.subcategoryId || '',
      cardId: (item.type !== 'installment' && item.type !== 'emprestimo') ? (item.cardId || '') : '',
      notes: item.notes || '',
      tagIds: item.tags?.map(t => t.id) || [],
      cardMode,
      splits,
      storeId: item.storeId || '',
      baseValue: item.baseValue || 0,
      interestRate: item.interestRate ? String(item.interestRate) : '',
      bankAccountId: item.bankAccountId || '',
      startMonth: item.startMonth,
      endMonth: item.endMonth || '',
      isPaid: !!item.isPaid,
      paidAt: item.paidAt || '',
      paymentMethod: item.paymentMethod || ((item.type === 'installment' || item.type === 'emprestimo') && item.cardId ? 'credit' : ''),
      currencyId: item.currencyId || '',
      exchangeRateSnapshot: item.exchangeRateSnapshot ?? 1.0
    })
    setAnticipateCounts({})
    setShowForm(true)
  }

  // Open edit from external navigation (Categories/Tags pages)
  useEffect(() => {
    if (pendingEditId && items.length > 0) {
      const item = items.find(i => i.id === pendingEditId)
      if (item) {
        const initialTab = itemModalTabs.includes(pendingInitialTab as ModalTab)
          ? pendingInitialTab as ModalTab
          : undefined
        openEdit(item, initialTab)
        navigate(location.pathname, { replace: true, state: {} })
      }
    }
  }, [pendingEditId, pendingInitialTab, items])

  const doSave = async () => {
    let totalInstallments: number | null = null
    let cardId: number | null = null
    let totalValue = form.value
    const validSplits = form.splits.filter(s => s.cardId)

    if (form.type === 'installment') {
      if (form.cardMode === 'multi' && validSplits.length >= 2) {
        totalInstallments = Math.max(...validSplits.map(s => s.totalInstallments), 1)
        totalValue = validSplits.reduce((sum, s) => sum + s.value, 0)
      } else if (form.cardMode === 'single' && validSplits.length >= 1) {
        const sp = validSplits[0]
        totalInstallments = sp.totalInstallments
        cardId = Number(sp.cardId)
      } else {
        const sp = form.splits[0]
        totalInstallments = sp?.totalInstallments || 1
      }
    } else if (form.type === 'emprestimo') {
      const sp = form.splits[0]
      totalInstallments = sp?.totalInstallments || 1
    } else {
      cardId = form.cardId ? Number(form.cardId) : null
    }

    const payload: any = {
      personId: activePerson.id,
      description: form.description,
      type: form.type,
      value: totalValue,
      dueDay: form.dueDay ? parseInt(form.dueDay) : null,
      dueDayLabel: form.dueDay && form.dueDayLabel ? form.dueDayLabel : null,
      dueDayType: form.dueDayType || 'static',
      dueDayMonthOffset: form.dueDayMonthOffset || 0,
      billingDay: form.billingDay ? parseInt(form.billingDay) : null,
      billingDayType: form.billingDayType || 'static',
      billingDayMonthOffset: form.billingDayMonthOffset || 0,
      totalInstallments,
      startMonth: form.startMonth || month,
      endMonth: form.type === 'subscription' && form.endMonth ? form.endMonth : null,
      categoryId: form.categoryId ? Number(form.categoryId) : null,
      subcategoryId: form.subcategoryId ? Number(form.subcategoryId) : null,
      cardId,
      notes: form.notes || null,
      tagIds: form.tagIds,
      storeId: form.storeId ? Number(form.storeId) : null,
      baseValue: form.type === 'emprestimo' ? form.baseValue : null,
      interestRate: form.type === 'emprestimo' && form.interestRate ? parseFloat(form.interestRate) : null,
      bankAccountId: form.type === 'emprestimo' && form.bankAccountId ? Number(form.bankAccountId) : null,
      paymentMethod: form.type === 'installment' && form.cardMode === 'multi' ? null : (form.paymentMethod || null),
      currencyId: form.currencyId ? Number(form.currencyId) : null,
      exchangeRateSnapshot: form.exchangeRateSnapshot ?? 1.0,
      cardSplits: (form.type !== 'emprestimo' && form.cardMode === 'multi' && validSplits.length >= 2)
        ? validSplits.map(s => ({
            cardId: Number(s.cardId),
            value: s.value,
            totalInstallments: s.totalInstallments,
            paymentMethod: s.paymentMethod || 'credit'
          }))
        : []
    }

    if (editing) {
      await window.api.items.update({ id: editing.id, ...payload })
      const paidChanged = form.isPaid !== !!editing.isPaid
      const dateChanged = form.paidAt !== (editing.paidAt || '')
      if (paidChanged || dateChanged) {
        await window.api.items.setPaid(editing.id, month, form.isPaid, form.paidAt || undefined)
      }
      toast.success(t('items.itemUpdated'))
    } else {
      const created = await window.api.items.create(payload)
      if (form.isPaid && created?.id) {
        await window.api.items.setPaid(created.id, month, true, form.paidAt || undefined)
      }
      toast.success(t('items.itemAdded'))
    }
    setShowForm(false)
    bumpItems()
    loadData()
  }

  const handleSave = async () => {
    if (!form.description.trim()) { toast.error(t('common.descriptionRequired')); return }
    if (form.value <= 0 && form.type !== 'installment') { toast.error(t('common.valueRequired')); return }

    // Credit billing confirmation
    if (form.type === 'common' && form.paymentMethod === 'credit' && form.startMonth && form.startMonth !== month) {
      setShowCreditConfirm(true)
      return
    }

    await doSave()
  }

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

  const handleInterrupt = async () => {
    if (!interruptItem) return
    const pauseMonths = interruptMode === 'temporary' ? interruptMonths : undefined
    const interruptionBaseMonth = editingInterruption?.endMonth || month
    if (editingInterruption) {
      await window.api.items.updateInterruption(
        editingInterruption.id,
        interruptionBaseMonth,
        pauseMonths ? addMonths(interruptionBaseMonth, pauseMonths + 1) : null
      )
    } else {
      await window.api.items.interrupt(interruptItem.id, interruptionBaseMonth, pauseMonths)
    }
    toast.success(pauseMonths ? t('items.pausedUntil', { month: String(pauseMonths) }) : t('items.interrupted'))
    setInterruptItem(null)
    setEditingInterruption(null)
    setInterruptMode('permanent')
    setInterruptMonths(1)
    bumpItems()
    loadData()
  }

  const handleReactivate = async (interruptionId: number) => {
    await window.api.items.reactivate(interruptionId)
    toast.success(t('items.interruptionUndone'))
    setEditing(prev => prev ? {
      ...prev,
      interruptions: prev.interruptions?.filter(int => int.id !== interruptionId)
    } : prev)
    bumpItems()
    loadData()
  }

  const handleEditInterruption = (item: SectionItem, interruption: ItemInterruption) => {
    setInterruptItem(item)
    setEditingInterruption(interruption)
    if (interruption.resumeMonth) {
      setInterruptMode('temporary')
      setInterruptMonths(Math.max(1, monthDiff(interruption.endMonth, interruption.resumeMonth) - 1))
    } else {
      setInterruptMode('permanent')
      setInterruptMonths(1)
    }
  }

  const openValueEdit = (item: SectionItem) => {
    setValueEditTarget(item)
    setMonthValue(item.effectiveValue ?? item.value)
    setShowValueEdit(true)
  }

  const handleSaveMonthValue = async () => {
    if (!valueEditTarget) return
    await window.api.items.setMonthValue(valueEditTarget.id, month, monthValue)
    toast.success(t('items.valueUpdatedFromMonth'))
    setShowValueEdit(false)
    bumpItems()
    loadData()
  }

  const handleResetMonthValue = async () => {
    if (!valueEditTarget) return
    await window.api.items.removeMonthValue(valueEditTarget.id, month)
    toast.success(t('items.valueRestoredToBase'))
    setShowValueEdit(false)
    bumpItems()
    loadData()
  }

  const handleAnticipate = async (splitId?: number, discountedTotal?: number) => {
    if (!editing) return
    const key = String(splitId ?? 'item')
    const count = parseInt(anticipateCounts[key] || '0')
    if (!count || count <= 0) return
    try {
      await window.api.items.anticipate(editing.id, month, count, splitId, discountedTotal)
      toast.success(t('items.anticipatedInstallments', { count: String(count) }))
      setShowForm(false)
      setAnticipateCounts({})
      bumpItems()
      loadData()
    } catch (e: any) {
      toast.error(e.message || t('common.errorSaving'))
    }
  }

  const handleUndoAnticipation = async (anticipationId: number) => {
    try {
      await window.api.items.undoAnticipation(anticipationId)
      toast.success(t('items.anticipationUndone'))
      setShowForm(false)
      bumpItems()
      loadData()
    } catch (e: any) {
      toast.error(e.message || t('common.errorSaving'))
    }
  }

  const interruptionPreview = (() => {
    const pausedFrom = addMonths(month, 1)
    const pausedUntil = addMonths(month, interruptMonths)
    const resumeMonth = addMonths(month, interruptMonths + 1)
    return t('items.interruptionPreview', {
      count: String(interruptMonths),
      startMonth: fmtMonth(pausedFrom),
      endMonth: fmtMonth(pausedUntil),
      resumeMonth: fmtMonth(resumeMonth)
    })
  })()

  return (
    <SectionLayout
      icon={Receipt}
      title={t('items.title')}
      monthNav={<CurrencyMonthNavigator month={month} onChange={setMonth} />}
      actionButton={<Button size="sm" onClick={openCreate}><Plus size={16} /> {t('items.newItem')}</Button>}
      controls={
        <>
          <SearchInput value={search} onChange={setSearch} />
          <FilterGroup
            activeCount={
              (filterItemTypes.length < EXPENSE_TYPE_FILTERS.length ? 1 : 0) + (filterCategories.length > 0 ? 1 : 0) + (filterSubcategories.length > 0 ? 1 : 0) + (filterTags.length > 0 ? 1 : 0) +
              (filterBankAccounts.length > 0 ? 1 : 0) + (filterCards.length > 0 ? 1 : 0) +
              (filterStores.length > 0 ? 1 : 0) + (filterActive !== 'all' ? 1 : 0) +
              (filterPaid !== 'all' ? 1 : 0) + (filterPayMethod !== 'all' ? 1 : 0)
            }
            onClear={() => { setFilterItemTypes([...EXPENSE_TYPE_FILTERS]); setFilterCategories([]); setFilterSubcategories([]); setFilterTags([]); setFilterCards([]); setFilterBankAccounts([]); setFilterStores([]); setFilterActive('all'); setFilterPaid('all'); setFilterPayMethod('all'); setSearchParams({}) }}
            primaryCount={3}
          >
            <div className="relative">
              <button ref={typeFilterRef} type="button" title={t('tileFields.type')}
                onClick={() => { setShowTypeFilter(f => !f); setShowCatFilter(false); setShowSubcatFilter(false); setShowTagFilter(false); setShowCardFilter(false); setShowBankFilter(false); setShowStoreFilter(false) }}
                className={`inline-flex items-center gap-1.5 h-7 px-2.5 text-xs font-medium rounded-md border transition-colors ${
                  filterItemTypes.length < EXPENSE_TYPE_FILTERS.length
                    ? 'bg-primary text-primary-foreground border-primary'
                    : 'bg-transparent text-foreground border-input hover:bg-accent'
                }`}>
                <Layers size={11} />
                <span data-filter-label>{t('tileFields.type')}</span>
                {filterItemTypes.length < EXPENSE_TYPE_FILTERS.length && (
                  <span className="bg-primary-foreground text-primary text-[10px] rounded-full h-4 min-w-[16px] flex items-center justify-center font-bold">{filterItemTypes.length}</span>
                )}
                <ChevronDown size={12} className="text-muted-foreground" />
              </button>
              {showTypeFilter && (
                <FilterDropdown
                  anchorRef={typeFilterRef}
                  dropRef={typeFilterDropRef}
                  onClose={() => setShowTypeFilter(false)}
                  items={[
                    { id: 'common', name: t('filters.singles'), color: '#6b7280' },
                    { id: 'installment', name: t('filters.installments'), color: '#8b5cf6' },
                    { id: 'subscription', name: t('filters.recurring'), color: '#22c55e' },
                    { id: 'emprestimo', name: t('filters.loans'), color: '#f97316' }
                  ]}
                  selected={filterItemTypes}
                  onToggle={id => setFilterItemTypes(current => current.includes(id) ? (current.length === 1 ? current : current.filter(type => type !== id)) : [...current, id])}
                  searchable={false}
                />
              )}
            </div>

            <div className="relative">
              <button ref={catFilterRef} type="button" title={t('filters.category')}
                onClick={() => { setShowCatFilter(f => !f); setShowSubcatFilter(false); setShowTagFilter(false); setShowCardFilter(false); setShowBankFilter(false) }}
                className={`inline-flex items-center gap-1.5 h-7 px-2.5 text-xs font-medium rounded-md border transition-colors ${
                  filterCategories.length > 0
                    ? 'bg-primary text-primary-foreground border-primary'
                    : 'bg-transparent text-foreground border-input hover:bg-accent'
                }`}>
                <Tags size={11} />
                <span data-filter-label>{t('filters.category')}</span>
                {filterCategories.length > 0 && (
                  <span className="bg-primary-foreground text-primary text-[10px] rounded-full h-4 min-w-[16px] flex items-center justify-center font-bold">{filterCategories.length}</span>
                )}
                <ChevronDown size={12} className="text-muted-foreground" />
              </button>
              {showCatFilter && (
                <FilterDropdown
                  anchorRef={catFilterRef}
                  dropRef={catDropRef}
                  onClose={() => setShowCatFilter(false)}
                  items={[{ id: -1, name: t('filters.noCategory'), color: '#6b7280' }, ...expenseCategories.map(c => ({ id: c.id, name: c.name, color: c.color }))]}
                  selected={filterCategories}
                  onToggle={id => setFilterCategories(f => f.includes(id) ? f.filter(x => x !== id) : [...f, id])}
                  emptyText={t('filters.noOptions')}
                />
              )}
            </div>

            <div className="relative">
              <button ref={subcatFilterRef} type="button" title={t('itemsForm.subcategory')}
                onClick={() => { setShowSubcatFilter(f => !f); setShowCatFilter(false); setShowTagFilter(false); setShowCardFilter(false); setShowBankFilter(false) }}
                className={`inline-flex items-center gap-1.5 h-7 px-2.5 text-xs font-medium rounded-md border transition-colors ${
                  filterSubcategories.length > 0
                    ? 'bg-primary text-primary-foreground border-primary'
                    : 'bg-transparent text-foreground border-input hover:bg-accent'
                }`}>
                <Tags size={11} />
                <span data-filter-label>{t('itemsForm.subcategory')}</span>
                {filterSubcategories.length > 0 && (
                  <span className="bg-primary-foreground text-primary text-[10px] rounded-full h-4 min-w-[16px] flex items-center justify-center font-bold">{filterSubcategories.length}</span>
                )}
                <ChevronDown size={12} className="text-muted-foreground" />
              </button>
              {showSubcatFilter && (
                <FilterDropdown
                  anchorRef={subcatFilterRef}
                  dropRef={subcatDropRef}
                  onClose={() => setShowSubcatFilter(false)}
                  items={[{ id: -1, name: t('itemsForm.noSubcategoryPlaceholder'), color: '#6b7280' }, ...subcategories.filter(s => s.scope !== 'income').map(s => ({ id: s.id, name: s.name, color: s.color }))]}
                  selected={filterSubcategories}
                  onToggle={id => setFilterSubcategories(f => f.includes(id) ? f.filter(x => x !== id) : [...f, id])}
                  emptyText={t('subcategories.noSubcategories')}
                />
              )}
            </div>

            <div className="relative">
              <button ref={tagFilterRef} type="button" title={t('tags.title')}
                onClick={() => { setShowTagFilter(f => !f); setShowCatFilter(false); setShowCardFilter(false); setShowBankFilter(false) }}
                className={`inline-flex items-center gap-1.5 h-7 px-2.5 text-xs font-medium rounded-md border transition-colors ${
                  filterTags.length > 0
                    ? 'bg-primary text-primary-foreground border-primary'
                    : 'bg-transparent text-foreground border-input hover:bg-accent'
                }`}>
                <Bookmark size={11} />
                <span data-filter-label>{t('tags.title')}</span>
                {filterTags.length > 0 && (
                  <span className="bg-primary-foreground text-primary text-[10px] rounded-full h-4 min-w-[16px] flex items-center justify-center font-bold">{filterTags.length}</span>
                )}
                <ChevronDown size={12} className="text-muted-foreground" />
              </button>
              {showTagFilter && (
                <FilterDropdown
                  anchorRef={tagFilterRef}
                  dropRef={tagDropRef}
                  onClose={() => setShowTagFilter(false)}
                  items={[{ id: -1, name: t('filters.noTag'), color: '#6b7280' }, ...allTags.map(tg => ({ id: tg.id, name: tg.name, color: tg.color }))]}
                  selected={filterTags}
                  onToggle={id => setFilterTags(f => f.includes(id) ? f.filter(x => x !== id) : [...f, id])}
                  emptyText={t('filters.noOptions')}
                />
              )}
            </div>

            <div className="relative">
              <button ref={bankFilterRef} type="button" title={t('filters.accounts')}
                onClick={() => { setShowBankFilter(f => !f); setShowCatFilter(false); setShowTagFilter(false); setShowCardFilter(false) }}
                className={`inline-flex items-center gap-1.5 h-7 px-2.5 text-xs font-medium rounded-md border transition-colors ${
                  filterBankAccounts.length > 0
                    ? 'bg-primary text-primary-foreground border-primary'
                    : 'bg-transparent text-foreground border-input hover:bg-accent'
                }`}>
                <Wallet size={11} />
                <span data-filter-label>{t('filters.accounts')}</span>
                {filterBankAccounts.length > 0 && (
                  <span className="bg-primary-foreground text-primary text-[10px] rounded-full h-4 min-w-[16px] flex items-center justify-center font-bold">{filterBankAccounts.length}</span>
                )}
                <ChevronDown size={12} className="text-muted-foreground" />
              </button>
              {showBankFilter && (
                <FilterDropdown
                  anchorRef={bankFilterRef}
                  dropRef={bankDropRef}
                  onClose={() => setShowBankFilter(false)}
                  items={[{ id: -1, name: t('filters.noAccount'), color: '#6b7280' }, ...bankAccounts.map(a => ({ id: a.id, name: a.name, color: '#3b82f6' }))]}
                  selected={filterBankAccounts}
                  onToggle={id => setFilterBankAccounts(f => f.includes(id) ? f.filter(x => x !== id) : [...f, id])}
                  emptyText={t('filters.noAccountRegistered')}
                />
              )}
            </div>

            <div className="relative">
              <button ref={cardFilterRef} type="button" title={t('filters.cards')}
                onClick={() => { setShowCardFilter(f => !f); setShowCatFilter(false); setShowTagFilter(false); setShowBankFilter(false); setShowStoreFilter(false) }}
                className={`inline-flex items-center gap-1.5 h-7 px-2.5 text-xs font-medium rounded-md border transition-colors ${
                  filterCards.length > 0
                    ? 'bg-primary text-primary-foreground border-primary'
                    : 'bg-transparent text-foreground border-input hover:bg-accent'
                }`}>
                <CreditCard size={11} />
                <span data-filter-label>{t('filters.cards')}</span>
                {filterCards.length > 0 && (
                  <span className="bg-primary-foreground text-primary text-[10px] rounded-full h-4 min-w-[16px] flex items-center justify-center font-bold">{filterCards.length}</span>
                )}
                <ChevronDown size={12} className="text-muted-foreground" />
              </button>
              {showCardFilter && (
                <FilterDropdown
                  anchorRef={cardFilterRef}
                  dropRef={cardDropRef}
                  onClose={() => setShowCardFilter(false)}
                  items={[{ id: -1, name: t('filters.noCard'), color: '#6b7280' }, ...cards.map(c => ({ id: c.id, name: c.name, color: '#8b5cf6' }))]}
                  selected={filterCards}
                  onToggle={id => setFilterCards(f => f.includes(id) ? f.filter(x => x !== id) : [...f, id])}
                  emptyText={t('filters.noCardRegistered')}
                />
              )}
            </div>

            <div className="relative">
              <button ref={storeFilterRef} type="button" title={t('filters.stores')}
                onClick={() => { setShowStoreFilter(f => !f); setShowCatFilter(false); setShowTagFilter(false); setShowCardFilter(false); setShowBankFilter(false) }}
                className={`inline-flex items-center gap-1.5 h-7 px-2.5 text-xs font-medium rounded-md border transition-colors ${
                  filterStores.length > 0
                    ? 'bg-primary text-primary-foreground border-primary'
                    : 'bg-transparent text-foreground border-input hover:bg-accent'
                }`}>
                <Store size={11} />
                <span data-filter-label>{t('filters.stores')}</span>
                {filterStores.length > 0 && (
                  <span className="bg-primary-foreground text-primary text-[10px] rounded-full h-4 min-w-[16px] flex items-center justify-center font-bold">{filterStores.length}</span>
                )}
                <ChevronDown size={12} className="text-muted-foreground" />
              </button>
              {showStoreFilter && (
                <FilterDropdown
                  anchorRef={storeFilterRef}
                  dropRef={storeDropRef}
                  onClose={() => setShowStoreFilter(false)}
                  items={[{ id: -1, name: t('filters.noStore'), color: '#6b7280' }, ...stores.map(s => ({ id: s.id, name: s.name, color: '#6366f1' }))]}
                  selected={filterStores}
                  onToggle={id => setFilterStores(f => f.includes(id) ? f.filter(x => x !== id) : [...f, id])}
                  emptyText={t('filters.noStoreRegistered')}
                />
              )}
            </div>

            <div className="relative">
              <button ref={activeBtnRef} type="button" title={t('common.active')}
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
              <button ref={paidBtnRef} type="button" title={t('items.paid')}
                onClick={() => setShowPaidMenu(f => !f)}
                className="inline-flex items-center gap-1.5 h-7 px-2.5 text-xs font-medium rounded-md border border-input hover:bg-accent transition-colors">
                <CheckCircleIcon size={11} />
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
          </FilterGroup>

          <div className="h-6 w-px bg-border shrink-0 ml-auto" />

          {pickerButton}
          <TileFieldsPickerButton page="items" showReceitas={false} />
          <button
            type="button"
            onClick={() => setShowCsvExport(true)}
            className="inline-flex items-center justify-center h-7 w-7 rounded-md hover:bg-accent transition-colors"
            title={t('csvExport.exportFiltered')}
          >
            <Download size={14} className="text-muted-foreground" />
          </button>

          <div className="relative">
            <button ref={sortBtnRef} type="button" onClick={() => setShowSortMenu(f => !f)}
              className="inline-flex items-center gap-1.5 h-7 px-2.5 text-xs font-medium rounded-md border border-input hover:bg-accent transition-colors">
              {SORT_LABEL_MAP[sortMode]}
              <ChevronDown size={12} className="text-muted-foreground" />
            </button>
            {showSortMenu && (
              <SimpleDropdown anchorRef={sortBtnRef} dropRef={sortDropRef}
                options={ITEM_SORT_OPTIONS}
                current={sortMode} onChange={v => { setSortMode(v as ItemSortMode); setShowSortMenu(false) }} onClose={() => setShowSortMenu(false)}
                defaultKey={defaultSortMode} onDefaultChange={v => setDefaultSortMode(v as ItemSortMode)} defaultTitle={t('sort.setAsDefault')} />
            )}
          </div>
        </>
      }
      stats={[
        {
          label: itemsStatLabel,
          value: formatDisplayCurrency(total),
          style: gastosStyle('items', 'hero')
        }
      ]}
    >
      {/* ─── Items list ─── */}
      {items.length === 0 ? (
        <Card className="p-8 text-center">
          <Receipt size={48} className="mx-auto text-muted-foreground/30 mb-3" />
          <p className="text-muted-foreground">{t('items.noItemsThisMonth')}</p>
        </Card>
      ) : filteredAndSortedItems.length === 0 ? (
        <Card className="p-8 text-center">
          <p className="text-muted-foreground">{t('common.noResults')}</p>
        </Card>
      ) : (
        <div className={`grid ${gridClass} gap-4`}>
          {filteredAndSortedItems.map(item => (
            <ItemsTile
              key={item.id}
              item={item}
              month={month}
              columns={columns}
              gastosStyle={gastosStyle}
              onEdit={openEdit}
              onToggleActive={handleToggleActive}
              onTogglePaid={togglePaid}
              onDelete={id => requestDelete(id)}
              onEditValue={openValueEdit}
              onReactivate={handleReactivate}
              onInterrupt={item => { setInterruptItem(item); if (item.interruptions?.some(i => !i.resumeMonth)) setInterruptMode('temporary') }}
              onViewInterruptions={item => openEdit(item, 'interrupcoes')}
            />
          ))}
        </div>
      )}

      {/* ═══════════ Form Modal ═══════════ */}
      <CsvExportModal
        open={showCsvExport}
        onClose={() => setShowCsvExport(false)}
        settingsKey="items-csv-export-columns"
        filename={`moneycapy-gastos-${month}.csv`}
        rows={filteredAndSortedItems}
        columns={csvColumns}
      />

      <ItemsForm
        open={showForm}
        onClose={() => setShowForm(false)}
        editing={editing}
        month={month}
        typeFilter={filterItemTypes.length === 1 ? filterItemTypes[0] : undefined}
        form={form}
        setForm={setForm}
        categories={categories}
        setCategories={setCategories}
        subcategories={subcategories}
        setSubcategories={setSubcategories}
        cards={cards}
        bankAccounts={bankAccounts}
        stores={stores}
        setStores={setStores}
        allTags={allTags}
        setAllTags={setAllTags}
        handleSave={handleSave}
        handleAnticipate={handleAnticipate}
          handleUndoAnticipation={handleUndoAnticipation}
          handleReactivate={handleReactivate}
          handleEditInterruption={handleEditInterruption}
          setInterruptItem={setInterruptItem}
          onValuesChanged={() => { bumpItems(); loadData() }}
          onDelete={id => requestDelete(id)}
          showParcelasTab={showParcelasTab}
        initialTab={formInitialTab}
        anticipateCounts={anticipateCounts}
        setAnticipateCounts={setAnticipateCounts}
      />

      <Modal open={interruptItem !== null} onClose={() => { setInterruptItem(null); setEditingInterruption(null); setInterruptMode('permanent'); setInterruptMonths(1) }} title={t('items.interrupt')}>
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">{t('items.interrupt')}</p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setInterruptMode('permanent')}
              disabled={!!(interruptItem?.interruptions?.some(i => !i.resumeMonth))}
              className={`flex-1 px-3 py-2 rounded-md border text-sm font-medium transition-colors ${interruptMode === 'permanent' ? 'border-primary bg-primary/10 text-primary' : 'border-border hover:bg-accent'} disabled:opacity-40 disabled:cursor-not-allowed`}
            >
              {t('items.interruptedPermanentlyOption')}
            </button>
            <button
              type="button"
              onClick={() => setInterruptMode('temporary')}
              className={`flex-1 px-3 py-2 rounded-md border text-sm font-medium transition-colors ${interruptMode === 'temporary' ? 'border-primary bg-primary/10 text-primary' : 'border-border hover:bg-accent'}`}
            >
              {t('items.interruptedForOption')}
            </button>
          </div>
          {interruptMode === 'temporary' && (
            <div className="space-y-2">
              <label className="text-sm font-medium">{t('items.interruptionMonths')}</label>
              <input
                type="number"
                min={1}
                max={60}
                value={interruptMonths}
                onChange={e => setInterruptMonths(Math.max(1, parseInt(e.target.value) || 1))}
                className="w-full h-9 px-3 rounded-md border border-input bg-background text-sm"
              />
              <p className="text-xs text-muted-foreground">{interruptionPreview}</p>
            </div>
          )}
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => { setInterruptItem(null); setEditingInterruption(null); setInterruptMode('permanent'); setInterruptMonths(1) }}>{t('common.cancel')}</Button>
            <Button variant="destructive" onClick={handleInterrupt}>
              {t('items.interrupt')}
            </Button>
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        open={showCreditConfirm}
        onClose={() => setShowCreditConfirm(false)}
        onConfirm={async () => { setShowCreditConfirm(false); await doSave() }}
        title={t('items.differentBillingMonth')}
        message={t('items.differentBillingConfirm', { month: fmtMonth(form.startMonth) })}
        confirmLabel={t('common.confirm')}
      />

      {/* Month Value Edit Modal (subscriptions) */}
      <Modal open={showValueEdit} onClose={() => setShowValueEdit(false)} title={t('items.editValueThisMonth')}>
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            {t('items.editValueThisMonth')} — <span className="font-semibold text-foreground">{fmtMonth(month)}</span>
          </p>
          <CurrencyInput label={t('common.valueRequired')} value={monthValue} onChange={setMonthValue} autoFocus />
          <div className="flex justify-between pt-2">
            <div>
              {valueEditTarget?.hasOverride && (
                <Button variant="ghost" size="sm" onClick={handleResetMonthValue}>
                  {t('items.valueRestoredToBase')}
                </Button>
              )}
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setShowValueEdit(false)}>{t('common.cancel')}</Button>
              <Button onClick={handleSaveMonthValue}>{t('common.save')}</Button>
            </div>
          </div>
        </div>
      </Modal>

      {/* Deactivation scope dialog */}
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
