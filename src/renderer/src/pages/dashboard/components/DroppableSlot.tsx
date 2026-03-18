import { ReactNode } from 'react'
import { useDroppable } from '@dnd-kit/core'
import { useDraggable } from '@dnd-kit/core'
import { X, GripVertical, Settings2 } from 'lucide-react'
import { useTranslation } from '../../../contexts/LanguageContext'

interface DroppableSlotProps {
  id: string
  widgetId: string
  children: ReactNode
  onRemove: () => void
  onSettings?: () => void
  widthPercent: number
  editMode?: boolean
}

export function DroppableSlot({ id, widgetId, children, onRemove, onSettings, widthPercent, editMode = false }: DroppableSlotProps) {
  const { t } = useTranslation()
  const { setNodeRef: setDropRef, isOver } = useDroppable({ id, disabled: !editMode })
  const {
    attributes,
    listeners,
    setNodeRef: setDragRef,
    transform,
    isDragging
  } = useDraggable({ id: `drag-${id}`, data: { slotId: id, widgetId }, disabled: !editMode })

  const style: React.CSSProperties = {
    minWidth: 0,
    flex: `${widthPercent} 0 0%`,
    ...(transform ? {
      transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
      zIndex: 50
    } : {}),
    opacity: isDragging ? 0.5 : 1
  }

  return (
    <div
      ref={setDropRef}
      className={`relative group/slot flex-shrink-0 transition-shadow rounded-lg ${
        isOver && editMode ? 'ring-2 ring-primary/50' : ''
      }`}
      style={style}
    >
      <div ref={editMode ? setDragRef : undefined}>
        {children}
        {editMode && (
          <div className="absolute top-2 right-2 z-10 flex gap-0.5 opacity-0 group-hover/slot:opacity-100 transition-opacity">
            <button
              type="button"
              className="p-1 rounded bg-card/80 backdrop-blur-sm hover:bg-muted text-muted-foreground hover:text-foreground cursor-grab active:cursor-grabbing"
              {...listeners}
              {...attributes}
              onClick={e => e.stopPropagation()}
            >
              <GripVertical size={14} />
            </button>
            {onSettings && (
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); onSettings() }}
                className="p-1 rounded bg-card/80 backdrop-blur-sm hover:bg-accent text-muted-foreground hover:text-foreground"
                title={t('dashboard.customizeWidget')}
              >
                <Settings2 size={14} />
              </button>
            )}
            <button
              type="button"
              onClick={onRemove}
              className="p-1 rounded bg-card/80 backdrop-blur-sm hover:bg-destructive/10 text-muted-foreground hover:text-destructive"
              title={t('dashboard.removeWidget')}
            >
              <X size={14} />
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
