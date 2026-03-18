import { HTMLAttributes } from 'react'

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: 'default' | 'secondary' | 'destructive' | 'outline'
  color?: string
}

export function Badge({ className = '', variant = 'default', color, style, ...props }: BadgeProps) {
  const variants = {
    default: 'bg-primary/10 text-primary',
    secondary: 'bg-secondary text-secondary-foreground',
    destructive: 'bg-destructive/10 text-destructive',
    outline: 'border border-border text-foreground'
  }

  const customStyle = color
    ? { ...style, backgroundColor: `${color}20`, color }
    : style

  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
        color ? '' : variants[variant]
      } ${className}`}
      style={customStyle}
      {...props}
    />
  )
}
