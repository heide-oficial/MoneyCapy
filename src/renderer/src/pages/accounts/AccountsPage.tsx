import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { Card } from '../../components/ui/Card'
import { SectionLayout } from '../../components/layout/SectionLayout'
import { Button } from '../../components/ui/Button'
import { Modal } from '../../components/ui/Modal'
import { Input } from '../../components/ui/Input'
import { CurrencyInput } from '../../components/ui/CurrencyInput'
import { Select } from '../../components/ui/Select'
import { SearchInput } from '../../components/ui/SearchInput'
import { CurrencyMonthNavigator } from '../../components/ui/CurrencyMonthNavigator'
import { SortableGrid } from '../../components/dnd/SortableGrid'
import { SortableItem } from '../../components/dnd/SortableItem'
import { useSortOrder } from '../../hooks/useSortOrder'
import { useDefaultSortMode } from '../../hooks/useDefaultSortMode'
import { usePageMonth } from '../../contexts/DefaultMonthContext'
import { useActivePerson } from '../../contexts/ActivePersonContext'
import { useColorSettings } from '../../contexts/ColorSettingsContext'
import { formatCurrency, formatCurrencyWith } from '../../lib/currency'
import { useCurrencySettings } from '../../contexts/CurrencySettingsContext'
import { useDisplayCurrency } from '../../contexts/DisplayCurrencyContext'
import { getCurrentMonth } from '../../lib/date'
import { useColumnsPicker } from '../../components/ui/ColumnsPickerDropdown'
import { SimpleDropdown } from '../../components/ui/SimpleDropdown'
import { FilterGroup } from '../../components/ui/FilterGroup'
import { Landmark, Plus, CreditCard, HandCoins, CircleDot, Layers, Repeat, ChevronDown, Users, Receipt, Info, Settings, ExternalLink, Building2, Hash } from 'lucide-react'
import { toast } from 'sonner'
import { useUndoableDelete } from '../../hooks/useUndoableDelete'
import { useTranslation } from '../../contexts/LanguageContext'

interface BankAccountEnriched {
  id: number
  personId: number
  name: string
  balance: number
  icon: string
  color: string
  accountType: string
  juridicidade: string
  agencia: string | null
  conta: string | null
  banco: string | null
  nomeBanco: string | null
  linkedCards: number
  commonCount: number
  commonTotal: number
  installmentCount: number
  installmentTotal: number
  subscriptionCount: number
  subscriptionTotal: number
  emprestimoCount: number
  emprestimoTotal: number
  hasMonthlyOverride: boolean
  currencyId?: number | null
  currencySymbol?: string
  currencyCode?: string
  createdAt?: string
}

type AccountSortMode = 'manual' | 'az' | 'za' | 'balance-desc' | 'balance-asc'
  | 'cards-desc' | 'cards-asc'
  | 'total-expense-desc' | 'total-expense-asc'
  | 'common-desc' | 'common-asc'
  | 'installment-desc' | 'installment-asc'
  | 'subscription-desc' | 'subscription-asc'
  | 'emprestimo-desc' | 'emprestimo-asc'
  | 'newest' | 'oldest'

const ACCOUNT_SORT_LABELS_FN = (t: (k: string) => string): Record<AccountSortMode, string> => ({
  'manual': t('sort.manual'),
  'az': t('sort.azAsc'),
  'za': t('sort.azDesc'),
  'newest': t('sort.newest'),
  'oldest': t('sort.oldest'),
  'balance-desc': t('sort.balanceDesc'),
  'balance-asc': t('sort.balanceAsc'),
  'cards-desc': t('sort.cardsDesc'),
  'cards-asc': t('sort.cardsAsc'),
  'total-expense-desc': t('sort.totalExpenseDesc'),
  'total-expense-asc': t('sort.totalExpenseAsc'),
  'common-desc': t('sort.commonDesc'),
  'common-asc': t('sort.commonAsc'),
  'installment-desc': t('sort.installmentDesc'),
  'installment-asc': t('sort.installmentAsc'),
  'subscription-desc': t('sort.subscriptionDesc'),
  'subscription-asc': t('sort.subscriptionAsc'),
  'emprestimo-desc': t('sort.loanDesc'),
  'emprestimo-asc': t('sort.loanAsc')
})

