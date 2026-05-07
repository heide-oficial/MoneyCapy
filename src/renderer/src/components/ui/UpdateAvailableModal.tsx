import { useEffect, useState } from 'react'
import { Download, GitBranch, Clock } from 'lucide-react'
import { Modal } from './Modal'
import { Button } from './Button'
import { useTranslation } from '../../contexts/LanguageContext'
import type { AppUpdateInfo } from '@shared/app-info'

const SKIPPED_UPDATE_SETTING = 'skippedUpdateVersion'

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
    <Modal open={open} onClose={() => setOpen(false)} title={t('updates.title')} maxWidth="max-w-md">
      <div className="space-y-5">
        <div className="rounded-lg border border-border bg-card p-4">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <GitBranch size={20} />
            </div>
            <div className="min-w-0 space-y-1">
              <p className="text-sm font-medium text-foreground">
                {t('updates.versionAvailable', { version: latestVersion })}
              </p>
              <p className="text-sm text-muted-foreground">
                {t('updates.description', { currentVersion: updateInfo?.currentVersion || '' })}
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button variant="outline" onClick={handleSkipVersion}>
            {t('updates.skipVersion')}
          </Button>
          <Button variant="outline" onClick={() => setOpen(false)}>
            <Clock size={14} />
            {t('updates.remindLater')}
          </Button>
          <Button onClick={handleDownload} disabled={!updateInfo?.latestReleaseUrl}>
            <Download size={14} />
            {t('updates.goToDownload')}
          </Button>
        </div>
      </div>
    </Modal>
  )
}
