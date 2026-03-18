import type { ReactNode } from 'react'

interface CurrencyTooltipProps {
  children: ReactNode
  label: string
  className?: string
}

export function CurrencyTooltip({ children, label, className = '' }: CurrencyTooltipProps) {
  return (
    <span className={`relative group/tip inline-flex ${className}`}>
      {children}
      <span className="pointer-events-none absolute left-1/2 -translate-x-1/2 bottom-full mb-1.5 px-2 py-1 rounded-md bg-card border border-border text-xs font-medium text-card-foreground shadow-md whitespace-nowrap opacity-0 scale-95 transition-all group-hover/tip:opacity-100 group-hover/tip:scale-100 z-50">
        {label}
      </span>
    </span>
  )
}
