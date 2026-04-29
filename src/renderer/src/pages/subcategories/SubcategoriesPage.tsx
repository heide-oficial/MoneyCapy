import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { CheckCircle, ChevronDown, ChevronRight, Circle, Filter, HandCoins, ListTree, Pencil, Plus, Receipt, Tags, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { ColorPicker } from '../../components/ui/ColorPicker'
import { FilterDropdown } from '../../components/ui/FilterDropdown'
import { FilterGroup } from '../../components/ui/FilterGroup'
import { Input } from '../../components/ui/Input'
import { KebabMenu } from '../../components/ui/KebabMenu'
import { Modal } from '../../components/ui/Modal'
import { MonthNavigator } from '../../components/ui/MonthNavigator'
import { SearchInput } from '../../components/ui/SearchInput'
import { SectionLayout } from '../../components/layout/SectionLayout'
import { SimpleDropdown } from '../../components/ui/SimpleDropdown'
import { useColumnsPicker } from '../../components/ui/ColumnsPickerDropdown'
import { formatCurrency } from '../../lib/currency'
import { PRESET_COLORS } from '../../lib/constants'
import { usePageMonth } from '../../contexts/DefaultMonthContext'
import { useActivePerson } from '../../contexts/ActivePersonContext'
import { useColorMode } from '../../contexts/ColorModeContext'
import { useColorSettings } from '../../contexts/ColorSettingsContext'
import { useDimPaid } from '../../contexts/DimPaidContext'
import { useTranslation } from '../../contexts/LanguageContext'
import { useUndoableDelete } from '../../hooks/useUndoableDelete'
import type { IncomeRecord, SectionItem } from '../../types/entities'

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

export default function SubcategoriesPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { activePerson } = useActivePerson()
  const { month, setMonth } = usePageMonth()
  const { resolveEntityColor } = useColorMode()
  const { gastosStyle, receitasStyle } = useColorSettings()
  const { dimPaid } = useDimPaid()
  const { columns, gridClass, pickerButton } = useColumnsPicker('item-columns')

  const [categories, setCategories] = useState<Category[]>([])
  const [subcategories, setSubcategories] = useState<Subcategory[]>([])
  const [items, setItems] = useState<SectionItem[]>([])
  const [incomes, setIncomes] = useState<IncomeRecord[]>([])
  const [search, setSearch] = useState('')
  const [viewMode, setViewMode] = useState<ViewMode>('all')
  const [showViewMenu, setShowViewMenu] = useState(false)
  const viewBtnRef = useRef<HTMLButtonElement>(null)
  const viewDropRef = useRef<HTMLDivElement>(null)

  const [filterCategoryKeys, setFilterCategoryKeys] = useState<string[]>([])
  const [showCategoryFilter, setShowCategoryFilter] = useState(false)
  const categoryFilterRef = useRef<HTMLButtonElement>(null)
  const categoryDropRef = useRef<HTMLDivElement>(null)
  const [filterSubcategoryKeys, setFilterSubcategoryKeys] = useState<string[]>([])
  const [showSubcategoryFilter, setShowSubcategoryFilter] = useState(false)
  const subcategoryFilterRef = useRef<HTMLButtonElement>(null)
  const subcategoryDropRef = useRef<HTMLDivElement>(null)
  const [hideEmpty, setHideEmpty] = useState(false)
  const [expandedGroups, setExpandedGroups] = useState<Set<number | 'none'>>(new Set())

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
    const [its, incs] = await Promise.all([
      window.api.items.list(activePerson.id, month),
      window.api.personIncome.listByMonth(activePerson.id, month)
    ])
    setItems(its)
    setIncomes(incs)
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

  const toggleCategory = (categoryId: number) => {
    setCategoryIds(ids => ids.includes(categoryId) ? ids.filter(id => id !== categoryId) : [...ids, categoryId])
  }

  const filterItem = (item: SectionItem) => {
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
    return true
  }

  const filterIncome = (income: IncomeRecord) => {
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
    return true
  }

  const searchLower = search.trim().toLowerCase()
  const groups = (() => {
    const mapped = subcategories.map((subcat, index) => {
      const nameMatches = searchLower && subcat.name.toLowerCase().includes(searchLower)
      const groupItems = viewMode === 'receitas' ? [] : items.filter(item => item.subcategoryId === subcat.id).filter(filterItem)
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
    const noneItems = viewMode === 'receitas' ? [] : items.filter(item => !item.subcategoryId).filter(filterItem)
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
  const expenseTotal = allFilteredItems.filter(item => item.isActive).reduce((sum, item) => {
    const rate = item.exchangeRateSnapshot || 1
    if ((item.type === 'installment' || item.type === 'emprestimo') && item.totalInstallments) {
      return sum + Math.round((item.value / item.totalInstallments) * 100) / 100 * rate
    }
    return sum + item.value * rate
  }, 0)
  const incomeTotal = allFilteredIncomes.reduce((sum, income) => sum + income.effectiveValue * (income.exchangeRateSnapshot || 1), 0)
  const hasActiveFilters = filterCategoryKeys.length > 0 || filterSubcategoryKeys.length > 0 || hideEmpty

  const stats = viewMode === 'gastos'
    ? [
        { label: hasActiveFilters ? t('items.totalActiveFiltered') : t('items.totalActive'), value: formatCurrency(expenseTotal), style: gastosStyle('subcategories', 'hero') },
        { label: t('items.title'), value: `${allFilteredItems.length} ${t('items.title').toLowerCase()}` }
      ]
    : viewMode === 'receitas'
      ? [
          { label: hasActiveFilters ? t('items.totalIncomeFiltered') : t('items.totalIncome'), value: formatCurrency(incomeTotal), style: receitasStyle('subcategories', 'hero') },
          { label: t('income.title'), value: `${allFilteredIncomes.length} ${t('income.title').toLowerCase()}` }
        ]
      : [
          { label: hasActiveFilters ? t('items.totalFiltered') : t('items.total'), value: <><span style={gastosStyle('subcategories', 'hero')}>{formatCurrency(expenseTotal)} {t('items.expensesLabel')}</span> · <span style={receitasStyle('subcategories', 'hero')}>{formatCurrency(incomeTotal)} {t('items.incomeLabel')}</span></> },
          { label: t('items.summaryLabel'), value: `${allFilteredItems.length} ${t('items.expensesLabel')} · ${allFilteredIncomes.length} ${t('items.incomeLabel')}` }
        ]

  const categoryFilterItems = [
    { id: 'none', name: t('categories.noCategory'), color: '#6b7280' },
    ...categories.map(category => ({ id: String(category.id), name: category.name, color: category.color }))
  ]
  const subcategoryFilterItems = [
    { id: 'none', name: t('itemsForm.noSubcategoryPlaceholder'), color: '#6b7280' },
    ...subcategories.map(subcat => ({ id: String(subcat.id), name: subcat.name, color: subcat.color }))
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
      monthNav={<MonthNavigator month={month} onChange={setMonth} />}
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
          <FilterGroup
            activeCount={(filterCategoryKeys.length > 0 ? 1 : 0) + (filterSubcategoryKeys.length > 0 ? 1 : 0) + (hideEmpty ? 1 : 0)}
            onClear={() => { setFilterCategoryKeys([]); setFilterSubcategoryKeys([]); setHideEmpty(false) }}
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
            <button type="button" title={t('categories.hideEmpty')} onClick={() => setHideEmpty(v => !v)}
              className={`inline-flex items-center gap-1.5 h-7 px-2.5 text-xs font-medium rounded-md border transition-colors ${hideEmpty ? 'bg-primary text-primary-foreground border-primary' : 'bg-transparent text-foreground border-input hover:bg-accent'}`}>
              <Filter size={11} />
              <span data-filter-label>{t('categories.hideEmpty')}</span>
            </button>
          </FilterGroup>
          <div className="h-6 w-px bg-border shrink-0 ml-auto" />
          {pickerButton}
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
                    {group.items.map(item => (
                      <Card key={`item-${item.id}`} className={`p-4 ${item.isPaid && dimPaid ? 'opacity-50' : ''}`}>
                        <div className="flex items-center gap-2">
                          {item.isPaid ? <CheckCircle size={16} className="text-primary" /> : <Circle size={16} className="text-muted-foreground/50" />}
                          <p className="text-sm font-semibold truncate flex-1">{item.description} - {item.categoryName || t('categories.noCategory')}/{item.subcategoryName || t('itemsForm.noSubcategoryPlaceholder')}</p>
                          <Button variant="ghost" size="sm" onClick={() => navigate('/items', { state: { editItemId: item.id } })}><Pencil size={14} /></Button>
                        </div>
                        <p className="mt-2 text-lg font-bold tabular-nums" style={gastosStyle('subcategories', 'itens')}>{formatCurrency(item.value * (item.exchangeRateSnapshot || 1))}</p>
                      </Card>
                    ))}
                    {group.incomes.map(income => (
                      <Card key={`income-${income.id}`} className={`p-4 ${income.isReceived && dimPaid ? 'opacity-50' : ''}`}>
                        <div className="flex items-center gap-2">
                          {income.isReceived ? <CheckCircle size={16} className="text-primary" /> : <Circle size={16} className="text-muted-foreground/50" />}
                          <p className="text-sm font-semibold truncate flex-1">{income.description} - {income.categoryName || t('categories.noCategory')}/{income.subcategoryName || t('itemsForm.noSubcategoryPlaceholder')}</p>
                          <Button variant="ghost" size="sm" onClick={() => navigate('/income', { state: { editIncomeId: income.id } })}><Pencil size={14} /></Button>
                        </div>
                        <p className="mt-2 text-lg font-bold tabular-nums" style={receitasStyle('subcategories', 'itens')}>{formatCurrency(income.effectiveValue * (income.exchangeRateSnapshot || 1))}</p>
                      </Card>
                    ))}
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
