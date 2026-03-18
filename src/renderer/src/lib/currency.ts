import type { CurrencyConfig } from '../contexts/CurrencySettingsContext'

let _config: CurrencyConfig = {
  symbol: 'R$',
  decimalSep: ',',
  thousandSep: '.'
}

export function setCurrencyConfig(config: CurrencyConfig) {
  _config = config
}

export function formatCurrency(value: number): string {
  const abs = Math.abs(value)
  const [intPart, decPart] = abs.toFixed(2).split('.')
  const grouped = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, _config.thousandSep)
  const formatted = `${_config.symbol} ${grouped}${_config.decimalSep}${decPart}`
  return value < 0 ? `-${formatted}` : formatted
}

export function parseCurrencyInput(input: string): number {
  const cleaned = input.replace(/[^\d,.-]/g, '').replace(',', '.')
  const value = parseFloat(cleaned)
  return isNaN(value) ? 0 : value
}

export function formatCurrencyInput(value: number): string {
  if (value === 0) return ''
  const abs = Math.abs(value)
  const [intPart, decPart] = abs.toFixed(2).split('.')
  const grouped = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, _config.thousandSep)
  const result = `${grouped}${_config.decimalSep}${decPart}`
  return value < 0 ? `-${result}` : result
}

export function getCurrencySymbol(): string {
  return _config.symbol
}

export function getCurrencyConfig(): CurrencyConfig {
  return _config
}

export function formatCurrencyWith(value: number, symbol: string): string {
  const abs = Math.abs(value)
  const [intPart, decPart] = abs.toFixed(2).split('.')
  const grouped = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, _config.thousandSep)
  const formatted = `${symbol} ${grouped}${_config.decimalSep}${decPart}`
  return value < 0 ? `-${formatted}` : formatted
}

export function formatWithOriginal(
  baseValue: number,
  originalValue: number,
  originalSymbol: string,
  isBaseCurrency: boolean
): string {
  const baseFormatted = formatCurrency(baseValue)
  if (isBaseCurrency) return baseFormatted
  const originalFormatted = formatCurrencyWith(originalValue, originalSymbol)
  return `${baseFormatted} (${originalFormatted})`
}
