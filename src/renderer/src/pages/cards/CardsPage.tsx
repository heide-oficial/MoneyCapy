import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { Card } from '../../components/ui/Card'
import { SectionLayout } from '../../components/layout/SectionLayout'
import { Button } from '../../components/ui/Button'
import { Modal } from '../../components/ui/Modal'
import { Input } from '../../components/ui/Input'
import { CurrencyInput } from '../../components/ui/CurrencyInput'
import { Select } from '../../components/ui/Select'
import { ConfirmDialog } from '../../components/ui/ConfirmDialog'
import { CurrencyMonthNavigator } from '../../components/ui/CurrencyMonthNavigator'
import { SearchInput } from '../../components/ui/SearchInput'
import { PasswordModal } from '../../components/ui/PasswordModal'
import { SortableGrid } from '../../components/dnd/SortableGrid'
import { SortableItem } from '../../components/dnd/SortableItem'
import { useSortOrder } from '../../hooks/useSortOrder'
import { useDefaultSortMode } from '../../hooks/useDefaultSortMode'
import { usePageMonth } from '../../contexts/DefaultMonthContext'
import { useActivePerson } from '../../contexts/ActivePersonContext'
import { useSession } from '../../contexts/SessionContext'
import { useColorSettings } from '../../contexts/ColorSettingsContext'
import { formatCurrency, formatCurrencyWith } from '../../lib/currency'
import { useCurrencySettings } from '../../contexts/CurrencySettingsContext'
import { useDisplayCurrency } from '../../contexts/DisplayCurrencyContext'
import { getCurrentMonth } from '../../lib/date'
import { useColumnsPicker } from '../../components/ui/ColumnsPickerDropdown'
import { SimpleDropdown } from '../../components/ui/SimpleDropdown'
import { FilterGroup } from '../../components/ui/FilterGroup'
import { CreditCard, Plus, Landmark, ChevronDown, CheckCircle2, ExternalLink, CircleDot, Layers, Repeat, HandCoins, Receipt, Info, Settings, CalendarDays, User, Hash } from 'lucide-react'
import { toast } from 'sonner'
import { useUndoableDelete } from '../../hooks/useUndoableDelete'
import { useTranslation } from '../../contexts/LanguageContext'

interface CardEnriched {
  id: number
  name: string
  personId: number | null
  bankAccountId: number | null
  numberMasked: string
  expirationMasked: string
  holderMasked: string
  totalLimit: number
  usedLimit: number
  availableLimit: number
  billingCloseDay: number
  dueDay: number
  cardType: 'credit' | 'debit' | 'both'
  bankAccountName: string | null
  commonCount: number
  commonTotal: number
  installmentCount: number
  installmentTotal: number
  subscriptionCount: number
  subscriptionTotal: number
  emprestimoCount: number
  emprestimoTotal: number
  invoiceAllPaid: boolean
  currencyId?: number | null
  currencySymbol?: string
  currencyCode?: string
  createdAt?: string
}

interface BankAccountBasic {
  id: number
  name: string
  nomeBanco: string | null
}

type CardSortMode = 'manual' | 'az' | 'za' | 'limit-desc' | 'limit-asc' | 'avail-desc' | 'avail-asc'
  | 'total-expense-desc' | 'total-expense-asc'
  | 'common-desc' | 'common-asc'
  | 'installment-desc' | 'installment-asc'
  | 'subscription-desc' | 'subscription-asc'
  | 'newest' | 'oldest'
  | 'due-day-asc' | 'due-day-desc'

const CARD_SORT_LABELS_FN = (t: (k: string) => string): Record<CardSortMode, string> => ({
  'manual': t('sort.manual'),
  'az': t('sort.azAsc'),
  'za': t('sort.azDesc'),
  'newest': t('sort.newest'),
  'oldest': t('sort.oldest'),
  'limit-desc': t('sort.limitDesc'),
  'limit-asc': t('sort.limitAsc'),
  'avail-desc': t('sort.availDesc'),
  'avail-asc': t('sort.availAsc'),
  'total-expense-desc': t('sort.totalExpenseDesc'),
  'total-expense-asc': t('sort.totalExpenseAsc'),
  'common-desc': t('sort.commonDesc'),
  'common-asc': t('sort.commonAsc'),
  'installment-desc': t('sort.installmentDesc'),
  'installment-asc': t('sort.installmentAsc'),
  'subscription-desc': t('sort.subscriptionDesc'),
  'subscription-asc': t('sort.subscriptionAsc'),
  'due-day-asc': t('sort.dueDayAsc'),
  'due-day-desc': t('sort.dueDayDesc')
})

