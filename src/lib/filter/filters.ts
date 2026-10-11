import type { Session } from '../../model/session'
import { contentKind, hostOf, responseSize } from './derive'

export type FilterState = {
  text: string // substring or /regex/ on URL
  hosts: string[] // empty = all
  hiddenHosts: string[]
  statusClasses: number[] // e.g. [4,5]; empty = all
  kinds: string[] // empty = all
  hideConnects: boolean
  hide304: boolean
  minSize?: number
  maxSize?: number
  minDuration?: number
  /** Extra predicates from QuickExec, ANDed together. */
  quick: { label: string; test: (s: Session) => boolean }[]
}

export const emptyFilters = (): FilterState => ({
  text: '',
  hosts: [],
  hiddenHosts: [],
  statusClasses: [],
  kinds: [],
  hideConnects: false,
  hide304: false,
  quick: [],
})

export const compileText = (text: string): ((url: string) => boolean) | null => {
  if (!text) return null
  const m = /^\/(.+)\/([gimsuy]*)$/.exec(text)
  if (m) {
    try {
      const re = new RegExp(m[1], m[2].replace('g', ''))
      return (u) => re.test(u)
    } catch {
      return () => false
    }
  }
  const t = text.toLowerCase()
  return (u) => u.toLowerCase().includes(t)
}

export const applyFilters = (sessions: Session[], f: FilterState): Session[] => {
  const textTest = compileText(f.text)
  return sessions.filter((s) => {
    if (f.hideConnects && s.request.method === 'CONNECT') return false
    if (f.hide304 && s.response.status === 304) return false
    if (textTest && !textTest(s.request.url)) return false
    if (f.hosts.length || f.hiddenHosts.length) {
      const h = hostOf(s)
      if (f.hosts.length && !f.hosts.includes(h)) return false
      if (f.hiddenHosts.includes(h)) return false
    }
    if (f.statusClasses.length && !f.statusClasses.includes(Math.floor(s.response.status / 100))) return false
    if (f.kinds.length && !f.kinds.includes(contentKind(s))) return false
    if (f.minSize != null && responseSize(s) < f.minSize) return false
    if (f.maxSize != null && responseSize(s) > f.maxSize) return false
    if (f.minDuration != null && (s.timings.total ?? 0) < f.minDuration) return false
    return f.quick.every((q) => q.test(s))
  })
}
