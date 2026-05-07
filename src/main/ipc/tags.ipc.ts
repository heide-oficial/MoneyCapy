import { ipcMain } from 'electron'
import { WrappedDatabase } from '../database/connection'
import { IPC_CHANNELS } from '../../../shared/ipc-channels'
import type { TagCreateInput, TagUpdateInput } from '../../../shared/api-types'
import { TagsRepository } from '../database/repositories/tags.repo'

export function registerTagsHandlers(db: WrappedDatabase): void {
  const repo = new TagsRepository(db)

  ipcMain.handle(IPC_CHANNELS.TAGS_LIST, () => {
    return (repo.findAll() as any[]).map(t => ({
      id: t.id, name: t.name, color: t.color
    }))
  })

  ipcMain.handle(IPC_CHANNELS.TAGS_CREATE, (_, data: TagCreateInput) => {
    const t = repo.create({ name: data.name, color: data.color }) as any
    return { id: t.id, name: t.name, color: t.color }
  })

  ipcMain.handle(IPC_CHANNELS.TAGS_UPDATE, (_, data: TagUpdateInput) => {
    const updateData: Partial<TagCreateInput> = {}
    if (data.name !== undefined) updateData.name = data.name
    if (data.color !== undefined) updateData.color = data.color
    const t = repo.update(data.id, updateData) as any
    return { id: t.id, name: t.name, color: t.color }
  })

  ipcMain.handle(IPC_CHANNELS.TAGS_DELETE, (_, id) => repo.delete(id))
}
