import { formatCurrency, formatCurrencyWith } from '../../lib/currency'
import { useFormatDate } from '../../lib/date'
import { getItemCardLabels, formatCardLabel } from '../../lib/card-utils'
import { formatDayLabelResolved } from '../../../../../shared/day-utils'
import { useBusinessDayConfig } from '../../contexts/BusinessDayContext'
import { useDimPaid } from '../../contexts/DimPaidContext'
import { useTileFields } from '../../contexts/TileFieldsContext'
import { useTranslation } from '../../contexts/LanguageContext'
import {
  Pencil, CheckCircle, Circle, Trash2, ToggleRight, ToggleLeft,
  CircleDot, Layers, Repeat, Landmark, CalendarClock, CreditCard,
  Store, Tag, Wallet, DollarSign, X
} from 'lucide-react'
import { Card } from '../../components/ui/Card'
import { CurrencyTooltip } from '../../components/ui/CurrencyTooltip'
import { KebabMenu } from '../../components/ui/KebabMenu'
import type { SectionItem } from '../../types/entities'

interface ItemsTileProps {
  item: SectionItem
  month: string
  columns: number
  fieldsPage?: string
  styleScope?: string
  gastosStyle: (category: string, type: string) => React.CSSProperties
  onEdit: (item: SectionItem) => void
  onToggleActive: (item: SectionItem) => void
  onTogglePaid: (itemId: number) => void
  onDelete: (itemId: number) => void
  onEditValue: (item: SectionItem) => void
  onReactivate: (interruptionId: number) => void
  onInterrupt: (item: SectionItem) => void
  onViewInterruptions: (item: SectionItem) => void
}

