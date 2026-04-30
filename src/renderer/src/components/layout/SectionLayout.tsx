import { CSSProperties, ReactNode } from 'react'
import { ArrowDown, ArrowUp, type LucideIcon } from 'lucide-react'
import { Card } from '../ui/Card'

export interface StatItem {
  label: string
  value: ReactNode
  className?: string
  style?: CSSProperties
}

export interface SectionLayoutProps {
  icon: LucideIcon
  title: string
  monthNav?: ReactNode
  actionButton?: ReactNode
  breadcrumbs?: ReactNode
  controls?: ReactNode
  stats?: StatItem[]
  nested?: boolean
  children: ReactNode
}

function IconBadge({ icon: Icon }: { icon: LucideIcon }) {
  return (
    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 shrink-0">
      <Icon size={20} className="text-primary" />
    </div>
  )
}

function StatCard({ stat, index }: { stat: StatItem; index: number }) {
  const tone = typeof stat.style?.color === 'string' ? stat.style.color : undefined
  const TrendIcon = index === 0 ? ArrowDown : ArrowUp

  return (
    <div className="w-[230px] max-w-[230px] rounded-lg border border-border/80 bg-background/25 px-3 py-2 shadow-sm">
      <div className="flex items-center gap-2.5">
        <div
          className="flex h-7 w-7 items-center justify-center rounded-full border shrink-0"
          style={tone ? { color: tone, borderColor: `${tone}80`, backgroundColor: `${tone}14` } : undefined}
        >
          <TrendIcon size={15} />
        </div>
        <div className="min-w-0 flex-1">
          <div className={`truncate text-sm font-bold tabular-nums leading-tight ${stat.className || ''}`} style={stat.style}>
            {stat.value}
          </div>
          {stat.label && (
            <p className="truncate text-[11px] text-muted-foreground mt-0.5 leading-tight">
              {stat.label}
            </p>
          )}
        </div>
      </div>
    </div>
  )
}

export function SectionLayout({
  icon: Icon, title, monthNav, actionButton, breadcrumbs,
  controls, stats, nested = false, children
}: SectionLayoutProps) {
  const hasControls = !!controls
  const hasStats = stats && stats.length > 0

  /* ═══ NESTED VARIANT ═══ */
  if (nested) {
    return (
      <div className="space-y-4">
        {(actionButton || hasStats || hasControls) && (
          <Card className="p-3">
            <div className="flex items-center gap-2 flex-wrap">
              {actionButton}
              {hasStats && (
                <div className="flex items-center gap-3">
                  {stats!.map((s, i) => (
                    <span key={i} className={`text-sm ${s.className || ''}`}>
                      <span className="text-muted-foreground">{s.label}: </span>
                      <span className="font-semibold tabular-nums">{s.value}</span>
                    </span>
                  ))}
                </div>
              )}
              {hasControls && (
                <>
                  <div className="ml-auto" />
                  {controls}
                </>
              )}
            </div>
          </Card>
        )}
        {children}
      </div>
    )
  }

  /* ═══ FULL PAGE VARIANT ═══ */
  return (
    <div className="space-y-6">
      {/* Header Card */}
      <Card className="p-0 overflow-hidden">
        <div className="flex min-h-[66px] flex-col xl:flex-row xl:items-stretch">
          <div className="flex min-w-0 flex-1 flex-col gap-3 px-4 py-2.5 lg:flex-row lg:items-center">
            <div className="flex min-w-[180px] items-center gap-3 shrink-0">
              <IconBadge icon={Icon} />
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h1 className="text-lg font-bold leading-tight">{title}</h1>
                  {breadcrumbs}
                </div>
              </div>
            </div>

            {hasStats && (
              <>
                <div className="hidden h-10 w-px bg-border lg:block" />
                <div className="flex min-w-0 flex-nowrap items-center gap-2 overflow-hidden">
                  {stats!.slice(0, 3).map((stat, index) => (
                    <StatCard key={index} stat={stat} index={index} />
                  ))}
                </div>
              </>
            )}
          </div>

          {(monthNav || actionButton) && (
            <div className="flex shrink-0 items-stretch border-t border-border xl:border-l xl:border-t-0">
              {monthNav && (
                <div className="flex items-center px-4 py-2.5">
                  {monthNav}
                </div>
              )}
              {actionButton && (
                <div className="flex items-stretch border-l border-border [&>button]:h-auto [&>button]:min-w-[92px] [&>button]:rounded-none [&>button]:px-4 [&>button]:text-xs [&>button]:flex-col [&>button]:gap-0.5 [&>button]:whitespace-normal [&>button]:leading-tight [&_svg]:h-4 [&_svg]:w-4">
                  {actionButton}
                </div>
              )}
            </div>
          )}
        </div>
      </Card>

      {/* Toolbar Card */}
      {hasControls && (
        <Card className="p-2">
          <div className="flex items-center gap-1.5 flex-wrap">
            {controls}
          </div>
        </Card>
      )}

      {children}
    </div>
  )
}
