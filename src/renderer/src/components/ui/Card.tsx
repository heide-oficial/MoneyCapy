import { HTMLAttributes, forwardRef } from 'react'

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  hover?: boolean
}

export const Card = forwardRef<HTMLDivElement, CardProps>(
  ({ className = '', hover = false, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={`rounded-lg border border-border bg-card text-card-foreground ${
          hover ? 'transition-colors hover:border-primary/30 hover:bg-card/80 cursor-pointer' : ''
        } ${className}`}
        {...props}
      />
    )
  }
)
Card.displayName = 'Card'

export function CardHeader({ className = '', ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={`flex flex-col space-y-1.5 p-4 pb-2 ${className}`} {...props} />
}

export function CardTitle({ className = '', ...props }: HTMLAttributes<HTMLHeadingElement>) {
  return <h3 className={`text-base font-semibold leading-none ${className}`} {...props} />
}

export function CardContent({ className = '', ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={`p-4 pt-2 ${className}`} {...props} />
}
