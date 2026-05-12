import { app, BrowserWindow, shell, Tray, Menu, nativeImage, ipcMain } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import { initDatabase, closeDatabase } from './database/connection'
import type { WrappedDatabase } from './database/connection'
import { getPendingMigrations, runMigrations } from './database/migrations/runner'
import './database/migrations/001_initial_schema'
import './database/migrations/002_restructure'
import './database/migrations/003_accounts'
import './database/migrations/004_card_splits'
import './database/migrations/005_item_details'
import './database/migrations/006_cleanup_orphaned_cards'
import './database/migrations/007_item_store'
import './database/migrations/008_monthly_restructure'
import './database/migrations/009_due_day_label'
import './database/migrations/010_income_monthly'
import './database/migrations/011_income_categories_tags'
import './database/migrations/012_emprestimo_type'
import './database/migrations/013_bank_account_fields'
import './database/migrations/014_end_reason'
import './database/migrations/015_item_anticipations'
import './database/migrations/016_anticipations_split_id'

import './database/migrations/018_item_bank_account'
import './database/migrations/019_fix_emprestimo_check'
import './database/migrations/020_income_persistent_override'
import './database/migrations/021_paid_at'
import './database/migrations/022_item_monthly_values'
import './database/migrations/023_payment_method_billing'
import './database/migrations/024_stores'
import './database/migrations/025_monthly_active'
import './database/migrations/026_bank_account_monthly_balance'
import './database/migrations/027_stores_color'
import './database/migrations/028_income_received_at'
import './database/migrations/029_dual_day_system'
import './database/migrations/030_due_day_month_offset'
import './database/migrations/031_card_due_type'
import './database/migrations/032_billing_day_month_offset'
import './database/migrations/033_emprestimo_base_value'
import './database/migrations/034_anticipation_discount'
import './database/migrations/035_income_notes'
import './database/migrations/036_income_store'
import './database/migrations/037_multi_currency'
import './database/migrations/038_resume_month'
import './database/migrations/039_item_interruptions'
import './database/migrations/040_income_interruptions'
import './database/migrations/041_split_payment_method'
import './database/migrations/042_category_scope'
import './database/migrations/043_subcategories'
import './database/migrations/044_subcategory_scope'
import './database/migrations/045_card_invoice_status'
import './database/migrations/046_current_installment_payments'
import './database/migrations/047_ensure_card_type'
import './database/migrations/048_card_limit_groups'
import './database/migrations/049_card_cvc'
import { registerAllIpcHandlers } from './ipc/register'
import { SettingsRepository } from './database/repositories/settings.repo'
import { startAutoUpdateRates, stopAutoUpdateRates } from './services/auto-update-rates'
import {
  completeMigrationProgress,
  createMigrationProgressWindow,
  failMigrationProgress,
  updateMigrationProgress
} from './migration-progress-window'

let mainWindow: BrowserWindow | null = null
let tray: Tray | null = null
let isQuitting = false
let db: WrappedDatabase

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

// App icon path — in dev: project root resources/, in packaged: process.resourcesPath
const APP_ICON_PATH = is.dev
  ? join(__dirname, '../../resources/icon.ico')
  : join(process.resourcesPath, 'icon.ico')

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1024,
    minHeight: 700,
    show: false,
    frame: false,
    icon: APP_ICON_PATH,
    titleBarStyle: 'hidden',
    titleBarOverlay: {
      color: 'rgba(0,0,0,0)',
      symbolColor: '#9ca3af',
      height: 40
    },
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false
    }
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow?.show()
  })

  mainWindow.on('close', (e) => {
    if (!isQuitting) {
      const settings = new SettingsRepository(db)
      const minimizeToTray = settings.get('minimizeToTray')
      if (minimizeToTray === 'true') {
        e.preventDefault()
        mainWindow?.hide()
        return
      }
    }
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

function getTrayLabels(): { open: string; quit: string } {
  const settings = new SettingsRepository(db)
  const lang = settings.get('language') || 'pt-BR'
  if (lang.startsWith('en')) return { open: 'Open MoneyCapy', quit: 'Quit' }
  return { open: 'Abrir MoneyCapy', quit: 'Sair' }
}

function createTray(): void {
  tray = new Tray(APP_ICON_PATH)
  tray.setToolTip('MoneyCapy')

  const labels = getTrayLabels()
  const contextMenu = Menu.buildFromTemplate([
    {
      label: labels.open,
      click: () => {
        mainWindow?.show()
        mainWindow?.focus()
      }
    },
    { type: 'separator' },
    {
      label: labels.quit,
      click: () => {
        isQuitting = true
        app.quit()
      }
    }
  ])

  tray.setContextMenu(contextMenu)
  tray.on('double-click', () => {
    mainWindow?.show()
    mainWindow?.focus()
  })
}

// Single instance lock — quit immediately if another instance is already running
const gotTheLock = app.requestSingleInstanceLock()
if (!gotTheLock) {
  app.quit()
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore()
      mainWindow.show()
      mainWindow.focus()
    }
  })
}

app.on('before-quit', () => {
  isQuitting = true
})

app.whenReady().then(async () => {
  electronApp.setAppUserModelId('com.moneycapy.app')

  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  // Initialize database (async for sql.js)
  db = await initDatabase()
  const pendingMigrations = getPendingMigrations(db)
  const migrationWindow =
    pendingMigrations.length > 0
      ? await createMigrationProgressWindow(APP_ICON_PATH, pendingMigrations.length)
      : null

  try {
    runMigrations(db, {
      onProgress: (progress) => updateMigrationProgress(migrationWindow, progress)
    })
    if (migrationWindow) {
      completeMigrationProgress(migrationWindow)
      await wait(600)
      migrationWindow.close()
    }
    db.forceSave()
  } catch (error) {
    failMigrationProgress(migrationWindow, error)
    await wait(4000)
    app.quit()
    throw error
  }

  // Register IPC handlers
  registerAllIpcHandlers(db)

  // Start auto-update rates scheduler
  startAutoUpdateRates(db)

  createWindow()
  createTray()

  // Apply auto-start setting
  const settings = new SettingsRepository(db)
  const autoStart = settings.get('autoStart')
  app.setLoginItemSettings({ openAtLogin: autoStart === 'true' })

  // IPC: set auto-start
  ipcMain.handle('app:set-auto-start', (_event, enabled: boolean) => {
    app.setLoginItemSettings({ openAtLogin: enabled })
    const s = new SettingsRepository(db)
    s.set('autoStart', String(enabled))
  })

  // IPC: set minimize-to-tray
  ipcMain.handle('app:set-minimize-to-tray', (_event, enabled: boolean) => {
    const s = new SettingsRepository(db)
    s.set('minimizeToTray', String(enabled))
  })

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  stopAutoUpdateRates()
  closeDatabase()
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
