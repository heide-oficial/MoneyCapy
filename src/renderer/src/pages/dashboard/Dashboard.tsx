import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { DndContext, DragEndEvent, PointerSensor, useSensor, useSensors } from '@dnd-kit/core'
import { Card } from '../../components/ui/Card'
import { SectionLayout } from '../../components/layout/SectionLayout'
import { Button } from '../../components/ui/Button'
import { CurrencyMonthNavigator } from '../../components/ui/CurrencyMonthNavigator'
import { usePageMonth } from '../../contexts/DefaultMonthContext'
import { ROUTES } from '../../lib/constants'
import { useActivePerson } from '../../contexts/ActivePersonContext'
import { useColorSettings } from '../../contexts/ColorSettingsContext'
import { useDisplayCurrency } from '../../contexts/DisplayCurrencyContext'
import { useStartCountingMonth } from '../../contexts/StartCountingMonthContext'
import { useTranslation } from '../../contexts/LanguageContext'
import { RowCreatorModal } from './components/RowCreatorModal'
import { DroppableSlot } from './components/DroppableSlot'
import { EmptySlot } from './components/EmptySlot'
import { WidgetSettingsModal, hasWidgetSettings } from './components/WidgetSettingsModal'
import type { DashboardWidgetsData } from '../../../../../shared/dashboard-types'
import {
  House, Users, LayoutGrid, Settings2, Pencil, Check,
  Plus, ChevronUp, ChevronDown, Trash2
} from 'lucide-react'
import {
  renderWidgetContent as renderWidget,
  TYPE_ICON_MAP, TYPE_COLOR_MAP, TYPE_TAB_MAP
} from './WidgetRenderer'
import type { Summary, WidgetType, AvailableWidget, WidgetRenderContext } from './WidgetRenderer'

// ── Layout types (v2) ──

interface DashboardSlot { widthPercent: number; widgetId: string | null; displayPrefs?: Record<string, any> }
interface DashboardRow { id: string; slots: DashboardSlot[] }
interface DashboardLayout { version: 2; rows: DashboardRow[] }

// Old format for migration
interface OldWidgetConfig { id: string; enabled: boolean; span?: number }

// ── Helpers ──

function getWidgetId(w: WidgetType): string {
  switch (w.kind) {
    case 'expenses-total': return 'expenses-total'
    case 'income-total': return 'income-total'
    case 'balance-total': return 'balance-total'
    case 'type-total': return `type-${w.type}`
    case 'cards-total': return 'cards-total'
    case 'card': return `card-${w.cardId}`
    case 'bank-accounts-total': return 'bank-accounts-total'
    case 'bank-account': return `bank-account-${w.accountId}`
    case 'upcoming-expenses': return 'upcoming-expenses'
    case 'unpaid-items': return 'unpaid-items'
    case 'top-expenses': return 'top-expenses'
    case 'pending-incomes': return 'pending-incomes'
    case 'ending-installments': return 'ending-installments'

    case 'month-comparison': return 'month-comparison'
    case 'next-month-comparison': return 'next-month-comparison'
    case 'overdue-items': return 'overdue-items'
    case 'payment-summary': return 'payment-summary'
    case 'financial-health': return 'financial-health'
    case 'type-distribution': return 'type-distribution'
    case 'current-month-summary': return 'current-month-summary'
    case 'previous-month-summary': return 'previous-month-summary'
    case 'next-month-summary': return 'next-month-summary'
    case 'overall-balance': return 'overall-balance'
    case 'balance-with-accounts': return 'balance-with-accounts'
    case 'category-distribution': return 'category-distribution'
    case 'subcategory-distribution': return 'subcategory-distribution'
    case 'tag-distribution': return 'tag-distribution'
    case 'income-type-distribution': return 'income-type-distribution'
    case 'income-category-distribution': return 'income-category-distribution'
    case 'income-subcategory-distribution': return 'income-subcategory-distribution'
    case 'upcoming-billing': return 'upcoming-billing'
  }
}

