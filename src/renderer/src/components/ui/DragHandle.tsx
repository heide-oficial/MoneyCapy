import { forwardRef, HTMLAttributes } from 'react'
import { GripVertical } from 'lucide-react'

interface DragHandleProps extends HTMLAttributes<HTMLButtonElement> {
  listeners?: Record<string, Function>
  attributes?: Record<string, any>
}

export const DragHandle = forwardRef<HTMLButtonElement, DragHandleProps>(
  ({ listeners, attributes, className = '', ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={`absolute top-2 right-2 z-10 p-1 rounded opacity-0 group-hover/drag:opacity-100
                    transition-opacity text-muted-foreground hover:text-foreground
                    hover:bg-muted cursor-grab active:cursor-grabbing ${className}`}
        {...listeners}
        {...attributes}
        {...props}
        onClick={(e) => e.stopPropagation()}
      >
        <GripVertical size={16} />
      </button>
    )
  }
)
DragHandle.displayName = 'DragHandle'
