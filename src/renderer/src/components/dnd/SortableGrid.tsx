import { useState, useCallback, ReactNode } from 'react'
import {
  DndContext,
  DragOverlay,
  closestCenter,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  DragStartEvent,
  DragEndEvent
} from '@dnd-kit/core'
import {
  SortableContext,
  sortableKeyboardCoordinates,
  rectSortingStrategy
} from '@dnd-kit/sortable'

interface SortableGridProps<T> {
  items: T[]
  getId: (item: T) => string | number
  onReorder: (newItems: T[]) => void
  renderItem: (item: T) => ReactNode
  renderOverlay?: (item: T) => ReactNode
  className?: string
}

export function SortableGrid<T>({
  items,
  getId,
  onReorder,
  renderItem,
  renderOverlay,
  className = 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4'
}: SortableGridProps<T>) {
  const [activeItem, setActiveItem] = useState<T | null>(null)

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 5 }
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates
    })
  )

  const handleDragStart = useCallback((event: DragStartEvent) => {
    const item = items.find(i => getId(i) === event.active.id)
    setActiveItem(item ?? null)
  }, [items, getId])

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    setActiveItem(null)
    const { active, over } = event
    if (!over || active.id === over.id) return

    const oldIndex = items.findIndex(i => getId(i) === active.id)
    const newIndex = items.findIndex(i => getId(i) === over.id)
    if (oldIndex === -1 || newIndex === -1) return

    const newItems = [...items]
    const [moved] = newItems.splice(oldIndex, 1)
    newItems.splice(newIndex, 0, moved)
    onReorder(newItems)
  }, [items, getId, onReorder])

  const ids = items.map(getId)

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <SortableContext items={ids} strategy={rectSortingStrategy}>
        <div className={className}>
          {items.map(item => renderItem(item))}
        </div>
      </SortableContext>

      <DragOverlay dropAnimation={null}>
        {activeItem ? (
          <div className="shadow-xl rounded-lg scale-[1.02] pointer-events-none opacity-90">
            {renderOverlay ? renderOverlay(activeItem) : renderItem(activeItem)}
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  )
}