const EMPTY_FORM = {
  name: '',
  balance: 0,
  accountType: 'corrente',
  juridicidade: 'cpf',
  agencia: '',
  conta: '',
  banco: '',
  nomeBanco: '',
  currencyId: null as number | null
}

export default function AccountsPage() {
  const navigate = useNavigate()
  const { t } = useTranslation()
  const { activePerson } = useActivePerson()
  const { receitasStyle } = useColorSettings()
  const { currencies } = useCurrencySettings()
  const { formatDisplayCurrency } = useDisplayCurrency()
  const accountSortLabels = ACCOUNT_SORT_LABELS_FN(t)
  const accountSortOptions = Object.entries(accountSortLabels).map(([key, label]) => ({ key, label })) as { key: AccountSortMode; label: string }[]
  const [accounts, setAccounts] = useState<BankAccountEnriched[]>([])
  const { month, setMonth } = usePageMonth()
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<number | null>(null)
  const { gridClass, pickerButton } = useColumnsPicker('accounts-columns')
  const [formData, setFormData] = useState({ ...EMPTY_FORM })
  const { sortMode, setSortMode, defaultSortMode, setDefaultSortMode } = useDefaultSortMode<AccountSortMode>('accounts', 'manual', accountSortOptions.map(option => option.key))
  const [filterType, setFilterType] = useState('')
  const [filterJuridicidade, setFilterJuridicidade] = useState('')
  const [filterBanco, setFilterBanco] = useState('')
  const [search, setSearch] = useState('')
  const [expandedAccountId, setExpandedAccountId] = useState<number | null>(null)

  // Dropdown refs/state
  const [showTypeMenu, setShowTypeMenu] = useState(false)
  const typeBtnRef = useRef<HTMLButtonElement>(null)
  const typeDropRef = useRef<HTMLDivElement>(null)
  const [showJuridMenu, setShowJuridMenu] = useState(false)
  const juridBtnRef = useRef<HTMLButtonElement>(null)
  const juridDropRef = useRef<HTMLDivElement>(null)
  const [showBancoMenu, setShowBancoMenu] = useState(false)
  const bancoBtnRef = useRef<HTMLButtonElement>(null)
  const bancoDropRef = useRef<HTMLDivElement>(null)
  const [showSortMenu, setShowSortMenu] = useState(false)
  const sortBtnRef = useRef<HTMLButtonElement>(null)
  const sortDropRef = useRef<HTMLDivElement>(null)

  const loadData = async () => {
    if (!activePerson) return
    const data = await window.api.bankAccounts.listEnriched(activePerson.id, month)
    setAccounts(data)
  }

  useEffect(() => { loadData() }, [activePerson, month])

  const { requestDelete, isPending: isDeletePending } = useUndoableDelete({
    onDelete: async (id) => { await window.api.bankAccounts.delete(id); loadData() },
    toastLabel: t('accounts.accountDeleted')
  })

  const { sortedItems: sortedAccounts, handleReorder } = useSortOrder({
    settingsKey: activePerson ? `accounts-order-${activePerson.id}` : '',
    items: accounts,
    getId: (a) => a.id,
    enabled: !!activePerson
  })

  // Filter
  let filtered = sortedAccounts.filter(a => !isDeletePending(a.id))
  if (search) filtered = filtered.filter(a => a.name.toLowerCase().includes(search.toLowerCase()))
  if (filterType) filtered = filtered.filter(a => a.accountType === filterType)
  if (filterJuridicidade) filtered = filtered.filter(a => a.juridicidade === filterJuridicidade)
  if (filterBanco) filtered = filtered.filter(a => a.nomeBanco === filterBanco)

  const accountTotalExpense = (a: BankAccountEnriched) => a.commonTotal + a.installmentTotal + a.subscriptionTotal + a.emprestimoTotal

  const displayAccounts = sortMode === 'manual' ? filtered : [...filtered].sort((a, b) => {
    switch (sortMode) {
      case 'az': return a.name.localeCompare(b.name)
      case 'za': return b.name.localeCompare(a.name)
      case 'balance-desc': return b.balance - a.balance
      case 'balance-asc': return a.balance - b.balance
      case 'cards-desc': return b.linkedCards - a.linkedCards
      case 'cards-asc': return a.linkedCards - b.linkedCards
      case 'total-expense-desc': return accountTotalExpense(b) - accountTotalExpense(a)
      case 'total-expense-asc': return accountTotalExpense(a) - accountTotalExpense(b)
      case 'common-desc': return b.commonTotal - a.commonTotal
      case 'common-asc': return a.commonTotal - b.commonTotal
      case 'installment-desc': return b.installmentTotal - a.installmentTotal
      case 'installment-asc': return a.installmentTotal - b.installmentTotal
      case 'subscription-desc': return b.subscriptionTotal - a.subscriptionTotal
      case 'subscription-asc': return a.subscriptionTotal - b.subscriptionTotal
      case 'emprestimo-desc': return b.emprestimoTotal - a.emprestimoTotal
      case 'emprestimo-asc': return a.emprestimoTotal - b.emprestimoTotal
      case 'newest': return (b.createdAt || '').localeCompare(a.createdAt || '')
      case 'oldest': return (a.createdAt || '').localeCompare(b.createdAt || '')
      default: return 0
    }
  })

  const totalBalance = accounts.reduce((sum, a) => sum + a.balance, 0)
  const bankNames = [...new Set(accounts.map(a => a.nomeBanco).filter(Boolean))] as string[]
  const hasFilters = !!(filterType || filterJuridicidade || filterBanco)
  const editingAccount = editing ? accounts.find(account => account.id === editing) : null

  const openCreate = () => {
    setEditing(null)
    setFormData({ ...EMPTY_FORM })
    setShowForm(true)
  }

  const openEdit = (account: BankAccountEnriched) => {
    setEditing(account.id)
    setFormData({
      name: account.name,
      balance: account.balance,
      accountType: account.accountType,
      juridicidade: account.juridicidade,
      agencia: account.agencia || '',
      conta: account.conta || '',
      banco: account.banco || '',
      nomeBanco: account.nomeBanco || '',
      currencyId: account.currencyId || null
    })
    setShowForm(true)
  }

  const handleSave = async () => {
    if (!formData.name.trim()) { toast.error(t('common.nameIsRequired')); return }
    if (!activePerson) return
    try {
      const payload = {
        ...formData,
        agencia: formData.agencia || null,
        conta: formData.conta || null,
        banco: formData.banco || null,
        nomeBanco: formData.nomeBanco || null
      }
      if (editing) {
        const { balance, ...rest } = payload
        await window.api.bankAccounts.update({ id: editing, ...rest })
        await window.api.bankAccounts.setMonthlyBalance(editing, month, balance)
        toast.success(t('accounts.accountUpdated'))
      } else {
        await window.api.bankAccounts.create({ personId: activePerson.id, ...payload })
        toast.success(t('accounts.accountCreated'))
      }
      setShowForm(false)
      loadData()
    } catch (err: any) {
      toast.error(err.message || t('accounts.errorSaving'))
    }
  }

  const handleRestoreBalance = async (accountId: number) => {
    await window.api.bankAccounts.removeMonthlyBalance(accountId, month)
    toast.success(t('accounts.balanceRestoredToInherited'))
    loadData()
  }

  const fmtAcct = (account: BankAccountEnriched, v: number) =>
    account.currencySymbol ? formatCurrencyWith(v, account.currencySymbol) : formatCurrency(v)

  const formatAccountType = (value: string) => value === 'poupanca' ? t('accounts.savings') : t('accounts.checking')
  const formatJuridicidade = (value: string) => value === 'cnpj' ? 'CNPJ' : 'CPF'
  const emptyValue = (value?: string | null) => value || t('common.notInformed')

  const renderAccountTile = (account: BankAccountEnriched) => {
    const expanded = expandedAccountId === account.id
    return (
      <>
        {expanded && (
          <div
            aria-hidden="true"
            className="tile-card-backdrop fixed inset-0 z-40 bg-black/60 backdrop-blur-[1px]"
            onClick={() => setExpandedAccountId(null)}
          />
        )}
        <Card
          hover
          className={`group relative overflow-visible cursor-pointer transition-all duration-200 ease-out ${expanded ? 'z-50 rounded-b-none border-b-0 shadow-2xl' : ''}`}
          onClick={() => setExpandedAccountId(current => current === account.id ? null : account.id)}
        >
      <div className="relative z-20 flex items-center gap-3 px-3 py-3 sm:px-4">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
          <Landmark size={20} className="text-primary" />
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h3 className="truncate text-lg font-bold leading-tight text-foreground sm:text-xl">{account.name}</h3>
              <div className="mt-1 flex items-center gap-2 text-sm text-muted-foreground">
                {account.nomeBanco && <span className="truncate">{account.nomeBanco}</span>}
                {account.linkedCards > 0 && (
                  <span className="inline-flex items-center gap-1 shrink-0">
                    <CreditCard size={12} className="opacity-70" />
                    {account.linkedCards} {account.linkedCards !== 1 ? t('accounts.cardsPlural') : t('accounts.cardSingular')}
                  </span>
                )}
              </div>
            </div>

            <div className="flex shrink-0 items-start gap-3 text-right">
              <div>
                <p className="text-lg font-bold leading-tight tabular-nums sm:text-xl" style={receitasStyle('accounts', 'itens')}>
                  {fmtAcct(account, account.balance)}
                </p>
                <p className="mt-1 text-sm text-muted-foreground">{t('accounts.totalBalance')}</p>
              </div>
              <div className="flex flex-col items-center gap-1 border-l border-border pl-2" onClick={event => event.stopPropagation()}>
                <span className="relative group/expenses">
                  <button
                    type="button"
                    className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                    title={t('cards.totalExpenses', { total: fmtAcct(account, accountTotalExpense(account)) })}
                  >
                    <Info size={16} />
                  </button>
                  <div className="tile-card-tooltip absolute right-0 top-full mt-2 hidden w-[24rem] rounded-lg border border-border p-3 text-left text-xs text-card-foreground group-hover/expenses:block">
                    <p className="font-semibold text-foreground">{t('accounts.expensesBreakdown')}</p>
                    <dl className="mt-2 space-y-1.5">
                      {[
                        { icon: Receipt, label: t('accounts.totalExpenses'), value: fmtAcct(account, accountTotalExpense(account)) },
                        { icon: CircleDot, label: t('itemTypes.common'), value: t('accounts.commonCount', { count: account.commonCount, total: fmtAcct(account, account.commonTotal) }) },
                        { icon: Layers, label: t('itemTypes.installment'), value: t('accounts.installmentCount', { count: account.installmentCount, total: fmtAcct(account, account.installmentTotal) }) },
                        { icon: Repeat, label: t('itemTypes.subscription'), value: t('accounts.subscriptionCount', { count: account.subscriptionCount, total: fmtAcct(account, account.subscriptionTotal) }) },
                        { icon: HandCoins, label: t('itemTypes.emprestimo'), value: t('accounts.loanCount', { count: account.emprestimoCount, total: fmtAcct(account, account.emprestimoTotal) }) }
                      ].map(row => (
                        <div key={row.label} className="grid grid-cols-[16px_minmax(0,1fr)] gap-2">
                          <row.icon size={14} className="mt-0.5 text-muted-foreground" />
                          <div className="min-w-0">
                            <dt className="text-muted-foreground">{row.label}:</dt>
                            <dd className="whitespace-normal break-words text-foreground leading-snug">{row.value}</dd>
                          </div>
                        </div>
                      ))}
                    </dl>
                  </div>
                </span>
                <button
                  type="button"
                  onClick={event => {
                    event.stopPropagation()
                    openEdit(account)
                  }}
                  className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                  title={t('common.edit')}
                >
                  <Settings size={16} />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {expanded && (
        <div className="tile-card-panel absolute -left-px -right-px top-full z-10 -mt-px rounded-b-lg border border-t-0 border-border px-4 pb-4 pt-3 shadow-2xl" onClick={event => event.stopPropagation()}>
          <div className="grid gap-2 sm:grid-cols-2">
            {[
              { icon: Building2, label: t('accounts.accountType'), value: formatAccountType(account.accountType) },
              { icon: Users, label: t('accounts.juridicidade'), value: formatJuridicidade(account.juridicidade) },
              { icon: Hash, label: t('accounts.agency'), value: emptyValue(account.agencia) },
              { icon: Hash, label: t('accounts.accountNumber'), value: emptyValue(account.conta) },
              { icon: Landmark, label: t('accounts.bankCode'), value: emptyValue(account.banco) },
              { icon: Landmark, label: t('accounts.bankName'), value: emptyValue(account.nomeBanco) }
            ].map(row => (
              <div key={row.label} className="flex items-start gap-2 rounded-lg border border-border/70 bg-background/20 px-3 py-2">
                <row.icon size={14} className="mt-0.5 shrink-0 text-muted-foreground" />
                <div className="min-w-0">
                  <p className="text-xs text-muted-foreground">{row.label}</p>
                  <p className="truncate text-sm font-medium text-foreground">{row.value}</p>
                </div>
              </div>
            ))}
          </div>
          <div className="mt-3 flex justify-end">
            <Button size="sm" variant="outline" onClick={() => navigate(`/items?bankAccountId=${account.id}`)}>
              <ExternalLink size={14} />
              {t('accounts.filterByAccountItems')}
            </Button>
          </div>
        </div>
      )}
        </Card>
      </>
    )
  }

  return (
    <SectionLayout
      icon={Landmark}
      title={t('accounts.title')}
      actionButton={<Button size="sm" onClick={openCreate}><Plus size={16} /> {t('accounts.newAccount')}</Button>}
      monthNav={<CurrencyMonthNavigator month={month} onChange={setMonth} />}
      controls={
        <>
          <SearchInput value={search} onChange={setSearch} />
          <FilterGroup
            activeCount={(filterType !== '' ? 1 : 0) + (filterJuridicidade !== '' ? 1 : 0) + (filterBanco !== '' ? 1 : 0)}
            onClear={() => { setFilterType(''); setFilterJuridicidade(''); setFilterBanco('') }}
            primaryCount={1}
          >
            <div className="relative">
              <button ref={typeBtnRef} type="button" title={t('accounts.allTypes')} onClick={() => setShowTypeMenu(f => !f)}
                className="inline-flex items-center gap-1.5 h-7 px-2.5 text-xs font-medium rounded-md border border-input hover:bg-accent transition-colors">
                {filterType === '' ? t('accounts.allTypes') : filterType === 'corrente' ? t('accounts.checking') : t('accounts.savings')}
                <ChevronDown size={12} className="text-muted-foreground" />
              </button>
              {showTypeMenu && (
                <SimpleDropdown anchorRef={typeBtnRef} dropRef={typeDropRef}
                  options={[
                    { key: '', label: t('accounts.allTypes') },
                    { key: 'corrente', label: t('accounts.checking') },
                    { key: 'poupanca', label: t('accounts.savings') }
                  ]}
                  current={filterType} onChange={v => { setFilterType(v); setShowTypeMenu(false) }} onClose={() => setShowTypeMenu(false)} />
              )}
            </div>
            <div className="relative">
              <button ref={juridBtnRef} type="button" title={t('accounts.cpfAndCnpj')} onClick={() => setShowJuridMenu(f => !f)}
                className="inline-flex items-center gap-1.5 h-7 px-2.5 text-xs font-medium rounded-md border border-input hover:bg-accent transition-colors">
                <Users size={11} />
                <span data-filter-label>{filterJuridicidade === '' ? t('accounts.cpfAndCnpj') : filterJuridicidade === 'cpf' ? 'CPF' : 'CNPJ'}</span>
                <ChevronDown size={12} className="text-muted-foreground" />
              </button>
              {showJuridMenu && (
                <SimpleDropdown anchorRef={juridBtnRef} dropRef={juridDropRef}
                  options={[
                    { key: '', label: t('accounts.cpfAndCnpj') },
                    { key: 'cpf', label: 'CPF' },
                    { key: 'cnpj', label: 'CNPJ' }
                  ]}
                  current={filterJuridicidade} onChange={v => { setFilterJuridicidade(v); setShowJuridMenu(false) }} onClose={() => setShowJuridMenu(false)} />
              )}
            </div>
            <div className="relative">
              <button ref={bancoBtnRef} type="button" title={t('accounts.allBanks')} onClick={() => setShowBancoMenu(f => !f)}
                className="inline-flex items-center gap-1.5 h-7 px-2.5 text-xs font-medium rounded-md border border-input hover:bg-accent transition-colors">
                <Landmark size={11} />
                <span data-filter-label>{filterBanco === '' ? t('accounts.allBanks') : filterBanco}</span>
                <ChevronDown size={12} className="text-muted-foreground" />
              </button>
              {showBancoMenu && (
                <SimpleDropdown anchorRef={bancoBtnRef} dropRef={bancoDropRef}
                  options={[
                    { key: '', label: t('accounts.allBanks') },
                    ...bankNames.map(b => ({ key: b, label: b }))
                  ]}
                  current={filterBanco} onChange={v => { setFilterBanco(v); setShowBancoMenu(false) }} onClose={() => setShowBancoMenu(false)} />
              )}
            </div>
          </FilterGroup>

          <div className="h-6 w-px bg-border shrink-0 ml-auto" />

          {pickerButton}
          <div className="relative">
            <button ref={sortBtnRef} type="button" onClick={() => setShowSortMenu(f => !f)}
              className="inline-flex items-center gap-1.5 h-7 px-2.5 text-xs font-medium rounded-md border border-input hover:bg-accent transition-colors">
              {accountSortLabels[sortMode]}
              <ChevronDown size={12} className="text-muted-foreground" />
            </button>
            {showSortMenu && (
              <SimpleDropdown anchorRef={sortBtnRef} dropRef={sortDropRef}
                options={accountSortOptions}
                current={sortMode} onChange={v => { setSortMode(v as AccountSortMode); setShowSortMenu(false) }} onClose={() => setShowSortMenu(false)}
                defaultKey={defaultSortMode} onDefaultChange={v => setDefaultSortMode(v as AccountSortMode)} defaultTitle={t('sort.setAsDefault')} />
            )}
          </div>
        </>
      }
      stats={[
        { label: t('accounts.totalBalance'), value: formatDisplayCurrency(totalBalance), style: receitasStyle('accounts', 'hero') },
        { label: t('accounts.title'), value: t('accounts.registeredCount', { count: accounts.length }) }
      ]}
    >
      {accounts.length === 0 ? (
        <Card className="p-8 text-center">
          <Landmark size={48} className="mx-auto text-muted-foreground/30 mb-3" />
          <p className="text-muted-foreground">{t('accounts.noAccounts')}</p>
          <Button size="sm" className="mt-4" onClick={openCreate}><Plus size={16} /> {t('accounts.addAccount')}</Button>
        </Card>
      ) : sortMode === 'manual' && !hasFilters ? (
        <SortableGrid
          items={sortedAccounts}
          getId={(a) => a.id}
          onReorder={handleReorder}
          className={`grid ${gridClass} gap-4`}
          renderItem={(account) => (
            <SortableItem key={account.id} id={account.id} dragHandle={false}>
              {renderAccountTile(account)}
            </SortableItem>
          )}
        />
      ) : (
        <div className={`grid ${gridClass} gap-4`}>
          {displayAccounts.map(account => (
            <div key={account.id}>{renderAccountTile(account)}</div>
          ))}
        </div>
      )}

      {/* Create/Edit Modal */}
      <Modal open={showForm} onClose={() => setShowForm(false)} title={editing ? t('accounts.editAccount') : t('accounts.newAccountModal')} maxWidth="max-w-xl">
        <div className="flex max-h-[70vh] flex-col overflow-hidden">
          <div className="space-y-2 overflow-y-auto pr-1">
            <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{t('itemsForm.information')}</h4>
            <div className="rounded-lg border border-border bg-card p-4 space-y-3">
          <Input label={t('common.name')} value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} placeholder={t('accounts.placeholder')} autoFocus />
          <div className="grid grid-cols-2 gap-3">
            <Select
              label={t('accounts.accountType')}
              value={formData.accountType}
              onChange={e => setFormData({ ...formData, accountType: e.target.value })}
              options={[
                { value: 'corrente', label: t('accounts.checking') },
                { value: 'poupanca', label: t('accounts.savings') }
              ]}
            />
            <Select
              label={t('accounts.juridicidade')}
              value={formData.juridicidade}
              onChange={e => setFormData({ ...formData, juridicidade: e.target.value })}
              options={[
                { value: 'cpf', label: 'CPF' },
                { value: 'cnpj', label: 'CNPJ' }
              ]}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Input label={t('accounts.agency')} value={formData.agencia} onChange={e => setFormData({ ...formData, agencia: e.target.value })} placeholder="Ex: 0001" />
            <Input label={t('accounts.accountNumber')} value={formData.conta} onChange={e => setFormData({ ...formData, conta: e.target.value })} placeholder="Ex: 12345-6" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Input label={t('accounts.bankCode')} value={formData.banco} onChange={e => setFormData({ ...formData, banco: e.target.value })} placeholder="Ex: 0260" />
            <Input label={t('accounts.bankName')} value={formData.nomeBanco} onChange={e => setFormData({ ...formData, nomeBanco: e.target.value })} placeholder="Ex: Nubank" />
          </div>
          <CurrencyInput label={t('accounts.balance')} value={formData.balance} onChange={v => setFormData({ ...formData, balance: v })} />
          {currencies.length > 1 && (
            <Select
              label={t('common.currency')}
              value={formData.currencyId !== null ? String(formData.currencyId) : ''}
              onChange={e => setFormData({ ...formData, currencyId: e.target.value ? parseInt(e.target.value) : null })}
              options={currencies.map(c => ({ value: String(c.id), label: `${c.code} — ${c.symbol}` }))}
            />
          )}
            </div>
            <div className="sticky bottom-0 -mt-6 h-6 pointer-events-none bg-gradient-to-t from-background to-transparent" />
          </div>
          <div className="mt-4 flex flex-wrap justify-between gap-2 pt-2">
            <div className="flex gap-2">
              {editingAccount?.hasMonthlyOverride && (
                <Button variant="outline" onClick={() => handleRestoreBalance(editingAccount.id)}>{t('accounts.restoreInheritedBalance')}</Button>
              )}
              {editing && (
                <Button variant="destructive" onClick={() => { requestDelete(editing); setShowForm(false) }}>{t('common.delete')}</Button>
              )}
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setShowForm(false)}>{t('common.cancel')}</Button>
              <Button onClick={handleSave}>{editing ? t('common.save') : t('common.create')}</Button>
            </div>
          </div>
        </div>
      </Modal>

    </SectionLayout>
  )
}
