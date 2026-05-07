import { ipcMain } from 'electron'
import { WrappedDatabase } from '../database/connection'
import { IPC_CHANNELS } from '../../../shared/ipc-channels'
import type { SubcategoryCreateInput, SubcategoryUpdateInput } from '../../../shared/api-types'
import { SubcategoriesRepository } from '../database/repositories/subcategories.repo'

export function registerSubcategoriesHandlers(db: WrappedDatabase): void {
  const repo = new SubcategoriesRepository(db)

  ipcMain.handle(IPC_CHANNELS.SUBCATEGORIES_LIST, () => repo.findAll())
  ipcMain.handle(IPC_CHANNELS.SUBCATEGORIES_CREATE, (_, data: SubcategoryCreateInput) => repo.create(data))
  ipcMain.handle(IPC_CHANNELS.SUBCATEGORIES_UPDATE, (_, data: SubcategoryUpdateInput) => repo.update(data.id, data))
  ipcMain.handle(IPC_CHANNELS.SUBCATEGORIES_DELETE, (_, id) => repo.delete(id))
}
