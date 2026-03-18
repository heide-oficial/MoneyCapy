import { ReactNode } from 'react'
import { useDroppable } from '@dnd-kit/core'
import { WidgetPicker } from './WidgetPicker'

interface EmptySlotProps {
  id: string
  widthPercent: number
  availableWidgets: { id: string; label: string; category: string }[]
  onSelectWidget: (widgetId: string) => void
  renderPreview: (widgetId: string) => ReactNode
  editMode?: boolean
}

export function EmptySlot({ id, widthPercent, availableWidgets, onSelectWidget, renderPreview, editMode = false }: EmptySlotProps) {
  const { setNodeRef, isOver } = useDroppable({ id, disabled: !editMode })

  if (!editMode) {
    // In view mode, empty slots are invisible spacers
    return <div style={{ flex: `${widthPercent} 0 0%`, minWidth: 0 }} />
  }

  return (
    <div
      ref={setNodeRef}
      className={`flex-shrink-0 rounded-lg border-2 border-dashed flex items-center justify-center min-h-[120px] transition-colors ${
        isOver
          ? 'border-primary/50 bg-primary/5'
          : 'border-muted-foreground/20 bg-muted/20'
      }`}
      style={{ flex: `${widthPercent} 0 0%`, minWidth: 0 }}
    >
      <WidgetPicker
        availableWidgets={availableWidgets}
        onSelect={onSelectWidget}
        renderPreview={renderPreview}
      />
    </div>
  )
}
