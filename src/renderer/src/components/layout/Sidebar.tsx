import { useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import {
  House, Landmark, CreditCard, HandCoins, Tags, Bookmark,
  Settings, ChevronLeft, ChevronRight, Plus,
  Receipt, ArrowRightLeft, Users, BarChart3, Store, Search
} from 'lucide-react'
import { ROUTES } from '../../lib/constants'
import appIcon from '../../../../../resources/icon.png'
import { useActivePerson } from '../../contexts/ActivePersonContext'
import { useTranslation } from '../../contexts/LanguageContext'
import { Modal } from '../ui/Modal'

interface SidebarProps {
  collapsed: boolean
  onToggle: () => void
}

export function Sidebar({ collapsed, onToggle }: SidebarProps) {
  const location = useLocation()
  const navigate = useNavigate()
  const { activePerson, people, setActivePersonId } = useActivePerson()
  const { t } = useTranslation()
  const [showProfileModal, setShowProfileModal] = useState(false)

  const isActive = (path: string) => {
    if (path === '/') return location.pathname === '/'
    return location.pathname.startsWith(path)
  }

  const renderNavButton = (icon: any, label: string, path: string) => {
    const Icon = icon
    const active = isActive(path)
    return (
      <button
        key={path}
        onClick={() => navigate(path)}
        title={collapsed ? label : undefined}
        className={`no-drag flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
          active
            ? 'bg-primary/10 text-primary'
            : 'text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground'
        } ${collapsed ? 'justify-center px-0' : ''}`}
      >
        <Icon size={20} className="shrink-0" />
        {!collapsed && <span className="truncate">{label}</span>}
      </button>
    )
  }

  return (
    <div
      className={`group/sidebar flex flex-col border-r border-sidebar-border bg-sidebar transition-all duration-300 ${
        collapsed ? 'w-16' : 'w-64'
      }`}
    >
      {/* Logo + collapse toggle */}
      <div className="drag-region flex h-10 items-center gap-2 border-b border-sidebar-border px-4">
        {!collapsed && (
          <>
            <img src={appIcon} alt="MoneyCapy" className="no-drag h-6 w-6 shrink-0" />
            <span className="no-drag text-lg font-bold text-primary truncate flex-1">MoneyCapy</span>
            <button
              onClick={onToggle}
              className="no-drag flex items-center justify-center rounded-md p-1 text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-colors"
              title={t('sidebar.collapse')}
            >
              <ChevronLeft size={16} />
            </button>
          </>
        )}
        {collapsed && (
          <>
            <img src={appIcon} alt="MoneyCapy" className="no-drag h-6 w-6 mx-auto group-hover/sidebar:hidden" />
            <button
              onClick={onToggle}
              className="no-drag hidden group-hover/sidebar:flex items-center justify-center rounded-md p-1 mx-auto text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-colors"
              title={t('sidebar.expand')}
            >
              <ChevronRight size={16} />
            </button>
          </>
        )}
      </div>

      {/* Profile Selector */}
      {activePerson && (
        <div className="border-b border-sidebar-border p-2">
          {!collapsed ? (
            <button
              onClick={() => setShowProfileModal(true)}
              className="no-drag flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 hover:bg-sidebar-accent transition-colors"
            >
              <div
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full"
                style={{ backgroundColor: activePerson.color }}
              >
                <span className="text-white text-xs font-bold">{activePerson.name.charAt(0).toUpperCase()}</span>
              </div>
              <div className="flex-1 min-w-0 text-left">
                <p className="text-sm font-medium truncate text-sidebar-foreground">{activePerson.name}</p>
                <p className="text-[10px] text-muted-foreground flex items-center gap-1"><ArrowRightLeft size={9} /> {t('sidebar.switchProfile')}</p>
              </div>
            </button>
          ) : (
            <div className="flex justify-center">
              <button
                onClick={() => setShowProfileModal(true)}
                title={activePerson.name}
                className="no-drag flex items-center justify-center h-8 w-8 rounded-full transition-all hover:scale-105"
                style={{ backgroundColor: activePerson.color }}
              >
                <span className="text-white text-xs font-bold">{activePerson.name.charAt(0).toUpperCase()}</span>
              </button>
            </div>
          )}
        </div>
      )}

      {/* Search Button */}
      <div className="px-2 pt-2">
        <button
          onClick={() => document.dispatchEvent(new CustomEvent('open-global-search'))}
          title={collapsed ? t('sidebar.searchShortcut') : undefined}
          className={`no-drag flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground ${collapsed ? 'justify-center px-0' : ''}`}
        >
          <Search size={20} className="shrink-0" />
          {!collapsed && (
            <>
              <span className="flex-1 text-left truncate">{t('common.search')}</span>
              <kbd className="text-[10px] px-1.5 py-0.5 rounded border border-border font-mono text-muted-foreground">Ctrl+K</kbd>
            </>
          )}
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-2 px-2">
        {/* Dashboard */}
        <div className="mb-2">
          {renderNavButton(House, t('sidebar.dashboard'), ROUTES.DASHBOARD)}
          {renderNavButton(BarChart3, t('sidebar.insights'), ROUTES.INSIGHTS)}
        </div>

        {/* Items */}
        {activePerson && (
          <div className="mb-2">
            {!collapsed && (
              <div className="px-3 py-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">{t('sidebar.sectionItems')}</div>
            )}
            {collapsed && <div className="my-2 mx-2 border-t border-sidebar-border" />}
            {renderNavButton(Receipt, t('sidebar.items'), ROUTES.ITEMS)}
            {renderNavButton(HandCoins, t('sidebar.income'), ROUTES.INCOME)}
          </div>
        )}

        {/* Financeiro */}
        <div className="mb-2">
          {!collapsed && (
            <div className="px-3 py-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">{t('sidebar.sectionFinancial')}</div>
          )}
          {collapsed && <div className="my-2 mx-2 border-t border-sidebar-border" />}
          {renderNavButton(Landmark, t('sidebar.accounts'), ROUTES.ACCOUNTS)}
          {renderNavButton(CreditCard, t('sidebar.cards'), ROUTES.CARDS)}
        </div>

        {/* Outros */}
        <div className="mb-2">
          {!collapsed && (
            <div className="px-3 py-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">{t('sidebar.sectionOther')}</div>
          )}
          {collapsed && <div className="my-2 mx-2 border-t border-sidebar-border" />}
          {renderNavButton(Tags, t('sidebar.categories'), ROUTES.CATEGORIES)}
          {renderNavButton(Bookmark, t('sidebar.subcategories'), ROUTES.SUBCATEGORIES)}
          {renderNavButton(Bookmark, t('sidebar.tags'), ROUTES.TAGS)}
          {renderNavButton(Store, t('sidebar.stores'), ROUTES.STORES)}
          {renderNavButton(Users, t('sidebar.people'), ROUTES.PEOPLE)}
        </div>
      </nav>

      {/* Bottom */}
      <div className="border-t border-sidebar-border p-2">
        {renderNavButton(Settings, t('sidebar.settings'), ROUTES.SETTINGS)}
      </div>

      {/* Profile Switch Modal */}
      <Modal open={showProfileModal} onClose={() => setShowProfileModal(false)} title={t('sidebar.switchProfile')} maxWidth="max-w-sm">
        <div className="space-y-2">
          {people.map(p => (
            <button
              key={p.id}
              onClick={() => { setActivePersonId(p.id); setShowProfileModal(false) }}
              className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 transition-colors ${
                activePerson?.id === p.id
                  ? 'bg-primary/10 ring-1 ring-primary/30'
                  : 'hover:bg-accent'
              }`}
            >
              <div
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full"
                style={{ backgroundColor: p.color }}
              >
                <span className="text-white text-sm font-bold">{p.name.charAt(0).toUpperCase()}</span>
              </div>
              <span className="text-sm font-medium flex-1 text-left">{p.name}</span>
              {activePerson?.id === p.id && (
                <span className="text-xs text-primary font-medium">{t('common.active')}</span>
              )}
            </button>
          ))}
          <button
            onClick={() => { setShowProfileModal(false); navigate(ROUTES.PEOPLE) }}
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-muted-foreground hover:bg-accent hover:text-foreground transition-colors border border-dashed border-border"
          >
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-dashed border-muted-foreground/30">
              <Plus size={16} />
            </div>
            <span className="text-sm font-medium">{t('sidebar.createProfile')}</span>
          </button>
        </div>
      </Modal>
    </div>
  )
}