function getWidgetLabel(id: string, summary: Summary, t: (key: string, params?: Record<string, string | number>) => string): string {
  if (id === 'expenses-total') return t('dashboard.widgetExpensesTotal')
  if (id === 'income-total') return t('dashboard.widgetIncome')
  if (id === 'balance-total') return t('dashboard.widgetBalance')
  if (id === 'cards-total') return t('dashboard.widgetCardsTotal')
  if (id === 'bank-accounts-total') return t('dashboard.widgetBankMoney')
  if (id === 'upcoming-expenses') return t('dashboard.widgetUpcomingExpenses')
  if (id === 'unpaid-items') return t('dashboard.widgetUnpaidItems')
  if (id === 'top-expenses') return t('dashboard.widgetTopExpenses')
  if (id === 'pending-incomes') return t('dashboard.widgetPendingIncomes')
  if (id === 'ending-installments') return t('dashboard.widgetEndingInstallments')

  if (id === 'month-comparison') return t('dashboard.widgetMonthComparison')
  if (id === 'overdue-items') return t('dashboard.widgetOverdueItems')
  if (id === 'payment-summary') return t('dashboard.widgetPaymentSummary')
  if (id === 'financial-health') return t('dashboard.widgetFinancialHealth')
  if (id === 'type-distribution') return t('dashboard.widgetTypeDistribution')
  if (id === 'current-month-summary') return t('dashboard.widgetCurrentMonthSummary')
  if (id === 'previous-month-summary') return t('dashboard.widgetPreviousMonthSummary')
  if (id === 'next-month-summary') return t('dashboard.widgetNextMonthSummary')
  if (id === 'overall-balance') return t('dashboard.widgetOverallBalance')
  if (id === 'balance-with-accounts') return t('dashboard.widgetBalanceWithAccounts')
  if (id === 'category-distribution') return t('dashboard.widgetCategoryDistribution')
  if (id === 'tag-distribution') return t('dashboard.widgetTagDistribution')
  if (id === 'income-type-distribution') return t('dashboard.widgetIncomeTypeDistribution')
  if (id === 'income-category-distribution') return t('dashboard.widgetIncomeCategoryDistribution')
  if (id === 'upcoming-billing') return t('dashboard.widgetUpcomingBilling')
  if (id === 'next-month-comparison') return t('dashboard.widgetNextMonthComparison')
  if (id === 'subcategory-distribution') return t('dashboard.widgetSubcategoryDistribution')
  if (id === 'income-subcategory-distribution') return t('dashboard.widgetIncomeSubcategoryDistribution')
  if (id.startsWith('type-')) {
    const type = id.replace('type-', '')
    const tt = summary.typeTotals.find(t => t.type === type)
    return tt ? t('itemTypes.' + tt.type) : type
  }
  if (id.startsWith('card-')) {
    const cId = parseInt(id.replace('card-', ''))
    const c = summary.cardSummaries.find(cs => cs.id === cId)
    return c ? t('dashboard.widgetCard', { name: c.name }) : t('dashboard.widgetCardFallback')
  }
  if (id.startsWith('bank-account-')) {
    const aId = parseInt(id.replace('bank-account-', ''))
    const a = summary.bankAccounts.find(ba => ba.id === aId)
    return a ? t('dashboard.widgetAccount', { name: a.name }) : t('dashboard.widgetAccountFallback')
  }
  return id
}

