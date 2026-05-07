import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { ReactNode } from 'react'
import { DragHandle } from '../ui/DragHandle'

interface SortableItemProps {
  id: string | number
  children: ReactNode
  className?: string
  dragHandle?: boolean
}

export function SortableItem({ id, children, className, dragHandle = true }: SortableItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging
  } = useSortable({ id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`group/drag relative ${!dragHandle ? 'cursor-grab active:cursor-grabbing' : ''} ${className ?? ''}`}
      {...(!dragHandle ? attributes : {})}
      {...(!dragHandle ? listeners : {})}
    >
      {dragHandle && <DragHandle listeners={listeners} attributes={attributes} />}
      {children}
    </div>
  )
}
