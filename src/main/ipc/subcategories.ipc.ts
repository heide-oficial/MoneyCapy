import { ipcMain } from 'electron'
import { WrappedDatabase } from '../database/connection'
import { IPC_CHANNELS } from '../../../shared/ipc-channels'
import { SubcategoriesRepository } from '../database/repositories/subcategories.repo'

export function registerSubcategoriesHandlers(db: WrappedDatabase): void {
  const repo = new SubcategoriesRepository(db)

  ipcMain.handle(IPC_CHANNELS.SUBCATEGORIES_LIST, () => repo.findAll())
  ipcMain.handle(IPC_CHANNELS.SUBCATEGORIES_CREATE, (_, data) => repo.create(data))
  ipcMain.handle(IPC_CHANNELS.SUBCATEGORIES_UPDATE, (_, data) => repo.update(data.id, data))
  ipcMain.handle(IPC_CHANNELS.SUBCATEGORIES_DELETE, (_, id) => repo.delete(id))
}
