import { ChevronLeft, ChevronRight, CalendarCheck } from 'lucide-react'
import { getPreviousMonth, getNextMonth, getCurrentMonth } from '../../lib/date'
import { useStartCountingMonth } from '../../contexts/StartCountingMonthContext'
import { useTranslation } from '../../contexts/LanguageContext'
import { DatePicker } from './DatePicker'

interface MonthNavigatorProps {
  month: string
  onChange: (month: string) => void
}

export function MonthNavigator({ month, onChange }: MonthNavigatorProps) {
  const { t } = useTranslation()
  const currentMonth = getCurrentMonth()
  const isCurrentMonth = month === currentMonth
  const { startCountingMonth } = useStartCountingMonth()

  const prevMonth = getPreviousMonth(month)
  const canGoPrev = !startCountingMonth || prevMonth >= startCountingMonth

  return (
    <div className="inline-flex items-center gap-0.5 rounded-md border border-input bg-transparent h-9 px-1 w-[250px] justify-center">
      <button
        onClick={() => onChange(prevMonth)}
        disabled={!canGoPrev}
        className={`flex items-center justify-center h-7 w-7 rounded transition-colors ${
          !canGoPrev
            ? 'opacity-30 pointer-events-none'
            : 'hover:bg-accent text-muted-foreground hover:text-foreground'
        }`}
        title={t('monthNavigator.previousMonth')}
      >
        <ChevronLeft size={16} />
      </button>
      <DatePicker
        mode="month"
        value={month}
        onChange={v => {
          if (startCountingMonth && v < startCountingMonth) return
          onChange(v)
        }}
        className="border-0 shadow-none bg-transparent h-7 min-w-[110px] justify-center text-sm font-medium"
      />
      <button
        onClick={() => onChange(getNextMonth(month))}
        className="flex items-center justify-center h-7 w-7 rounded hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
        title={t('monthNavigator.nextMonth')}
      >
        <ChevronRight size={16} />
      </button>
      <button
        onClick={() => onChange(currentMonth)}
        disabled={isCurrentMonth}
        className={`flex items-center justify-center h-7 w-7 rounded transition-colors ${
          isCurrentMonth
            ? 'text-muted-foreground/30 cursor-not-allowed'
            : 'hover:bg-accent text-primary hover:text-primary/80'
        }`}
        title={t('monthNavigator.goToCurrentMonth')}
      >
        <CalendarCheck size={14} />
      </button>
    </div>
  )
}
