import { ipcMain } from 'electron'
import { WrappedDatabase } from '../database/connection'
import { IPC_CHANNELS } from '../../../shared/ipc-channels'
import type { StoreCreateInput, StoreUpdateInput } from '../../../shared/api-types'
import { StoresRepository } from '../database/repositories/stores.repo'

export function registerStoresHandlers(db: WrappedDatabase): void {
  const repo = new StoresRepository(db)

  ipcMain.handle(IPC_CHANNELS.STORES_LIST, () => {
    return (repo.findAll() as any[]).map(s => ({
      id: s.id, name: s.name, color: s.color || '#6366f1'
    }))
  })

  ipcMain.handle(IPC_CHANNELS.STORES_CREATE, (_, data: StoreCreateInput) => {
    const s = repo.create({ name: data.name, color: data.color }) as any
    return { id: s.id, name: s.name, color: s.color || '#6366f1' }
  })

  ipcMain.handle(IPC_CHANNELS.STORES_UPDATE, (_, data: StoreUpdateInput) => {
    const updateData: Partial<StoreCreateInput> = {}
    if (data.name !== undefined) updateData.name = data.name
    if (data.color !== undefined) updateData.color = data.color
    const s = repo.update(data.id, updateData) as any
    return { id: s.id, name: s.name, color: s.color || '#6366f1' }
  })

  ipcMain.handle(IPC_CHANNELS.STORES_DELETE, (_, id) => repo.delete(id))
}
