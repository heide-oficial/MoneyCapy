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
import { KebabMenu } from '../../components/ui/KebabMenu'
import { SortableGrid } from '../../components/dnd/SortableGrid'
import { SortableItem } from '../../components/dnd/SortableItem'
import { useSortOrder } from '../../hooks/useSortOrder'
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
import { CreditCard, Plus, Pencil, Trash2, Landmark, ChevronDown, CheckCircle2, ExternalLink, CircleDot, Layers, Repeat, HandCoins, Receipt } from 'lucide-react'
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
  const [cards, setCards] = useState<CardEnriched[]>([])
  const [accounts, setAccounts] = useState<BankAccountBasic[]>([])
  const { month, setMonth } = usePageMonth()
  const [showForm, setShowForm] = useState(false)
  const [showPasswordModal, setShowPasswordModal] = useState(false)
  const [editing, setEditing] = useState<number | null>(null)
  const [pendingEditId, setPendingEditId] = useState<number | null>(null)
  const [payInvoiceCardId, setPayInvoiceCardId] = useState<number | null>(null)
  const [multiCardMessage, setMultiCardMessage] = useState<string | null>(null)
  const [sortMode, setSortMode] = useState<CardSortMode>('manual')
  const [filterBanco, setFilterBanco] = useState<string>('')
  const [filterCardType, setFilterCardType] = useState('all')
  const [search, setSearch] = useState('')

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

  const cardTotalExpense = (c: CardEnriched) => c.commonTotal + c.installmentTotal + c.subscriptionTotal

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
    return (
      <Card className="p-5">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 shrink-0">
              <CreditCard size={20} className="text-primary" />
            </div>
            <h3 className="font-semibold truncate">{card.name}</h3>
          </div>
          <KebabMenu items={[
            { label: t('common.edit'), icon: Pencil, onClick: () => openEdit(card.id) },
            { label: t('common.delete'), icon: Trash2, onClick: () => requestDelete(card.id), destructive: true }
          ]} />
        </div>

        <div className="flex items-center gap-1.5 mb-3">
          {card.bankAccountName && (
            <>
              <Landmark size={12} className="text-muted-foreground" />
              <span className="text-xs text-muted-foreground">{card.bankAccountName}</span>
            </>
          )}
          {card.cardType !== 'both' && (
            <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${
              card.cardType === 'credit' ? 'bg-blue-500/15 text-blue-500' : 'bg-green-500/15 text-green-500'
            }`}>
              {card.cardType === 'credit' ? t('cards.credit') : t('cards.debit')}
            </span>
          )}
        </div>

        <div className="mb-3 flex items-center gap-2 text-xs text-muted-foreground font-mono">
          <span className="tracking-widest shrink-0">{!isUnlocked ? '**** **** **** ****' : (card.numberMasked && card.numberMasked !== '**** **** **** ****' ? card.numberMasked : '0000 0000 0000 0000')}</span>
          <span className="shrink-0">-</span>
          <span className="shrink-0">{!isUnlocked ? '**/**' : (card.expirationMasked && card.expirationMasked !== '**/**' ? card.expirationMasked : '00/00')}</span>
          <span className="shrink-0">-</span>
          <span className="uppercase truncate">{!isUnlocked ? '*****' : (card.holderMasked && card.holderMasked !== '*****' ? card.holderMasked : t('cards.nameOnCard'))}</span>
        </div>

        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">{t('cards.usedOverLimit')}</span>
            <span className="font-medium">{fmtCard(card.usedLimit)} / {card.totalLimit === 0 ? t('cards.unlimited') : fmtCard(card.totalLimit)}</span>
          </div>
          {card.totalLimit > 0 ? (
          <div className="h-2 rounded-full bg-muted overflow-hidden">
            <div className={`h-full rounded-full transition-all ${usedPct > 80 ? 'bg-destructive' : 'bg-primary'}`} style={{ width: `${Math.min(usedPct, 100)}%` }} />
          </div>
          ) : (
          <div className="h-2 rounded-full overflow-hidden" style={{
            backgroundImage: 'repeating-linear-gradient(135deg, hsl(var(--muted-foreground) / 0.18) 0px, hsl(var(--muted-foreground) / 0.18) 3px, transparent 3px, transparent 6px)',
          }} />
          )}
          <div className="flex justify-between items-center text-xs text-muted-foreground">
            <span>{t('cards.closesDay', { day: card.billingCloseDay })}</span>
            {card.totalLimit > 0 && (
              <span>{t('cards.available')}: <span className="font-medium">{fmtCard(card.availableLimit)}</span></span>
            )}
            <span>{t('cards.duesDay', { day: card.dueDay })}</span>
          </div>
        </div>

        <div className="mt-3 pt-3 border-t border-border/50 flex items-center">
          <div className="relative group/expenses inline-flex items-center gap-1.5 text-xs text-muted-foreground cursor-default">
            <Receipt size={12} className="shrink-0 opacity-60" />
            <span className="font-medium">
              {t('cards.totalExpenses', { total: fmtCard(card.commonTotal + card.installmentTotal + card.subscriptionTotal + card.emprestimoTotal) })}
            </span>
            <div className="absolute bottom-full left-0 mb-1.5 hidden group-hover/expenses:flex flex-col gap-1 bg-zinc-900 dark:bg-zinc-800 text-zinc-100 border border-zinc-700 rounded-lg shadow-lg p-2.5 z-50 min-w-max">
              <span className="inline-flex items-center gap-1.5 text-[11px] text-zinc-300">
                <CircleDot size={10} className="shrink-0 opacity-60" />
                {t('accounts.commonCount', { count: card.commonCount, total: formatCurrency(card.commonTotal) })}
              </span>
              <span className="inline-flex items-center gap-1.5 text-[11px] text-zinc-300">
                <Layers size={10} className="shrink-0 opacity-60" />
                {t('accounts.installmentCount', { count: card.installmentCount, total: formatCurrency(card.installmentTotal) })}
              </span>
              <span className="inline-flex items-center gap-1.5 text-[11px] text-zinc-300">
                <Repeat size={10} className="shrink-0 opacity-60" />
                {t('accounts.subscriptionCount', { count: card.subscriptionCount, total: formatCurrency(card.subscriptionTotal) })}
              </span>
              <span className="inline-flex items-center gap-1.5 text-[11px] text-zinc-300">
                <HandCoins size={10} className="shrink-0 opacity-60" />
                {t('accounts.loanCount', { count: card.emprestimoCount, total: formatCurrency(card.emprestimoTotal) })}
              </span>
            </div>
          </div>
          <div className="ml-auto flex items-center gap-3">
            <button
              type="button"
              onClick={() => navigate(`/items?cardId=${card.id}`)}
              className="flex items-center gap-1.5 text-xs font-medium text-primary hover:text-primary/80 transition-colors"
            >
              <ExternalLink size={14} />
              {t('cards.viewItems')}
            </button>
            {card.cardType !== 'debit' && (
              <button
                type="button"
                onClick={() => setPayInvoiceCardId(card.id)}
                disabled={card.invoiceAllPaid}
                className={`flex items-center gap-1.5 text-xs font-medium transition-colors ${card.invoiceAllPaid ? 'text-muted-foreground/50 cursor-not-allowed' : 'text-primary hover:text-primary/80'}`}
              >
                <CheckCircle2 size={14} />
                {t('cards.payInvoice')}
              </button>
            )}
          </div>
        </div>
      </Card>
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
                options={Object.entries(cardSortLabels).map(([k, v]) => ({ key: k, label: v }))}
                current={sortMode} onChange={v => { setSortMode(v as CardSortMode); setShowSortMenu(false) }} onClose={() => setShowSortMenu(false)} />
            )}
          </div>
        </>
      }
      stats={[
        { label: t('cards.totalToPay'), value: formatDisplayCurrency(totalExpense), style: gastosStyle('cards', 'hero') },
        { label: t('cards.limits'), value: t('cards.limitsInfo', { used: formatDisplayCurrency(totalUsed), available: formatDisplayCurrency(totalAvailable), unlimitedCount: unlimitedCards.length }) }
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
            <SortableItem key={card.id} id={card.id}>
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
      <Modal open={showForm} onClose={() => setShowForm(false)} title={editing ? t('cards.editCard') : t('cards.newCardModal')}>
        <div className="space-y-4">
          <Input label={t('cards.cardName')} value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} placeholder="Ex: Nubank" autoFocus />
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
          {accounts.length > 0 && (
            <Select
              label={t('cards.bankAccount')}
              value={formData.bankAccountId !== null ? String(formData.bankAccountId) : ''}
              onChange={e => setFormData({ ...formData, bankAccountId: e.target.value ? parseInt(e.target.value) : null })}
              options={[
                { value: '', label: t('cards.noneOption') },
                ...accounts.map(a => ({ value: String(a.id), label: a.name }))
              ]}
            />
          )}
          {currencies.length > 1 && (
            <Select
              label={t('common.currency')}
              value={formData.currencyId !== null ? String(formData.currencyId) : ''}
              onChange={e => setFormData({ ...formData, currencyId: e.target.value ? parseInt(e.target.value) : null })}
              options={currencies.map(c => ({ value: String(c.id), label: `${c.code} — ${c.symbol}` }))}
            />
          )}
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setShowForm(false)}>{t('common.cancel')}</Button>
            <Button onClick={handleSave}>{editing ? t('common.save') : t('common.create')}</Button>
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
