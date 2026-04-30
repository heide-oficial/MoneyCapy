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
    <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 shrink-0">
      <Icon size={24} className="text-primary" />
    </div>
  )
}

function StatCard({ stat, index }: { stat: StatItem; index: number }) {
  const tone = typeof stat.style?.color === 'string' ? stat.style.color : undefined
  const TrendIcon = index === 0 ? ArrowDown : ArrowUp

  return (
    <div className="min-w-[210px] rounded-lg border border-border/80 bg-background/25 px-4 py-2.5 shadow-sm">
      <div className="flex items-center gap-3">
        <div
          className="flex h-8 w-8 items-center justify-center rounded-full border"
          style={tone ? { color: tone, borderColor: `${tone}80`, backgroundColor: `${tone}14` } : undefined}
        >
          <TrendIcon size={18} />
        </div>
        <div className="min-w-0">
          <p className={`truncate text-base font-bold tabular-nums leading-tight ${stat.className || ''}`} style={stat.style}>
            {stat.value}
          </p>
          <p className="truncate text-xs text-muted-foreground mt-0.5">
            {stat.label}
          </p>
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
        <div className="flex min-h-[86px] flex-col xl:flex-row xl:items-stretch">
          <div className="flex min-w-0 flex-1 flex-col gap-4 px-5 py-4 lg:flex-row lg:items-center">
            <div className="flex min-w-[210px] items-center gap-4 shrink-0">
              <IconBadge icon={Icon} />
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h1 className="text-xl font-bold leading-tight">{title}</h1>
                  {breadcrumbs}
                </div>
              </div>
            </div>

            {hasStats && (
              <>
                <div className="hidden h-12 w-px bg-border lg:block" />
                <div className="flex min-w-0 flex-wrap items-center gap-3">
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
                <div className="flex items-center px-5 py-4">
                  {monthNav}
                </div>
              )}
              {actionButton && (
                <div className="flex items-stretch border-l border-border [&>button]:h-auto [&>button]:min-w-[104px] [&>button]:rounded-none [&>button]:px-5 [&>button]:text-sm [&>button]:flex-col [&>button]:gap-1 [&>button]:whitespace-normal [&>button]:leading-tight">
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