export function ItemsTile({
  item, month, columns, fieldsPage = 'items', styleScope = 'items', gastosStyle,
  onEdit, onToggleActive, onTogglePaid, onDelete,
  onEditValue, onReactivate, onInterrupt, onViewInterruptions
}: ItemsTileProps) {
  const { t } = useTranslation()
  const { fmtDate, fmtMonth } = useFormatDate()
  const { businessDayConfig } = useBusinessDayConfig()
  const { dimPaid } = useDimPaid()
  const { gastosFields } = useTileFields(fieldsPage)
  const [mYear, mMonth] = month.split('-').map(Number)

  const hasSplits = item.cardSplits && item.cardSplits.length > 0
  const isForeign = !!(item.currencySymbol && item.exchangeRateSnapshot && item.exchangeRateSnapshot !== 1.0)
  const sym = item.currencySymbol || ''
  const snap = item.exchangeRateSnapshot || 1.0
  const fmtVal = (v: number) => isForeign ? formatCurrencyWith(v, sym) : formatCurrency(v)
  const fmtBase = (v: number) => formatCurrency(v * snap)
  let installmentValue: number
  if (hasSplits) {
    installmentValue = item.cardSplits!.reduce((acc, sp) => {
      const monthly = Math.round((sp.value / sp.totalInstallments) * 100) / 100
      if ((sp.anticipatedThisMonth || 0) > 0 && sp.discountedTotalThisMonth != null) {
        return acc + monthly + sp.discountedTotalThisMonth
      }
      return acc + monthly * (1 + (sp.anticipatedThisMonth || 0))
    }, 0)
  } else if ((item.type === 'installment' || item.type === 'emprestimo') && item.totalInstallments) {
    const monthly = Math.round((item.value / item.totalInstallments) * 100) / 100
    if ((item.anticipatedThisMonth || 0) > 0 && item.discountedTotalThisMonth != null) {
      installmentValue = monthly + item.discountedTotalThisMonth
    } else if ((item.anticipatedThisMonth || 0) > 0) {
      installmentValue = monthly * (1 + item.anticipatedThisMonth!)
    } else {
      installmentValue = monthly
    }
  } else {
    installmentValue = item.type === 'subscription' ? (item.effectiveValue ?? item.value) : item.value
  }

  const metaItems: { icon: any; text: string }[] = []
  const typeIcon = item.type === 'emprestimo' ? Landmark : item.type === 'installment' ? Layers : item.type === 'subscription' ? Repeat : CircleDot
  const typeText = item.type === 'emprestimo' ? t('itemTypes.emprestimo') : item.type === 'installment' ? t('itemTypes.installment') : item.type === 'subscription' ? t('itemTypes.subscription') : t('itemTypes.common')
  if (gastosFields.type) metaItems.push({ icon: typeIcon, text: typeText })
  if (gastosFields.billingDay) {
    const billingDayText = formatDayLabelResolved(item.billingDay ?? null, item.billingDayType || null, t('items.billingDayLabel'), mYear, mMonth, businessDayConfig, undefined, item.billingDayMonthOffset || 0)
    if (billingDayText) metaItems.push({ icon: CalendarClock, text: billingDayText })
  }
  if (gastosFields.dueDay) {
    const dueOffset = item.dueDayMonthOffset || 0
    let dueDayText: string
    if (item.dueDayType === 'card_due' && item.cardDueDays && item.cardDueDays.length > 0) {
      let dueMonth = mMonth + dueOffset
      if (dueMonth > 12) dueMonth -= 12
      const mm = String(dueMonth).padStart(2, '0')
      const uniqueDays = [...new Set(item.cardDueDays)]
      dueDayText = t('items.dueDayText', { label: t('items.dueDayLabel'), day: uniqueDays.map(d => `${String(d).padStart(2, '0')}/${mm}`).join(` ${t('insights.andConjunction')} `) }) + ` (${t('dayPicker.cardDueDay')})`
    } else {
      dueDayText = formatDayLabelResolved(item.dueDay, item.dueDayType || null, t('items.dueDayLabel'), mYear, mMonth, businessDayConfig, undefined, dueOffset)
    }
    if (dueDayText) metaItems.push({ icon: CalendarClock, text: dueDayText })
  }
  if (gastosFields.card) {
    const cardLabels = getItemCardLabels(item)
    if (cardLabels.length > 0) {
      for (const label of cardLabels) metaItems.push({ icon: CreditCard, text: label })
    } else {
      metaItems.push({ icon: Wallet, text: t('items.noCard') })
    }
  }
  if (gastosFields.store && item.storeName) metaItems.push({ icon: Store, text: item.storeName })
  if (gastosFields.interestRate && item.interestRate && item.interestRate > 0) metaItems.push({ icon: Landmark, text: t('items.interestRate', { rate: item.interestRate }) })
  if (item.type === 'emprestimo' && item.baseValue && item.baseValue > 0) metaItems.push({ icon: DollarSign, text: t('items.baseValue', { value: fmtVal(item.baseValue) }) })

  const isInstallment = (item.type === 'installment' || item.type === 'emprestimo') && item.totalInstallments && item.currentInstallment
  const installmentCards: { name: string; current: number; total: number; monthly: number; anticipated: number }[] = []
  if (isInstallment) {
    if (hasSplits && item.type !== 'emprestimo') {
      for (const sp of item.cardSplits!) {
        const cur = sp.currentInstallment || Math.min(item.currentInstallment!, sp.totalInstallments)
        const anticipated = sp.anticipatedThisMonth || 0
        const spLabel = sp.cardName ? formatCardLabel(sp.cardName, sp.cardType, sp.paymentMethod) : t('items.cardFallback', { id: String(sp.cardId) })
        installmentCards.push({ name: spLabel, current: cur, total: sp.totalInstallments, monthly: sp.value / sp.totalInstallments, anticipated })
      }
    } else {
      installmentCards.push({
        name: item.type === 'emprestimo' ? t('items.installments') : (item.cardName || t('items.installments')),
        current: item.currentInstallment!,
        total: item.totalInstallments!,
        monthly: item.value / item.totalInstallments!,
        anticipated: item.anticipatedThisMonth || 0
      })
    }
  }

  const kebabItems = () => {
    const base: any[] = [
      { label: t('common.edit'), icon: Pencil, onClick: () => onEdit(item) },
      { label: item.isActive ? t('common.deactivate') : t('common.activate'), icon: item.isActive ? ToggleRight : ToggleLeft, onClick: () => onToggleActive(item) }
    ]
    if (item.isPaid) {
      base.push({ label: t('items.undoPayment'), icon: CheckCircle, onClick: () => onTogglePaid(item.id) })
    }
    if (item.type === 'subscription') {
      base.push({ label: t('items.editValueThisMonth'), icon: DollarSign, onClick: () => onEditValue(item) })
    }
    if ((item.type === 'installment' || item.type === 'emprestimo' || item.type === 'subscription') && item.interruptions && item.interruptions.length > 0) {
      base.push({ label: t('items.viewInterruptions'), icon: Repeat, onClick: () => onViewInterruptions(item) })
    }
    if ((item.type === 'installment' || item.type === 'emprestimo' || item.type === 'subscription') && !(item.interruptions?.some(i => !i.resumeMonth))) {
      base.push({ label: t('items.interrupt'), icon: X, onClick: () => onInterrupt(item) })
    }
    base.push({ label: t('common.delete'), icon: Trash2, onClick: () => onDelete(item.id), destructive: true })
    return base
  }

  const renderMeta = (items: { icon: any; text: string }[], iconSize = 10, textClass = 'text-[11px] text-muted-foreground') => (
    <div className="flex items-center gap-2.5 flex-wrap">
      {items.map((m, i) => {
        const MIcon = m.icon
        return (
          <span key={i} className={`inline-flex items-center gap-1 ${textClass}`}>
            <MIcon size={iconSize} className="shrink-0 opacity-60" />
            {m.text}
          </span>
        )
      })}
    </div>
  )

  const paidCheckbox = (size = 16) => (
    <button onClick={() => onTogglePaid(item.id)} className="shrink-0" title={item.isPaid ? t('items.markUnpaid') : t('items.markPaid')}>
      {item.isPaid
        ? <CheckCircle size={size} className="text-primary" />
        : <Circle size={size} className="text-muted-foreground/40 hover:text-primary transition-colors" />}
    </button>
  )

  const totalAnticipatedThisMonth = hasSplits
    ? item.cardSplits!.reduce((sum, sp) => sum + (sp.anticipatedThisMonth || 0), 0)
    : (item.anticipatedThisMonth || 0)

  return (
    <Card
      className={`group relative overflow-hidden transition-all flex flex-col ${!item.isActive && dimPaid ? 'opacity-50 hover:opacity-100' : ''} ${item.isPaid && dimPaid ? 'opacity-50 hover:opacity-100' : item.isActive || !dimPaid ? 'hover:shadow-md' : ''}`}
    >
      {/* Inactive stripes */}
      {!item.isActive && (
        <div className="absolute inset-0 z-[1] pointer-events-none select-none" style={{ backgroundImage: 'repeating-linear-gradient(135deg, transparent, transparent 8px, hsl(var(--muted)) 8px, hsl(var(--muted)) 9px)', opacity: 0.3 }} />
      )}
      {/* Hover: edit + undo paid buttons */}
      {dimPaid && item.isPaid && item.isActive && (
        <div className="absolute inset-0 z-20 flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity bg-card/50 backdrop-blur-[1px]">
          <button
            onClick={() => onEdit(item)}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-accent text-foreground text-sm font-semibold shadow-md hover:bg-accent/80 transition-colors"
          >
            <Pencil size={14} /> {t('common.edit')}
          </button>
          <button
            onClick={() => onTogglePaid(item.id)}
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
            onClick={() => onEdit(item)}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-accent text-foreground text-sm font-semibold shadow-md hover:bg-accent/80 transition-colors"
          >
            <Pencil size={14} /> {t('common.edit')}
          </button>
          <button
            onClick={() => onToggleActive(item)}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-semibold shadow-md hover:bg-primary/90 transition-colors"
          >
            <ToggleRight size={14} /> {t('common.activate')}
          </button>
        </div>
      )}

      {/* Top bar: checkbox + title + category + tags + kebab */}
      <div className="flex items-center gap-2 px-4 py-2.5 border-b border-border/50 overflow-hidden">
        {paidCheckbox(18)}
        <p className="text-base font-bold truncate flex-1 min-w-0">
          {item.description}
          {item.categoryName && (
            <span className="text-[11px] font-normal text-muted-foreground ml-1.5"> - {item.categoryName}{item.subcategoryName ? `/${item.subcategoryName}` : ''}</span>
          )}
        </p>
        {totalAnticipatedThisMonth > 0 && (
          <span className="text-[10px] px-2 py-0.5 rounded-full font-bold whitespace-nowrap bg-primary/15 text-primary border border-primary/30">{t('items.anticipatedInstallments', { count: totalAnticipatedThisMonth })}</span>
        )}
        {item.interruptions && item.interruptions.length > 0 && (() => {
          const activeInt = item.interruptions.find(i => {
            if (i.resumeMonth) {
              return month >= i.endMonth && month < i.resumeMonth
            }
            return month >= i.endMonth
          })
          const lastVisibleInt = !activeInt ? item.interruptions.find(i => i.endMonth === month) : null
          const displayInt = activeInt || lastVisibleInt
          if (!displayInt) return null
          return (
            <span className="text-[10px] px-2 py-0.5 rounded-full font-bold whitespace-nowrap bg-yellow-500/15 text-yellow-500 border border-yellow-500/30">
              {displayInt.resumeMonth ? t('items.pausedUntil', { month: fmtMonth(displayInt.resumeMonth) }) : t('items.interrupted')}
            </span>
          )
        })()}
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
        <KebabMenu items={kebabItems()} size={16} />
      </div>

      {/* Body: info left + installment cards right */}
      <div className="flex gap-3 flex-1 min-h-0 p-4">
        {/* Left column: value, meta */}
        <div className="flex-1 min-w-0 flex flex-col">
          <div className="flex items-baseline gap-2 mb-1 flex-wrap">
            {isForeign ? (
              <CurrencyTooltip label={fmtBase(installmentValue)}>
                <span className="text-2xl font-bold tabular-nums" style={gastosStyle(styleScope, 'itens')}>
                  {fmtVal(installmentValue)}
                </span>
              </CurrencyTooltip>
            ) : (
              <span className="text-2xl font-bold tabular-nums" style={gastosStyle(styleScope, 'itens')}>
                {fmtVal(installmentValue)}
              </span>
            )}
            {isInstallment && (
              isForeign ? (
                <CurrencyTooltip label={fmtBase(item.value)}>
                  <span className="text-xs text-muted-foreground">{t('items.ofTotal', { value: fmtVal(item.value) })}</span>
                </CurrencyTooltip>
              ) : (
                <span className="text-xs text-muted-foreground">{t('items.ofTotal', { value: fmtVal(item.value) })}</span>
              )
            )}
          </div>
          {metaItems.length > 0 && (
            <div className="mb-1">{renderMeta(metaItems)}</div>
          )}
        </div>

        {/* Right column: installment cards */}
        {gastosFields.installments && isInstallment && item.isActive && installmentCards.length > 0 && (
          <div className="flex gap-1.5 shrink-0 items-start">
            {installmentCards.map((card, i) => {
              const done = card.current >= card.total
              return columns >= 3 ? (
                <div key={i} className="rounded-md border border-border/60 px-2 py-1.5 bg-muted/20 text-center">
                  <p className="text-[10px] text-muted-foreground truncate max-w-[80px]">{card.name}</p>
                  <span className={`text-xs font-bold tabular-nums ${done ? 'text-green-500' : 'text-foreground/70'}`}>{card.current}/{card.total}{card.anticipated > 0 && <span className="text-primary"> (+{card.anticipated})</span>}</span>
                </div>
              ) : (
                <div key={i} className="rounded-lg border border-border/60 px-3 py-2 w-[150px] bg-muted/20">
                  <p className="text-[11px] font-semibold truncate">{card.name}</p>
                  <div className="flex items-center justify-between mt-1">
                    <span className={`text-xs font-bold tabular-nums ${done ? 'text-green-500' : 'text-foreground/70'}`}>{card.current}/{card.total}{card.anticipated > 0 && <span className="text-primary"> (+{card.anticipated})</span>}</span>
                    {isForeign ? (
                      <CurrencyTooltip label={`${fmtBase(card.monthly)}${t('itemsForm.perMonth')}`}>
                        <span className="text-[11px] text-muted-foreground tabular-nums">{fmtVal(card.monthly)}{t('itemsForm.perMonth')}</span>
                      </CurrencyTooltip>
                    ) : (
                      <span className="text-[11px] text-muted-foreground tabular-nums">{fmtVal(card.monthly)}{t('itemsForm.perMonth')}</span>
                    )}
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
