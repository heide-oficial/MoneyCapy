import { useState, useEffect, forwardRef, InputHTMLAttributes } from 'react'
import { getCurrencySymbol, getCurrencyConfig, formatCurrencyInput } from '../../lib/currency'

interface CurrencyInputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange'> {
  value: number
  onChange: (value: number) => void
  label?: string
  error?: string
  symbol?: string
}

export const CurrencyInput = forwardRef<HTMLInputElement, CurrencyInputProps>(
  ({ value, onChange, label, error, symbol: symbolProp, id, className = '', ...props }, ref) => {
    const [display, setDisplay] = useState('')

    useEffect(() => {
      if (value === 0 && display === '') return
      setDisplay(formatCurrencyInput(value))
    }, [value])

    const MAX_VALUE = 999_000_000_000_000

    function handleChange(raw: string) {
      // Remove tudo exceto digitos
      const digits = raw.replace(/\D/g, '')
      if (digits === '') {
        setDisplay('')
        onChange(0)
        return
      }
      const cents = parseInt(digits, 10)
      const val = Math.min(cents / 100, MAX_VALUE)
      setDisplay(formatCurrencyInput(val))
      onChange(val)
    }

    const config = getCurrencyConfig()
    const placeholder = `0${config.decimalSep}00`

    return (
      <div className="space-y-1">
        {label && (
          <label htmlFor={id} className="text-sm font-medium text-foreground">
            {label}
          </label>
        )}
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
            {symbolProp || getCurrencySymbol()}
          </span>
          <input
            ref={ref}
            id={id}
            type="text"
            inputMode="numeric"
            value={display}
            onChange={(e) => handleChange(e.target.value)}
            placeholder={placeholder}
            className={`flex h-9 w-full rounded-md border border-input bg-transparent pl-9 pr-3 py-1 text-sm text-foreground shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 ${
              error ? 'border-destructive' : ''
            } ${className}`}
            {...props}
          />
        </div>
        {error && <p className="text-xs text-destructive">{error}</p>}
      </div>
    )
  }
)
CurrencyInput.displayName = 'CurrencyInput'
