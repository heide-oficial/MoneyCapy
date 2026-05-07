import { ipcMain } from 'electron'
import { WrappedDatabase } from '../database/connection'
import { IPC_CHANNELS } from '../../../shared/ipc-channels'
import type { CategoryCreateInput, CategoryUpdateInput } from '../../../shared/api-types'
import { CategoriesRepository } from '../database/repositories/categories.repo'

export function registerCategoriesHandlers(db: WrappedDatabase): void {
  const repo = new CategoriesRepository(db)

  ipcMain.handle(IPC_CHANNELS.CATEGORIES_LIST, () => repo.findAll())
  ipcMain.handle(IPC_CHANNELS.CATEGORIES_CREATE, (_, data: CategoryCreateInput) => repo.create(data))
  ipcMain.handle(IPC_CHANNELS.CATEGORIES_UPDATE, (_, data: CategoryUpdateInput) => repo.update(data.id, data))
  ipcMain.handle(IPC_CHANNELS.CATEGORIES_DELETE, (_, id) => repo.delete(id))
}
