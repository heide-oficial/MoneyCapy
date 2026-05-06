import { useEffect, useState, useCallback } from 'react'

export function useDefaultSortMode<T extends string>(pageKey: string, fallback: T, validModes: readonly T[]) {
  const settingsKey = `defaultSortMode:${pageKey}`
  const [sortMode, setSortMode] = useState<T>(fallback)
  const [defaultSortMode, setDefaultSortModeState] = useState<T | null>(null)

  useEffect(() => {
    let mounted = true
    window.api.settings.get(settingsKey).then((value: string | null) => {
      if (!mounted || !value || !validModes.includes(value as T)) return
      setDefaultSortModeState(value as T)
      setSortMode(value as T)
    }).catch(() => {})
    return () => { mounted = false }
  }, [settingsKey])

  const setDefaultSortMode = useCallback((value: T) => {
    setDefaultSortModeState(value)
    setSortMode(value)
    window.api.settings.set(settingsKey, value)
  }, [settingsKey])

  return { sortMode, setSortMode, defaultSortMode, setDefaultSortMode }
}