function generateRowId(): string {
  return `row-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

function getSpanFromWidth(widthPercent: number): number {
  if (widthPercent >= 75) return 4
  if (widthPercent >= 50) return 3
  if (widthPercent >= 35) return 2
  return 1
}

function migrateOldFormat(old: OldWidgetConfig[]): DashboardLayout {
  const enabled = old.filter(w => w.enabled)
  const rows: DashboardRow[] = []
  let currentRow: DashboardSlot[] = []
  let currentTotal = 0

  for (const w of enabled) {
    const span = w.span || 1
    const widthPercent = span === 4 ? 100 : span === 3 ? 75 : span === 2 ? 50 : 25

    if (currentTotal + widthPercent > 100 && currentRow.length > 0) {
      rows.push({ id: generateRowId(), slots: currentRow })
      currentRow = []
      currentTotal = 0
    }
    currentRow.push({ widthPercent, widgetId: w.id })
    currentTotal += widthPercent
  }
  if (currentRow.length > 0) {
    rows.push({ id: generateRowId(), slots: currentRow })
  }

  return { version: 2, rows }
}

// ── Component ──

export default function Dashboard() {
  const navigate = useNavigate()
  const { activePerson, people } = useActivePerson()
  const { gastosStyle, receitasStyle, saldoStyle } = useColorSettings()
  const { formatDisplayCurrency } = useDisplayCurrency()
  const { startCountingMonth } = useStartCountingMonth()
  const { t } = useTranslation()
  const [summary, setSummary] = useState<Summary | null>(null)
  const [widgetsData, setWidgetsData] = useState<DashboardWidgetsData | null>(null)
  const [layout, setLayout] = useState<DashboardLayout>({ version: 2, rows: [] })
  const [showRowCreator, setShowRowCreator] = useState(false)
  const [editingRowId, setEditingRowId] = useState<string | null>(null)
  const [editMode, setEditMode] = useState(false)
  const [settingsTarget, setSettingsTarget] = useState<{ rowId: string; slotIdx: number; widgetId: string } | null>(null)
  const { month, setMonth } = usePageMonth()

  const settingsKey = activePerson ? `dashboard-widgets-${activePerson.id}` : ''

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  )

  // ── Load / save layout ──

  const loadLayout = async () => {
    if (!activePerson) return
    try {
      const raw = await window.api.settings.get(`dashboard-widgets-${activePerson.id}`)
      if (raw) {
        const parsed = JSON.parse(raw)
        if (Array.isArray(parsed)) {
          // Migration from old format
          const migrated = migrateOldFormat(parsed as OldWidgetConfig[])
          setLayout(migrated)
          await window.api.settings.set(settingsKey, JSON.stringify(migrated))
        } else if (parsed.version === 2) {
          setLayout(parsed as DashboardLayout)
        } else {
          setLayout({ version: 2, rows: [] })
        }
      } else {
        setLayout({ version: 2, rows: [] })
      }
    } catch {
      setLayout({ version: 2, rows: [] })
    }
  }

  const saveLayout = async (newLayout: DashboardLayout) => {
    setLayout(newLayout)
    if (activePerson) {
      await window.api.settings.set(settingsKey, JSON.stringify(newLayout))
    }
  }

  const load = async () => {
    if (!activePerson) { setSummary(null); setWidgetsData(null); return }
    const [summaryData, wData] = await Promise.all([
      window.api.dashboard.summary(activePerson.id, month),
      window.api.dashboard.widgets(activePerson.id, month)
    ])
    setSummary(summaryData)
    setWidgetsData(wData)
  }

  useEffect(() => { load(); loadLayout() }, [activePerson, month])

  // ── Row management ──

  const addRow = (slotWidths: number[]) => {
    const newRow: DashboardRow = {
      id: generateRowId(),
      slots: slotWidths.map(w => ({ widthPercent: w, widgetId: null }))
    }
    saveLayout({ ...layout, rows: [...layout.rows, newRow] })
  }

  const deleteRow = (rowId: string) => {
    saveLayout({ ...layout, rows: layout.rows.filter(r => r.id !== rowId) })
  }

  const moveRow = (rowId: string, direction: -1 | 1) => {
    const idx = layout.rows.findIndex(r => r.id === rowId)
    if (idx === -1) return
    const newIdx = idx + direction
    if (newIdx < 0 || newIdx >= layout.rows.length) return
    const newRows = [...layout.rows]
    const [moved] = newRows.splice(idx, 1)
    newRows.splice(newIdx, 0, moved)
    saveLayout({ ...layout, rows: newRows })
  }

  const assignWidget = (rowId: string, slotIndex: number, widgetId: string) => {
    const newRows = layout.rows.map(r => {
      if (r.id !== rowId) return r
      const newSlots = r.slots.map((s, i) => i === slotIndex ? { ...s, widgetId } : s)
      return { ...r, slots: newSlots }
    })
    saveLayout({ ...layout, rows: newRows })
  }

  const updateRowSlots = (rowId: string, newWidths: number[]) => {
    const newRows = layout.rows.map(r => {
      if (r.id !== rowId) return r
      // Build new slots: preserve existing widget assignments where possible
      const newSlots: DashboardSlot[] = newWidths.map((w, i) => ({
        widthPercent: w,
        widgetId: i < r.slots.length ? r.slots[i].widgetId : null
      }))
      return { ...r, slots: newSlots }
    })
    saveLayout({ ...layout, rows: newRows })
  }

  const removeWidget = (rowId: string, slotIndex: number) => {
    const newRows = layout.rows.map(r => {
      if (r.id !== rowId) return r
      const newSlots = r.slots.map((s, i) => i === slotIndex ? { ...s, widgetId: null } : s)
      return { ...r, slots: newSlots }
    })
    saveLayout({ ...layout, rows: newRows })
  }

  const updateSlotPrefs = (rowId: string, slotIndex: number, prefs: Record<string, any>) => {
    const newRows = layout.rows.map(r => {
      if (r.id !== rowId) return r
      const newSlots = r.slots.map((s, i) => i === slotIndex ? { ...s, displayPrefs: prefs } : s)
      return { ...r, slots: newSlots }
    })
    saveLayout({ ...layout, rows: newRows })
  }

  // ── Drag & drop ──

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    if (!over || active.id === over.id) return

    const dragId = String(active.id).replace('drag-', '')
    const dropId = String(over.id)

    // Find source slot
    let sourceRowId: string | null = null, sourceSlotIdx = -1, sourceWidgetId: string | null = null
    for (const row of layout.rows) {
      for (let i = 0; i < row.slots.length; i++) {
        const slotId = `${row.id}-${i}`
        if (slotId === dragId) {
          sourceRowId = row.id
          sourceSlotIdx = i
          sourceWidgetId = row.slots[i].widgetId
        }
      }
    }

    // Find target slot
    let targetRowId: string | null = null, targetSlotIdx = -1, targetWidgetId: string | null = null
    for (const row of layout.rows) {
      for (let i = 0; i < row.slots.length; i++) {
        const slotId = `${row.id}-${i}`
        if (slotId === dropId) {
          targetRowId = row.id
          targetSlotIdx = i
          targetWidgetId = row.slots[i].widgetId
        }
      }
    }

    if (!sourceRowId || !targetRowId || sourceSlotIdx === -1 || targetSlotIdx === -1) return

    // Swap widgets
    const newRows = layout.rows.map(r => {
      const newSlots = r.slots.map((s, i) => {
        if (r.id === sourceRowId && i === sourceSlotIdx) return { ...s, widgetId: targetWidgetId }
        if (r.id === targetRowId && i === targetSlotIdx) return { ...s, widgetId: sourceWidgetId }
        return s
      })
      return { ...r, slots: newSlots }
    })
    saveLayout({ ...layout, rows: newRows })
  }

  // ── No person ──

  if (!activePerson) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <House size={24} className="text-primary" />
          <h1 className="text-2xl font-bold">{t('dashboard.title')}</h1>
        </div>
        <Card className="p-8 text-center">
          <Users size={48} className="mx-auto text-muted-foreground/30 mb-3" />
          <p className="text-muted-foreground mb-4">{t('dashboard.createProfilePrompt')}</p>
          <Button onClick={() => navigate(ROUTES.PEOPLE)}>{t('dashboard.createProfile')}</Button>
        </Card>
      </div>
    )
  }

  if (!summary) return <div className="text-muted-foreground">{t('common.loading')}</div>

  const expenseTotal = summary.typeTotals.reduce((s, t) => s + t.total, 0)

  // ── Available widgets ──

  const availableWidgets: AvailableWidget[] = [
    { id: 'expenses-total', type: { kind: 'expenses-total' as const }, category: t('dashboard.categorySummary') },
    { id: 'income-total', type: { kind: 'income-total' as const }, category: t('dashboard.categorySummary') },
    { id: 'balance-total', type: { kind: 'balance-total' as const }, category: t('dashboard.categorySummary') },
    { id: 'bank-accounts-total', type: { kind: 'bank-accounts-total' as const }, category: t('dashboard.categorySummary') },
    ...summary.typeTotals.map(tt => ({
      id: getWidgetId({ kind: 'type-total' as const, type: tt.type }),
      type: { kind: 'type-total' as const, type: tt.type },
      category: t('dashboard.categoryByType')
    })),
    { id: 'cards-total', type: { kind: 'cards-total' as const }, category: t('dashboard.categoryCards') },
    ...summary.cardSummaries.map(cs => ({
      id: getWidgetId({ kind: 'card' as const, cardId: cs.id }),
      type: { kind: 'card' as const, cardId: cs.id },
      category: t('dashboard.categoryCards')
    })),
    ...summary.bankAccounts.map(ba => ({
      id: getWidgetId({ kind: 'bank-account' as const, accountId: ba.id }),
      type: { kind: 'bank-account' as const, accountId: ba.id },
      category: t('dashboard.categoryAccounts')
    })),
    { id: 'upcoming-expenses', type: { kind: 'upcoming-expenses' as const }, category: t('dashboard.categoryLists') },
    { id: 'unpaid-items', type: { kind: 'unpaid-items' as const }, category: t('dashboard.categoryLists') },
    { id: 'top-expenses', type: { kind: 'top-expenses' as const }, category: t('dashboard.categoryLists') },
    { id: 'pending-incomes', type: { kind: 'pending-incomes' as const }, category: t('dashboard.categoryLists') },
    { id: 'ending-installments', type: { kind: 'ending-installments' as const }, category: t('dashboard.categoryLists') },

    { id: 'overdue-items', type: { kind: 'overdue-items' as const }, category: t('dashboard.categoryLists') },
    { id: 'upcoming-billing', type: { kind: 'upcoming-billing' as const }, category: t('dashboard.categoryLists') },
    { id: 'month-comparison', type: { kind: 'month-comparison' as const }, category: t('dashboard.categoryAnalyses') },
    { id: 'next-month-comparison', type: { kind: 'next-month-comparison' as const }, category: t('dashboard.categoryAnalyses') },
    { id: 'type-distribution', type: { kind: 'type-distribution' as const }, category: t('dashboard.categoryAnalyses') },
    { id: 'category-distribution', type: { kind: 'category-distribution' as const }, category: t('dashboard.categoryAnalyses') },
    { id: 'subcategory-distribution', type: { kind: 'subcategory-distribution' as const }, category: t('dashboard.categoryAnalyses') },
    { id: 'tag-distribution', type: { kind: 'tag-distribution' as const }, category: t('dashboard.categoryAnalyses') },
    { id: 'income-type-distribution', type: { kind: 'income-type-distribution' as const }, category: t('dashboard.categoryAnalyses') },
    { id: 'income-category-distribution', type: { kind: 'income-category-distribution' as const }, category: t('dashboard.categoryAnalyses') },
    { id: 'income-subcategory-distribution', type: { kind: 'income-subcategory-distribution' as const }, category: t('dashboard.categoryAnalyses') },
    { id: 'current-month-summary', type: { kind: 'current-month-summary' as const }, category: t('dashboard.categoryAnalyses') },
    { id: 'previous-month-summary', type: { kind: 'previous-month-summary' as const }, category: t('dashboard.categoryAnalyses') },
    { id: 'next-month-summary', type: { kind: 'next-month-summary' as const }, category: t('dashboard.categoryAnalyses') }
  ]

  // Compute assigned and unassigned widgets
  const assignedIds = new Set<string>()
  for (const row of layout.rows) {
    for (const slot of row.slots) {
      if (slot.widgetId) assignedIds.add(slot.widgetId)
    }
  }

  const unassignedWidgets = availableWidgets
    .filter(aw => !assignedIds.has(aw.id))
    .map(aw => ({ id: aw.id, label: getWidgetLabel(aw.id, summary, t), category: aw.category }))

  // ── Widget render context ──

  const widgetCtx: WidgetRenderContext = {
    summary, widgetsData, expenseTotal, month, navigate,
    gastosStyle, receitasStyle, saldoStyle, startCountingMonth,
    availableWidgets, t, formatMoney: formatDisplayCurrency
  }

  const renderWidgetContent = (widgetId: string, widthPercent: number, displayPrefs?: Record<string, any>) =>
    renderWidget(widgetId, widthPercent, widgetCtx, displayPrefs)

  const renderWidgetPreview = (widgetId: string) => renderWidgetContent(widgetId, 50)

  const personBadge = (
    <div className="flex items-center gap-2 ml-2">
      <div className="h-6 w-6 rounded-full flex items-center justify-center text-white text-xs font-bold" style={{ backgroundColor: activePerson.color }}>
        {activePerson.name.charAt(0).toUpperCase()}
      </div>
      <span className="text-sm text-muted-foreground">{activePerson.name}</span>
    </div>
  )

  const editingRow = editingRowId ? layout.rows.find(r => r.id === editingRowId) : null

  const renderRows = () => (
    <div className="space-y-4">
      {layout.rows.map((row, rowIdx) => {
        // Check if row has any visible content (non-empty slots)
        const hasContent = row.slots.some(s => s.widgetId)
        // In view mode, skip rows with zero visible widgets
        if (!editMode && !hasContent) return null

        return (
          <div key={row.id} className={`group/row relative ${editMode ? 'pl-10' : ''}`}>
            {/* Row controls — only in edit mode */}
            {editMode && (
              <div className="absolute left-0 top-1/2 -translate-y-1/2 flex flex-col gap-0.5 z-10">
                <button type="button" onClick={() => moveRow(row.id, -1)} disabled={rowIdx === 0}
                  className="p-0.5 rounded hover:bg-accent text-muted-foreground hover:text-foreground disabled:opacity-30 transition-colors" title={t('dashboard.moveUp')}>
                  <ChevronUp size={14} />
                </button>
                <button type="button" onClick={() => { setEditingRowId(row.id) }}
                  className="p-0.5 rounded hover:bg-accent text-muted-foreground hover:text-foreground transition-colors" title={t('dashboard.editRow')}>
                  <Pencil size={14} />
                </button>
                <button type="button" onClick={() => deleteRow(row.id)}
                  className="p-0.5 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors" title={t('dashboard.deleteRow')}>
                  <Trash2 size={14} />
                </button>
                <button type="button" onClick={() => moveRow(row.id, 1)} disabled={rowIdx === layout.rows.length - 1}
                  className="p-0.5 rounded hover:bg-accent text-muted-foreground hover:text-foreground disabled:opacity-30 transition-colors" title={t('dashboard.moveDown')}>
                  <ChevronDown size={14} />
                </button>
              </div>
            )}

            {/* Slots */}
            <div className="flex flex-col md:flex-row gap-4">
              {row.slots.map((slot, slotIdx) => {
                const slotId = `${row.id}-${slotIdx}`
                if (slot.widgetId) {
                  return (
                    <DroppableSlot
                      key={slotId}
                      id={slotId}
                      widgetId={slot.widgetId}
                      widthPercent={slot.widthPercent}
                      onRemove={() => removeWidget(row.id, slotIdx)}
                      onSettings={hasWidgetSettings(slot.widgetId) ? () => setSettingsTarget({ rowId: row.id, slotIdx, widgetId: slot.widgetId! }) : undefined}
                      editMode={editMode}
                    >
                      {renderWidgetContent(slot.widgetId, slot.widthPercent, slot.displayPrefs)}
                    </DroppableSlot>
                  )
                }
                return (
                  <EmptySlot
                    key={slotId}
                    id={slotId}
                    widthPercent={slot.widthPercent}
                    availableWidgets={unassignedWidgets}
                    onSelectWidget={(widgetId) => assignWidget(row.id, slotIdx, widgetId)}
                    renderPreview={renderWidgetPreview}
                    editMode={editMode}
                  />
                )
              })}
            </div>
          </div>
        )
      })}
    </div>
  )

  return (
    <SectionLayout
      icon={House}
      title={t('dashboard.title')}
      breadcrumbs={personBadge}
      monthNav={<CurrencyMonthNavigator month={month} onChange={setMonth} />}
      actionButton={
        editMode ? (
          <Button size="sm" onClick={() => setEditMode(false)}>
            <Check size={16} /> {t('dashboard.done')}
          </Button>
        ) : (
          <Button variant="outline" size="sm" onClick={() => setEditMode(true)}>
            <Settings2 size={16} /> {t('dashboard.customize')}
          </Button>
        )
      }
    >
      {/* Edit mode banner */}
      {editMode && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-primary/10 border border-primary/20 text-sm text-primary mb-4">
          <Pencil size={14} />
          <span>{t('dashboard.editModeActive')}</span>
        </div>
      )}

      <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
        {layout.rows.length > 0 ? (
          renderRows()
        ) : (
          <Card className="p-8 text-center">
            <LayoutGrid size={48} className="mx-auto text-muted-foreground/30 mb-3" />
            <p className="text-muted-foreground mb-4">{t('dashboard.emptyDashboard')}</p>
            <Button variant="outline" onClick={() => { setEditMode(true); setShowRowCreator(true) }}>
              <Plus size={16} /> {t('dashboard.createFirstRow')}
            </Button>
          </Card>
        )}
      </DndContext>

      {/* Add row button — only in edit mode */}
      {editMode && layout.rows.length > 0 && (
        <div className="flex justify-center pt-2">
          <Button variant="outline" size="sm" onClick={() => setShowRowCreator(true)}>
            <Plus size={14} /> {t('dashboard.createNewRow')}
          </Button>
        </div>
      )}

      {/* Create new row modal */}
      <RowCreatorModal
        open={showRowCreator}
        onClose={() => setShowRowCreator(false)}
        onCreate={addRow}
      />

      {/* Edit existing row modal */}
      <RowCreatorModal
        open={editingRowId !== null}
        onClose={() => setEditingRowId(null)}
        onCreate={(newWidths) => {
          if (editingRowId) updateRowSlots(editingRowId, newWidths)
          setEditingRowId(null)
        }}
        initialSlots={editingRow ? editingRow.slots.map(s => s.widthPercent) : undefined}
      />

      {/* Widget settings modal */}
      {settingsTarget && (
        <WidgetSettingsModal
          open={true}
          onClose={() => setSettingsTarget(null)}
          widgetId={settingsTarget.widgetId}
          widgetLabel={getWidgetLabel(settingsTarget.widgetId, summary, t)}
          displayPrefs={
            layout.rows
              .find(r => r.id === settingsTarget.rowId)
              ?.slots[settingsTarget.slotIdx]?.displayPrefs
          }
          onSave={(prefs) => updateSlotPrefs(settingsTarget.rowId, settingsTarget.slotIdx, prefs)}
        />
      )}
    </SectionLayout>
  )
}
