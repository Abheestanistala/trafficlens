import type { Session } from '../../model/session'
import { contentKind, hostOf, responseSize } from './derive'
import type { FilterState } from './filters'
import { getHeader } from '../http/headers'

export type QuickResult =
  | { kind: 'filter'; label: string; test: (s: Session) => boolean }
  | { kind: 'clear-filters' }
  | { kind: 'clear-sessions' }
  | { kind: 'select'; test: (s: Session) => boolean; label: string }
  | { kind: 'error'; message: string }

const parseSize = (v: string): number | null => {
  const m = /^(\d+(?:\.\d+)?)([kmg]?)$/i.exec(v)
  if (!m) return null
  return Math.round(Number(m[1]) * { '': 1, k: 1024, m: 1024 ** 2, g: 1024 ** 3 }[m[2].toLowerCase() as '' | 'k' | 'm' | 'g'])
}

/**
 * Fiddler-style QuickExec subset:
 *   ?text  >10k  <1k  =404  =5xx  @host  select <kind|method|text>  cls  clearfilters
 */
export const runQuickExec = (input: string): QuickResult => {
  const q = input.trim()
  if (!q) return { kind: 'error', message: 'Empty command' }
  const lower = q.toLowerCase()
  if (lower === 'cls' || lower === 'clear') return { kind: 'clear-sessions' }
  if (lower === 'clearfilters' || lower === 'reset') return { kind: 'clear-filters' }

  const rest = q.slice(1).trim()
  switch (q[0]) {
    case '?': {
      const t = rest.toLowerCase()
      return { kind: 'filter', label: `URL contains "${rest}"`, test: (s) => s.request.url.toLowerCase().includes(t) }
    }
    case '>':
    case '<': {
      const n = parseSize(rest)
      if (n == null) return { kind: 'error', message: `Bad size "${rest}" (try 10k, 2m)` }
      return q[0] === '>'
        ? { kind: 'filter', label: `size > ${rest}`, test: (s) => responseSize(s) > n }
        : { kind: 'filter', label: `size < ${rest}`, test: (s) => responseSize(s) < n }
    }
    case '=': {
      const m = /^([1-5])xx$/i.exec(rest)
      if (m) return { kind: 'filter', label: `status ${rest}`, test: (s) => Math.floor(s.response.status / 100) === Number(m[1]) }
      if (/^\d{3}$/.test(rest)) return { kind: 'filter', label: `status = ${rest}`, test: (s) => s.response.status === Number(rest) }
      return { kind: 'error', message: `Bad status "${rest}"` }
    }
    case '@': {
      const h = rest.toLowerCase()
      return { kind: 'filter', label: `host ${rest}`, test: (s) => hostOf(s).toLowerCase().includes(h) }
    }
  }

  const sel = /^select\s+(.+)$/i.exec(q)
  if (sel) {
    const arg = sel[1].trim().toLowerCase()
    const kinds = ['image', 'json', 'html', 'script', 'css', 'xml', 'text', 'font']
    if (kinds.includes(arg)) return { kind: 'select', label: arg, test: (s) => contentKind(s) === arg }
    if (/^(get|post|put|delete|patch|head|options|connect)$/.test(arg))
      return { kind: 'select', label: arg, test: (s) => s.request.method.toLowerCase() === arg }
    const hdr = /^(\S+):(.+)$/.exec(arg)
    if (hdr) return { kind: 'select', label: arg, test: (s) => (getHeader(s.response.headers, hdr[1]) ?? '').toLowerCase().includes(hdr[2].trim()) }
    return { kind: 'select', label: arg, test: (s) => s.request.url.toLowerCase().includes(arg) }
  }
  return { kind: 'error', message: `Unknown command "${q}". Try ?text, >10k, =404, =5xx, @host, select json, cls` }
}

export const dropQuick = (f: FilterState, label: string): FilterState => ({
  ...f,
  quick: f.quick.filter((q) => q.label !== label),
})
