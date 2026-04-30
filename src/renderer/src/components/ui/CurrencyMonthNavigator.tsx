import { MonthNavigator } from './MonthNavigator'
import { useDisplayCurrency } from '../../contexts/DisplayCurrencyContext'

interface CurrencyMonthNavigatorProps {
  month: string
  onChange: (month: string) => void
}

export function CurrencyMonthNavigator({ month, onChange }: CurrencyMonthNavigatorProps) {
  const { currencies, displayCurrency, setDisplayCurrencyId } = useDisplayCurrency()

  return (
    <div className="flex items-center gap-2">
      {currencies.length > 1 && (
        <select
          value={displayCurrency?.id ?? ''}
          onChange={event => setDisplayCurrencyId(Number(event.target.value))}
          className="h-9 min-w-[92px] rounded-md border border-input bg-card px-3 text-sm font-medium text-foreground outline-none transition-colors hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring"
        >
          {currencies.map(currency => (
            <option key={currency.id} value={currency.id}>
              {currency.code}
            </option>
          ))}
        </select>
      )}
      <MonthNavigator month={month} onChange={onChange} />
    </div>
  )
}
