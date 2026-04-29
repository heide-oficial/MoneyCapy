import { useState, useEffect, useRef } from 'react'
import { Card } from '../../components/ui/Card'
import { SectionLayout } from '../../components/layout/SectionLayout'
import { Button } from '../../components/ui/Button'
import { Modal } from '../../components/ui/Modal'
import { Input } from '../../components/ui/Input'
import { CurrencyInput } from '../../components/ui/CurrencyInput'
import { DatePicker } from '../../components/ui/DatePicker'
import { Select } from '../../components/ui/Select'
import { MonthNavigator } from '../../components/ui/MonthNavigator'
import { SearchInput } from '../../components/ui/SearchInput'
import { KebabMenu } from '../../components/ui/KebabMenu'
import { formatCurrency, formatCurrencyWith } from '../../lib/currency'
import { CurrencyTooltip } from '../../components/ui/CurrencyTooltip'
import { useCurrencySettings } from '../../contexts/CurrencySettingsContext'
import { getCurrentMonth, useFormatDate } from '../../lib/date'
import { usePageMonth } from '../../contexts/DefaultMonthContext'
import { useActivePerson } from '../../contexts/ActivePersonContext'
import { useColorSettings } from '../../contexts/ColorSettingsContext'
import { useColumnsPicker } from '../../components/ui/ColumnsPickerDropdown'
import { SimpleDropdown } from '../../components/ui/SimpleDropdown'
import { FilterDropdown } from '../../components/ui/FilterDropdown'
import { FilterGroup } from '../../components/ui/FilterGroup'
import {
  HandCoins, Plus, Pencil, Trash2, Repeat, Users,
  CheckCircle, Circle, CircleDot, DollarSign,
  ChevronDown, CalendarClock, Filter, Palette, X, Undo2, Tags, Bookmark, Download
} from 'lucide-react'
import { DayPicker } from '../../components/ui/DayPicker'
import { formatDayLabelResolved } from '../../../../../shared/day-utils'
import { useBusinessDayConfig } from '../../contexts/BusinessDayContext'
import { useDimPaid } from '../../contexts/DimPaidContext'
import { TileFieldsPickerButton } from '../../components/ui/TileFieldsPickerButton'
import { CsvExportModal, type CsvColumn } from '../../components/ui/CsvExportModal'
import { useTileFields } from '../../contexts/TileFieldsContext'
import { ROUTES } from '../../lib/constants'
import { useLocation, useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { useUndoableDelete } from '../../hooks/useUndoableDelete'
import { ColorPicker } from '../../components/ui/ColorPicker'
import { useTranslation } from '../../contexts/LanguageContext'

import type { TagData, ItemInterruption } from '../../types/entities'

import { PRESET_COLORS } from '../../lib/constants'

interface Category { id: number; name: string; icon: string; color: string }

interface Income {
  id: number; personId: number; description: string
  value: number; effectiveValue: number
  isRecurring: boolean; startMonth: string; endMonth: string | null
  isReceived: boolean; receivedAt: string | null; hasOverride: boolean
  categoryId: number | null; categoryName?: string; categoryColor?: string
  dueDay?: number | null; dueDayType?: string
  notes?: string
  storeId?: number | null; storeName?: string; storeColor?: string
  tags?: TagData[]
  interruptions?: ItemInterruption[]
  currencyId?: number | null
  currencySymbol?: string
  currencyCode?: string
  exchangeRateSnapshot?: number
  createdAt?: string
}

type RecurringFilter = 'all' | 'recurring' | 'non-recurring'

export default function IncomePage() {
  const { t } = useTranslation()
  const location = useLocation()
  const navigate = useNavigate()
  const { activePerson } = useActivePerson()
  const { receitasStyle } = useColorSettings()
  const { fmtMonth, fmtDate } = useFormatDate()
  const { businessDayConfig } = useBusinessDayConfig()
  const { dimPaid } = useDimPaid()
  const { receitasFields } = useTileFields('income')
  const { currencies, baseCurrency } = useCurrencySettings()
  const { gridClass, pickerButton } = useColumnsPicker('income-columns')
  const { month, setMonth } = usePageMonth()
  const [incomes, setIncomes] = useState<Income[]>([])
  const [showCsvExport, setShowCsvExport] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<Income | null>(null)
  const [form, setForm] = useState({
    description: '', value: 0, isRecurring: false,
    startMonth: month, endMonth: '' as string,
    categoryId: '' as string | number, tagIds: [] as number[],
    isReceived: false, receivedAt: '',
    dueDay: '' as string, dueDayType: '' as string,
    notes: '', storeId: '' as string | number,
    currencyId: '' as string | number, exchangeRateSnapshot: 1.0
  })

  const [search, setSearch] = useState('')
  const [recurringFilter, setRecurringFilter] = useState<RecurringFilter>(() => {
    const rf = (location.state as any)?.recurringFilter as string | undefined
    return (rf === 'recurring' || rf === 'non-recurring') ? rf : 'all'
  })
  const [showRecurringMenu, setShowRecurringMenu] = useState(false)
  const recurringBtnRef = useRef<HTMLButtonElement>(null)
  const recurringDropRef = useRef<HTMLDivElement>(null)

  // Categories, tags & stores
  const [categories, setCategories] = useState<Category[]>([])
  const [allTags, setAllTags] = useState<TagData[]>([])
  const [stores, setStores] = useState<{ id: number; name: string; color: string }[]>([])

  // Category & tag filters
  const [filterCategories, setFilterCategories] = useState<number[]>([])
  const [showCatFilter, setShowCatFilter] = useState(false)
  const catFilterRef = useRef<HTMLButtonElement>(null)
  const catDropRef = useRef<HTMLDivElement>(null)
  const [filterTags, setFilterTags] = useState<number[]>([])
  const [showTagFilter, setShowTagFilter] = useState(false)
  const tagFilterRef = useRef<HTMLButtonElement>(null)
  const tagDropRef = useRef<HTMLDivElement>(null)

  // Month value edit modal
  type IncomeSortMode = 'az' | 'za' | 'value-desc' | 'value-asc' | 'newest' | 'oldest' | 'due-day-asc' | 'due-day-desc'
  const [sortMode, setSortMode] = useState<IncomeSortMode>('az')
  const [showSortMenu, setShowSortMenu] = useState(false)
  const sortBtnRef = useRef<HTMLButtonElement>(null)
  const sortDropRef = useRef<HTMLDivElement>(null)

  const [incomeTab, setIncomeTab] = useState<'detalhes' | 'interrupcoes' | 'classificacao'>('detalhes')
  const [modalScrollFade, setModalScrollFade] = useState({ top: false, bottom: false })
  const modalScrollRef = useRef<HTMLDivElement>(null)
  const [showValueEdit, setShowValueEdit] = useState(false)
  const [valueEditTarget, setValueEditTarget] = useState<Income | null>(null)
  const [monthValue, setMonthValue] = useState(0)

  // Tag creation modal
  const [showTagCreate, setShowTagCreate] = useState(false)
  const [tagCreateName, setTagCreateName] = useState('')
  const [tagCreateColor, setTagCreateColor] = useState(PRESET_COLORS[0])
  const [showTagColorPicker, setShowTagColorPicker] = useState(false)

  // Interrupt state
  const [interruptItem, setInterruptItem] = useState<Income | null>(null)
  const [interruptMode, setInterruptMode] = useState<'permanent' | 'temporary'>('temporary')
  const [interruptMonths, setInterruptMonths] = useState('2')

  const load = async () => {
    if (!activePerson) { setIncomes([]); return }
    const [data, cats, tgs, strs] = await Promise.all([
      window.api.personIncome.listByMonth(activePerson.id, month),
      window.api.categories.list(),
      window.api.tags.list(),
      window.api.stores.list()
    ])
    setIncomes(data)
    setCategories(cats)
    setAllTags(tgs)
    setStores(strs)
  }

  useEffect(() => { load() }, [activePerson, month])
  useEffect(() => { if (showForm) setIncomeTab('detalhes') }, [showForm])

  const handleModalScroll = () => {
    const el = modalScrollRef.current
    if (!el) return
    setModalScrollFade({
      top: el.scrollTop > 8,
      bottom: el.scrollTop + el.clientHeight < el.scrollHeight - 8
    })
  }

  useEffect(() => {
    if (showForm) requestAnimationFrame(handleModalScroll)
  }, [showForm, incomeTab])

  // Apply category filter from navigation state
  useEffect(() => {
    const state = location.state as any
    if (!state) return
    const catName = state.categoryName as string | undefined
    if (catName && categories.length > 0) {
      if (catName === '__no_category__') {
        setFilterCategories([-1])
      } else {
        const cat = categories.find(c => c.name === catName)
        if (cat) setFilterCategories([cat.id])
      }
      window.history.replaceState({}, '')
    }
    if (state.recurringFilter) {
      window.history.replaceState({}, '')
    }
  }, [location.state, categories])

  const { requestDelete, isPending: isDeletePending } = useUndoableDelete({
    onDelete: async (id) => { await window.api.personIncome.delete(id); load() },
    toastLabel: t('income.incomeDeleted')
  })

  // Filter by search, recurring, category, and tags
  const filteredIncomes = incomes.filter(inc => {
    if (isDeletePending(inc.id)) return false
    if (search && !inc.description.toLowerCase().includes(search.toLowerCase())) return false
    if (recurringFilter === 'recurring' && !inc.isRecurring) return false
    if (recurringFilter === 'non-recurring' && inc.isRecurring) return false
    if (filterCategories.length > 0) {
      const none = filterCategories.includes(-1)
      const ids = filterCategories.filter(x => x !== -1)
      const match = (none && !inc.categoryId) || (ids.length > 0 && inc.categoryId && ids.includes(inc.categoryId))
      if (!match) return false
    }
    if (filterTags.length > 0) {
      const none = filterTags.includes(-1)
      const ids = filterTags.filter(x => x !== -1)
      const match = (none && (!inc.tags || inc.tags.length === 0)) || (ids.length > 0 && inc.tags && inc.tags.some(t => ids.includes(t.id)))
      if (!match) return false
    }
    return true
  })

  const total = filteredIncomes.reduce((s, i) => s + i.effectiveValue * (i.exchangeRateSnapshot || 1.0), 0)
  const receivedCount = filteredIncomes.filter(i => i.isReceived).length

  const sortedIncomes = [...filteredIncomes].sort((a, b) => {
    switch (sortMode) {
      case 'az': return a.description.localeCompare(b.description)
      case 'za': return b.description.localeCompare(a.description)
      case 'value-desc': return b.effectiveValue - a.effectiveValue
      case 'value-asc': return a.effectiveValue - b.effectiveValue
      case 'newest': return (b.createdAt || '').localeCompare(a.createdAt || '')
      case 'oldest': return (a.createdAt || '').localeCompare(b.createdAt || '')
      case 'due-day-asc': return (a.dueDay ?? 99) - (b.dueDay ?? 99)
      case 'due-day-desc': return (b.dueDay ?? 0) - (a.dueDay ?? 0)
      default: return 0
    }
  })

  const csvColumns: CsvColumn<Income>[] = [
    { id: 'description', label: t('csvExport.columns.description'), value: i => i.description },
    { id: 'type', label: t('csvExport.columns.type'), value: i => i.isRecurring ? t('income.recurring') : t('income.nonRecurring') },
    { id: 'monthValue', label: t('csvExport.columns.monthValue'), value: i => formatCurrency(i.effectiveValue * (i.exchangeRateSnapshot || 1.0)) },
    { id: 'baseValue', label: t('csvExport.columns.baseValue'), value: i => formatCurrency(i.value * (i.exchangeRateSnapshot || 1.0)) },
    { id: 'category', label: t('csvExport.columns.category'), value: i => i.categoryName || '' },
    { id: 'tags', label: t('csvExport.columns.tags'), value: i => i.tags?.map(tag => tag.name).join(', ') || '' },
    { id: 'store', label: t('csvExport.columns.store'), value: i => i.storeName || '' },
    { id: 'receivingDay', label: t('csvExport.columns.receivingDay'), value: i => i.dueDay ?? '' },
    { id: 'startMonth', label: t('csvExport.columns.startMonth'), value: i => fmtMonth(i.startMonth) },
    { id: 'endMonth', label: t('csvExport.columns.endMonth'), value: i => i.endMonth ? fmtMonth(i.endMonth) : '' },
    { id: 'status', label: t('csvExport.columns.status'), value: i => i.isReceived ? t('items.received') : t('items.notReceived') },
    { id: 'receivedAt', label: t('csvExport.columns.receivedAt'), value: i => i.receivedAt ? fmtDate(i.receivedAt) : '' },
    { id: 'currency', label: t('csvExport.columns.currency'), value: i => i.currencyCode || '' },
    { id: 'notes', label: t('csvExport.columns.notes'), value: i => i.notes || '' }
  ]

  const openCreate = () => {
    setEditing(null)
    setForm({ description: '', value: 0, isRecurring: false, startMonth: month, endMonth: '', categoryId: '', tagIds: [], isReceived: false, receivedAt: '', dueDay: '', dueDayType: '', notes: '', storeId: '', currencyId: '', exchangeRateSnapshot: 1.0 })
    setShowForm(true)
  }

  const openEdit = (inc: Income) => {
    setEditing(inc)
    setForm({
      description: inc.description, value: inc.value,
      isRecurring: inc.isRecurring, startMonth: inc.startMonth,
      endMonth: inc.endMonth || '',
      categoryId: inc.categoryId || '',
      tagIds: inc.tags?.map(t => t.id) || [],
      isReceived: inc.isReceived,
      receivedAt: inc.receivedAt || '',
      dueDay: inc.dueDay?.toString() || '',
      dueDayType: (inc.dueDayType === 'static' || !inc.dueDayType) && inc.dueDay == null ? '' : (inc.dueDayType || ''),
      notes: inc.notes || '', storeId: inc.storeId || '',
      currencyId: inc.currencyId || '', exchangeRateSnapshot: inc.exchangeRateSnapshot ?? 1.0
    })
    setShowForm(true)
  }

  const openValueEdit = (inc: Income) => {
    setValueEditTarget(inc)
    setMonthValue(inc.effectiveValue)
    setShowValueEdit(true)
  }

  const handleSave = async () => {
    if (!form.description.trim()) { toast.error(t('common.descriptionRequired')); return }
    if (!form.startMonth) { toast.error(t('common.startMonthRequired')); return }
    if (!activePerson) return
    if (editing) {
      await window.api.personIncome.update({
        id: editing.id, description: form.description, value: form.value,
        isRecurring: form.isRecurring, startMonth: form.startMonth,
        endMonth: form.endMonth || null,
        categoryId: form.categoryId ? Number(form.categoryId) : null,
        tagIds: form.tagIds,
        dueDay: form.dueDay ? parseInt(form.dueDay) : null,
        dueDayType: form.dueDayType || 'static',
        notes: form.notes,
        storeId: form.storeId ? Number(form.storeId) : null,
        currencyId: form.currencyId ? Number(form.currencyId) : null,
        exchangeRateSnapshot: form.exchangeRateSnapshot ?? 1.0
      })
      const receivedChanged = form.isReceived !== editing.isReceived
      const dateChanged = form.receivedAt !== (editing.receivedAt || '')
      if (receivedChanged || dateChanged) {
        await window.api.personIncome.setReceived(editing.id, month, form.isReceived, form.receivedAt || undefined)
      }
      toast.success(t('income.incomeUpdated'))
    } else {
      const created = await window.api.personIncome.create({
        personId: activePerson.id, description: form.description, value: form.value,
        isRecurring: form.isRecurring, startMonth: form.startMonth,
        endMonth: form.endMonth || null,
        categoryId: form.categoryId ? Number(form.categoryId) : null,
        tagIds: form.tagIds,
        dueDay: form.dueDay ? parseInt(form.dueDay) : null,
        dueDayType: form.dueDayType || 'static',
        notes: form.notes,
        storeId: form.storeId ? Number(form.storeId) : null,
        currencyId: form.currencyId ? Number(form.currencyId) : null,
        exchangeRateSnapshot: form.exchangeRateSnapshot ?? 1.0
      })
      if (form.isReceived && created?.id) {
        await window.api.personIncome.setReceived(created.id, month, true, form.receivedAt || undefined)
      }
      toast.success(t('income.incomeAdded'))
    }
    setShowForm(false)
    load()
  }

  const toggleReceived = async (incomeId: number) => {
    await window.api.personIncome.toggleReceived(incomeId, month)
    load()
  }

  const handleSaveMonthValue = async () => {
    if (!valueEditTarget) return
    await window.api.personIncome.setMonthValue(valueEditTarget.id, month, monthValue)
    toast.success(t('items.valueUpdatedFromMonth'))
    setShowValueEdit(false)
    load()
  }

  const handleResetMonthValue = async () => {
    if (!valueEditTarget) return
    await window.api.personIncome.removeMonthValue(valueEditTarget.id, month)
    toast.success(t('items.valueRestoredToBase'))
    setShowValueEdit(false)
    load()
  }

  const handleInterrupt = async () => {
    if (!interruptItem) return
    const pauseMonths = interruptMode === 'temporary' ? interruptionMonthsCount : undefined
    await window.api.personIncome.interrupt(interruptItem.id, month, pauseMonths)
    toast.success(interruptMode === 'permanent' ? t('items.interrupted') : t('items.pausedUntil', { month: String(pauseMonths) }))
    setInterruptItem(null)
    load()
  }

  const handleReactivate = async (interruptionId: number) => {
    await window.api.personIncome.reactivate(interruptionId)
    toast.success(t('items.interruptionUndone'))
    load()
  }

  const toggleTag = (tagId: number) => {
    setForm(f => ({
      ...f,
      tagIds: f.tagIds.includes(tagId)
        ? f.tagIds.filter(id => id !== tagId)
        : [...f.tagIds, tagId]
    }))
  }

  const formatMonth = (m: string) => fmtMonth(m)

  const addMonthsForInterruption = (baseMonth: string, count: number) => {
    const [year, monthNumber] = baseMonth.split('-').map(Number)
    const total = year * 12 + monthNumber - 1 + count
    const nextYear = Math.floor(total / 12)
    const nextMonth = (total % 12) + 1
    return `${nextYear}-${String(nextMonth).padStart(2, '0')}`
  }

  const interruptionMonthsCount = Math.max(1, parseInt(interruptMonths) || 1)
  const interruptionPreview = (() => {
    const pausedUntil = addMonthsForInterruption(month, interruptionMonthsCount)
    const resumeMonth = addMonthsForInterruption(month, interruptionMonthsCount + 1)
    return t('items.interruptionPreview', {
      count: String(interruptionMonthsCount),
      startMonth: fmtMonth(month),
      endMonth: fmtMonth(pausedUntil),
      resumeMonth: fmtMonth(resumeMonth)
    })
  })()

  if (!activePerson) {
    return (
      <div className="space-y-6">
        <Card className="p-5">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10">
              <HandCoins size={20} className="text-primary" />
            </div>
            <h1 className="text-xl font-bold">{t('income.title')}</h1>
          </div>
        </Card>
        <Card className="p-8 text-center">
          <Users size={48} className="mx-auto text-muted-foreground/30 mb-3" />
          <p className="text-muted-foreground mb-4">{t('items.selectProfileToSee')}</p>
          <Button onClick={() => navigate(ROUTES.PEOPLE)}>{t('people.createPerson')}</Button>
        </Card>
      </div>
    )
  }

  return (
    <SectionLayout
      icon={HandCoins}
      title={t('income.title')}
      monthNav={<MonthNavigator month={month} onChange={setMonth} />}
      actionButton={<Button size="sm" onClick={openCreate}><Plus size={16} /> {t('income.newIncome')}</Button>}
      controls={
        <>
          <SearchInput value={search} onChange={setSearch} />
          <FilterGroup
            activeCount={(recurringFilter !== 'all' ? 1 : 0) + (filterCategories.length > 0 ? 1 : 0) + (filterTags.length > 0 ? 1 : 0)}
            onClear={() => { setRecurringFilter('all'); setFilterCategories([]); setFilterTags([]) }}
            primaryCount={1}
          >
            <div className="relative">
              <button ref={recurringBtnRef} type="button" title={t('income.recurring')}
                onClick={() => setShowRecurringMenu(f => !f)}
                className="inline-flex items-center gap-1.5 h-7 px-2.5 text-xs font-medium rounded-md border border-input hover:bg-accent transition-colors">
                {recurringFilter === 'all' ? t('filters.allRecurring') : recurringFilter === 'recurring' ? t('filters.recurringOnly') : t('filters.nonRecurringOnly')}
                <ChevronDown size={12} className="text-muted-foreground" />
              </button>
              {showRecurringMenu && (
                <SimpleDropdown
                  anchorRef={recurringBtnRef}
                  dropRef={recurringDropRef}
                  options={[
                    { key: 'all', label: t('filters.allRecurring') },
                    { key: 'recurring', label: t('filters.recurringOnly') },
                    { key: 'non-recurring', label: t('filters.nonRecurringOnly') }
                  ]}
                  current={recurringFilter}
                  onChange={v => { setRecurringFilter(v as RecurringFilter); setShowRecurringMenu(false) }}
                  onClose={() => setShowRecurringMenu(false)}
                />
              )}
            </div>

            <div className="relative">
              <button ref={catFilterRef} type="button" title={t('categories.title')}
                onClick={() => { setShowCatFilter(f => !f); setShowTagFilter(false) }}
                className={`inline-flex items-center gap-1.5 h-7 px-2.5 text-xs font-medium rounded-md border transition-colors ${
                  filterCategories.length > 0
                    ? 'bg-primary text-primary-foreground border-primary'
                    : 'bg-transparent text-foreground border-input hover:bg-accent'
                }`}>
                <Tags size={11} />
                <span data-filter-label>{t('categories.title')}</span>
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
                  items={[{ id: -1, name: t('categories.noCategory'), color: '#6b7280' }, ...categories.map(c => ({ id: c.id, name: c.name, color: c.color }))]}
                  selected={filterCategories}
                  onToggle={id => setFilterCategories(f => f.includes(id) ? f.filter(x => x !== id) : [...f, id])}
                  emptyText={t('categories.noCategories')}
                />
              )}
            </div>

            <div className="relative">
              <button ref={tagFilterRef} type="button" title={t('tags.title')}
                onClick={() => { setShowTagFilter(f => !f); setShowCatFilter(false) }}
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
                  items={[{ id: -1, name: t('tags.noTag'), color: '#6b7280' }, ...allTags.map(tg => ({ id: tg.id, name: tg.name, color: tg.color }))]}
                  selected={filterTags}
                  onToggle={id => setFilterTags(f => f.includes(id) ? f.filter(x => x !== id) : [...f, id])}
                  emptyText={t('tags.noTags')}
                />
              )}
            </div>
          </FilterGroup>

          <div className="h-6 w-px bg-border shrink-0 ml-auto" />
          {pickerButton}
          <TileFieldsPickerButton page="income" showGastos={false} />
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
              {{ 'az': t('sort.azAsc'), 'za': t('sort.azDesc'), 'value-desc': t('sort.valueDesc'), 'value-asc': t('sort.valueAsc'), 'newest': t('sort.newest'), 'oldest': t('sort.oldest'), 'due-day-asc': t('sort.dueDayAsc'), 'due-day-desc': t('sort.dueDayDesc') }[sortMode]}
              <ChevronDown size={12} className="text-muted-foreground" />
            </button>
            {showSortMenu && (
              <SimpleDropdown anchorRef={sortBtnRef} dropRef={sortDropRef}
                options={[
                  { key: 'az', label: t('sort.azAsc') },
                  { key: 'za', label: t('sort.azDesc') },
                  { key: 'value-desc', label: t('sort.valueDesc') },
                  { key: 'value-asc', label: t('sort.valueAsc') },
                  { key: 'newest', label: t('sort.newest') },
                  { key: 'oldest', label: t('sort.oldest') },
                  { key: 'due-day-asc', label: t('sort.dueDayAsc') },
                  { key: 'due-day-desc', label: t('sort.dueDayDesc') }
                ]}
                current={sortMode} onChange={v => { setSortMode(v as IncomeSortMode); setShowSortMenu(false) }} onClose={() => setShowSortMenu(false)} />
            )}
          </div>
        </>
      }
      stats={[
        { label: t('items.total'), value: formatCurrency(total), style: receitasStyle('income', 'hero') },
        { label: t('income.title'), value: `${filteredIncomes.length} total · ${receivedCount} ${t('items.received').toLowerCase()}` }
      ]}
    >
      {/* Income tiles */}
      {filteredIncomes.length === 0 ? (
        <Card className="p-8 text-center">
          <HandCoins size={48} className="mx-auto text-muted-foreground/30 mb-3" />
          <p className="text-muted-foreground">{t('items.noItemsThisMonth')}</p>
          <Button size="sm" className="mt-4" onClick={openCreate}><Plus size={16} /> {t('income.newIncome')}</Button>
        </Card>
      ) : (
        <div className={`grid ${gridClass} gap-4`}>
          {sortedIncomes.map(inc => {
            const kebabItems: any[] = [
              { label: t('income.editIncome'), icon: Pencil, onClick: () => openEdit(inc) },
              { label: t('items.editValueThisMonth'), icon: DollarSign, onClick: () => openValueEdit(inc) },
            ]
            if (inc.isReceived) {
              kebabItems.push({ label: t('items.undoReceipt'), icon: CheckCircle, onClick: () => toggleReceived(inc.id) })
            }
            if (inc.isRecurring && inc.interruptions && inc.interruptions.length > 0) {
              kebabItems.push({ label: t('items.viewInterruptions'), icon: Repeat, onClick: () => openEdit(inc) })
            }
            if (inc.isRecurring && !(inc.interruptions?.some(i => !i.resumeMonth))) {
              kebabItems.push({ label: t('items.interrupt'), icon: X, onClick: () => { setInterruptMode('temporary'); setInterruptMonths('2'); setInterruptItem(inc) } })
            }
            kebabItems.push({ label: t('common.delete'), icon: Trash2, onClick: () => requestDelete(inc.id), destructive: true })

            const [mY, mM] = month.split('-').map(Number)
            const metaItems: { icon: any; text: string }[] = []
            if (receitasFields.type) metaItems.push({ icon: inc.isRecurring ? Repeat : CircleDot, text: inc.isRecurring ? t('income.recurring') : t('income.nonRecurring') })
            if (receitasFields.dueDay) {
              const dueDayText = formatDayLabelResolved(inc.dueDay ?? null, inc.dueDayType || null, t('income.receivingDay'), mY, mM, businessDayConfig)
              if (dueDayText) metaItems.push({ icon: CalendarClock, text: dueDayText })
            }

            return (
              <Card
                key={inc.id}
                className={`group relative overflow-hidden transition-all flex flex-col ${inc.isReceived && dimPaid ? 'opacity-50 hover:opacity-100' : 'hover:shadow-md'}`}
              >
                {/* Hover: undo received */}
                {dimPaid && inc.isReceived && (
                  <div className="absolute inset-0 z-20 flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity bg-card/50 backdrop-blur-[1px]">
                    <button
                      onClick={() => openEdit(inc)}
                      className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-accent text-foreground text-sm font-semibold shadow-md hover:bg-accent/80 transition-colors"
                    >
                      <Pencil size={14} /> {t('common.edit')}
                    </button>
                    <button
                      onClick={() => toggleReceived(inc.id)}
                      className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-semibold shadow-md hover:bg-primary/90 transition-colors"
                    >
                      {t('items.undoReceipt')}
                    </button>
                  </div>
                )}

                {/* Top bar */}
                <div className="flex items-center gap-2.5 px-4 py-2.5 border-b border-border/50">
                  <button onClick={() => toggleReceived(inc.id)} className="shrink-0" title={inc.isReceived ? t('items.markNotReceived') : t('items.markReceived')}>
                    {inc.isReceived
                      ? <CheckCircle size={18} className="text-primary" />
                      : <Circle size={18} className="text-muted-foreground/40 hover:text-primary transition-colors" />}
                  </button>
                  <p className="text-base font-bold truncate flex-1 min-w-0">
                    {inc.description}
                    {inc.categoryName && (
                      <span className="text-[11px] font-normal text-muted-foreground ml-1.5">· {inc.categoryName}</span>
                    )}
                  </p>
                  {inc.tags && inc.tags.length > 0 && (
                    <div className="flex items-center gap-1 overflow-hidden">
                      {inc.tags.map(tag => (
                        <span key={tag.id} className="text-[11px] px-2 py-0.5 rounded-full font-medium whitespace-nowrap" style={{ backgroundColor: `${tag.color}20`, color: tag.color }}>{tag.name}</span>
                      ))}
                    </div>
                  )}
                  {inc.interruptions && inc.interruptions.length > 0 && (() => {
                    const activeInt = inc.interruptions.find(i => {
                      if (i.resumeMonth) {
                        return month >= i.endMonth && month < i.resumeMonth
                      }
                      return month >= i.endMonth
                    })
                    const lastVisibleInt = !activeInt ? inc.interruptions.find(i => i.endMonth === month) : null
                    const displayInt = activeInt || lastVisibleInt
                    if (!displayInt) return null
                    return (
                      <span className="text-[10px] px-2 py-0.5 rounded-full font-bold whitespace-nowrap bg-yellow-500/15 text-yellow-500 border border-yellow-500/30">
                        {displayInt.resumeMonth ? t('items.pausedUntil', { month: fmtMonth(displayInt.resumeMonth) }) : t('items.interrupted')}
                      </span>
                    )
                  })()}
                  {inc.isReceived && (
                    <span className="flex items-center gap-1 px-2 py-0.5 rounded-full whitespace-nowrap shrink-0" style={{ backgroundColor: 'color-mix(in srgb, #22c55e 15%, transparent)', borderWidth: '1px', borderColor: 'color-mix(in srgb, #22c55e 30%, transparent)' }}>
                      <CheckCircle size={11} style={{ color: '#22c55e' }} />
                      <span className="text-[10px] font-semibold" style={{ color: '#22c55e' }}>{inc.receivedAt ? t('items.receivedAt', { date: fmtDate(inc.receivedAt) }) : t('items.received')}</span>
                    </span>
                  )}
                  <KebabMenu items={kebabItems} size={16} />
                </div>

                {/* Body */}
                <div className="flex-1 p-4">
                  <div className="flex items-baseline gap-2 mb-1">
                    {inc.currencySymbol && inc.exchangeRateSnapshot && inc.exchangeRateSnapshot !== 1.0 ? (
                      <CurrencyTooltip label={formatCurrency(inc.effectiveValue * (inc.exchangeRateSnapshot || 1.0))}>
                        <span className="text-2xl font-bold tabular-nums" style={receitasStyle('income', 'itens')}>
                          {formatCurrencyWith(inc.effectiveValue, inc.currencySymbol)}
                        </span>
                      </CurrencyTooltip>
                    ) : (
                      <span className="text-2xl font-bold tabular-nums" style={receitasStyle('income', 'itens')}>
                        {formatCurrency(inc.effectiveValue)}
                      </span>
                    )}
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
          })}
        </div>
      )}

      <CsvExportModal
        open={showCsvExport}
        onClose={() => setShowCsvExport(false)}
        settingsKey="income-csv-export-columns"
        filename={`moneycapy-receitas-${month}.csv`}
        rows={sortedIncomes}
        columns={csvColumns}
      />

      {/* Create/Edit Modal */}
      <Modal open={showForm} onClose={() => setShowForm(false)} title={editing ? t('income.editIncome') : t('income.newIncome')} maxWidth="max-w-xl">
        <div className="flex flex-col overflow-hidden" style={{ maxHeight: '70vh' }}>
          {/* Tab bar */}
          <div className="flex gap-4 -mx-6 px-6 pb-3 mb-4 border-b border-border shrink-0">
            {([
              { key: 'detalhes' as const, label: t('itemsForm.tabDetails') },
              ...(editing ? [{ key: 'interrupcoes' as const, label: t('itemsForm.tabInterruptions') }] : []),
              { key: 'classificacao' as const, label: t('itemsForm.tabClassification') }
            ]).map(tab => (
              <button key={tab.key} type="button" onClick={() => setIncomeTab(tab.key)}
                className={`text-sm font-medium pb-1 border-b-2 transition-colors ${
                  incomeTab === tab.key
                    ? 'border-primary text-primary'
                    : 'border-transparent text-muted-foreground hover:text-foreground'
                }`}>
                {tab.label}
              </button>
            ))}
          </div>

          {/* Scrollable content */}
          <div ref={modalScrollRef} onScroll={handleModalScroll} className="flex-1 min-h-0 overflow-y-auto -mr-6 pr-6">
            {/* Top fade */}
            <div className={`sticky top-0 -mb-6 h-6 z-10 pointer-events-none bg-gradient-to-b from-background to-transparent transition-opacity ${modalScrollFade.top ? 'opacity-100' : 'opacity-0'}`} />

            {incomeTab === 'detalhes' && (
              <div className="space-y-5">
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-foreground">{t('income.type')}</label>
                  <div className="flex rounded-lg border border-input p-0.5 bg-muted/30">
                    {[
                      { value: false, label: t('income.single') },
                      { value: true, label: t('income.recurring') }
                    ].map(opt => (
                      <button key={String(opt.value)} type="button" onClick={() => setForm({ ...form, isRecurring: opt.value })}
                        className={`flex-1 py-1.5 text-sm font-medium rounded-md transition-all ${
                          form.isRecurring === opt.value ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
                        }`}>
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Seção: Informações */}
                <div className="space-y-2">
                  <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{t('itemsForm.information')}</h4>
                  <div className="rounded-lg border border-border bg-card p-4 space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                      <Input label={t('itemsForm.description')} value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} placeholder={t('income.descriptionPlaceholder')} autoFocus />
                      <Select label={t('itemsForm.storeEntity')} value={String(form.storeId)} onChange={e => setForm({ ...form, storeId: e.target.value })} options={stores.map(s => ({ value: s.id, label: s.name }))} placeholder={t('itemsForm.nonePlaceholder')} />
                    </div>
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
                    <CurrencyInput label={t('itemsForm.value')} value={form.value} onChange={v => setForm({ ...form, value: v })}
                      symbol={(() => { const c = currencies.find(c => c.id === Number(form.currencyId)); return c?.symbol || baseCurrency?.symbol || undefined })()}
                    />
                  </div>
                </div>

                {/* Seção: Dia de recebimento */}
                <div className="space-y-2">
                  <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{t('income.receivingDay')}</h4>
                  <div className="rounded-lg border border-border bg-card p-4">
                    <DayPicker label={t('income.receivingDay')} day={form.dueDay} dayType={form.dueDayType}
                      onChange={(d, t) => setForm({ ...form, dueDay: d, dueDayType: t })} />
                  </div>
                </div>

                {/* Seção: Período */}
                <div className="space-y-2">
                  <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{t('itemsForm.period')}</h4>
                  <div className="rounded-lg border border-border bg-card p-4 space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                      <DatePicker mode="month" label={t('income.startMonth')} value={form.startMonth} onChange={v => setForm({ ...form, startMonth: v })} />
                      <DatePicker mode="month" label={t('income.endMonth')} value={form.endMonth} onChange={v => setForm({ ...form, endMonth: v })} />
                    </div>
                    <div className={`grid gap-3 items-end ${form.isReceived ? 'grid-cols-2' : 'grid-cols-1'}`}>
                      <div className="space-y-1.5">
                        <label className="text-sm font-medium text-foreground">{t('itemsForm.status')}</label>
                        <div className="flex h-9 rounded-lg border border-input p-0.5 bg-muted/30">
                          <button type="button" onClick={() => setForm({ ...form, isReceived: false, receivedAt: '' })}
                            className={`flex-1 text-sm font-medium rounded-md transition-all ${
                              !form.isReceived ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
                            }`}>
                            {t('items.markNotReceived')}
                          </button>
                          <button type="button" onClick={() => setForm({ ...form, isReceived: true, receivedAt: form.receivedAt || new Date().toISOString().substring(0, 10) })}
                            className={`flex-1 text-sm font-medium rounded-md transition-all ${
                              form.isReceived ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
                            }`}>
                            {t('items.received')}
                          </button>
                        </div>
                      </div>
                      {form.isReceived && (
                        <DatePicker mode="date" label={t('income.receivedDate')} value={form.receivedAt}
                          onChange={v => setForm({ ...form, receivedAt: v })} />
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {incomeTab === 'interrupcoes' && editing && (
              <div className="space-y-4">
                {!editing.isRecurring && (
                  <div className="rounded-lg border border-border bg-card p-4 text-sm text-muted-foreground">
                    {t('income.interruptionsUnavailable')}
                  </div>
                )}
                {editing.isRecurring && (
                  <div className="rounded-lg border border-border bg-card p-4 space-y-3">
                    {editing.interruptions && editing.interruptions.length > 0 ? (
                      editing.interruptions.map(int => (
                        <div key={int.id} className="flex items-center justify-between gap-3 text-sm">
                          <span>
                            {int.resumeMonth
                              ? t('itemsForm.pausedAt', { startMonth: fmtMonth(int.endMonth), resumeMonth: fmtMonth(int.resumeMonth) })
                              : t('itemsForm.interruptedPermanently', { endMonth: fmtMonth(int.endMonth) })}
                          </span>
                          <Button size="sm" variant="outline" onClick={() => { handleReactivate(int.id); setShowForm(false) }}>
                            <Undo2 size={12} /> {t('common.undo')}
                          </Button>
                        </div>
                      ))
                    ) : (
                      <p className="text-sm text-muted-foreground">{t('itemsForm.noInterruptions')}</p>
                    )}
                    {!(editing.interruptions?.some(i => !i.resumeMonth)) && (
                      <Button size="sm" variant="outline" onClick={() => { setShowForm(false); setInterruptMode('temporary'); setInterruptMonths('2'); setTimeout(() => setInterruptItem(editing), 50) }}>
                        <X size={14} /> {t('itemsForm.interrupt')}
                      </Button>
                    )}
                  </div>
                )}
              </div>
            )}

            {incomeTab === 'classificacao' && (
              <div className="space-y-5">
                {/* Seção: Categoria */}
                <div className="space-y-2">
                  <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{t('itemsForm.category')}</h4>
                  <div className="rounded-lg border border-border bg-card p-4">
                    <Select
                      label={t('itemsForm.category')}
                      value={String(form.categoryId)}
                      onChange={e => setForm({ ...form, categoryId: e.target.value })}
                      options={categories.map(c => ({ value: c.id, label: c.name }))}
                      placeholder={t('itemsForm.noCategoryPlaceholder')}
                    />
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
                        onClick={() => { setTagCreateName(''); setTagCreateColor(PRESET_COLORS[0]); setShowTagCreate(true) }}
                        className="text-xs px-2.5 py-1 rounded-full font-medium transition-all border border-dashed border-muted-foreground/30 text-muted-foreground hover:text-foreground hover:border-foreground/30"
                      >
                        {t('itemsForm.newTag')}
                      </button>
                    </div>
                  </div>
                </div>

                {/* Seção: Observações */}
                <div className="space-y-2">
                  <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{t('itemsForm.notes')}</h4>
                  <div className="rounded-lg border border-border bg-card p-4">
                    <textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })}
                      className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      rows={2} placeholder={t('itemsForm.notesPlaceholder')} />
                  </div>
                </div>
              </div>
            )}

            {/* Bottom fade */}
            <div className={`sticky bottom-0 -mt-6 h-6 z-10 pointer-events-none bg-gradient-to-t from-background to-transparent transition-opacity ${modalScrollFade.bottom ? 'opacity-100' : 'opacity-0'}`} />
          </div>

          {/* Botões */}
          <div className="flex items-center justify-end gap-2 pt-3 border-t border-border shrink-0">
            <Button variant="outline" onClick={() => setShowForm(false)}>{t('common.cancel')}</Button>
            <Button onClick={handleSave}>{editing ? t('common.save') : t('common.create')}</Button>
          </div>
        </div>
      </Modal>

      {/* Month Value Edit Modal */}
      <Modal open={showValueEdit} onClose={() => setShowValueEdit(false)} title={t('income.changeValueFrom', { month: formatMonth(month) })}>
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            {t('income.newValueAppliedFrom', { month: formatMonth(month) })}
          </p>
          <CurrencyInput label={t('income.newValue')} value={monthValue} onChange={setMonthValue} autoFocus />
          <div className="flex justify-between pt-2">
            <div>
              {valueEditTarget?.hasOverride && (
                <Button variant="ghost" size="sm" onClick={handleResetMonthValue}>
                  {t('income.restoreOriginalValue')}
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

      {/* Tag creation modal */}
      <Modal open={showTagCreate} onClose={() => setShowTagCreate(false)} title={t('itemsForm.newTagModal')} maxWidth="max-w-sm">
        <div className="space-y-4">
          <Input label={t('common.name')} value={tagCreateName} onChange={e => setTagCreateName(e.target.value)} placeholder={t('itemsForm.tagPlaceholder')} autoFocus />
          <div className="space-y-1">
            <label className="text-sm font-medium text-foreground">{t('common.color')}</label>
            <div className="flex flex-wrap gap-2">
              {PRESET_COLORS.map(c => (
                <button key={c} type="button" onClick={() => setTagCreateColor(c)}
                  className={`h-7 w-7 rounded-full transition-all ${tagCreateColor === c ? 'ring-2 ring-offset-2 ring-offset-card ring-primary scale-110' : 'hover:scale-105'}`}
                  style={{ backgroundColor: c }} />
              ))}
              <button type="button" onClick={() => setShowTagColorPicker(true)}
                className={`h-7 w-7 rounded-full border-2 border-dashed border-border hover:border-primary flex items-center justify-center transition-all hover:scale-105 ${!PRESET_COLORS.includes(tagCreateColor) ? 'ring-2 ring-offset-2 ring-offset-card ring-primary scale-110' : ''}`}
                style={!PRESET_COLORS.includes(tagCreateColor) ? { backgroundColor: tagCreateColor } : undefined} title={t('common.customColor')}>
                {PRESET_COLORS.includes(tagCreateColor) && <Palette size={12} className="text-muted-foreground" />}
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

      {/* Interrupt modal */}
      <Modal open={!!interruptItem} onClose={() => setInterruptItem(null)} title={t('income.interruptIncome')} maxWidth="max-w-sm">
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            {t('income.interruptFrom', { name: interruptItem?.description || '', month: formatMonth(month) })}
          </p>
          <div className="flex rounded-lg border border-input p-0.5 bg-muted/30">
            <button type="button" onClick={() => setInterruptMode('temporary')}
              className={`flex-1 py-1.5 text-sm font-medium rounded-md transition-all ${
                interruptMode === 'temporary' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
              }`}>
              {t('items.interruptedForOption')}
            </button>
            <button type="button" onClick={() => setInterruptMode('permanent')}
              className={`flex-1 py-1.5 text-sm font-medium rounded-md transition-all ${
                interruptMode === 'permanent' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
              }`}>
              {t('items.interruptedPermanentlyOption')}
            </button>
          </div>
          {interruptMode === 'temporary' && (
            <div className="space-y-2">
              <Input label={t('items.interruptionMonths')} type="number" min={1} value={interruptMonths}
                onChange={e => setInterruptMonths(e.target.value)} />
              <p className="text-xs text-muted-foreground">{interruptionPreview}</p>
            </div>
          )}
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setInterruptItem(null)}>{t('common.cancel')}</Button>
            <Button onClick={handleInterrupt}>{t('income.interrupt')}</Button>
          </div>
        </div>
      </Modal>

    </SectionLayout>
  )
}
