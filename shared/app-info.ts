export const APP_VERSION = '1.1.0'
export const GITHUB_REPOSITORY = 'heide-oficial/MoneyCapy'
export const GITHUB_RELEASES_URL = `https://github.com/${GITHUB_REPOSITORY}/releases`

export interface AppUpdateInfo {
  currentVersion: string
  latestVersion: string | null
  latestReleaseUrl: string | null
  releaseName: string | null
  isUpdateAvailable: boolean
}
