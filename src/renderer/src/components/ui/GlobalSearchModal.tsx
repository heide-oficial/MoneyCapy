import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Search, X, CircleDot, Layers, Repeat, Landmark, Check,
  CreditCard, Store, Tags, Filter, ChevronDown, HandCoins,
  Receipt
} from 'lucide-react'
import { formatCurrency } from '../../lib/currency'
import { getItemCardLabels } from '../../lib/card-utils'
import { useFormatDate } from '../../lib/date'
import { getMonthlyIncomeValue } from '../../lib/monthly-finance'
import { useActivePerson } from '../../contexts/ActivePersonContext'
import { useTranslation } from '../../contexts/LanguageContext'
import { FilterDropdown } from './FilterDropdown'
import { SimpleDropdown } from './SimpleDropdown'
import type { SectionItem, IncomeRecord } from '../../types/entities'

interface GlobalSearchModalProps {
  open: boolean
  onClose: () => void
}

type SearchSource = 'gastos' | 'receitas'

const TYPE_ICONS: Record<string, typeof CircleDot> = {
  common: CircleDot, installment: Layers, subscription: Repeat, emprestimo: Landmark
}

interface FilterOption { id: number; name: string; color: string }
export function GlobalSearchModal({ open, onClose }: GlobalSearchModalProps) {
  const navigate = useNavigate()
  const { activePerson } = useActivePerson()
  const { fmtMonth } = useFormatDate()
  const { t } = useTranslation()

  const TYPE_LABELS: Record<string, string> = {
    common: t('itemTypes.common'), installment: t('itemTypes.installment'), subscription: t('itemTypes.subscription'), emprestimo: t('itemTypes.emprestimo')
  }

  const [query, setQuery] = useState('')
  const [selectedIndex, setSelectedIndex] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout>>()
  const resultsRef = useRef<HTMLDivElement>(null)

  // Source
  const [source, setSource] = useState<SearchSource>('gastos')
  const [showSourceMenu, setShowSourceMenu] = useState(false)
  const sourceBtnRef = useRef<HTMLButtonElement>(null)
  const sourceDropRef = useRef<HTMLDivElement>(null)

  // Results (union type)
  const [itemResults, setItemResults] = useState<SectionItem[]>([])
  const [incomeResults, setIncomeResults] = useState<IncomeRecord[]>([])


  // ─── Gastos filters ───
  const [filterType, setFilterType] = useState<string>('all')
  const [showTypeMenu, setShowTypeMenu] = useState(false)
  const typeBtnRef = useRef<HTMLButtonElement>(null)
  const typeDropRef = useRef<HTMLDivElement>(null)

  const [filterCategoryId, setFilterCategoryId] = useState<number | null>(null)
  const [showCatFilter, setShowCatFilter] = useState(false)
  const catBtnRef = useRef<HTMLButtonElement>(null)
  const catDropRef = useRef<HTMLDivElement>(null)

  const [filterTagId, setFilterTagId] = useState<number | null>(null)
  const [showTagFilter, setShowTagFilter] = useState(false)
  const tagBtnRef = useRef<HTMLButtonElement>(null)
  const tagDropRef = useRef<HTMLDivElement>(null)

  const [filterBankAccountId, setFilterBankAccountId] = useState<number | null>(null)
  const [showBankFilter, setShowBankFilter] = useState(false)
  const bankBtnRef = useRef<HTMLButtonElement>(null)
  const bankDropRef = useRef<HTMLDivElement>(null)

  const [filterCardId, setFilterCardId] = useState<number | null>(null)
  const [showCardFilter, setShowCardFilter] = useState(false)
  const cardBtnRef = useRef<HTMLButtonElement>(null)
  const cardDropRef = useRef<HTMLDivElement>(null)

  const [filterStoreId, setFilterStoreId] = useState<number | null>(null)
  const [showStoreFilter, setShowStoreFilter] = useState(false)
  const storeBtnRef = useRef<HTMLButtonElement>(null)
  const storeDropRef = useRef<HTMLDivElement>(null)

  const [filterActive, setFilterActive] = useState<string>('all')
  const [showActiveMenu, setShowActiveMenu] = useState(false)
  const activeBtnRef = useRef<HTMLButtonElement>(null)
  const activeDropRef = useRef<HTMLDivElement>(null)

  const [filterPaid, setFilterPaid] = useState<string>('all')
  const [showPaidMenu, setShowPaidMenu] = useState(false)
  const paidBtnRef = useRef<HTMLButtonElement>(null)
  const paidDropRef = useRef<HTMLDivElement>(null)

  const [filterPayMethod, setFilterPayMethod] = useState<string>('all')
  const [showPayMethodMenu, setShowPayMethodMenu] = useState(false)
  const payMethodBtnRef = useRef<HTMLButtonElement>(null)
  const payMethodDropRef = useRef<HTMLDivElement>(null)

  // ─── Receitas filters ───
  const [filterRecurring, setFilterRecurring] = useState<string>('all')
  const [showRecurringMenu, setShowRecurringMenu] = useState(false)
  const recurringBtnRef = useRef<HTMLButtonElement>(null)
  const recurringDropRef = useRef<HTMLDivElement>(null)

  // Filter data
  const [categories, setCategories] = useState<FilterOption[]>([])
  const [stores, setStores] = useState<FilterOption[]>([])
  const [cards, setCards] = useState<FilterOption[]>([])
  const [allTags, setAllTags] = useState<FilterOption[]>([])
  const [bankAccounts, setBankAccounts] = useState<FilterOption[]>([])

  useEffect(() => {
    if (open) {
      setQuery('')
      setItemResults([]); setIncomeResults([])
      setSelectedIndex(0)
      resetAllFilters()
      setTimeout(() => inputRef.current?.focus(), 50)

      window.api.categories.list().then((cats: any[]) =>
        setCategories(cats.map(c => ({ id: c.id, name: c.name, color: c.color || '#6b7280' })))
      )
      window.api.stores.list().then((ss: any[]) =>
        setStores(ss.map(s => ({ id: s.id, name: s.name, color: s.color || '#6366f1' })))
      )
      window.api.cards.list().then((cs: any[]) =>
        setCards(cs.map(c => ({ id: c.id, name: c.name, color: '#8b5cf6' })))
      )
      window.api.tags.list().then((ts: any[]) =>
        setAllTags(ts.map(t => ({ id: t.id, name: t.name, color: t.color || '#6366f1' })))
      )
      if (activePerson) {
        window.api.bankAccounts.list(activePerson.id).then((accs: any[]) =>
          setBankAccounts(accs.map(a => ({ id: a.id, name: a.name, color: '#3b82f6' })))
        )
      }
    }
  }, [open])

  const resetAllFilters = () => {
    setFilterType('all'); setFilterCategoryId(null); setFilterTagId(null)
    setFilterBankAccountId(null); setFilterCardId(null); setFilterStoreId(null)
    setFilterActive('all'); setFilterPaid('all'); setFilterPayMethod('all')
    setFilterRecurring('all')
  }

  // Build filters per source
  const buildGastosFilters = useCallback(() => {
    const f: Record<string, any> = {}
    if (filterType !== 'all') f.type = filterType
    if (filterCategoryId && filterCategoryId !== -1) f.categoryId = filterCategoryId
    if (filterTagId && filterTagId !== -1) f.tagId = filterTagId
    if (filterCardId && filterCardId !== -1) f.cardId = filterCardId
    if (filterStoreId && filterStoreId !== -1) f.storeId = filterStoreId
    if (filterBankAccountId && filterBankAccountId !== -1) f.bankAccountId = filterBankAccountId
    if (filterPaid === 'paid') f.isPaid = true
    if (filterPaid === 'unpaid') f.isPaid = false
    if (filterActive === 'active') f.isActive = true
    if (filterActive === 'inactive') f.isActive = false
    return Object.keys(f).length > 0 ? f : undefined
  }, [filterType, filterCategoryId, filterTagId, filterCardId, filterStoreId, filterBankAccountId, filterPaid, filterActive])

  const buildReceitasFilters = useCallback(() => {
    const f: Record<string, any> = {}
    if (filterRecurring === 'recurring') f.isRecurring = true
    if (filterRecurring === 'non-recurring') f.isRecurring = false
    if (filterCategoryId && filterCategoryId !== -1) f.categoryId = filterCategoryId
    if (filterTagId && filterTagId !== -1) f.tagId = filterTagId
    return Object.keys(f).length > 0 ? f : undefined
  }, [filterRecurring, filterCategoryId, filterTagId])


  const doSearch = useCallback(async (q: string) => {
    if (!activePerson || q.trim().length < 2) {
      setItemResults([]); setIncomeResults([])
      return
    }
    const trimmed = q.trim()
    if (source === 'gastos') {
      const items = await window.api.items.search(activePerson.id, trimmed, buildGastosFilters())
      // Client-side payment method filter
      let filtered = items
      if (filterPayMethod === 'no-card') filtered = items.filter((i: any) => !i.cardId)
      else if (filterPayMethod === 'credit') filtered = items.filter((i: any) => i.paymentMethod === 'credit' || (!i.paymentMethod && i.cardId))
      else if (filterPayMethod === 'debit') filtered = items.filter((i: any) => i.paymentMethod === 'debit')
      if (filterCategoryId === -1) filtered = filtered.filter((i: any) => !i.categoryId)
      if (filterTagId === -1) filtered = filtered.filter((i: any) => !i.tagId)
      if (filterCardId === -1) filtered = filtered.filter((i: any) => !i.cardId)
      if (filterStoreId === -1) filtered = filtered.filter((i: any) => !i.storeId)
      if (filterBankAccountId === -1) filtered = filtered.filter((i: any) => !i.bankAccountId)
      setItemResults(filtered)
      setIncomeResults([])
    } else {
      const items = await window.api.personIncome.search(activePerson.id, trimmed, buildReceitasFilters())
      let filtered = items
      if (filterCategoryId === -1) filtered = filtered.filter((i: any) => !i.categoryId)
      if (filterTagId === -1) filtered = filtered.filter((i: any) => !i.tagId)
      setIncomeResults(filtered)
      setItemResults([])
    }
    setSelectedIndex(0)
  }, [activePerson, source, buildGastosFilters, buildReceitasFilters, filterPayMethod, filterCategoryId, filterTagId, filterCardId, filterStoreId, filterBankAccountId])

  // Re-search when filters change
  useEffect(() => {
    if (open && query.trim().length >= 2) doSearch(query)
  }, [filterType, filterCategoryId, filterTagId, filterCardId, filterStoreId, filterBankAccountId,
      filterActive, filterPaid, filterPayMethod, filterRecurring])

  // Re-search when source changes
  useEffect(() => {
    resetAllFilters()
    if (open && query.trim().length >= 2) {
      // Delay to let state reset
      setTimeout(() => doSearch(query), 0)
    } else {
      setItemResults([]); setIncomeResults([])
    }
  }, [source])

  const handleQueryChange = (value: string) => {
    setQuery(value)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => doSearch(value), 300)
  }

  const resultCount = source === 'gastos' ? itemResults.length : incomeResults.length

  const selectResult = (index: number) => {
    onClose()
    if (source === 'gastos' && itemResults[index]) {
      navigate('/items', { state: { editItemId: itemResults[index].id }, replace: false })
    } else if (source === 'receitas' && incomeResults[index]) {
      navigate('/income')
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setSelectedIndex(i => { const next = Math.min(i + 1, resultCount - 1); scrollToIndex(next); return next })
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setSelectedIndex(i => { const next = Math.max(i - 1, 0); scrollToIndex(next); return next })
    } else if (e.key === 'Enter' && resultCount > 0) {
      e.preventDefault()
      selectResult(selectedIndex)
    } else if (e.key === 'Escape') {
      onClose()
    }
  }

  const scrollToIndex = (index: number) => {
    const el = resultsRef.current?.children[index] as HTMLElement
    if (el) el.scrollIntoView({ block: 'nearest' })
  }

  const closeAllDropdowns = () => {
    setShowSourceMenu(false); setShowTypeMenu(false); setShowCatFilter(false)
    setShowTagFilter(false); setShowBankFilter(false); setShowCardFilter(false)
    setShowStoreFilter(false); setShowActiveMenu(false); setShowPaidMenu(false)
    setShowPayMethodMenu(false); setShowRecurringMenu(false)
  }

  const hasActiveFilters = (() => {
    if (source === 'gastos') return filterType !== 'all' || filterCategoryId || filterTagId || filterBankAccountId || filterCardId || filterStoreId || filterActive !== 'all' || filterPaid !== 'all' || filterPayMethod !== 'all'
    return filterRecurring !== 'all' || filterCategoryId || filterTagId
  })()

  const sourceLabels: Record<SearchSource, string> = { gastos: t('filters.expenses'), receitas: t('filters.income') }
  const selectedCatName = filterCategoryId === -1 ? t('filters.noCategory') : filterCategoryId ? categories.find(c => c.id === filterCategoryId)?.name : null
  const selectedTagName = filterTagId === -1 ? t('filters.noTag') : filterTagId ? allTags.find(tg => tg.id === filterTagId)?.name : null
  const selectedBankName = filterBankAccountId === -1 ? t('filters.noAccount') : filterBankAccountId ? bankAccounts.find(a => a.id === filterBankAccountId)?.name : null
  const selectedCardName = filterCardId === -1 ? t('filters.noCard') : filterCardId ? cards.find(c => c.id === filterCardId)?.name : null
  const selectedStoreName = filterStoreId === -1 ? t('filters.noStore') : filterStoreId ? stores.find(s => s.id === filterStoreId)?.name : null

  if (!open) return null

  // ─── Filter button helper ───
  const filterBtn = (ref: React.RefObject<HTMLButtonElement | null>, label: string, isActive: boolean, onClick: () => void) => (
    <button ref={ref} type="button" onClick={() => { closeAllDropdowns(); onClick() }}
      className={`inline-flex items-center gap-1.5 h-7 px-2.5 text-xs font-medium rounded-md border transition-colors whitespace-nowrap ${
        isActive ? 'bg-primary text-primary-foreground border-primary' : 'bg-transparent text-foreground border-input hover:bg-accent'
      }`}>
      <Filter size={11} /> {label}
    </button>
  )

  const dropdownBtn = (ref: React.RefObject<HTMLButtonElement | null>, label: string, isActive: boolean, onClick: () => void) => (
    <button ref={ref} type="button" onClick={() => { closeAllDropdowns(); onClick() }}
      className={`inline-flex items-center gap-1.5 h-7 px-2.5 text-xs font-medium rounded-md border transition-colors whitespace-nowrap ${
        isActive ? 'bg-primary text-primary-foreground border-primary' : 'bg-transparent text-foreground border-input hover:bg-accent'
      }`}>
      {label}
      <ChevronDown size={12} className={isActive ? '' : 'text-muted-foreground'} />
    </button>
  )

  return (
    <div className="fixed inset-0 z-[9999] flex items-start justify-center pt-[10vh]" onClick={onClose}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <div className="relative w-full max-w-2xl mx-4 rounded-xl border border-border bg-background shadow-2xl overflow-hidden"
        onClick={e => e.stopPropagation()}>

        {/* Search input */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-border">
          <Search size={16} className="text-muted-foreground shrink-0" />
          <input ref={inputRef} type="text" value={query}
            onChange={e => handleQueryChange(e.target.value)} onKeyDown={handleKeyDown}
            placeholder={source === 'gastos' ? t('search.searchExpensesAll') : source === 'receitas' ? t('search.searchIncome') : t('common.search')}
            className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none" />
          {query && (
            <button onClick={() => { setQuery(''); setItemResults([]); setIncomeResults([]) }}
              className="text-muted-foreground hover:text-foreground transition-colors">
              <X size={14} />
            </button>
          )}
          <kbd className="hidden sm:inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded border border-border text-[10px] text-muted-foreground font-mono">ESC</kbd>
        </div>

        {/* Filters */}
        <div className="flex items-center gap-2 px-4 py-2 border-b border-border flex-wrap">
          {/* Source selector */}
          <div className="relative">
            {dropdownBtn(sourceBtnRef, sourceLabels[source], false, () => setShowSourceMenu(f => !f))}
            {showSourceMenu && (
              <SimpleDropdown anchorRef={sourceBtnRef} dropRef={sourceDropRef}
                options={[
                  { key: 'gastos', label: t('filters.expenses') },
                  { key: 'receitas', label: t('filters.income') }
                ]}
                current={source} onChange={v => { setSource(v as SearchSource); setShowSourceMenu(false) }}
                onClose={() => setShowSourceMenu(false)} />
            )}
          </div>

          <div className="h-6 w-px bg-border shrink-0" />

          {/* ─── GASTOS filters ─── */}
          {source === 'gastos' && (
            <>
              {/* Type */}
              <div className="relative">
                {dropdownBtn(typeBtnRef, filterType === 'all' ? t('common.all') : TYPE_LABELS[filterType], filterType !== 'all', () => setShowTypeMenu(f => !f))}
                {showTypeMenu && (
                  <SimpleDropdown anchorRef={typeBtnRef} dropRef={typeDropRef}
                    options={[
                      { key: 'all', label: t('filters.allTypes') },
                      { key: 'common', label: t('itemTypes.common') },
                      { key: 'installment', label: t('itemTypes.installment') },
                      { key: 'subscription', label: t('itemTypes.subscription') },
                      { key: 'emprestimo', label: t('itemTypes.emprestimo') }
                    ]}
                    current={filterType} onChange={v => { setFilterType(v); setShowTypeMenu(false) }}
                    onClose={() => setShowTypeMenu(false)} />
                )}
              </div>

              {/* Category */}
              <div className="relative">
                {filterBtn(catBtnRef, selectedCatName || t('filters.category'), !!filterCategoryId, () => setShowCatFilter(f => !f))}
                {showCatFilter && (
                  <FilterDropdown anchorRef={catBtnRef} dropRef={catDropRef} onClose={() => setShowCatFilter(false)}
                    items={[{ id: -1, name: t('filters.noCategory'), color: '#6b7280' }, ...categories]} selected={filterCategoryId ? [filterCategoryId] : []}
                    onToggle={id => setFilterCategoryId(filterCategoryId === id ? null : id)} emptyText={t('filters.noOptions')} />
                )}
              </div>

              {/* Tags */}
              {allTags.length > 0 && (
                <div className="relative">
                  {filterBtn(tagBtnRef, selectedTagName || t('tags.title'), !!filterTagId, () => setShowTagFilter(f => !f))}
                  {showTagFilter && (
                    <FilterDropdown anchorRef={tagBtnRef} dropRef={tagDropRef} onClose={() => setShowTagFilter(false)}
                      items={[{ id: -1, name: t('filters.noTag'), color: '#6b7280' }, ...allTags]} selected={filterTagId ? [filterTagId] : []}
                      onToggle={id => setFilterTagId(filterTagId === id ? null : id)} emptyText={t('filters.noOptions')} />
                  )}
                </div>
              )}

              {/* Bank accounts */}
              {bankAccounts.length > 0 && (
                <div className="relative">
                  {filterBtn(bankBtnRef, selectedBankName || t('filters.accounts'), !!filterBankAccountId, () => setShowBankFilter(f => !f))}
                  {showBankFilter && (
                    <FilterDropdown anchorRef={bankBtnRef} dropRef={bankDropRef} onClose={() => setShowBankFilter(false)}
                      items={[{ id: -1, name: t('filters.noAccount'), color: '#3b82f6' }, ...bankAccounts]} selected={filterBankAccountId ? [filterBankAccountId] : []}
                      onToggle={id => setFilterBankAccountId(filterBankAccountId === id ? null : id)} emptyText={t('filters.noAccountRegistered')} />
                  )}
                </div>
              )}

              {/* Cards */}
              {cards.length > 0 && (
                <div className="relative">
                  {filterBtn(cardBtnRef, selectedCardName || t('filters.cards'), !!filterCardId, () => setShowCardFilter(f => !f))}
                  {showCardFilter && (
                    <FilterDropdown anchorRef={cardBtnRef} dropRef={cardDropRef} onClose={() => setShowCardFilter(false)}
                      items={[{ id: -1, name: t('filters.noCard'), color: '#8b5cf6' }, ...cards]} selected={filterCardId ? [filterCardId] : []}
                      onToggle={id => setFilterCardId(filterCardId === id ? null : id)} emptyText={t('filters.noCardRegistered')} />
                  )}
                </div>
              )}

              {/* Stores */}
              {stores.length > 0 && (
                <div className="relative">
                  {filterBtn(storeBtnRef, selectedStoreName || t('filters.stores'), !!filterStoreId, () => setShowStoreFilter(f => !f))}
                  {showStoreFilter && (
                    <FilterDropdown anchorRef={storeBtnRef} dropRef={storeDropRef} onClose={() => setShowStoreFilter(false)}
                      items={[{ id: -1, name: t('filters.noStore'), color: '#6366f1' }, ...stores]} selected={filterStoreId ? [filterStoreId] : []}
                      onToggle={id => setFilterStoreId(filterStoreId === id ? null : id)} emptyText={t('filters.noStoreRegistered')} />
                  )}
                </div>
              )}

              {/* Active/Inactive */}
              <div className="relative">
                {dropdownBtn(activeBtnRef,
                  filterActive === 'all' ? t('filters.activeAndInactive') : filterActive === 'active' ? t('filters.activeOnly') : t('filters.inactiveOnly'),
                  filterActive !== 'all', () => setShowActiveMenu(f => !f))}
                {showActiveMenu && (
                  <SimpleDropdown anchorRef={activeBtnRef} dropRef={activeDropRef}
                    options={[
                      { key: 'all', label: t('filters.activeAndInactive') },
                      { key: 'active', label: t('filters.activeOnly') },
                      { key: 'inactive', label: t('filters.inactiveOnly') }
                    ]}
                    current={filterActive} onChange={v => { setFilterActive(v); setShowActiveMenu(false) }}
                    onClose={() => setShowActiveMenu(false)} />
                )}
              </div>

              {/* Paid */}
              <div className="relative">
                {dropdownBtn(paidBtnRef,
                  filterPaid === 'all' ? t('filters.paidAndUnpaid') : filterPaid === 'paid' ? t('filters.paidOnly') : t('filters.unpaidOnly'),
                  filterPaid !== 'all', () => setShowPaidMenu(f => !f))}
                {showPaidMenu && (
                  <SimpleDropdown anchorRef={paidBtnRef} dropRef={paidDropRef}
                    options={[
                      { key: 'all', label: t('filters.paidAndUnpaid') },
                      { key: 'paid', label: t('filters.paidOnly') },
                      { key: 'unpaid', label: t('filters.unpaidOnly') }
                    ]}
                    current={filterPaid} onChange={v => { setFilterPaid(v); setShowPaidMenu(false) }}
                    onClose={() => setShowPaidMenu(false)} />
                )}
              </div>

              {/* Payment method */}
              <div className="relative">
                {dropdownBtn(payMethodBtnRef,
                  { all: t('filters.allPaymentMethods'), 'no-card': t('filters.noCardOnly'), credit: t('filters.creditCardOnly'), debit: t('filters.debitCardOnly') }[filterPayMethod] || t('filters.allPaymentMethods'),
                  filterPayMethod !== 'all', () => setShowPayMethodMenu(f => !f))}
                {showPayMethodMenu && (
                  <SimpleDropdown anchorRef={payMethodBtnRef} dropRef={payMethodDropRef}
                    options={[
                      { key: 'all', label: t('filters.allPaymentMethods') },
                      { key: 'no-card', label: t('filters.noCardOnly') },
                      { key: 'credit', label: t('filters.creditCardOnly') },
                      { key: 'debit', label: t('filters.debitCardOnly') }
                    ]}
                    current={filterPayMethod} onChange={v => { setFilterPayMethod(v); setShowPayMethodMenu(false) }}
                    onClose={() => setShowPayMethodMenu(false)} />
                )}
              </div>
            </>
          )}

          {/* ─── RECEITAS filters ─── */}
          {source === 'receitas' && (
            <>
              <div className="relative">
                {dropdownBtn(recurringBtnRef,
                  filterRecurring === 'all' ? t('filters.allRecurring') : filterRecurring === 'recurring' ? t('filters.recurringOnly') : t('filters.nonRecurringOnly'),
                  filterRecurring !== 'all', () => setShowRecurringMenu(f => !f))}
                {showRecurringMenu && (
                  <SimpleDropdown anchorRef={recurringBtnRef} dropRef={recurringDropRef}
                    options={[
                      { key: 'all', label: t('filters.allRecurring') },
                      { key: 'recurring', label: t('filters.recurringOnly') },
                      { key: 'non-recurring', label: t('filters.nonRecurringOnly') }
                    ]}
                    current={filterRecurring} onChange={v => { setFilterRecurring(v); setShowRecurringMenu(false) }}
                    onClose={() => setShowRecurringMenu(false)} />
                )}
              </div>

              {/* Category for income */}
              <div className="relative">
                {filterBtn(catBtnRef, selectedCatName || t('filters.category'), !!filterCategoryId, () => setShowCatFilter(f => !f))}
                {showCatFilter && (
                  <FilterDropdown anchorRef={catBtnRef} dropRef={catDropRef} onClose={() => setShowCatFilter(false)}
                    items={[{ id: -1, name: t('filters.noCategory'), color: '#6b7280' }, ...categories]} selected={filterCategoryId ? [filterCategoryId] : []}
                    onToggle={id => setFilterCategoryId(filterCategoryId === id ? null : id)} emptyText={t('filters.noOptions')} />
                )}
              </div>

              {/* Tags for income */}
              {allTags.length > 0 && (
                <div className="relative">
                  {filterBtn(tagBtnRef, selectedTagName || t('tags.title'), !!filterTagId, () => setShowTagFilter(f => !f))}
                  {showTagFilter && (
                    <FilterDropdown anchorRef={tagBtnRef} dropRef={tagDropRef} onClose={() => setShowTagFilter(false)}
                      items={[{ id: -1, name: t('filters.noTag'), color: '#6b7280' }, ...allTags]} selected={filterTagId ? [filterTagId] : []}
                      onToggle={id => setFilterTagId(filterTagId === id ? null : id)} emptyText={t('filters.noOptions')} />
                  )}
                </div>
              )}
            </>
          )}

          {hasActiveFilters && (
            <button className="text-xs text-muted-foreground hover:text-foreground transition-colors whitespace-nowrap" onClick={resetAllFilters}>
              {t('common.clearFilters')}
            </button>
          )}
        </div>

        {/* Results */}
        <div ref={resultsRef} className="max-h-[50vh] overflow-y-auto">
          {query.trim().length >= 2 && resultCount === 0 && (
            <div className="px-4 py-10 text-center">
              <Search size={28} className="mx-auto mb-2 text-muted-foreground/30" />
              <p className="text-sm text-muted-foreground">{t('common.noResults')}</p>
              {hasActiveFilters && <p className="text-xs text-muted-foreground/60 mt-1">{t('common.tryRemoveFilters')}</p>}
            </div>
          )}
          {query.trim().length < 2 && resultCount === 0 && (
            <div className="px-4 py-10 text-center">
              <Search size={28} className="mx-auto mb-2 text-muted-foreground/30" />
              <p className="text-sm text-muted-foreground">{t('common.minCharsSearch')}</p>
            </div>
          )}

          {/* Gastos results */}
          {source === 'gastos' && itemResults.map((item, i) => {
            const Icon = TYPE_ICONS[item.type] || CircleDot
            return (
              <button key={item.id} onClick={() => selectResult(i)}
                className={`flex items-center gap-3 w-full px-4 py-2 text-left transition-colors border-b border-border last:border-b-0 ${
                  i === selectedIndex ? 'bg-accent' : 'hover:bg-accent/50'
                }`}>
                <Icon size={14} className="text-muted-foreground shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium truncate">{item.description}</p>
                    {item.isPaid && <span className="inline-flex items-center gap-0.5 text-[10px] font-medium text-primary"><Check size={9} /> {t('items.paid')}</span>}
                    {item.isPaid === false && <span className="text-[10px] font-medium text-muted-foreground">{t('items.pending')}</span>}
                  </div>
                  <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground flex-wrap">
                    <span className="whitespace-nowrap">{TYPE_LABELS[item.type] || item.type}</span>
                    <span>·</span>
                    <span className="whitespace-nowrap">{fmtMonth(item.startMonth)}</span>
                    {item.categoryName && <><span>·</span><span className="inline-flex items-center gap-0.5 whitespace-nowrap"><Tags size={9} />{item.categoryName}</span></>}
                    {item.storeName && <><span>·</span><span className="inline-flex items-center gap-0.5 whitespace-nowrap"><Store size={9} />{item.storeName}</span></>}
                    {getItemCardLabels(item).map((label, i) => <span key={i} className="inline-flex items-center gap-0.5 whitespace-nowrap"><>{i === 0 && <span>·</span>}<CreditCard size={9} />{label}</></span>)}
                  </div>
                </div>
                <span className="text-sm font-semibold tabular-nums shrink-0">{formatCurrency(item.value * (item.exchangeRateSnapshot || 1.0))}</span>
              </button>
            )
          })}

          {/* Receitas results */}
          {source === 'receitas' && incomeResults.map((inc, i) => (
            <button key={inc.id} onClick={() => selectResult(i)}
              className={`flex items-center gap-3 w-full px-4 py-2 text-left transition-colors border-b border-border last:border-b-0 ${
                i === selectedIndex ? 'bg-accent' : 'hover:bg-accent/50'
              }`}>
              <HandCoins size={14} className="text-muted-foreground shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-medium truncate">{inc.description}</p>
                  {inc.isRecurring && <span className="text-[10px] font-medium text-primary flex items-center gap-0.5"><Repeat size={9} /> {t('income.recurring')}</span>}
                </div>
                <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground flex-wrap">
                  <span className="whitespace-nowrap">{fmtMonth(inc.startMonth)}</span>
                  {inc.categoryName && <><span>·</span><span className="inline-flex items-center gap-0.5 whitespace-nowrap"><Tags size={9} />{inc.categoryName}</span></>}
                </div>
              </div>
              <span className="text-sm font-semibold tabular-nums shrink-0">{formatCurrency(getMonthlyIncomeValue(inc))}</span>
            </button>
          ))}


        </div>

        {/* Footer */}
        <div className="px-4 py-1.5 border-t border-border text-xs text-muted-foreground flex items-center gap-3">
          <span><kbd className="px-1 py-0.5 rounded border border-border font-mono text-[10px]">↑↓</kbd> {t('common.navigate')}</span>
          <span><kbd className="px-1 py-0.5 rounded border border-border font-mono text-[10px]">Enter</kbd> {t('common.open')}</span>
          {resultCount > 0 && <span className="ml-auto">{resultCount} {resultCount !== 1 ? t('common.results') : t('common.result')}</span>}
        </div>
      </div>
    </div>
  )
}
