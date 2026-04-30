import { MonthNavigator } from './MonthNavigator'
import { useDisplayCurrency } from '../../contexts/DisplayCurrencyContext'

interface CurrencyMonthNavigatorProps {
  month: string
  onChange: (month: string) => void
}

export function CurrencySelector() {
  const { currencies, displayCurrency, setDisplayCurrencyId } = useDisplayCurrency()

  if (currencies.length <= 1) return null

  return (
    <select
      value={displayCurrency?.id ?? ''}
      onChange={event => setDisplayCurrencyId(Number(event.target.value))}
      className="h-8 min-w-[86px] rounded-md border border-input bg-card px-2.5 text-sm font-medium text-foreground outline-none transition-colors hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring"
    >
      {currencies.map(currency => (
        <option key={currency.id} value={currency.id}>
          {currency.code}
        </option>
      ))}
    </select>
  )
}

export function CurrencyMonthNavigator({ month, onChange }: CurrencyMonthNavigatorProps) {
  return (
    <div className="flex items-center gap-2">
      <CurrencySelector />
      <MonthNavigator month={month} onChange={onChange} />
    </div>
  )
}
