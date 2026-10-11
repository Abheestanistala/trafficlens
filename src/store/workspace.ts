import { create } from 'zustand'
import type { Session } from '../model/session'
import { emptyFilters, type FilterState } from '../lib/filter/filters'
import type { Hit } from '../lib/search'
import { parseFile, resetWorker, restoreSessions } from '../workers/client'

export type View = 'sessions' | 'timeline' | 'findings' | 'stats' | 'search' | 'compare' | 'tools' | 'workspaces' | 'rules'
/** Views that list sessions and share the inspector pane underneath. */
export const LIST_VIEWS: View[] = ['sessions', 'timeline', 'findings', 'stats', 'search']

type State = {
  sessions: Session[]
  files: string[]
  selectedId?: string
  filters: FilterState
  loading: boolean
  error?: string
  showFilters: boolean
  view: View
  compareA?: string
  compareB?: string
  searchHits: Hit[]
  exportOpen: boolean
  load: (files: File[]) => Promise<void>
  loadSessions: (name: string, files: string[], sessions: Session[]) => void
  select: (id?: string) => void
  setFilters: (f: Partial<FilterState>) => void
  clear: () => void
  set: (p: Partial<State>) => void
  /** Select a session and make sure a list view with the inspector is showing. */
  reveal: (id: string) => void
}

export const useWorkspace = create<State>((set, get) => ({
  sessions: [],
  files: [],
  filters: emptyFilters(),
  loading: false,
  showFilters: true,
  view: 'sessions',
  searchHits: [],
  exportOpen: false,
  set: (p) => set(p),
  select: (selectedId) => set({ selectedId }),
  reveal: (id) => set({ selectedId: id, view: LIST_VIEWS.includes(get().view) ? get().view : 'sessions' }),
  setFilters: (f) => set({ filters: { ...get().filters, ...f } }),
  clear: () => {
    void resetWorker()
    set({ sessions: [], files: [], selectedId: undefined, filters: emptyFilters(), error: undefined, searchHits: [], compareA: undefined, compareB: undefined })
  },
  loadSessions: (_name, files, sessions) => {
    void restoreSessions(sessions)
    set({ sessions, files, selectedId: undefined, error: undefined, searchHits: [], filters: emptyFilters(), view: 'sessions' })
  },
  load: async (files) => {
    set({ loading: true, error: undefined })
    const errors: string[] = []
    let all = get().sessions
    const names = [...get().files]
    for (const f of files) {
      try {
        // Keep the source name unique so capture-to-capture diff can tell two files apart.
        let unique = f.name
        for (let n = 2; names.includes(unique); n++) unique = `${f.name} (${n})`
        const parsed = await parseFile(f, unique, String(names.length), all.length)
        all = all.concat(parsed)
        names.push(unique)
        set({ sessions: all, files: names })
      } catch (e) {
        errors.push(`${f.name}: ${e instanceof Error ? e.message : String(e)}`)
      }
    }
    set({ sessions: all, files: names, loading: false, error: errors.join('\n') || undefined })
  },
}))
