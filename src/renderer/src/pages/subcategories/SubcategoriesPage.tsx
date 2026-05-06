import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { CheckCircle, ChevronDown, ChevronRight, Circle, CircleDot, CreditCard, EyeOff, Filter, HandCoins, ListTree, Pencil, Plus, Receipt, Repeat, Store, Tags, ToggleLeft, Trash2, Wallet, ChevronsUpDown } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { ColorPicker } from '../../components/ui/ColorPicker'
import { FilterDropdown } from '../../components/ui/FilterDropdown'
import { FilterGroup } from '../../components/ui/FilterGroup'
import { Input } from '../../components/ui/Input'
import { KebabMenu } from '../../components/ui/KebabMenu'
import { Modal } from '../../components/ui/Modal'
import { CurrencyMonthNavigator } from '../../components/ui/CurrencyMonthNavigator'
import { SearchInput } from '../../components/ui/SearchInput'
import { SectionLayout } from '../../components/layout/SectionLayout'
import { SimpleDropdown } from '../../components/ui/SimpleDropdown'
import { useColumnsPicker } from '../../components/ui/ColumnsPickerDropdown'
import { TileFieldsPickerButton } from '../../components/ui/TileFieldsPickerButton'
import { formatCurrency } from '../../lib/currency'
import { PRESET_COLORS } from '../../lib/constants'
import { getActiveInterruption } from '../../lib/interruptions'
import { usePageMonth } from '../../contexts/DefaultMonthContext'
import { useActivePerson } from '../../contexts/ActivePersonContext'
import { useColorMode } from '../../contexts/ColorModeContext'
import { useColorSettings } from '../../contexts/ColorSettingsContext'
import { useDimPaid } from '../../contexts/DimPaidContext'
import { useDisplayCurrency } from '../../contexts/DisplayCurrencyContext'
import { useTranslation } from '../../contexts/LanguageContext'
import { useUndoableDelete } from '../../hooks/useUndoableDelete'
import { useTileFields } from '../../contexts/TileFieldsContext'
import type { IncomeRecord, SectionItem } from '../../types/entities'
import { type ItemSortMode, sortItems, getItemSortOptions, getSortLabelMap } from '../../hooks/useSortItems'
import { ItemsTile } from '../items/ItemsTile'
import { IncomeTile } from '../income/IncomeTile'
import { useFormatDate } from '../../lib/date'

type ViewMode = 'all' | 'gastos' | 'receitas'
type Scope = 'expense' | 'income' | 'both'

interface Category {
  id: number
  name: string
  color: string
}

interface Subcategory {
  id: number
  name: string
  color: string
  scope?: Scope
  categoryIds?: number[]
}

interface CardData {
  id: number
  name: string
  bankAccountId: number | null
}

interface BankAccountData {
  id: number
  name: string
}

