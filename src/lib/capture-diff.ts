import type { Session } from '../model/session'
import { responseSize } from './filter/derive'

export type DiffKind = 'added' | 'removed' | 'changed' | 'same'
export type DiffRow = { key: string; kind: DiffKind; a?: Session; b?: Session; changes: string[] }

const keyOf = (s: Session) => `${s.request.method} ${s.request.url.split('#')[0]}`

/** Match two captures by method+URL (nth occurrence pairs with nth occurrence). */
export const diffCaptures = (all: Session[], srcA: string, srcB: string, timeTolerance = 0.5): DiffRow[] => {
  const group = (src: string) => {
    const m = new Map<string, Session[]>()
    for (const s of all) if (s.source === src) m.set(keyOf(s), [...(m.get(keyOf(s)) ?? []), s])
    return m
  }
  const A = group(srcA)
  const B = group(srcB)
  const rows: DiffRow[] = []
  for (const k of new Set([...A.keys(), ...B.keys()])) {
    const la = A.get(k) ?? []
    const lb = B.get(k) ?? []
    for (let i = 0; i < Math.max(la.length, lb.length); i++) {
      const a = la[i]
      const b = lb[i]
      const key = la.length > 1 || lb.length > 1 ? `${k} #${i + 1}` : k
      if (!a) rows.push({ key, kind: 'added', b, changes: [] })
      else if (!b) rows.push({ key, kind: 'removed', a, changes: [] })
      else {
        const changes: string[] = []
        if (a.response.status !== b.response.status) changes.push(`status ${a.response.status} → ${b.response.status}`)
        const sa = responseSize(a)
        const sb = responseSize(b)
        if (sa !== sb) changes.push(`size ${sa} → ${sb} B`)
        const ta = a.timings.total
        const tb = b.timings.total
        if (ta != null && tb != null && ta > 0 && Math.abs(tb - ta) / ta > timeTolerance && Math.abs(tb - ta) > 100) changes.push(`time ${Math.round(ta)} → ${Math.round(tb)} ms`)
        rows.push({ key, kind: changes.length ? 'changed' : 'same', a, b, changes })
      }
    }
  }
  const order = { changed: 0, added: 1, removed: 2, same: 3 }
  return rows.sort((x, y) => order[x.kind] - order[y.kind])
}
