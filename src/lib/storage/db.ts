import type { Session } from '../../model/session'

export type SavedWorkspace = { id: string; name: string; savedAt: number; files: string[]; sessions: Session[] }

const open = (): Promise<IDBDatabase> =>
  new Promise((res, rej) => {
    const r = indexedDB.open('htk-traffic-lens', 1)
    r.onupgradeneeded = () => r.result.createObjectStore('workspaces', { keyPath: 'id' })
    r.onsuccess = () => res(r.result)
    r.onerror = () => rej(r.error)
  })

const tx = async <T,>(mode: IDBTransactionMode, f: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> => {
  const db = await open()
  return new Promise((res, rej) => {
    const t = db.transaction('workspaces', mode)
    const r = f(t.objectStore('workspaces'))
    t.oncomplete = () => (db.close(), res(r.result))
    t.onerror = () => (db.close(), rej(t.error))
  })
}

export const saveWorkspace = (w: SavedWorkspace) => tx('readwrite', (s) => s.put(w))
export const deleteWorkspace = (id: string) => tx('readwrite', (s) => s.delete(id))
export const getWorkspace = (id: string) => tx<SavedWorkspace | undefined>('readonly', (s) => s.get(id))
export const listWorkspaces = async (): Promise<Pick<SavedWorkspace, 'id' | 'name' | 'savedAt' | 'files'>[]> => {
  const all = await tx<SavedWorkspace[]>('readonly', (s) => s.getAll())
  return all.map(({ id, name, savedAt, files }) => ({ id, name, savedAt, files })).sort((a, b) => b.savedAt - a.savedAt)
}
