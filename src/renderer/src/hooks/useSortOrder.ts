import { useState, useEffect, useCallback } from 'react'
import { applyStoredOrder } from '../lib/sortOrder'

interface UseSortOrderOptions<T> {
  settingsKey: string
  items: T[]
  getId: (item: T) => string | number
  enabled?: boolean
}

export function useSortOrder<T>({
  settingsKey,
  items,
  getId,
  enabled = true
}: UseSortOrderOptions<T>) {
  const [storedOrder, setStoredOrder] = useState<(string | number)[] | null>(null)

  useEffect(() => {
    if (!enabled || !settingsKey) return
    window.api.settings.get(settingsKey).then((raw: string | null) => {
      if (raw) {
        try { setStoredOrder(JSON.parse(raw)) } catch { setStoredOrder(null) }
      } else {
        setStoredOrder(null)
      }
    })
  }, [settingsKey, enabled])

  const sortedItems = storedOrder
    ? applyStoredOrder(items, storedOrder, getId)
    : items

  const handleReorder = useCallback((newItems: T[]) => {
    const newOrder = newItems.map(getId)
    setStoredOrder(newOrder)
    if (settingsKey) {
      window.api.settings.set(settingsKey, JSON.stringify(newOrder))
    }
  }, [settingsKey, getId])

  return { sortedItems, handleReorder }
}
