import { useState, useEffect } from 'react'
import { Outlet } from 'react-router-dom'
import { Sidebar } from './Sidebar'
import { TopBar } from './TopBar'
import { OnboardingWizard } from '../onboarding/OnboardingWizard'
import { useActivePerson } from '../../contexts/ActivePersonContext'

export function MainLayout() {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const { people, isLoaded } = useActivePerson()
  // null = not yet decided, true = show wizard, false = skip wizard
  const [showOnboarding, setShowOnboarding] = useState<boolean | null>(null)

  useEffect(() => {
    window.api.settings.get('sidebarCollapsed').then((val: string | null) => {
      if (val === 'true') setSidebarCollapsed(true)
    })
  }, [])

  useEffect(() => {
    if (!isLoaded || showOnboarding !== null) return
    window.api.settings.get('onboardingCompleted').then((val: string | null) => {
      // Decision is made once: show wizard only if no people AND onboarding not done.
      // After this point, people.length changes won't affect the wizard visibility.
      setShowOnboarding(val !== 'true' && people.length === 0)
    })
  }, [isLoaded, people.length, showOnboarding])

  // Still loading — render nothing to avoid flash
  if (!isLoaded || showOnboarding === null) {
    return null
  }

  if (showOnboarding) {
    return <OnboardingWizard onComplete={() => setShowOnboarding(false)} />
  }

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar collapsed={sidebarCollapsed} onToggle={() => setSidebarCollapsed(!sidebarCollapsed)} />
      <div className="flex flex-1 flex-col overflow-hidden">
        <TopBar />
        <main className="flex-1 overflow-y-auto p-6 pb-32">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
