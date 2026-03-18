import { Search, X } from 'lucide-react'
import { useTranslation } from '../../contexts/LanguageContext'

interface SearchInputProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
}

export function SearchInput({ value, onChange, placeholder }: SearchInputProps) {
  const { t } = useTranslation()
  const resolvedPlaceholder = placeholder ?? t('common.search')
  return (
    <div className="relative">
      <Search size={12} className="absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
      <input
        type="text"
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={resolvedPlaceholder}
        className="h-7 w-[140px] pl-6 pr-6 text-xs rounded-md border border-input bg-transparent placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/30 transition-colors"
      />
      {value && (
        <button
          type="button"
          onClick={() => onChange('')}
          className="absolute right-1.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
        >
          <X size={12} />
        </button>
      )}
    </div>
  )
}
