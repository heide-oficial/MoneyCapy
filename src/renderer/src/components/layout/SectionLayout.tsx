import { CSSProperties, ReactNode } from 'react'
import { type LucideIcon } from 'lucide-react'
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
    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 shrink-0">
      <Icon size={20} className="text-primary" />
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
      {/* Hero Card */}
      <Card className="p-5 relative">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3 shrink-0">
            <IconBadge icon={Icon} />
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-xl font-bold">{title}</h1>
              {breadcrumbs}
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {monthNav}
            {actionButton}
          </div>
        </div>
        {hasStats && (
          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
            {stats![0] && (
              <p className={`text-lg font-bold tabular-nums leading-tight ${stats![0].className || ''}`} style={stats![0].style}>
                {stats![0].value}
              </p>
            )}
            {stats![1] && (
              <p className="text-xs text-muted-foreground mt-0.5">
                {stats![1].value}
              </p>
            )}
          </div>
        )}
      </Card>

      {/* Toolbar Card */}
      {hasControls && (
        <Card className="p-2">
          <div className="flex items-center gap-2 flex-wrap">
            {controls}
          </div>
        </Card>
      )}

      {children}
    </div>
  )
}
