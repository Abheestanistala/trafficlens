import type { Session } from '../model/session'
import { contentKind, hostOf, responseSize } from './filter/derive'

export type Stats = {
  count: number
  bytesIn: number
  bytesOut: number
  spanMs: number
  byStatus: [string, number][]
  byKind: [string, { count: number; bytes: number }][]
  byHost: [string, { count: number; bytes: number }][]
  slowest: Session[]
  largest: Session[]
}

export const computeStats = (list: Session[]): Stats => {
  const status = new Map<string, number>()
  const kind = new Map<string, { count: number; bytes: number }>()
  const host = new Map<string, { count: number; bytes: number }>()
  let bytesIn = 0
  let bytesOut = 0
  let min = Infinity
  let max = -Infinity
  for (const s of list) {
    const size = responseSize(s)
    bytesIn += size
    bytesOut += s.request.body.raw.length
    const key = `${Math.floor(s.response.status / 100)}xx`
    status.set(key, (status.get(key) ?? 0) + 1)
    for (const [m, k] of [[kind, contentKind(s)], [host, hostOf(s)]] as const) {
      const e = m.get(k) ?? { count: 0, bytes: 0 }
      e.count++
      e.bytes += size
      m.set(k, e)
    }
    if (s.timings.startedAt != null) {
      min = Math.min(min, s.timings.startedAt)
      max = Math.max(max, s.timings.startedAt + (s.timings.total ?? 0))
    }
  }
  const byBytes = (a: [string, { bytes: number }], b: [string, { bytes: number }]) => b[1].bytes - a[1].bytes
  return {
    count: list.length,
    bytesIn,
    bytesOut,
    spanMs: max > min ? max - min : 0,
    byStatus: [...status].sort(),
    byKind: [...kind].sort(byBytes),
    byHost: [...host].sort(byBytes).slice(0, 15),
    slowest: [...list].sort((a, b) => (b.timings.total ?? 0) - (a.timings.total ?? 0)).slice(0, 10),
    largest: [...list].sort((a, b) => responseSize(b) - responseSize(a)).slice(0, 10),
  }
}

export const fmtBytes = (n: number): string =>
  n < 1024 ? `${n} B` : n < 1024 ** 2 ? `${(n / 1024).toFixed(1)} KB` : `${(n / 1024 ** 2).toFixed(1)} MB`
