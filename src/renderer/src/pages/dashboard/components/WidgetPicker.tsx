import { useState, ReactNode } from 'react'
import { Modal } from '../../../components/ui/Modal'
import { Plus, Search } from 'lucide-react'
import { useTranslation } from '../../../contexts/LanguageContext'

interface WidgetPickerProps {
  availableWidgets: { id: string; label: string; category: string }[]
  onSelect: (widgetId: string) => void
  renderPreview: (widgetId: string) => ReactNode
}

export function WidgetPicker({ availableWidgets, onSelect, renderPreview }: WidgetPickerProps) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')

  const CATEGORY_ORDER = [
    t('dashboard.categorySummary'),
    t('dashboard.categoryByType'),
    t('dashboard.categoryCards'),
    t('dashboard.categoryAccounts'),
    t('dashboard.categoryLists'),
    t('dashboard.categoryAnalyses'),
    t('dashboard.others')
  ]

  const smallCategories = new Set([
    t('dashboard.categorySummary'),
    t('dashboard.categoryByType'),
    t('dashboard.categoryCards'),
    t('dashboard.categoryAccounts')
  ])

  const filtered = search
    ? availableWidgets.filter(w => w.label.toLowerCase().includes(search.toLowerCase()))
    : availableWidgets

  // Group by category
  const grouped = new Map<string, typeof filtered>()
  for (const w of filtered) {
    if (!grouped.has(w.category)) grouped.set(w.category, [])
    grouped.get(w.category)!.push(w)
  }

  const sortedCategories = CATEGORY_ORDER.filter(c => grouped.has(c))

  return (
    <>
      <button
        type="button"
        onClick={() => { setOpen(true); setSearch('') }}
        className="flex items-center justify-center h-8 w-8 rounded-lg border-2 border-dashed border-muted-foreground/30 text-muted-foreground/50 hover:border-primary/50 hover:text-primary/70 transition-colors"
        title={t('dashboard.addWidget')}
      >
        <Plus size={16} />
      </button>

      <Modal open={open} onClose={() => setOpen(false)} title={t('dashboard.addWidget')} maxWidth="max-w-4xl">
        <div className="space-y-4">
          {/* Search */}
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              placeholder={t('dashboard.searchWidget')}
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full rounded-lg border border-input bg-background pl-9 pr-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
              autoFocus
            />
          </div>

          {/* Widget previews */}
          <div className="max-h-[65vh] overflow-y-auto space-y-6 pr-1">
            {availableWidgets.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">{t('dashboard.allWidgetsAllocated')}</p>
            ) : filtered.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">{t('dashboard.noWidgetFound')}</p>
            ) : (
              sortedCategories.map(cat => {
                const widgets = grouped.get(cat)!
                const isSmallCategory = smallCategories.has(cat)
                return (
                  <div key={cat}>
                    <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">{cat}</h3>
                    <div className={isSmallCategory ? 'grid grid-cols-1 sm:grid-cols-2 gap-3' : 'grid grid-cols-1 gap-3'}>
                      {widgets.map(w => (
                        <button
                          key={w.id}
                          type="button"
                          onClick={() => { onSelect(w.id); setOpen(false) }}
                          className="group relative rounded-xl border-2 border-transparent hover:border-primary/50 transition-all text-left"
                        >
                          {/* Actual widget preview */}
                          <div className="pointer-events-none max-h-[200px] overflow-hidden rounded-lg">
                            {renderPreview(w.id)}
                          </div>
                          {/* Hover overlay */}
                          <div className="absolute inset-0 rounded-xl bg-primary/0 group-hover:bg-primary/5 transition-colors flex items-end justify-center opacity-0 group-hover:opacity-100">
                            <span className="mb-3 px-3 py-1 rounded-full bg-primary text-primary-foreground text-xs font-medium shadow-lg">
                              {t('dashboard.add')}
                            </span>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                )
              })
            )}
          </div>
        </div>
      </Modal>
    </>
  )
}
