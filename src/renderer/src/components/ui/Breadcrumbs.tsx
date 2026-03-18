import { useNavigate } from 'react-router-dom'
import { ChevronRight } from 'lucide-react'

export interface BreadcrumbItem {
  label: string
  path?: string
}

interface BreadcrumbsProps {
  items: BreadcrumbItem[]
}

export function Breadcrumbs({ items }: BreadcrumbsProps) {
  const navigate = useNavigate()

  return (
    <nav className="flex items-center gap-1 text-sm">
      {items.map((item, i) => {
        const isLast = i === items.length - 1
        return (
          <span key={i} className="flex items-center gap-1">
            {i > 0 && <ChevronRight size={12} className="text-muted-foreground/50" />}
            {isLast || !item.path ? (
              <span className={isLast ? 'font-semibold text-foreground' : 'text-muted-foreground'}>{item.label}</span>
            ) : (
              <button
                onClick={() => navigate(item.path!)}
                className="text-muted-foreground hover:text-foreground transition-colors"
              >
                {item.label}
              </button>
            )}
          </span>
        )
      })}
    </nav>
  )
}
