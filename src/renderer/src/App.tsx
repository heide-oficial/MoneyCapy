import { useState, useEffect, useCallback, Component, type ReactNode, type ErrorInfo } from 'react'
import { HashRouter, Routes, Route } from 'react-router-dom'
import { ThemeProvider } from './contexts/ThemeContext'
import { SessionProvider } from './contexts/SessionContext'
import { ActivePersonProvider } from './contexts/ActivePersonContext'
import { DateFormatProvider } from './contexts/DateFormatContext'
import { DefaultMonthProvider } from './contexts/DefaultMonthContext'
import { ColorSettingsProvider } from './contexts/ColorSettingsContext'
import { CurrencySettingsProvider } from './contexts/CurrencySettingsContext'
import { StartCountingMonthProvider } from './contexts/StartCountingMonthContext'
import { ToastPositionProvider, useToastPosition } from './contexts/ToastPositionContext'
import { ColorModeProvider } from './contexts/ColorModeContext'
import { AccentColorProvider } from './contexts/AccentColorContext'
import { LanguageProvider } from './contexts/LanguageContext'
import { BusinessDayProvider } from './contexts/BusinessDayContext'
import { DimPaidProvider } from './contexts/DimPaidContext'
import { FilterDisplayModeProvider } from './contexts/FilterDisplayModeContext'
import { TileFieldsProvider } from './contexts/TileFieldsContext'
import { Toaster } from 'sonner'
import { MainLayout } from './components/layout/MainLayout'
import { ROUTES } from './lib/constants'
import { GlobalSearchModal } from './components/ui/GlobalSearchModal'

// Pages
import Dashboard from './pages/dashboard/Dashboard'
import AccountsPage from './pages/accounts/AccountsPage'
import CardsPage from './pages/cards/CardsPage'
import IncomePage from './pages/income/IncomePage'
import PeoplePage from './pages/people/PeoplePage'
import CategoriesPage from './pages/categories/CategoriesPage'
import SubcategoriesPage from './pages/subcategories/SubcategoriesPage'
import TagsPage from './pages/tags/TagsPage'

import ItemsPage from './pages/items/ItemsPage'
import SettingsPage from './pages/settings/SettingsPage'
import InsightsPage from './pages/insights/InsightsPage'
import StoresPage from './pages/stores/StoresPage'

class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null }
  static getDerivedStateFromError(error: Error) { return { error } }
  componentDidCatch(error: Error, info: ErrorInfo) { console.error('ErrorBoundary caught:', error, info) }
  render() {
    if (this.state.error) {
      return (
        <div style={{ padding: 40, color: '#fff', fontFamily: 'monospace' }}>
          <h1 style={{ color: '#f87171' }}>Erro na aplicação</h1>
          <pre style={{ whiteSpace: 'pre-wrap', marginTop: 16 }}>{this.state.error.message}</pre>
          <pre style={{ whiteSpace: 'pre-wrap', marginTop: 8, opacity: 0.7, fontSize: 12 }}>{this.state.error.stack}</pre>
          <button onClick={() => this.setState({ error: null })} style={{ marginTop: 16, padding: '8px 16px', cursor: 'pointer' }}>Tentar novamente</button>
        </div>
      )
    }
    return this.props.children
  }
}

function PositionedToaster() {
  const { position } = useToastPosition()
  return (
    <Toaster
      position={position}
      toastOptions={{
        style: {
          background: 'hsl(var(--card))',
          color: 'hsl(var(--card-foreground))',
          border: '1px solid hsl(var(--border))'
        }
      }}
    />
  )
}

function GlobalSearchWrapper() {
  const [showSearch, setShowSearch] = useState(false)

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault()
        setShowSearch(s => !s)
      }
    }
    const customHandler = () => setShowSearch(true)
    document.addEventListener('keydown', handler)
    document.addEventListener('open-global-search', customHandler)
    return () => {
      document.removeEventListener('keydown', handler)
      document.removeEventListener('open-global-search', customHandler)
    }
  }, [])

  return <GlobalSearchModal open={showSearch} onClose={() => setShowSearch(false)} />
}

function App() {
  return (
    <ErrorBoundary>
    <LanguageProvider>
    <AccentColorProvider>
    <ThemeProvider>
      <DateFormatProvider>
      <DefaultMonthProvider>
      <ColorSettingsProvider>
      <CurrencySettingsProvider>
      <ColorModeProvider>
      <BusinessDayProvider>
      <DimPaidProvider>
      <FilterDisplayModeProvider>
      <TileFieldsProvider>
      <ToastPositionProvider>
      <SessionProvider>
        <ActivePersonProvider>
        <StartCountingMonthProvider>
          <HashRouter>
            <PositionedToaster />
            <GlobalSearchWrapper />
            <Routes>
              <Route element={<MainLayout />}>
                <Route path={ROUTES.DASHBOARD} element={<Dashboard />} />
                <Route path={ROUTES.ITEMS} element={<ItemsPage />} />
                <Route path={ROUTES.ACCOUNTS} element={<AccountsPage />} />
                <Route path={ROUTES.CARDS} element={<CardsPage />} />
                <Route path={ROUTES.INCOME} element={<IncomePage />} />
                <Route path={ROUTES.PEOPLE} element={<PeoplePage />} />
                <Route path={ROUTES.CATEGORIES} element={<CategoriesPage />} />
                <Route path={ROUTES.SUBCATEGORIES} element={<SubcategoriesPage />} />
                <Route path={ROUTES.TAGS} element={<TagsPage />} />
                <Route path={ROUTES.STORES} element={<StoresPage />} />

                <Route path={ROUTES.INSIGHTS} element={<InsightsPage />} />
                <Route path={ROUTES.SETTINGS} element={<SettingsPage />} />
              </Route>
            </Routes>
          </HashRouter>
        </StartCountingMonthProvider>
        </ActivePersonProvider>
      </SessionProvider>
      </ToastPositionProvider>
      </TileFieldsProvider>
      </FilterDisplayModeProvider>
      </DimPaidProvider>
      </BusinessDayProvider>
      </ColorModeProvider>
      </CurrencySettingsProvider>
      </ColorSettingsProvider>
      </DefaultMonthProvider>
      </DateFormatProvider>
    </ThemeProvider>
    </AccentColorProvider>
    </LanguageProvider>
    </ErrorBoundary>
  )
}

export default App
