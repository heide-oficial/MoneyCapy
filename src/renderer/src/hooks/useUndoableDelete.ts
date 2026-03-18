import { useState, useRef, useCallback, useEffect } from 'react'
import { toast } from 'sonner'
import { useTranslation } from '../contexts/LanguageContext'

interface UseUndoableDeleteOptions {
  onDelete: (id: number) => Promise<void>
  toastLabel?: string
  duration?: number
}

export function useUndoableDelete({
  onDelete,
  toastLabel,
  duration = 5000
}: UseUndoableDeleteOptions) {
  const { t } = useTranslation()
  const resolvedToastLabel = toastLabel ?? t('common.deleted')
  const [pendingIds, setPendingIds] = useState<Set<number>>(new Set())
  const timersRef = useRef<Map<number, ReturnType<typeof setTimeout>>>(new Map())
  const onDeleteRef = useRef(onDelete)
  onDeleteRef.current = onDelete
  const mountedRef = useRef(true)

  useEffect(() => {
    return () => {
      mountedRef.current = false
      // Execute pending deletes immediately on unmount instead of canceling them
      for (const [id, timer] of timersRef.current.entries()) {
        clearTimeout(timer)
        onDeleteRef.current(id)
      }
      timersRef.current.clear()
    }
  }, [])

  const requestDelete = useCallback((id: number) => {
    if (timersRef.current.has(id)) return

    setPendingIds(prev => new Set(prev).add(id))

    const timer = setTimeout(async () => {
      timersRef.current.delete(id)
      if (mountedRef.current) {
        setPendingIds(prev => {
          const next = new Set(prev)
          next.delete(id)
          return next
        })
      }
      await onDeleteRef.current(id)
    }, duration)

    timersRef.current.set(id, timer)

    toast(resolvedToastLabel, {
      duration,
      action: {
        label: t('common.undo'),
        onClick: () => {
          const timer = timersRef.current.get(id)
          if (timer) {
            clearTimeout(timer)
            timersRef.current.delete(id)
            setPendingIds(prev => {
              const next = new Set(prev)
              next.delete(id)
              return next
            })
          }
        }
      }
    })
  }, [resolvedToastLabel, duration, t])

  const isPending = useCallback((id: number) => {
    return pendingIds.has(id)
  }, [pendingIds])

  return { requestDelete, isPending }
}
