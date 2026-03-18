import { app } from 'electron'
import { join } from 'path'

export function getDatabasePath(): string {
  return join(app.getPath('userData'), 'moneycapy.db')
}

export function getBackupDir(): string {
  return join(app.getPath('userData'), 'backups')
}