export default function CardsPage() {
  const navigate = useNavigate()
  const { t } = useTranslation()
  const { activePerson } = useActivePerson()
  const { isUnlocked, hasPassword } = useSession()
  const { gastosStyle } = useColorSettings()
  const { currencies } = useCurrencySettings()
  const { formatDisplayCurrency } = useDisplayCurrency()
  const cardSortLabels = CARD_SORT_LABELS_FN(t)
  const cardSortOptions = Object.entries(cardSortLabels).map(([key, label]) => ({ key, label })) as { key: CardSortMode; label: string }[]
  const [cards, setCards] = useState<CardEnriched[]>([])
  const [accounts, setAccounts] = useState<BankAccountBasic[]>([])
  const { month, setMonth } = usePageMonth()
  const [showForm, setShowForm] = useState(false)
  const [showPasswordModal, setShowPasswordModal] = useState(false)
  const [editing, setEditing] = useState<number | null>(null)
  const [pendingEditId, setPendingEditId] = useState<number | null>(null)
  const [payInvoiceCardId, setPayInvoiceCardId] = useState<number | null>(null)
  const [multiCardMessage, setMultiCardMessage] = useState<string | null>(null)
  const { sortMode, setSortMode, defaultSortMode, setDefaultSortMode } = useDefaultSortMode<CardSortMode>('cards', 'manual', cardSortOptions.map(option => option.key))
  const [filterBanco, setFilterBanco] = useState<string>('')
  const [filterCardType, setFilterCardType] = useState('all')
  const [search, setSearch] = useState('')
  const [expandedCardId, setExpandedCardId] = useState<number | null>(null)

  // Dropdown refs/state
  const [showBancoMenu, setShowBancoMenu] = useState(false)
  const bancoBtnRef = useRef<HTMLButtonElement>(null)
  const bancoDropRef = useRef<HTMLDivElement>(null)
  const [showCardTypeMenu, setShowCardTypeMenu] = useState(false)
  const cardTypeBtnRef = useRef<HTMLButtonElement>(null)
  const cardTypeDropRef = useRef<HTMLDivElement>(null)
  const [showSortMenu, setShowSortMenu] = useState(false)
  const sortBtnRef = useRef<HTMLButtonElement>(null)
  const sortDropRef = useRef<HTMLDivElement>(null)

  const { gridClass, pickerButton } = useColumnsPicker('cards-columns')

  const [formData, setFormData] = useState({
    name: '', number: '', expiration: '', holder: '',
    totalLimit: 0, billingCloseDay: 1, dueDay: 10,
    bankAccountId: null as number | null,
    cardType: 'both' as 'credit' | 'debit' | 'both',
    currencyId: null as number | null
  })

  const loadData = async () => {
    if (!activePerson) return
    const [cardsData, accountsData] = await Promise.all([
      window.api.cards.listEnriched(activePerson.id, month),
      window.api.bankAccounts.list(activePerson.id)
    ])
    setCards(cardsData)
    setAccounts(accountsData)
  }

  useEffect(() => { loadData() }, [activePerson, month, isUnlocked])

  const handlePayInvoice = async () => {
    if (!payInvoiceCardId) return
    const result = await window.api.cards.payInvoice(payInvoiceCardId, month)
    setPayInvoiceCardId(null)
    if (result.paidCount === 0) {
      toast.info(t('cards.noPendingCredit'))
      return
    }
    toast.success(t('cards.itemsMarkedPaid', { count: result.paidCount }))
    if (result.hasMultiCardItems) {
      setMultiCardMessage(
        t('cards.multiCardMessage', { items: result.multiCardItemNames.join('\n') })
      )
    }
    loadData()
  }

  const { requestDelete, isPending: isDeletePending } = useUndoableDelete({
    onDelete: async (id) => { await window.api.cards.delete(id); loadData() },
    toastLabel: t('cards.cardDeleted')
  })

  const { sortedItems: sortedCards, handleReorder } = useSortOrder({
    settingsKey: activePerson ? `cards-page-order-${activePerson.id}` : '',
    items: cards,
    getId: (c) => c.id,
    enabled: !!activePerson
  })

  // Bank name options for filter
  const bankNames = [...new Set(accounts.map(a => a.nomeBanco).filter(Boolean))] as string[]

  // Filter by banco, card type and search
  const filteredCards = sortedCards.filter(c => !isDeletePending(c.id)).filter(c => {
    if (filterBanco) {
      const acc = accounts.find(a => a.id === c.bankAccountId)
      if (acc?.nomeBanco !== filterBanco) return false
    }
    if (filterCardType === 'credit' && c.cardType === 'debit') return false
    if (filterCardType === 'debit' && c.cardType === 'credit') return false
    if (search) {
      if (!c.name.toLowerCase().includes(search.toLowerCase())) return false
    }
    return true
  })

  const cardTotalExpense = (c: CardEnriched) => c.commonTotal + c.installmentTotal + c.subscriptionTotal + c.emprestimoTotal

  const displayCards = sortMode === 'manual' ? filteredCards : [...filteredCards].sort((a, b) => {
    switch (sortMode) {
      case 'az': return a.name.localeCompare(b.name)
      case 'za': return b.name.localeCompare(a.name)
      case 'limit-desc': return b.totalLimit - a.totalLimit
      case 'limit-asc': return a.totalLimit - b.totalLimit
      case 'avail-desc': return b.availableLimit - a.availableLimit
      case 'avail-asc': return a.availableLimit - b.availableLimit
      case 'total-expense-desc': return cardTotalExpense(b) - cardTotalExpense(a)
      case 'total-expense-asc': return cardTotalExpense(a) - cardTotalExpense(b)
      case 'common-desc': return b.commonTotal - a.commonTotal
      case 'common-asc': return a.commonTotal - b.commonTotal
      case 'installment-desc': return b.installmentTotal - a.installmentTotal
      case 'installment-asc': return a.installmentTotal - b.installmentTotal
      case 'subscription-desc': return b.subscriptionTotal - a.subscriptionTotal
      case 'subscription-asc': return a.subscriptionTotal - b.subscriptionTotal
      case 'newest': return (b.createdAt || '').localeCompare(a.createdAt || '')
      case 'oldest': return (a.createdAt || '').localeCompare(b.createdAt || '')
      case 'due-day-asc': return (a.dueDay ?? 99) - (b.dueDay ?? 99)
      case 'due-day-desc': return (b.dueDay ?? 0) - (a.dueDay ?? 0)
      default: return 0
    }
  })

  const totalExpense = cards.reduce((s, c) => s + cardTotalExpense(c), 0)
  const limitedCards = cards.filter(c => c.totalLimit > 0)
  const unlimitedCards = cards.filter(c => c.totalLimit === 0)
  const totalLimit = limitedCards.reduce((s, c) => s + c.totalLimit, 0)
  const totalUsed = limitedCards.reduce((s, c) => s + c.usedLimit, 0)
  const totalAvailable = totalLimit - totalUsed

  const openCreate = () => {
    if (!hasPassword) { setShowPasswordModal(true); return }
    if (!isUnlocked) { setShowPasswordModal(true); return }
    setEditing(null)
    setFormData({ name: '', number: '', expiration: '', holder: '', totalLimit: 0, billingCloseDay: 1, dueDay: 10, bankAccountId: null, cardType: 'both' })
    setShowForm(true)
  }

  const openEdit = async (cardId: number) => {
    if (!hasPassword || !isUnlocked) {
      setPendingEditId(cardId)
      setShowPasswordModal(true)
      return
    }
    try {
      const decrypted = await window.api.cards.getDecrypted(cardId)
      setFormData({
        name: decrypted.name,
        number: decrypted.number || '',
        expiration: decrypted.expiration || '',
        holder: decrypted.holder || '',
        totalLimit: decrypted.totalLimit,
        billingCloseDay: decrypted.billingCloseDay,
        dueDay: decrypted.dueDay,
        bankAccountId: decrypted.bankAccountId ?? null,
        cardType: decrypted.cardType || 'both',
        currencyId: decrypted.currencyId || null
      })
      setEditing(cardId)
      setShowForm(true)
    } catch {
      toast.error(t('cards.errorLoading'))
    }
  }

  const handleSave = async () => {
    if (!formData.name.trim()) { toast.error(t('common.nameIsRequired')); return }
    if (!activePerson) return
    try {
      if (editing) {
        await window.api.cards.update({ id: editing, ...formData })
        toast.success(t('cards.cardUpdated'))
      } else {
        await window.api.cards.create({ ...formData, personId: activePerson.id })
        toast.success(t('cards.cardCreated'))
      }
      setShowForm(false)
      loadData()
    } catch (err: any) {
      toast.error(err.message || t('cards.errorSaving'))
    }
  }

  const handlePasswordSuccess = async () => {
    setShowPasswordModal(false)
    if (pendingEditId) {
      const editId = pendingEditId
      setPendingEditId(null)
      await openEdit(editId)
    } else {
      setEditing(null)
      setFormData({ name: '', number: '', expiration: '', holder: '', totalLimit: 0, billingCloseDay: 1, dueDay: 10, bankAccountId: null, cardType: 'both', currencyId: null })
      setShowForm(true)
    }
  }

  const renderCardTile = (card: CardEnriched) => {
    const usedPct = card.totalLimit > 0 ? (card.usedLimit / card.totalLimit) * 100 : 0
    const fmtCard = (v: number) => card.currencySymbol ? formatCurrencyWith(v, card.currencySymbol) : formatCurrency(v)
    const expanded = expandedCardId === card.id
    const cardTypeLabel = card.cardType === 'credit' ? t('cards.credit') : card.cardType === 'debit' ? t('cards.debit') : t('cards.creditAndDebit')
    const sensitiveRows = [
      { icon: Hash, label: t('cards.cardNumber'), value: !isUnlocked ? '**** **** **** ****' : (card.numberMasked && card.numberMasked !== '**** **** **** ****' ? card.numberMasked : '0000 0000 0000 0000') },
      { icon: CalendarDays, label: t('cards.expiration'), value: !isUnlocked ? '**/**' : (card.expirationMasked && card.expirationMasked !== '**/**' ? card.expirationMasked : '00/00') },
      { icon: User, label: t('cards.holderName'), value: !isUnlocked ? '*****' : (card.holderMasked && card.holderMasked !== '*****' ? card.holderMasked : t('cards.nameOnCard')) },
      { icon: CalendarDays, label: t('cards.billingCloseDay'), value: t('cards.closesDay', { day: card.billingCloseDay }) },
      { icon: CalendarDays, label: t('cards.dueDay'), value: t('cards.duesDay', { day: card.dueDay }) }
    ]
    return (
      <>
        {expanded && (
          <div
            aria-hidden="true"
            className="tile-card-backdrop fixed inset-0 z-40 bg-black/60 backdrop-blur-[1px]"
            onClick={() => setExpandedCardId(null)}
          />
        )}
        <Card
          hover
          className={`group relative overflow-visible cursor-pointer transition-all duration-200 ease-out ${expanded ? 'z-50 rounded-b-none border-b-0 shadow-2xl' : ''}`}
          onClick={() => setExpandedCardId(current => current === card.id ? null : card.id)}
        >
        <div className="relative z-20 flex items-center gap-3 px-3 py-3 sm:px-4">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
            <CreditCard size={20} className="text-primary" />
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h3 className="truncate text-lg font-bold leading-tight text-foreground sm:text-xl">{card.name}</h3>
                <p className="mt-1 truncate text-sm text-muted-foreground">{cardTypeLabel}</p>
              </div>

              <div className="flex shrink-0 items-start gap-3 text-right">
                <div>
                  <p className="text-lg font-bold leading-tight tabular-nums sm:text-xl" style={gastosStyle('cards', 'itens')}>
                    {fmtCard(cardTotalExpense(card))}
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground">{t('cards.monthlyUsage')}</p>
                </div>
                <div className="flex flex-col items-center gap-1 border-l border-border pl-2" onClick={event => event.stopPropagation()}>
                  <span className="relative group/expenses">
                    <button
                      type="button"
                      className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                      title={t('cards.totalExpenses', { total: fmtCard(cardTotalExpense(card)) })}
                    >
                      <Info size={16} />
                    </button>
                    <div className="tile-card-tooltip absolute right-0 top-full mt-2 hidden w-[24rem] rounded-lg border border-border p-3 text-left text-xs text-card-foreground group-hover/expenses:block">
                      <p className="font-semibold text-foreground">{t('accounts.expensesBreakdown')}</p>
                      <dl className="mt-2 space-y-1.5">
                        {[
                          { icon: Receipt, label: t('accounts.totalExpenses'), value: fmtCard(cardTotalExpense(card)) },
                          { icon: CircleDot, label: t('itemTypes.common'), value: t('accounts.commonCount', { count: card.commonCount, total: fmtCard(card.commonTotal) }) },
                          { icon: Layers, label: t('itemTypes.installment'), value: t('accounts.installmentCount', { count: card.installmentCount, total: fmtCard(card.installmentTotal) }) },
                          { icon: Repeat, label: t('itemTypes.subscription'), value: t('accounts.subscriptionCount', { count: card.subscriptionCount, total: fmtCard(card.subscriptionTotal) }) },
                          { icon: HandCoins, label: t('itemTypes.emprestimo'), value: t('accounts.loanCount', { count: card.emprestimoCount, total: fmtCard(card.emprestimoTotal) }) }
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
                    onClick={() => openEdit(card.id)}
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
            <div className="mb-3 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">{t('cards.usedOverLimit')}</span>
                <span className="relative font-medium group/limit">
                  {fmtCard(card.usedLimit)} / {card.totalLimit === 0 ? t('cards.unlimited') : fmtCard(card.totalLimit)}
                  {card.totalLimit > 0 && (
                    <span className="tile-card-tooltip pointer-events-none absolute bottom-full right-0 mb-2 hidden w-max max-w-[16rem] rounded-lg border border-border px-3 py-2 text-xs text-card-foreground group-hover/limit:block">
                      {t('cards.available')}: <span className="font-semibold text-foreground">{fmtCard(card.availableLimit)}</span>
                    </span>
                  )}
                </span>
              </div>
              {card.totalLimit > 0 ? (
                <div className="h-2 overflow-hidden rounded-full bg-muted">
                  <div className={`h-full rounded-full transition-all ${usedPct > 80 ? 'bg-destructive' : 'bg-primary'}`} style={{ width: `${Math.min(usedPct, 100)}%` }} />
                </div>
              ) : (
                <div className="h-2 rounded-full overflow-hidden" style={{
                  backgroundImage: 'repeating-linear-gradient(135deg, hsl(var(--muted-foreground) / 0.18) 0px, hsl(var(--muted-foreground) / 0.18) 3px, transparent 3px, transparent 6px)',
                }} />
              )}
            </div>

            <div className="grid gap-2 sm:grid-cols-2">
              {sensitiveRows.map(row => (
                <div key={row.label} className="flex items-start gap-2 rounded-lg border border-border/70 bg-background/20 px-3 py-2">
                  <row.icon size={14} className="mt-0.5 shrink-0 text-muted-foreground" />
                  <div className="min-w-0">
                    <p className="text-xs text-muted-foreground">{row.label}</p>
                    <p className="truncate text-sm font-medium text-foreground">{row.value}</p>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-3 flex flex-wrap justify-end gap-2">
              <Button size="sm" variant="outline" onClick={() => navigate(`/items?cardId=${card.id}`)}>
                <ExternalLink size={14} />
                {t('cards.viewItems')}
              </Button>
              {card.cardType !== 'debit' && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setPayInvoiceCardId(card.id)}
                  disabled={card.invoiceAllPaid}
                >
                  <CheckCircle2 size={14} />
                  {t('cards.payInvoice')}
                </Button>
              )}
            </div>
          </div>
        )}
        </Card>
      </>
    )
  }

  return (
    <SectionLayout
      icon={CreditCard}
      title={t('cards.title')}
      actionButton={<Button size="sm" onClick={openCreate}><Plus size={16} /> {t('cards.newCard')}</Button>}
      monthNav={<CurrencyMonthNavigator month={month} onChange={setMonth} />}
      controls={
        <>
          <SearchInput value={search} onChange={setSearch} />
          <FilterGroup
            activeCount={(filterBanco !== '' ? 1 : 0) + (filterCardType !== 'all' ? 1 : 0)}
            onClear={() => { setFilterBanco(''); setFilterCardType('all') }}
            primaryCount={1}
          >
            <div className="relative">
              <button ref={bancoBtnRef} type="button" title={t('accounts.allBanks')} onClick={() => setShowBancoMenu(f => !f)}
                className="inline-flex items-center gap-1.5 h-7 px-2.5 text-xs font-medium rounded-md border border-input hover:bg-accent transition-colors">
                {filterBanco === '' ? t('accounts.allBanks') : filterBanco}
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

            <div className="relative">
              <button ref={cardTypeBtnRef} type="button" title={t('cards.creditAndDebit')} onClick={() => setShowCardTypeMenu(f => !f)}
                className="inline-flex items-center gap-1.5 h-7 px-2.5 text-xs font-medium rounded-md border border-input hover:bg-accent transition-colors">
                <CreditCard size={11} />
                <span data-filter-label>{{ 'all': t('cards.creditAndDebit'), 'credit': t('cards.creditOnly'), 'debit': t('cards.debitOnly') }[filterCardType]}</span>
                <ChevronDown size={12} className="text-muted-foreground" />
              </button>
              {showCardTypeMenu && (
                <SimpleDropdown anchorRef={cardTypeBtnRef} dropRef={cardTypeDropRef}
                  options={[
                    { key: 'all', label: t('cards.creditAndDebit') },
                    { key: 'credit', label: t('cards.creditOnly') },
                    { key: 'debit', label: t('cards.debitOnly') }
                  ]}
                  current={filterCardType} onChange={v => { setFilterCardType(v); setShowCardTypeMenu(false) }} onClose={() => setShowCardTypeMenu(false)} />
              )}
            </div>
          </FilterGroup>

          <div className="h-6 w-px bg-border shrink-0 ml-auto" />

          {pickerButton}
          <div className="relative">
            <button ref={sortBtnRef} type="button" onClick={() => setShowSortMenu(f => !f)}
              className="inline-flex items-center gap-1.5 h-7 px-2.5 text-xs font-medium rounded-md border border-input hover:bg-accent transition-colors">
              {cardSortLabels[sortMode]}
              <ChevronDown size={12} className="text-muted-foreground" />
            </button>
            {showSortMenu && (
              <SimpleDropdown anchorRef={sortBtnRef} dropRef={sortDropRef}
                options={cardSortOptions}
                current={sortMode} onChange={v => { setSortMode(v as CardSortMode); setShowSortMenu(false) }} onClose={() => setShowSortMenu(false)}
                defaultKey={defaultSortMode} onDefaultChange={v => setDefaultSortMode(v as CardSortMode)} defaultTitle={t('sort.setAsDefault')} />
            )}
          </div>
        </>
      }
      stats={[
        { label: t('cards.totalToPay'), value: formatDisplayCurrency(totalExpense), style: gastosStyle('cards', 'hero') },
        { label: t('cards.limitUsed'), value: formatDisplayCurrency(totalUsed) },
        { label: t('cards.limitRemaining'), value: formatDisplayCurrency(totalAvailable) }
      ]}
    >
      {cards.length === 0 ? (
        <Card className="p-8 text-center">
          <CreditCard size={48} className="mx-auto text-muted-foreground/30 mb-3" />
          <p className="text-muted-foreground">{t('cards.noCards')}</p>
          <Button size="sm" className="mt-4" onClick={openCreate}><Plus size={16} /> {t('cards.addCard')}</Button>
        </Card>
      ) : sortMode === 'manual' && !filterBanco && filterCardType === 'all' ? (
        <SortableGrid
          items={filteredCards}
          getId={(c) => c.id}
          onReorder={handleReorder}
          className={`grid ${gridClass} gap-4`}
          renderItem={(card) => (
            <SortableItem key={card.id} id={card.id} dragHandle={false}>
              {renderCardTile(card)}
            </SortableItem>
          )}
        />
      ) : (
        <div className={`grid ${gridClass} gap-4`}>
          {displayCards.map(card => (
            <div key={card.id}>{renderCardTile(card)}</div>
          ))}
        </div>
      )}

      {/* Create/Edit Modal */}
      <Modal open={showForm} onClose={() => setShowForm(false)} title={editing ? t('cards.editCard') : t('cards.newCardModal')} maxWidth="max-w-xl">
        <div className="flex max-h-[70vh] flex-col overflow-hidden">
          <div className="space-y-2 overflow-y-auto pr-1">
            <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{t('itemsForm.information')}</h4>
            <div className="rounded-lg border border-border bg-card p-4 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <Input label={t('cards.cardName')} value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} placeholder="Ex: Nubank" autoFocus />
            <Select
              label={t('cards.bankAccount')}
              value={formData.bankAccountId !== null ? String(formData.bankAccountId) : ''}
              onChange={e => setFormData({ ...formData, bankAccountId: e.target.value ? parseInt(e.target.value) : null })}
              options={[
                { value: '', label: t('cards.noneOption') },
                ...accounts.map(a => ({ value: String(a.id), label: a.name }))
              ]}
            />
          </div>
          <Input label={t('cards.cardNumber')} value={formData.number} onChange={e => {
            const digits = e.target.value.replace(/\D/g, '').slice(0, 16)
            setFormData({ ...formData, number: digits.replace(/(.{4})/g, '$1 ').trim() })
          }} placeholder="0000 0000 0000 0000" maxLength={19} />
          <div className="grid grid-cols-2 gap-3">
            <Input label={t('cards.expiration')} value={formData.expiration} onChange={e => {
              const digits = e.target.value.replace(/\D/g, '').slice(0, 4)
              setFormData({ ...formData, expiration: digits.length > 2 ? digits.slice(0, 2) + '/' + digits.slice(2) : digits })
            }} placeholder="MM/AA" maxLength={5} />
            <Input label={t('cards.holderName')} value={formData.holder} onChange={e => setFormData({ ...formData, holder: e.target.value })} placeholder={t('cards.nameOnCard')} />
          </div>
          <CurrencyInput label={t('cards.totalLimit')} value={formData.totalLimit} onChange={v => setFormData({ ...formData, totalLimit: v })} />
          <div className="grid grid-cols-2 gap-3">
            <Input label={t('cards.closingDay')} type="number" min={1} max={31} value={String(formData.billingCloseDay)} onChange={e => setFormData({ ...formData, billingCloseDay: parseInt(e.target.value) || 1 })} />
            <Input label={t('cards.dueDay')} type="number" min={1} max={31} value={String(formData.dueDay)} onChange={e => setFormData({ ...formData, dueDay: parseInt(e.target.value) || 10 })} />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-foreground">{t('cards.cardType')}</label>
            <div className="flex rounded-lg border border-input p-0.5 bg-muted/30">
              {([{ value: 'credit', label: t('cards.credit') }, { value: 'debit', label: t('cards.debit') }, { value: 'both', label: t('cards.both') }] as const).map(opt => (
                <button key={opt.value} type="button" onClick={() => setFormData({ ...formData, cardType: opt.value })}
                  className={`flex-1 py-1.5 text-sm font-medium rounded-md transition-all ${
                    formData.cardType === opt.value ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
                  }`}>
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
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
            <div>
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

      <PasswordModal open={showPasswordModal} onClose={() => setShowPasswordModal(false)} onSuccess={handlePasswordSuccess} mode={hasPassword ? 'unlock' : 'set'} />
      <ConfirmDialog
        open={payInvoiceCardId !== null}
        onClose={() => setPayInvoiceCardId(null)}
        onConfirm={handlePayInvoice}
        title={t('cards.payInvoice')}
        message={t('cards.payInvoiceConfirm')}
        confirmLabel={t('cards.payInvoice')}
        variant="default"
      />
      <Modal open={multiCardMessage !== null} onClose={() => setMultiCardMessage(null)} title={t('cards.multiCardItems')} maxWidth="max-w-sm">
        <p className="text-sm text-muted-foreground whitespace-pre-line mb-4">{multiCardMessage}</p>
        <div className="flex justify-end">
          <Button size="sm" onClick={() => setMultiCardMessage(null)}>{t('common.understood')}</Button>
        </div>
      </Modal>
    </SectionLayout>
  )
}
