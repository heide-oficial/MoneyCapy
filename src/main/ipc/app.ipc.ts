import { ipcMain, shell } from 'electron'
import { IPC_CHANNELS } from '../../../shared/ipc-channels'
import {
  APP_VERSION,
  GITHUB_RELEASES_URL,
  GITHUB_REPOSITORY,
  type AppUpdateInfo
} from '../../../shared/app-info'

interface GitHubReleaseResponse {
  tag_name?: string
  name?: string
  html_url?: string
}

function normalizeVersion(version: string): string {
  return version.trim().replace(/^v/i, '').split('-')[0]
}

function compareSemver(a: string, b: string): number {
  const aParts = normalizeVersion(a).split('.').map(part => Number.parseInt(part, 10) || 0)
  const bParts = normalizeVersion(b).split('.').map(part => Number.parseInt(part, 10) || 0)
  const length = Math.max(aParts.length, bParts.length, 3)

  for (let index = 0; index < length; index += 1) {
    const diff = (aParts[index] || 0) - (bParts[index] || 0)
    if (diff !== 0) return diff
  }

  return 0
}

function createEmptyUpdateInfo(): AppUpdateInfo {
  return {
    currentVersion: APP_VERSION,
    latestVersion: null,
    latestReleaseUrl: null,
    releaseName: null,
    isUpdateAvailable: false
  }
}

export function registerAppHandlers(): void {
  ipcMain.handle(IPC_CHANNELS.APP_CHECK_FOR_UPDATES, async (): Promise<AppUpdateInfo> => {
    try {
      const response = await fetch(`https://api.github.com/repos/${GITHUB_REPOSITORY}/releases/latest`, {
        headers: {
          Accept: 'application/vnd.github+json',
          'User-Agent': 'MoneyCapy'
        }
      })

      if (!response.ok) return createEmptyUpdateInfo()

      const release = await response.json() as GitHubReleaseResponse
      const latestVersion = release.tag_name || null

      if (!latestVersion) return createEmptyUpdateInfo()

      return {
        currentVersion: APP_VERSION,
        latestVersion,
        latestReleaseUrl: release.html_url || `${GITHUB_RELEASES_URL}/latest`,
        releaseName: release.name || latestVersion,
        isUpdateAvailable: compareSemver(latestVersion, APP_VERSION) > 0
      }
    } catch {
      return createEmptyUpdateInfo()
    }
  })

  ipcMain.handle(IPC_CHANNELS.APP_OPEN_EXTERNAL, async (_, url: string) => {
    const target = new URL(url)
    if (target.protocol !== 'https:') return false
    await shell.openExternal(target.toString())
    return true
  })
}
