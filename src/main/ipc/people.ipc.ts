import { ipcMain } from 'electron'
import { WrappedDatabase } from '../database/connection'
import { IPC_CHANNELS } from '../../../shared/ipc-channels'
import { PeopleRepository } from '../database/repositories/people.repo'

export function registerPeopleHandlers(db: WrappedDatabase): void {
  const repo = new PeopleRepository(db)

  ipcMain.handle(IPC_CHANNELS.PEOPLE_LIST, () => {
    return (repo.findAll() as any[]).map(p => ({
      id: p.id, name: p.name, color: p.color
    }))
  })

  ipcMain.handle(IPC_CHANNELS.PEOPLE_CREATE, (_, data) => {
    const p = repo.create({ name: data.name, color: data.color || '#3b82f6' }) as any
    return { id: p.id, name: p.name, color: p.color }
  })

  ipcMain.handle(IPC_CHANNELS.PEOPLE_UPDATE, (_, data) => {
    const p = repo.update(data.id, { name: data.name, color: data.color }) as any
    return { id: p.id, name: p.name, color: p.color }
  })

  ipcMain.handle(IPC_CHANNELS.PEOPLE_DELETE, (_, id) => repo.delete(id))
}
