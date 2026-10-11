import { expose } from 'comlink'
import { importFile } from '../importers'
import type { Session } from '../model/session'
import { searchSessions, type Hit, type SearchOpts } from '../lib/search'

// The worker keeps its own copy of every session so full-text search never blocks the UI thread.
let held: Session[] = []

const api = {
  parse(name: string, buf: ArrayBuffer, prefix: string, baseSeq: number): Session[] {
    const parsed = importFile(name, new Uint8Array(buf)).map((s, i) => ({ ...s, id: `${prefix}:${s.id}`, seq: baseSeq + i + 1 }))
    held = held.concat(parsed)
    return parsed
  },
  restore(sessions: Session[]) {
    held = sessions
  },
  reset() {
    held = []
  },
  search(q: string, o: SearchOpts): Hit[] {
    return searchSessions(held, q, o)
  },
}
export type ParseApi = typeof api
expose(api)
