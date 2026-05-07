import { useEffect, useLayoutEffect, useState, type DependencyList, type RefObject } from 'react'

type PopoverAlign = 'start' | 'end'

interface AnchoredPopoverOptions<
  TAnchor extends HTMLElement = HTMLElement,
  TPopover extends HTMLElement = HTMLElement
> {
  anchorRef: RefObject<TAnchor | null>
  popoverRef: RefObject<TPopover | null>
  onClose?: () => void
  enabled?: boolean
  align?: PopoverAlign
  offset?: number
  margin?: number
  ignoreSelector?: string
  deps?: DependencyList
}

export interface AnchoredPopoverPosition {
  top: number
  left: number
  ready: boolean
}

export function useAnchoredPopover<
  TAnchor extends HTMLElement = HTMLElement,
  TPopover extends HTMLElement = HTMLElement
>({
  anchorRef,
  popoverRef,
  onClose,
  enabled = true,
  align = 'start',
  offset = 4,
  margin = 8,
  ignoreSelector = '[data-filter-dropdown]',
  deps = []
}: AnchoredPopoverOptions<TAnchor, TPopover>): AnchoredPopoverPosition {
  const [position, setPosition] = useState<AnchoredPopoverPosition>({ top: 0, left: 0, ready: false })

  useLayoutEffect(() => {
    if (!enabled || !anchorRef.current || !popoverRef.current) return

    const updatePosition = () => {
      if (!anchorRef.current || !popoverRef.current) return

      const anchor = anchorRef.current.getBoundingClientRect()
      const popover = popoverRef.current.getBoundingClientRect()
      let top = anchor.bottom + offset
      let left = align === 'end' ? anchor.right - popover.width : anchor.left

      if (left + popover.width > window.innerWidth) {
        left = window.innerWidth - popover.width - margin
      }
      if (top + popover.height > window.innerHeight) {
        top = anchor.top - popover.height - offset
      }
      if (left < margin) left = margin
      if (top < margin) top = margin

      setPosition({ top, left, ready: true })
    }

    updatePosition()
    window.addEventListener('resize', updatePosition)
    window.addEventListener('scroll', updatePosition, true)

    return () => {
      window.removeEventListener('resize', updatePosition)
      window.removeEventListener('scroll', updatePosition, true)
    }
  }, [align, anchorRef, enabled, margin, offset, popoverRef, ...deps])

  useEffect(() => {
    if (!enabled || !onClose) return

    const handleMouseDown = (event: MouseEvent) => {
      const target = event.target as Node
      const targetElement = target instanceof Element ? target : null

      if (ignoreSelector && targetElement?.closest(ignoreSelector)) return
      if (anchorRef.current?.contains(target)) return
      if (popoverRef.current?.contains(target)) return

      onClose()
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }

    document.addEventListener('mousedown', handleMouseDown)
    document.addEventListener('keydown', handleKeyDown)

    return () => {
      document.removeEventListener('mousedown', handleMouseDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [anchorRef, enabled, ignoreSelector, onClose, popoverRef])

  return position
}
