import { useState, useRef, useCallback, useEffect } from 'react'
import { Modal } from '../../../components/ui/Modal'
import { Button } from '../../../components/ui/Button'
import { Plus, Minus, Lock, Unlock } from 'lucide-react'
import { useTranslation } from '../../../contexts/LanguageContext'

interface RowCreatorModalProps {
  open: boolean
  onClose: () => void
  onCreate: (slots: number[]) => void
  initialSlots?: number[]
}

const MIN_SLOT_WIDTH = 10
const SLOT_COLORS = ['bg-primary/20', 'bg-blue-500/20', 'bg-violet-500/20', 'bg-amber-500/20', 'bg-rose-500/20']
const SLOT_BORDER_COLORS = ['border-primary/40', 'border-blue-500/40', 'border-violet-500/40', 'border-amber-500/40', 'border-rose-500/40']
const SLOT_TEXT_COLORS = ['text-primary', 'text-blue-500', 'text-violet-500', 'text-amber-500', 'text-rose-500']

export function RowCreatorModal({ open, onClose, onCreate, initialSlots }: RowCreatorModalProps) {
  const { t } = useTranslation()
  const [slots, setSlots] = useState<number[]>(initialSlots || [50, 50])
  const [locked, setLocked] = useState<boolean[]>(initialSlots ? initialSlots.map(() => false) : [false, false])
  const containerRef = useRef<HTMLDivElement>(null)
  const draggingRef = useRef<{ dividerIndex: number; startX: number; startSlots: number[] } | null>(null)

  useEffect(() => {
    if (open) {
      const init = initialSlots || [50, 50]
      setSlots(init)
      setLocked(init.map(() => false))
    }
  }, [open, initialSlots])

  const addSlot = () => {
    if (slots.length >= 5) return
    const newCount = slots.length + 1
    const unlockedIdxs = slots.map((_, i) => i).filter(i => !locked[i])
    if (unlockedIdxs.length === 0) return

    const lockedTotal = slots.reduce((sum, s, i) => locked[i] ? sum + s : sum, 0)
    const availableForUnlocked = 100 - lockedTotal
    const newSlotWidth = Math.max(MIN_SLOT_WIDTH, Math.round(availableForUnlocked / (unlockedIdxs.length + 1)))

    if (availableForUnlocked < newSlotWidth + unlockedIdxs.length * MIN_SLOT_WIDTH) return

    const remainingForExisting = availableForUnlocked - newSlotWidth
    const unlockedTotal = unlockedIdxs.reduce((sum, i) => sum + slots[i], 0)

    const newSlots = slots.map((s, i) => {
      if (!locked[i]) {
        return Math.max(MIN_SLOT_WIDTH, Math.round((s / unlockedTotal) * remainingForExisting))
      }
      return s
    })

    // Fix rounding to ensure total is exactly 100
    const currentSum = newSlots.reduce((a, b) => a + b, 0)
    const adjustedNewSlotWidth = 100 - currentSum
    if (adjustedNewSlotWidth < MIN_SLOT_WIDTH) return

    setSlots([...newSlots, adjustedNewSlotWidth])
    setLocked([...locked, false])
  }

  const removeSlot = () => {
    if (slots.length <= 1) return
    const lastIdx = slots.length - 1
    const removedWidth = slots[lastIdx]

    // Distribute removed width to unlocked slots
    const remaining = slots.slice(0, -1)
    const lockedRemaining = locked.slice(0, -1)
    const unlockedIdxs = remaining.map((_, i) => i).filter(i => !lockedRemaining[i])

    if (unlockedIdxs.length === 0) {
      // If all remaining are locked, just add to last one
      remaining[remaining.length - 1] += removedWidth
    } else {
      const perUnlocked = removedWidth / unlockedIdxs.length
      for (const i of unlockedIdxs) {
        remaining[i] = Math.round(remaining[i] + perUnlocked)
      }
      // Fix rounding
      const sum = remaining.reduce((a, b) => a + b, 0)
      if (sum !== 100) {
        const firstUnlocked = unlockedIdxs[0]
        remaining[firstUnlocked] += 100 - sum
      }
    }

    setSlots(remaining)
    setLocked(lockedRemaining)
  }

  const toggleLock = (index: number) => {
    const newLocked = [...locked]
    newLocked[index] = !newLocked[index]
    // Ensure at least one slot stays unlocked
    if (newLocked.every(l => l)) {
      return // Don't allow locking all
    }
    setLocked(newLocked)
  }

  const handleDividerMouseDown = useCallback((dividerIndex: number, e: React.MouseEvent) => {
    e.preventDefault()
    draggingRef.current = {
      dividerIndex,
      startX: e.clientX,
      startSlots: [...slots]
    }

    const handleMouseMove = (ev: MouseEvent) => {
      if (!draggingRef.current || !containerRef.current) return
      const { dividerIndex: di, startX, startSlots } = draggingRef.current
      const containerWidth = containerRef.current.getBoundingClientRect().width
      const deltaX = ev.clientX - startX
      const deltaPct = (deltaX / containerWidth) * 100

      const leftIdx = di
      const rightIdx = di + 1

      // Don't move locked slots
      if (locked[leftIdx] && locked[rightIdx]) return

      let newLeft = Math.round(startSlots[leftIdx] + deltaPct)
      let newRight = Math.round(startSlots[rightIdx] - deltaPct)

      // Clamp
      if (newLeft < MIN_SLOT_WIDTH) {
        newRight += newLeft - MIN_SLOT_WIDTH
        newLeft = MIN_SLOT_WIDTH
      }
      if (newRight < MIN_SLOT_WIDTH) {
        newLeft += newRight - MIN_SLOT_WIDTH
        newRight = MIN_SLOT_WIDTH
      }

      // If one side is locked, prevent changes to it
      if (locked[leftIdx]) {
        // Left is locked: only right and other unlocked can change
        newRight = startSlots[rightIdx] - (deltaPct)
        newRight = Math.max(MIN_SLOT_WIDTH, Math.round(newRight))
        const overflow = startSlots[rightIdx] - newRight
        // Distribute overflow to other unlocked slots
        const result = [...startSlots]
        result[rightIdx] = newRight
        const otherUnlocked = slots.map((_, i) => i).filter(i => i !== leftIdx && i !== rightIdx && !locked[i])
        if (otherUnlocked.length > 0) {
          const perOther = overflow / otherUnlocked.length
          for (const i of otherUnlocked) {
            result[i] = Math.max(MIN_SLOT_WIDTH, Math.round(startSlots[i] + perOther))
          }
        }
        // Fix total
        const total = result.reduce((a, b) => a + b, 0)
        if (total !== 100 && otherUnlocked.length > 0) {
          result[otherUnlocked[0]] += 100 - total
        }
        setSlots(result.map(v => Math.max(MIN_SLOT_WIDTH, v)))
        return
      }

      if (locked[rightIdx]) {
        newLeft = startSlots[leftIdx] + deltaPct
        newLeft = Math.max(MIN_SLOT_WIDTH, Math.round(newLeft))
        const overflow = startSlots[leftIdx] - newLeft
        const result = [...startSlots]
        result[leftIdx] = newLeft
        const otherUnlocked = slots.map((_, i) => i).filter(i => i !== leftIdx && i !== rightIdx && !locked[i])
        if (otherUnlocked.length > 0) {
          const perOther = overflow / otherUnlocked.length
          for (const i of otherUnlocked) {
            result[i] = Math.max(MIN_SLOT_WIDTH, Math.round(startSlots[i] + perOther))
          }
        }
        const total = result.reduce((a, b) => a + b, 0)
        if (total !== 100 && otherUnlocked.length > 0) {
          result[otherUnlocked[0]] += 100 - total
        }
        setSlots(result.map(v => Math.max(MIN_SLOT_WIDTH, v)))
        return
      }

      // Neither locked: simple resize between left and right
      const result = [...startSlots]
      result[leftIdx] = Math.max(MIN_SLOT_WIDTH, newLeft)
      result[rightIdx] = Math.max(MIN_SLOT_WIDTH, newRight)
      // Fix total to keep it at 100
      const total = result.reduce((a, b) => a + b, 0)
      if (total !== 100) {
        result[rightIdx] += 100 - total
      }
      setSlots(result.map(v => Math.max(MIN_SLOT_WIDTH, v)))
    }

    const handleMouseUp = () => {
      draggingRef.current = null
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }

    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)
  }, [slots, locked])

  const handleCreate = () => {
    onCreate(slots)
    onClose()
  }

  const isEditing = !!initialSlots

  return (
    <Modal open={open} onClose={onClose} title={isEditing ? t('rowCreator.editRow') : t('rowCreator.createNewRow')}>
      <div className="space-y-5">
        {/* Slot count controls */}
        <div className="flex items-center justify-between">
          <label className="text-sm font-medium">{t('rowCreator.slots', { count: slots.length })}</label>
          <div className="flex gap-1">
            <button type="button" onClick={removeSlot} disabled={slots.length <= 1}
              className="flex items-center justify-center h-7 w-7 rounded border border-input hover:bg-accent text-muted-foreground hover:text-foreground disabled:opacity-30 transition-colors">
              <Minus size={14} />
            </button>
            <button type="button" onClick={addSlot} disabled={slots.length >= 5}
              className="flex items-center justify-center h-7 w-7 rounded border border-input hover:bg-accent text-muted-foreground hover:text-foreground disabled:opacity-30 transition-colors">
              <Plus size={14} />
            </button>
          </div>
        </div>

        {/* Visual resizer */}
        <div>
          <label className="text-sm font-medium mb-2 block">{t('rowCreator.dragToResize')}</label>
          <div
            ref={containerRef}
            className="relative flex h-24 rounded-lg overflow-hidden border border-border select-none"
          >
            {slots.map((pct, i) => (
              <div key={i} className="relative flex flex-col items-center justify-center" style={{ flex: `${pct} 0 0%` }}>
                {/* Slot visual */}
                <div className={`absolute inset-0 ${SLOT_COLORS[i % SLOT_COLORS.length]} border-r last:border-r-0 ${SLOT_BORDER_COLORS[i % SLOT_BORDER_COLORS.length]}`} />

                {/* Percentage label */}
                <span className={`relative z-10 text-lg font-bold tabular-nums ${SLOT_TEXT_COLORS[i % SLOT_TEXT_COLORS.length]}`}>
                  {pct}%
                </span>

                {/* Lock button */}
                <button
                  type="button"
                  onClick={() => toggleLock(i)}
                  className={`relative z-10 mt-1 p-0.5 rounded transition-colors ${
                    locked[i]
                      ? 'text-amber-500 hover:text-amber-600'
                      : 'text-muted-foreground/40 hover:text-muted-foreground'
                  }`}
                  title={locked[i] ? t('rowCreator.unlockSize') : t('rowCreator.lockSize')}
                >
                  {locked[i] ? <Lock size={12} /> : <Unlock size={12} />}
                </button>

                {/* Divider handle (between slots) */}
                {i < slots.length - 1 && (
                  <div
                    className="absolute right-0 top-0 bottom-0 w-3 -mr-1.5 z-20 cursor-col-resize group/divider flex items-center justify-center"
                    onMouseDown={(e) => handleDividerMouseDown(i, e)}
                  >
                    <div className="w-0.5 h-8 rounded-full bg-border group-hover/divider:bg-primary group-hover/divider:h-12 transition-all" />
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Slot details row */}
        <div className="flex gap-2">
          {slots.map((pct, i) => (
            <div key={i} className={`flex-1 text-center rounded-md py-1 px-2 text-xs font-medium ${SLOT_COLORS[i % SLOT_COLORS.length]} ${SLOT_TEXT_COLORS[i % SLOT_TEXT_COLORS.length]}`}>
              {t('rowCreator.slotPercent', { index: i + 1, percent: pct })}
              {locked[i] && <Lock size={9} className="inline ml-1 -mt-0.5" />}
            </div>
          ))}
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={onClose}>{t('common.cancel')}</Button>
          <Button onClick={handleCreate}>{isEditing ? t('common.save') : t('common.create')}</Button>
        </div>
      </div>
    </Modal>
  )
}
