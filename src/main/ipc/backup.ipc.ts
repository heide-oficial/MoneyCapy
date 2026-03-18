import { ipcMain, dialog, BrowserWindow, shell, app } from 'electron'
import { WrappedDatabase } from '../database/connection'
import { IPC_CHANNELS } from '../../../shared/ipc-channels'
import { BackupService } from '../services/backup.service'

export function registerBackupHandlers(db: WrappedDatabase): void {
  const backupService = new BackupService(db)

  ipcMain.handle(IPC_CHANNELS.BACKUP_EXPORT, async () => {
    const win = BrowserWindow.getFocusedWindow()
    if (!win) return { success: false }

    const result = await dialog.showSaveDialog(win, {
      title: 'Exportar Backup',
      defaultPath: `moneycapy-backup-${new Date().toISOString().slice(0, 10)}.db`,
      filters: [{ name: 'SQLite Database', extensions: ['db'] }]
    })

    if (result.canceled || !result.filePath) return { success: false }

    try {
      backupService.exportBackup(result.filePath)
      return { success: true, path: result.filePath }
    } catch (err: any) {
      return { success: false, error: err.message }
    }
  })

  ipcMain.handle(IPC_CHANNELS.BACKUP_IMPORT, async () => {
    const win = BrowserWindow.getFocusedWindow()
    if (!win) return { success: false }

    const result = await dialog.showOpenDialog(win, {
      title: 'Restaurar Backup',
      filters: [{ name: 'SQLite Database', extensions: ['db'] }],
      properties: ['openFile']
    })

    if (result.canceled || result.filePaths.length === 0) return { success: false }

    try {
      backupService.importBackup(result.filePaths[0])
      return { success: true, needsRestart: true }
    } catch (err: any) {
      return { success: false, error: err.message }
    }
  })

  ipcMain.handle(IPC_CHANNELS.BACKUP_EXPORT_FILTERED, async (_event, startMonth: string, endMonth: string) => {
    const win = BrowserWindow.getFocusedWindow()
    if (!win) return { success: false }

    const result = await dialog.showSaveDialog(win, {
      title: 'Exportar Backup Filtrado',
      defaultPath: `moneycapy-backup-${startMonth}-to-${endMonth}.db`,
      filters: [{ name: 'SQLite Database', extensions: ['db'] }]
    })

    if (result.canceled || !result.filePath) return { success: false }

    try {
      await backupService.exportFiltered(result.filePath, startMonth, endMonth)
      return { success: true, path: result.filePath }
    } catch (err: any) {
      return { success: false, error: err.message }
    }
  })

  ipcMain.handle(IPC_CHANNELS.APP_OPEN_DATA_FOLDER, async () => {
    const userDataPath = app.getPath('userData')
    await shell.openPath(userDataPath)
    return { success: true }
  })

  ipcMain.handle(IPC_CHANNELS.APP_RELAUNCH, () => {
    app.relaunch()
    // Delay allows Chromium's GPU process to release file handles before the new instance starts
    setTimeout(() => app.exit(0), 300)
  })

  ipcMain.handle(IPC_CHANNELS.BACKUP_EXPORT_CSV, async () => {
    const win = BrowserWindow.getFocusedWindow()
    if (!win) return { success: false }

    const result = await dialog.showSaveDialog(win, {
      title: 'Exportar CSV',
      defaultPath: `moneycapy-export-${new Date().toISOString().slice(0, 10)}.csv`,
      filters: [{ name: 'CSV', extensions: ['csv'] }]
    })

    if (result.canceled || !result.filePath) return { success: false }

    try {
      backupService.exportCsv(result.filePath)
      return { success: true, path: result.filePath }
    } catch (err: any) {
      return { success: false, error: err.message }
    }
  })
}
