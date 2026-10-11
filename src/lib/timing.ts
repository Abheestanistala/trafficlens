import type { Session } from '../model/session'

export const PHASES = ['blocked', 'dns', 'connect', 'ssl', 'send', 'wait', 'receive'] as const
export type Phase = (typeof PHASES)[number]
export const PHASE_LABEL: Record<Phase, string> = { blocked: 'Blocked', dns: 'DNS', connect: 'Connect', ssl: 'TLS', send: 'Send', wait: 'Wait (TTFB)', receive: 'Receive' }

/** HAR `ssl` is included inside `connect`; subtract it so segments don't double count. */
export const phasesOf = (s: Session): { key: Phase; ms: number }[] => {
  const t = s.timings
  const out = PHASES.map((key) => {
    let ms = t[key] ?? 0
    if (key === 'connect' && t.ssl) ms = Math.max(0, ms - t.ssl)
    return { key, ms }
  }).filter((p) => p.ms > 0)
  // Importers without a phase breakdown (e.g. Charles totals): show one unlabeled block.
  if (!out.length && t.total) return [{ key: 'wait', ms: t.total }]
  return out
}
