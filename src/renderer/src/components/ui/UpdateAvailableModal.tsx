import { useEffect, useState } from 'react'
import { Download, GitBranch, Clock } from 'lucide-react'
import { Modal } from './Modal'
import { Button } from './Button'
import { useTranslation } from '../../contexts/LanguageContext'
import type { AppUpdateInfo } from '@shared/app-info'

const SKIPPED_UPDATE_SETTING = 'skippedUpdateVersion'

function displayVersion(version: string): string {
  return version.trim().replace(/^v/i, '')
}

export function UpdateAvailableModal() {
  const { t } = useTranslation()
  const [updateInfo, setUpdateInfo] = useState<AppUpdateInfo | null>(null)
  const [open, setOpen] = useState(false)

  useEffect(() => {
    let cancelled = false

    async function checkForUpdates() {
      const [info, skippedVersion] = await Promise.all([
        window.api.app.checkForUpdates(),
        window.api.settings.get(SKIPPED_UPDATE_SETTING)
      ])

      if (
        cancelled ||
        !info.isUpdateAvailable ||
        !info.latestVersion ||
        skippedVersion === info.latestVersion
      ) {
        return
      }

      setUpdateInfo(info)
      setOpen(true)
    }

    checkForUpdates().catch(() => {
      // Update checks are best-effort and should never interrupt app startup.
    })

    return () => {
      cancelled = true
    }
  }, [])

  const latestVersion = updateInfo?.latestVersion || ''
  const latestVersionLabel = displayVersion(latestVersion)
  const currentVersionLabel = displayVersion(updateInfo?.currentVersion || '')

  const handleSkipVersion = async () => {
    if (latestVersion) {
      await window.api.settings.set(SKIPPED_UPDATE_SETTING, latestVersion)
    }
    setOpen(false)
  }

  const handleDownload = async () => {
    if (updateInfo?.latestReleaseUrl) {
      await window.api.app.openExternal(updateInfo.latestReleaseUrl)
    }
    setOpen(false)
  }

  return (
    <Modal open={open} onClose={() => setOpen(false)} title={t('updates.title')} maxWidth="max-w-xl">
      <div className="space-y-5">
        <div className="rounded-lg border border-border bg-card p-4">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <GitBranch size={20} />
            </div>
            <div className="min-w-0 space-y-1">
              <p className="text-sm font-medium text-foreground">
                {t('updates.versionAvailable', { version: latestVersionLabel })}
              </p>
              <p className="max-w-prose text-sm leading-relaxed text-muted-foreground">
                {t('updates.description', { currentVersion: currentVersionLabel })}
              </p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.25fr)_minmax(0,1fr)]">
          <Button
            variant="outline"
            onClick={handleSkipVersion}
            className="h-auto min-h-11 whitespace-normal px-4 py-3 text-center leading-snug"
          >
            {t('updates.skipVersion')}
          </Button>
          <Button
            variant="outline"
            onClick={() => setOpen(false)}
            className="h-auto min-h-11 whitespace-normal px-4 py-3 text-center leading-snug"
          >
            <Clock size={14} />
            {t('updates.remindLater')}
          </Button>
          <Button
            onClick={handleDownload}
            disabled={!updateInfo?.latestReleaseUrl}
            className="h-auto min-h-11 whitespace-normal px-4 py-3 text-center leading-snug"
          >
            <Download size={14} />
            {t('updates.goToDownload')}
          </Button>
        </div>
      </div>
    </Modal>
  )
}