export default function SubcategoriesPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { activePerson } = useActivePerson()
  const { month, setMonth } = usePageMonth()
  const { resolveEntityColor } = useColorMode()
  const { gastosStyle, receitasStyle } = useColorSettings()
  const { dimPaid } = useDimPaid()
  const { formatDisplayCurrency } = useDisplayCurrency()
  const { columns, gridClass, pickerButton } = useColumnsPicker('item-columns')
  const { receitasFields } = useTileFields('subcategories')
  const { fmtDate } = useFormatDate()

  const [categories, setCategories] = useState<Category[]>([])
  const [subcategories, setSubcategories] = useState<Subcategory[]>([])
  const [items, setItems] = useState<SectionItem[]>([])
  const [incomes, setIncomes] = useState<IncomeRecord[]>([])
  const [cards, setCards] = useState<CardData[]>([])
  const [bankAccounts, setBankAccounts] = useState<BankAccountData[]>([])
  const [stores, setStores] = useState<{ id: number; name: string }[]>([])
  const [search, setSearch] = useState('')
  const [viewMode, setViewMode] = useState<ViewMode>('all')
  const [showViewMenu, setShowViewMenu] = useState(false)
  const viewBtnRef = useRef<HTMLButtonElement>(null)
  const viewDropRef = useRef<HTMLDivElement>(null)
  const [filterItemType, setFilterItemType] = useState('all')
  const [showItemTypeMenu, setShowItemTypeMenu] = useState(false)
  const itemTypeBtnRef = useRef<HTMLButtonElement>(null)
  const itemTypeDropRef = useRef<HTMLDivElement>(null)

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
  const [showCategoryFilter, setShowCategoryFilter] = useState(false)
  const categoryFilterRef = useRef<HTMLButtonElement>(null)
  const categoryDropRef = useRef<HTMLDivElement>(null)
  const [filterSubcategoryKeys, setFilterSubcategoryKeys] = useState<string[]>([])
  const [showSubcategoryFilter, setShowSubcategoryFilter] = useState(false)
  const subcategoryFilterRef = useRef<HTMLButtonElement>(null)
  const subcategoryDropRef = useRef<HTMLDivElement>(null)
  const [filterCardKeys, setFilterCardKeys] = useState<string[]>([])
  const [showCardFilter, setShowCardFilter] = useState(false)
  const cardFilterRef = useRef<HTMLButtonElement>(null)
  const cardDropRef = useRef<HTMLDivElement>(null)
  const [filterBankKeys, setFilterBankKeys] = useState<string[]>([])
  const [showBankFilter, setShowBankFilter] = useState(false)
  const bankFilterRef = useRef<HTMLButtonElement>(null)
  const bankDropRef = useRef<HTMLDivElement>(null)
  const [filterStoreKeys, setFilterStoreKeys] = useState<string[]>([])
  const [showStoreFilter, setShowStoreFilter] = useState(false)
  const storeFilterRef = useRef<HTMLButtonElement>(null)
  const storeDropRef = useRef<HTMLDivElement>(null)
  const [hideEmpty, setHideEmpty] = useState(false)
  const [expandedGroups, setExpandedGroups] = useState<Set<number | 'none'>>(new Set())
  const [sortMode, setSortMode] = useState<ItemSortMode>('az')
  const [showSortMenu, setShowSortMenu] = useState(false)
  const sortBtnRef = useRef<HTMLButtonElement>(null)
  const sortDropRef = useRef<HTMLDivElement>(null)

  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<Subcategory | null>(null)
  const [name, setName] = useState('')
  const [color, setColor] = useState(PRESET_COLORS[0])
  const [scope, setScope] = useState<Scope>('both')
  const [categoryIds, setCategoryIds] = useState<number[]>([])
  const [showColorPicker, setShowColorPicker] = useState(false)

  const loadData = async () => {
    const [subs, cats] = await Promise.all([
      window.api.subcategories.list(),
      window.api.categories.list()
    ])
    setSubcategories(subs)
    setCategories(cats)
    if (!activePerson) return
    const [its, incs, cds, accs, strs] = await Promise.all([
      window.api.items.list(activePerson.id, month),
      window.api.personIncome.listByMonth(activePerson.id, month),
      window.api.cards.list(activePerson.id, month),
      window.api.bankAccounts.list(activePerson.id),
      window.api.stores.list()
    ])
    setItems(its)
    setIncomes(incs)
    setCards(cds)
    setBankAccounts(accs)
    setStores(strs)
  }

  useEffect(() => { loadData() }, [activePerson, month])

  const openCreate = () => {
    setEditing(null)
    setName('')
    setColor(PRESET_COLORS[0])
    setScope('both')
    setCategoryIds([])
    setShowForm(true)
  }

  const openEdit = (subcat: Subcategory) => {
    setEditing(subcat)
    setName(subcat.name)
    setColor(subcat.color || PRESET_COLORS[0])
    setScope(subcat.scope || 'both')
    setCategoryIds(subcat.categoryIds || [])
    setShowForm(true)
  }

  const handleSave = async () => {
    if (!name.trim()) { toast.error(t('common.nameRequired')); return }
    if (categoryIds.length === 0) { toast.error(t('subcategories.categoryRequired')); return }
    const payload = { name: name.trim(), color, scope, categoryIds }
    if (editing) {
      await window.api.subcategories.update({ id: editing.id, ...payload })
      toast.success(t('subcategories.subcategoryUpdated'))
    } else {
      await window.api.subcategories.create(payload)
      toast.success(t('subcategories.subcategoryCreated'))
    }
    setShowForm(false)
    loadData()
  }

  const { requestDelete, isPending } = useUndoableDelete({
    onDelete: async (id) => { await window.api.subcategories.delete(id); loadData() },
    toastLabel: t('subcategories.subcategoryDeleted')
  })

  const { requestDelete: requestDeleteItem, isPending: isItemDeletePending } = useUndoableDelete({
    onDelete: async (id) => { await window.api.items.delete(id); loadData() },
    toastLabel: t('items.itemDeleted')
  })

  const { requestDelete: requestDeleteIncome, isPending: isIncomeDeletePending } = useUndoableDelete({
    onDelete: async (id) => { await window.api.personIncome.delete(id); loadData() },
    toastLabel: t('income.incomeDeleted')
  })

  const toggleItemPaid = async (itemId: number) => {
    await window.api.items.togglePaid(itemId, month)
    loadData()
  }

  const toggleItemActive = async (item: SectionItem) => {
    await window.api.items.toggleActive(item.id)
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

  const toggleCategory = (categoryId: number) => {
    setCategoryIds(ids => ids.includes(categoryId) ? ids.filter(id => id !== categoryId) : [...ids, categoryId])
  }

  const filterItem = (item: SectionItem) => {
    if (filterActive === 'active' && !item.isActive) return false
    if (filterActive === 'inactive' && item.isActive) return false
    if (filterPaid === 'paid' && !item.isPaid) return false
    if (filterPaid === 'unpaid' && item.isPaid) return false
    if (filterItemType !== 'all' && viewMode === 'gastos' && item.type !== filterItemType) return false
    if (filterCategoryKeys.length > 0) {
      const none = filterCategoryKeys.includes('none')
      const ids = filterCategoryKeys.filter(id => id !== 'none')
      if (!((none && !item.categoryId) || (item.categoryId && ids.includes(String(item.categoryId))))) return false
    }
    if (filterSubcategoryKeys.length > 0) {
      const none = filterSubcategoryKeys.includes('none')
      const ids = filterSubcategoryKeys.filter(id => id !== 'none')
      if (!((none && !item.subcategoryId) || (item.subcategoryId && ids.includes(String(item.subcategoryId))))) return false
    }
    if (filterCardKeys.length > 0) {
      const none = filterCardKeys.includes('none')
      const ids = filterCardKeys.filter(id => id !== 'none')
      const directMatch = item.cardId && ids.includes(String(item.cardId))
      const splitMatch = item.cardSplits?.some(split => ids.includes(String(split.cardId)))
      const noneMatch = none && !item.cardId && (!item.cardSplits || item.cardSplits.length === 0)
      if (!directMatch && !splitMatch && !noneMatch) return false
    }
    if (filterBankKeys.length > 0) {
      const none = filterBankKeys.includes('none')
      const ids = filterBankKeys.filter(id => id !== 'none')
      const bankCardIds = new Set(cards.filter(card => card.bankAccountId && ids.includes(String(card.bankAccountId))).map(card => String(card.id)))
      const directMatch = item.cardId && bankCardIds.has(String(item.cardId))
      const splitMatch = item.cardSplits?.some(split => bankCardIds.has(String(split.cardId)))
      const noneMatch = none && !item.cardId && (!item.cardSplits || item.cardSplits.length === 0)
      if (!directMatch && !splitMatch && !noneMatch) return false
    }
    if (filterStoreKeys.length > 0) {
      const none = filterStoreKeys.includes('none')
      const ids = filterStoreKeys.filter(id => id !== 'none')
      if (!((none && !item.storeId) || (item.storeId && ids.includes(String(item.storeId))))) return false
    }
    const splitPaymentMethods = item.cardSplits?.map(split => split.paymentMethod || split.cardType).filter(Boolean) || []
    const hasAnyCard = !!item.cardId || splitPaymentMethods.length > 0
    if (filterPayMethod === 'no-card' && hasAnyCard) return false
    if (filterPayMethod === 'card-both' && !hasAnyCard) return false
    if (filterPayMethod === 'credit' && item.paymentMethod !== 'credit' && !splitPaymentMethods.includes('credit')) return false
    if (filterPayMethod === 'debit' && item.paymentMethod !== 'debit' && !splitPaymentMethods.includes('debit')) return false
    return true
  }

  const filterIncome = (income: IncomeRecord) => {
    if (filterItemType !== 'all' && viewMode === 'receitas') {
      if (filterItemType === 'recurring' && !income.isRecurring) return false
      if (filterItemType === 'non-recurring' && income.isRecurring) return false
    }
    if (filterCategoryKeys.length > 0) {
      const none = filterCategoryKeys.includes('none')
      const ids = filterCategoryKeys.filter(id => id !== 'none')
      if (!((none && !income.categoryId) || (income.categoryId && ids.includes(String(income.categoryId))))) return false
    }
    if (filterSubcategoryKeys.length > 0) {
      const none = filterSubcategoryKeys.includes('none')
      const ids = filterSubcategoryKeys.filter(id => id !== 'none')
      if (!((none && !income.subcategoryId) || (income.subcategoryId && ids.includes(String(income.subcategoryId))))) return false
    }
    if (filterStoreKeys.length > 0) {
      const none = filterStoreKeys.includes('none')
      const ids = filterStoreKeys.filter(id => id !== 'none')
      if (!((none && !income.storeId) || (income.storeId && ids.includes(String(income.storeId))))) return false
    }
    return true
  }

  const searchLower = search.trim().toLowerCase()
  const groups = (() => {
    const mapped = subcategories.map((subcat, index) => {
      const nameMatches = searchLower && subcat.name.toLowerCase().includes(searchLower)
      const groupItems = viewMode === 'receitas' ? [] : sortItems(items.filter(item => item.subcategoryId === subcat.id).filter(filterItem), sortMode, month)
      const groupIncomes = viewMode === 'gastos' ? [] : incomes.filter(income => income.subcategoryId === subcat.id).filter(filterIncome)
      return {
        key: subcat.id as number | 'none',
        subcategory: subcat,
        name: subcat.name,
        color: resolveEntityColor(subcat.color || PRESET_COLORS[0], index),
        items: nameMatches || !searchLower ? groupItems : groupItems.filter(item => item.description.toLowerCase().includes(searchLower)),
        incomes: nameMatches || !searchLower ? groupIncomes : groupIncomes.filter(income => income.description.toLowerCase().includes(searchLower))
      }
    })
    const noneItems = viewMode === 'receitas' ? [] : sortItems(items.filter(item => !item.subcategoryId).filter(filterItem), sortMode, month)
    const noneIncomes = viewMode === 'gastos' ? [] : incomes.filter(income => !income.subcategoryId).filter(filterIncome)
    mapped.push({
      key: 'none',
      subcategory: null,
      name: t('itemsForm.noSubcategoryPlaceholder'),
      color: '#6b7280',
      items: !searchLower ? noneItems : noneItems.filter(item => item.description.toLowerCase().includes(searchLower)),
      incomes: !searchLower ? noneIncomes : noneIncomes.filter(income => income.description.toLowerCase().includes(searchLower))
    })
    let result = filterSubcategoryKeys.length > 0
      ? mapped.filter(group => filterSubcategoryKeys.includes(String(group.key)))
      : mapped
    if (hideEmpty || searchLower) result = result.filter(group => group.items.length > 0 || group.incomes.length > 0)
    return result
  })()

  const allFilteredItems = groups.flatMap(group => group.items)
  const allFilteredIncomes = groups.flatMap(group => group.incomes)
  const expenseTotal = allFilteredItems.filter(item => item.isActive && !getActiveInterruption(item.interruptions, month)).reduce((sum, item) => {
    const rate = item.exchangeRateSnapshot || 1
    if ((item.type === 'installment' || item.type === 'emprestimo') && item.totalInstallments) {
      return sum + Math.round((item.value / item.totalInstallments) * 100) / 100 * rate
    }
    return sum + item.value * rate
  }, 0)
  const incomeTotal = allFilteredIncomes
    .filter(income => !getActiveInterruption(income.interruptions, month))
    .reduce((sum, income) => sum + income.effectiveValue * (income.exchangeRateSnapshot || 1), 0)
  const paidCount = allFilteredItems.filter(item => item.isPaid).length
  const receivedCount = allFilteredIncomes.filter(income => income.isReceived).length
  const expenseStat = {
    label: `${allFilteredItems.length === 1 ? t('items.itemCount', { count: allFilteredItems.length }) : t('items.itemCountPlural', { count: allFilteredItems.length })} · ${t('items.unpaidCount', { count: allFilteredItems.length - paidCount })}`,
    value: formatDisplayCurrency(expenseTotal),
    style: gastosStyle('subcategories', 'hero')
  }
  const incomeStat = {
    label: `${allFilteredIncomes.length === 1 ? t('items.incomeCount', { count: allFilteredIncomes.length }) : t('items.incomeCountPlural', { count: allFilteredIncomes.length })} · ${t('items.unreceived', { count: allFilteredIncomes.length - receivedCount })}`,
    value: formatDisplayCurrency(incomeTotal),
    style: receitasStyle('subcategories', 'hero')
  }

  const stats = viewMode === 'gastos'
    ? [expenseStat]
    : viewMode === 'receitas'
      ? [incomeStat]
      : [expenseStat, incomeStat]

  const categoryFilterItems = [
    { id: 'none', name: t('categories.noCategory'), color: '#6b7280' },
    ...categories.map(category => ({ id: String(category.id), name: category.name, color: category.color }))
  ]
  const subcategoryFilterItems = [
    { id: 'none', name: t('itemsForm.noSubcategoryPlaceholder'), color: '#6b7280' },
    ...subcategories.map(subcat => ({ id: String(subcat.id), name: subcat.name, color: subcat.color }))
  ]
  const cardFilterItems = [
    { id: 'none', name: t('filters.noCard'), color: '#6b7280' },
    ...cards.map(card => ({ id: String(card.id), name: card.name, color: '#8b5cf6' }))
  ]
  const bankFilterItems = [
    { id: 'none', name: t('filters.noAccount'), color: '#6b7280' },
    ...bankAccounts.map(account => ({ id: String(account.id), name: account.name, color: '#3b82f6' }))
  ]
  const storeFilterItems = [
    { id: 'none', name: t('filters.noStore'), color: '#6b7280' },
    ...stores.map(store => ({ id: String(store.id), name: store.name, color: '#6366f1' }))
  ]

  const groupTotal = (group: typeof groups[number]) =>
    group.items.reduce((sum, item) => sum + item.value * (item.exchangeRateSnapshot || 1), 0) +
    group.incomes.reduce((sum, income) => sum + income.effectiveValue * (income.exchangeRateSnapshot || 1), 0)

  const getLinkedCategoryNames = (subcat: Subcategory) => {
    const ids = new Set(subcat.categoryIds || [])
    return categories.filter(category => ids.has(category.id)).map(category => category.name)
  }

  const scopeLabel = (value?: Scope) => {
    if (value === 'expense') return t('categories.scopeExpense')
    if (value === 'income') return t('categories.scopeIncome')
    return t('categories.scopeBoth')
  }

  const renderIncomeTile = (income: IncomeRecord) => {
    const metaItems: { icon: any; text: string }[] = []
    if (receitasFields.type) {
      metaItems.push({ icon: income.isRecurring ? Repeat : CircleDot, text: income.isRecurring ? t('income.recurring') : t('income.nonRecurring') })
    }
    if (receitasFields.dueDay && income.dueDay) {
      metaItems.push({ icon: CreditCard, text: `${t('tileFields.receivingDay')}: ${income.dueDay}` })
    }

    return (
      <Card
        key={`income-${income.id}`}
        className={`group relative overflow-hidden transition-all flex flex-col ${income.isReceived && dimPaid ? 'opacity-50 hover:opacity-100' : 'hover:shadow-md'}`}
      >
        {dimPaid && income.isReceived && (
          <div className="absolute inset-0 z-20 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-card/50 backdrop-blur-[1px]">
            <button
              onClick={() => toggleReceived(income.id)}
              className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-semibold shadow-md hover:bg-primary/90 transition-colors"
            >
              {t('items.undoReceipt')}
            </button>
          </div>
        )}

        <div className="flex items-center gap-2.5 px-4 py-2.5 border-b border-border/50 overflow-hidden">
          <button onClick={() => toggleReceived(income.id)} className="shrink-0" title={income.isReceived ? t('items.markNotReceived') : t('items.markReceived')}>
            {income.isReceived
              ? <CheckCircle size={18} className="text-primary" />
              : <Circle size={18} className="text-muted-foreground/40 hover:text-primary transition-colors" />}
          </button>
          <Wallet size={14} className="text-primary/60 shrink-0" />
          <p className="text-base font-bold truncate flex-1 min-w-0">
            {income.description}
            {income.categoryName && (
              <span className="text-[11px] font-normal text-muted-foreground ml-1.5"> - {income.categoryName}{income.subcategoryName ? `/${income.subcategoryName}` : ''}</span>
            )}
          </p>
          {income.tags && income.tags.length > 0 && (
            <div className="flex items-center gap-1 overflow-hidden">
              {income.tags.map(tag => (
                <span key={tag.id} className="text-[11px] px-2 py-0.5 rounded-full font-medium whitespace-nowrap" style={{ backgroundColor: `${tag.color}20`, color: tag.color }}>{tag.name}</span>
              ))}
            </div>
          )}
          {income.isReceived && (
            <span className="flex items-center gap-1 px-2 py-0.5 rounded-full whitespace-nowrap shrink-0" style={{ backgroundColor: 'color-mix(in srgb, #22c55e 15%, transparent)', borderWidth: '1px', borderColor: 'color-mix(in srgb, #22c55e 30%, transparent)' }}>
              <CheckCircle size={11} style={{ color: '#22c55e' }} />
              <span className="text-[10px] font-semibold" style={{ color: '#22c55e' }}>{income.receivedAt ? t('items.receivedAt', { date: fmtDate(income.receivedAt) }) : t('items.received')}</span>
            </span>
          )}
          <KebabMenu size={16} items={[
            { label: t('common.edit'), icon: Pencil, onClick: () => navigate('/income', { state: { editIncomeId: income.id } }) }
          ]} />
        </div>

        <div className="flex-1 p-4">
          <div className="flex items-baseline gap-2 mb-1">
            <span className="text-2xl font-bold tabular-nums" style={receitasStyle('subcategories', 'itens')}>
              {formatCurrency(income.effectiveValue * (income.exchangeRateSnapshot || 1))}
            </span>
          </div>
          {metaItems.length > 0 && (
            <div className="flex items-center gap-2.5 flex-wrap">
              {metaItems.map((meta, index) => {
                const MetaIcon = meta.icon
                return (
                  <span key={index} className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
                    <MetaIcon size={10} className="shrink-0 opacity-60" />
                    {meta.text}
                  </span>
                )
              })}
            </div>
          )}
        </div>
      </Card>
    )
  }

  const renderExpandableIncomeTile = (income: IncomeRecord) => (
    <IncomeTile
      key={`income-${income.id}`}
      income={income}
      month={month}
      fieldsPage="subcategories"
      styleScope="subcategories"
      receitasStyle={receitasStyle}
      onEdit={nextIncome => navigate('/income', { state: { editIncomeId: nextIncome.id } })}
      onToggleReceived={toggleReceived}
      onDelete={id => requestDeleteIncome(id)}
      onEditValue={nextIncome => navigate('/income', { state: { editIncomeId: nextIncome.id, initialTab: 'valores' } })}
      onInterrupt={nextIncome => navigate('/income', { state: { editIncomeId: nextIncome.id, initialTab: 'interrupcoes' } })}
      onReactivate={reactivateIncome}
    />
  )

  if (!activePerson) {
    return (
      <SectionLayout icon={ListTree} title={t('subcategories.title')}>
        <Card className="p-8 text-center">
          <p className="text-muted-foreground">{t('items.selectProfileToSee')}</p>
        </Card>
      </SectionLayout>
    )
  }

  return (
    <SectionLayout
      icon={ListTree}
      title={t('subcategories.title')}
      monthNav={<CurrencyMonthNavigator month={month} onChange={setMonth} />}
      actionButton={<Button size="sm" onClick={openCreate}><Plus size={16} /> {t('subcategories.createSubcategory')}</Button>}
      controls={
        <>
          <SearchInput value={search} onChange={setSearch} />
          <div className="relative">
            <button ref={viewBtnRef} type="button" onClick={() => setShowViewMenu(v => !v)}
              className="inline-flex items-center gap-1.5 h-7 px-2.5 text-xs font-medium rounded-md border border-input hover:bg-accent transition-colors">
              {viewMode === 'all' ? t('filters.expensesAndIncome') : viewMode === 'gastos' ? t('filters.expenses') : t('filters.income')}
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
                onChange={value => { setViewMode(value as ViewMode); setShowViewMenu(false) }}
                onClose={() => setShowViewMenu(false)}
              />
            )}
          </div>
          {viewMode !== 'all' && (
            <div className="relative">
              <button ref={itemTypeBtnRef} type="button" onClick={() => setShowItemTypeMenu(v => !v)}
                className="inline-flex items-center gap-1.5 h-7 px-2.5 text-xs font-medium rounded-md border border-input hover:bg-accent transition-colors">
                {filterItemType === 'all'
                  ? t('filters.allTypes')
                  : viewMode === 'gastos'
                    ? ({ common: t('filters.singles'), installment: t('filters.installments'), subscription: t('filters.recurring'), emprestimo: t('filters.loans') } as Record<string, string>)[filterItemType]
                    : filterItemType === 'recurring' ? t('filters.recurringOnly') : t('filters.nonRecurringOnly')}
                <ChevronDown size={12} className="text-muted-foreground" />
              </button>
              {showItemTypeMenu && (
                <SimpleDropdown
                  anchorRef={itemTypeBtnRef}
                  dropRef={itemTypeDropRef}
                  options={viewMode === 'gastos'
                    ? [
                        { key: 'all', label: t('filters.allTypes') },
                        { key: 'common', label: t('filters.singles') },
                        { key: 'installment', label: t('filters.installments') },
                        { key: 'subscription', label: t('filters.recurring') },
                        { key: 'emprestimo', label: t('filters.loans') }
                      ]
                    : [
                        { key: 'all', label: t('filters.allTypes') },
                        { key: 'recurring', label: t('filters.recurringOnly') },
                        { key: 'non-recurring', label: t('filters.nonRecurringOnly') }
                      ]}
                  current={filterItemType}
                  onChange={value => { setFilterItemType(value); setShowItemTypeMenu(false) }}
                  onClose={() => setShowItemTypeMenu(false)}
                />
              )}
            </div>
          )}
          <FilterGroup
            activeCount={
              (filterCategoryKeys.length > 0 ? 1 : 0) + (filterSubcategoryKeys.length > 0 ? 1 : 0) +
              (filterBankKeys.length > 0 ? 1 : 0) + (filterCardKeys.length > 0 ? 1 : 0) +
              (filterStoreKeys.length > 0 ? 1 : 0) + (hideEmpty ? 1 : 0) +
              (filterActive !== 'all' ? 1 : 0) + (filterPaid !== 'all' ? 1 : 0) +
              (filterPayMethod !== 'all' ? 1 : 0)
            }
            onClear={() => {
              setFilterActive('all'); setFilterPaid('all'); setFilterPayMethod('all'); setFilterItemType('all')
              setFilterCategoryKeys([]); setFilterSubcategoryKeys([]); setFilterCardKeys([]); setFilterBankKeys([]); setFilterStoreKeys([]); setHideEmpty(false)
            }}
            primaryCount={3}
          >
            <div className="relative">
              <button ref={categoryFilterRef} type="button" title={t('filters.category')}
                onClick={() => { setShowCategoryFilter(v => !v); setShowSubcategoryFilter(false) }}
                className={`inline-flex items-center gap-1.5 h-7 px-2.5 text-xs font-medium rounded-md border transition-colors ${filterCategoryKeys.length > 0 ? 'bg-primary text-primary-foreground border-primary' : 'bg-transparent text-foreground border-input hover:bg-accent'}`}>
                <Tags size={11} />
                <span data-filter-label>{t('filters.category')}</span>
                <ChevronDown size={12} className="text-muted-foreground" />
              </button>
              {showCategoryFilter && (
                <FilterDropdown anchorRef={categoryFilterRef} dropRef={categoryDropRef} onClose={() => setShowCategoryFilter(false)}
                  items={categoryFilterItems} selected={filterCategoryKeys}
                  onToggle={id => setFilterCategoryKeys(values => values.includes(id) ? values.filter(value => value !== id) : [...values, id])} />
              )}
            </div>
            <div className="relative">
              <button ref={subcategoryFilterRef} type="button" title={t('itemsForm.subcategory')}
                onClick={() => { setShowSubcategoryFilter(v => !v); setShowCategoryFilter(false) }}
                className={`inline-flex items-center gap-1.5 h-7 px-2.5 text-xs font-medium rounded-md border transition-colors ${filterSubcategoryKeys.length > 0 ? 'bg-primary text-primary-foreground border-primary' : 'bg-transparent text-foreground border-input hover:bg-accent'}`}>
                <ListTree size={11} />
                <span data-filter-label>{t('itemsForm.subcategory')}</span>
                <ChevronDown size={12} className="text-muted-foreground" />
              </button>
              {showSubcategoryFilter && (
                <FilterDropdown anchorRef={subcategoryFilterRef} dropRef={subcategoryDropRef} onClose={() => setShowSubcategoryFilter(false)}
                  items={subcategoryFilterItems} selected={filterSubcategoryKeys}
                  onToggle={id => setFilterSubcategoryKeys(values => values.includes(id) ? values.filter(value => value !== id) : [...values, id])} />
              )}
            </div>
            <div className="relative">
              <button ref={bankFilterRef} type="button" title={t('filters.accounts')}
                onClick={() => { setShowBankFilter(v => !v); setShowCategoryFilter(false); setShowSubcategoryFilter(false); setShowCardFilter(false); setShowStoreFilter(false) }}
                className={`inline-flex items-center gap-1.5 h-7 px-2.5 text-xs font-medium rounded-md border transition-colors ${filterBankKeys.length > 0 ? 'bg-primary text-primary-foreground border-primary' : 'bg-transparent text-foreground border-input hover:bg-accent'}`}>
                <Wallet size={11} />
                <span data-filter-label>{t('filters.accounts')}</span>
                <ChevronDown size={12} className="text-muted-foreground" />
              </button>
              {showBankFilter && (
                <FilterDropdown anchorRef={bankFilterRef} dropRef={bankDropRef} onClose={() => setShowBankFilter(false)}
                  items={bankFilterItems} selected={filterBankKeys}
                  onToggle={id => setFilterBankKeys(values => values.includes(id) ? values.filter(value => value !== id) : [...values, id])}
                  emptyText={t('filters.noAccountRegistered')} />
              )}
            </div>
            <div className="relative">
              <button ref={cardFilterRef} type="button" title={t('filters.cards')}
                onClick={() => { setShowCardFilter(v => !v); setShowCategoryFilter(false); setShowSubcategoryFilter(false); setShowBankFilter(false); setShowStoreFilter(false) }}
                className={`inline-flex items-center gap-1.5 h-7 px-2.5 text-xs font-medium rounded-md border transition-colors ${filterCardKeys.length > 0 ? 'bg-primary text-primary-foreground border-primary' : 'bg-transparent text-foreground border-input hover:bg-accent'}`}>
                <CreditCard size={11} />
                <span data-filter-label>{t('filters.cards')}</span>
                <ChevronDown size={12} className="text-muted-foreground" />
              </button>
              {showCardFilter && (
                <FilterDropdown anchorRef={cardFilterRef} dropRef={cardDropRef} onClose={() => setShowCardFilter(false)}
                  items={cardFilterItems} selected={filterCardKeys}
                  onToggle={id => setFilterCardKeys(values => values.includes(id) ? values.filter(value => value !== id) : [...values, id])}
                  emptyText={t('filters.noCardRegistered')} />
              )}
            </div>
            <div className="relative">
              <button ref={storeFilterRef} type="button" title={t('filters.stores')}
                onClick={() => { setShowStoreFilter(v => !v); setShowCategoryFilter(false); setShowSubcategoryFilter(false); setShowBankFilter(false); setShowCardFilter(false) }}
                className={`inline-flex items-center gap-1.5 h-7 px-2.5 text-xs font-medium rounded-md border transition-colors ${filterStoreKeys.length > 0 ? 'bg-primary text-primary-foreground border-primary' : 'bg-transparent text-foreground border-input hover:bg-accent'}`}>
                <Store size={11} />
                <span data-filter-label>{t('filters.stores')}</span>
                <ChevronDown size={12} className="text-muted-foreground" />
              </button>
              {showStoreFilter && (
                <FilterDropdown anchorRef={storeFilterRef} dropRef={storeDropRef} onClose={() => setShowStoreFilter(false)}
                  items={storeFilterItems} selected={filterStoreKeys}
                  onToggle={id => setFilterStoreKeys(values => values.includes(id) ? values.filter(value => value !== id) : [...values, id])}
                  emptyText={t('filters.noStoreRegistered')} />
              )}
            </div>
            <button type="button" title={t('categories.hideEmpty')} onClick={() => setHideEmpty(v => !v)}
              className={`inline-flex items-center gap-1.5 h-7 px-2.5 text-xs font-medium rounded-md border transition-colors ${hideEmpty ? 'bg-primary text-primary-foreground border-primary' : 'bg-transparent text-foreground border-input hover:bg-accent'}`}>
              <EyeOff size={11} />
              <span data-filter-label>{t('categories.hideEmpty')}</span>
            </button>
            {viewMode !== 'receitas' && (
              <>
                <div className="relative">
                  <button ref={activeBtnRef} type="button" title={t('common.active')}
                    onClick={() => setShowActiveMenu(v => !v)}
                    className="inline-flex items-center gap-1.5 h-7 px-2.5 text-xs font-medium rounded-md border border-input hover:bg-accent transition-colors">
                    <ToggleLeft size={11} />
                    <span data-filter-label>{filterActive === 'all' ? t('filters.activeAndInactive') : filterActive === 'active' ? t('filters.activeOnly') : t('filters.inactiveOnly')}</span>
                    <ChevronDown size={12} className="text-muted-foreground" />
                  </button>
                  {showActiveMenu && (
                    <SimpleDropdown anchorRef={activeBtnRef} dropRef={activeDropRef}
                      options={[
                        { key: 'all', label: t('filters.activeAndInactive') },
                        { key: 'active', label: t('filters.activeOnly') },
                        { key: 'inactive', label: t('filters.inactiveOnly') }
                      ]}
                      current={filterActive}
                      onChange={value => { setFilterActive(value as 'all' | 'active' | 'inactive'); setShowActiveMenu(false) }}
                      onClose={() => setShowActiveMenu(false)} />
                  )}
                </div>
                <div className="relative">
                  <button ref={paidBtnRef} type="button" title={t('filters.paidOnly')}
                    onClick={() => setShowPaidMenu(v => !v)}
                    className="inline-flex items-center gap-1.5 h-7 px-2.5 text-xs font-medium rounded-md border border-input hover:bg-accent transition-colors">
                    <CheckCircle size={11} />
                    <span data-filter-label>{filterPaid === 'all' ? t('filters.paidAndUnpaid') : filterPaid === 'paid' ? t('filters.paidOnly') : t('filters.unpaidOnly')}</span>
                    <ChevronDown size={12} className="text-muted-foreground" />
                  </button>
                  {showPaidMenu && (
                    <SimpleDropdown anchorRef={paidBtnRef} dropRef={paidDropRef}
                      options={[
                        { key: 'all', label: t('filters.paidAndUnpaid') },
                        { key: 'paid', label: t('filters.paidOnly') },
                        { key: 'unpaid', label: t('filters.unpaidOnly') }
                      ]}
                      current={filterPaid}
                      onChange={value => { setFilterPaid(value as 'all' | 'paid' | 'unpaid'); setShowPaidMenu(false) }}
                      onClose={() => setShowPaidMenu(false)} />
                  )}
                </div>
                <div className="relative">
                  <button ref={payMethodBtnRef} type="button" title={t('filters.paymentMethod')}
                    onClick={() => setShowPayMethodMenu(v => !v)}
                    className="inline-flex items-center gap-1.5 h-7 px-2.5 text-xs font-medium rounded-md border border-input hover:bg-accent transition-colors">
                    <Wallet size={11} />
                    <span data-filter-label>{{ 'all': t('filters.allPaymentMethods'), 'no-card': t('filters.noCardOnly'), 'card-both': t('filters.creditAndDebit'), 'credit': t('filters.creditCardOnly'), 'debit': t('filters.debitCardOnly') }[filterPayMethod]}</span>
                    <ChevronDown size={12} className="text-muted-foreground" />
                  </button>
                  {showPayMethodMenu && (
                    <SimpleDropdown anchorRef={payMethodBtnRef} dropRef={payMethodDropRef}
                      options={[
                        { key: 'all', label: t('filters.allPaymentMethods') },
                        { key: 'no-card', label: t('filters.noCardOnly') },
                        { key: 'card-both', label: t('filters.creditAndDebit') },
                        { key: 'credit', label: t('filters.creditCardOnly') },
                        { key: 'debit', label: t('filters.debitCardOnly') }
                      ]}
                      current={filterPayMethod}
                      onChange={value => { setFilterPayMethod(value); setShowPayMethodMenu(false) }}
                      onClose={() => setShowPayMethodMenu(false)} />
                  )}
                </div>
              </>
            )}
          </FilterGroup>
          <div className="h-6 w-px bg-border shrink-0 ml-auto" />
          <button
            type="button"
            onClick={() => {
              const keys = groups.map(group => group.key)
              const allExpanded = keys.every(key => expandedGroups.has(key))
              setExpandedGroups(allExpanded ? new Set() : new Set(keys))
            }}
            className="inline-flex items-center gap-1.5 h-7 px-2.5 text-xs font-medium rounded-md hover:bg-accent transition-colors"
            title={expandedGroups.size === groups.length ? t('settings.collapseAll') : t('settings.expandAll')}
          >
            <ChevronsUpDown size={14} />
          </button>
          {pickerButton}
          <TileFieldsPickerButton page="subcategories" />
          <div className="relative">
            <button ref={sortBtnRef} type="button" onClick={() => setShowSortMenu(v => !v)}
              className="inline-flex items-center gap-1.5 h-7 px-2.5 text-xs font-medium rounded-md border border-input hover:bg-accent transition-colors">
              {getSortLabelMap(t)[sortMode]}
              <ChevronDown size={12} className="text-muted-foreground" />
            </button>
            {showSortMenu && (
              <SimpleDropdown
                anchorRef={sortBtnRef}
                dropRef={sortDropRef}
                options={getItemSortOptions(t)}
                current={sortMode}
                onChange={value => { setSortMode(value as ItemSortMode); setShowSortMenu(false) }}
                onClose={() => setShowSortMenu(false)}
              />
            )}
          </div>
        </>
      }
      stats={stats}
    >
      {groups.length === 0 ? (
        <Card className="p-8 text-center">
          <ListTree size={48} className="mx-auto text-muted-foreground/30 mb-3" />
          <p className="text-muted-foreground">{t('subcategories.noSubcategories')}</p>
          <Button size="sm" className="mt-4" onClick={openCreate}><Plus size={16} /> {t('subcategories.createSubcategory')}</Button>
        </Card>
      ) : (
        <div className="space-y-4">
          {groups.filter(group => !group.subcategory || !isPending(group.subcategory.id)).map(group => {
            const expanded = expandedGroups.has(group.key)
            return (
              <div key={group.key}>
                <Card className="p-0 overflow-hidden">
                  <button onClick={() => setExpandedGroups(values => {
                    const next = new Set(values)
                    next.has(group.key) ? next.delete(group.key) : next.add(group.key)
                    return next
                  })} className="flex items-center gap-3 w-full text-left px-4 py-3 hover:bg-accent/50 transition-colors">
                    <ChevronRight size={16} className={`text-muted-foreground transition-transform ${expanded ? 'rotate-90' : ''}`} />
                    <div className="flex h-8 w-8 items-center justify-center rounded-full shrink-0" style={{ backgroundColor: `${group.color}20` }}>
                      <ListTree size={14} style={{ color: group.color }} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <span className="text-sm font-semibold">{group.name}</span>
                      {group.subcategory && (
                        <p className="text-xs text-muted-foreground truncate">
                          {getLinkedCategoryNames(group.subcategory).join(', ') || t('subcategories.noLinkedCategories')}
                        </p>
                      )}
                    </div>
                    {group.subcategory && (
                      <span className="text-[10px] px-2 py-0.5 rounded-full border border-border text-muted-foreground">
                        {scopeLabel(group.subcategory.scope)}
                      </span>
                    )}
                    <span className="text-xs text-muted-foreground">{group.items.length + group.incomes.length}</span>
                    <span className="text-sm font-bold tabular-nums">{formatCurrency(groupTotal(group))}</span>
                    {group.subcategory && (
                      <KebabMenu size={16} items={[
                        { label: t('common.edit'), icon: Pencil, onClick: () => openEdit(group.subcategory!) },
                        { label: t('common.delete'), icon: Trash2, onClick: () => requestDelete(group.subcategory!.id), destructive: true }
                      ]} />
                    )}
                  </button>
                </Card>
                {expanded && (group.items.length > 0 || group.incomes.length > 0) && (
                  <div className={`grid ${gridClass} gap-3 mt-2`}>
                    {group.items.filter(item => !isItemDeletePending(item.id)).map(item => (
                      <ItemsTile
                        key={`item-${item.id}`}
                        item={item}
                        month={month}
                        columns={columns}
                        fieldsPage="subcategories"
                        styleScope="subcategories"
                        gastosStyle={gastosStyle}
                        onEdit={nextItem => navigate('/items', { state: { editItemId: nextItem.id } })}
                        onToggleActive={toggleItemActive}
                        onTogglePaid={toggleItemPaid}
                        onDelete={id => requestDeleteItem(id)}
                        onEditValue={nextItem => navigate('/items', { state: { editItemId: nextItem.id, initialTab: 'valores' } })}
                        onReactivate={reactivateItem}
                        onInterrupt={nextItem => navigate('/items', { state: { editItemId: nextItem.id, initialTab: 'interrupcoes' } })}
                        onViewInterruptions={nextItem => navigate('/items', { state: { editItemId: nextItem.id, initialTab: 'interrupcoes' } })}
                      />
                    ))}
                    {group.incomes.filter(income => !isIncomeDeletePending(income.id)).map(income => renderExpandableIncomeTile(income))}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      <Modal open={showForm} onClose={() => setShowForm(false)} title={editing ? t('subcategories.editSubcategory') : t('subcategories.createSubcategory')}>
        <div className="space-y-4">
          <Input label={t('common.name')} value={name} onChange={event => setName(event.target.value)} placeholder={t('subcategories.placeholder')} autoFocus />
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-foreground">{t('categories.scope')}</label>
            <div className="flex rounded-lg border border-input p-0.5 bg-muted/30">
              {([
                { value: 'both', label: t('categories.scopeBoth') },
                { value: 'expense', label: t('categories.scopeExpense') },
                { value: 'income', label: t('categories.scopeIncome') }
              ] as { value: Scope; label: string }[]).map(option => (
                <button key={option.value} type="button" onClick={() => setScope(option.value)}
                  className={`flex-1 py-1.5 text-sm font-medium rounded-md transition-all ${scope === option.value ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}>
                  {option.label}
                </button>
              ))}
            </div>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">{t('categories.title')}</label>
            <div className="rounded-lg border border-border bg-card p-3">
              <div className="flex flex-wrap gap-1.5">
                {categories.map(category => {
                  const selected = categoryIds.includes(category.id)
                  return (
                    <button key={category.id} type="button" onClick={() => toggleCategory(category.id)}
                      className={`text-xs px-2.5 py-1 rounded-full font-medium transition-all border ${selected ? 'ring-1 ring-offset-1 ring-offset-card' : 'opacity-60 hover:opacity-100'}`}
                      style={{ backgroundColor: `${category.color || '#6b7280'}20`, color: category.color || '#6b7280', borderColor: selected ? category.color || '#6b7280' : 'transparent' }}>
                      {category.name}
                    </button>
                  )
                })}
              </div>
            </div>
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium text-foreground">{t('common.color')}</label>
            <div className="flex flex-wrap gap-2">
              {PRESET_COLORS.map(preset => (
                <button key={preset} onClick={() => setColor(preset)}
                  className={`h-8 w-8 rounded-full transition-all ${color === preset ? 'ring-2 ring-offset-2 ring-offset-card ring-primary scale-110' : 'hover:scale-105'}`}
                  style={{ backgroundColor: preset }} />
              ))}
              <button onClick={() => setShowColorPicker(true)}
                className={`h-8 w-8 rounded-full border-2 border-dashed border-border hover:border-primary flex items-center justify-center transition-all hover:scale-105 ${!PRESET_COLORS.includes(color) ? 'ring-2 ring-offset-2 ring-offset-card ring-primary scale-110' : ''}`}
                style={!PRESET_COLORS.includes(color) ? { backgroundColor: color } : undefined} />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setShowForm(false)}>{t('common.cancel')}</Button>
            <Button onClick={handleSave}>{editing ? t('common.save') : t('common.create')}</Button>
          </div>
        </div>
      </Modal>
      <ColorPicker open={showColorPicker} onClose={() => setShowColorPicker(false)} value={color}
        onConfirm={next => { setColor(next); setShowColorPicker(false) }} />
    </SectionLayout>
  )
}
