import { useMemo, useRef, useState } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import type { Session } from '../../model/session'
import { PHASE_LABEL, phasesOf, PHASES } from '../../lib/timing'
import { hostOf } from '../../lib/filter/derive'
import { MethodBadge, StatusPill } from '../Badges'

const fmtMs = (ms: number) => (ms >= 1000 ? `${(ms / 1000).toFixed(ms >= 10000 ? 0 : 1)} s` : `${Math.round(ms)} ms`)

export function TimelineView({ rows, selectedId, onSelect }: { rows: Session[]; selectedId?: string; onSelect: (id: string) => void }) {
  const parent = useRef<HTMLDivElement>(null)
  const [tip, setTip] = useState<{ x: number; y: number; s: Session } | null>(null)
  const sorted = useMemo(() => [...rows].sort((a, b) => (a.timings.startedAt ?? 0) - (b.timings.startedAt ?? 0) || a.seq - b.seq), [rows])
  const { t0, span } = useMemo(() => {
    const starts = sorted.map((s) => s.timings.startedAt).filter((x): x is number => x != null)
    const t0 = starts.length ? Math.min(...starts) : 0
    const end = Math.max(1, ...sorted.map((s) => (s.timings.startedAt ?? t0) - t0 + (s.timings.total ?? 0)))
    return { t0, span: end }
  }, [sorted])
  const v = useVirtualizer({ count: sorted.length, getScrollElement: () => parent.current, estimateSize: () => 24, overscan: 20 })
  const ticks = [0, 0.25, 0.5, 0.75, 1]

  return (
    <div className="wf">
      <div className="legend" aria-label="Timing phases">
        {PHASES.map((p) => <span key={p}><i className={`ph-${p}`} />{PHASE_LABEL[p]}</span>)}
        <span className="muted" style={{ marginLeft: 'auto' }}>{sorted.length.toLocaleString()} requests · {fmtMs(span)} total</span>
      </div>
      <div className="axis">
        <div style={{ padding: '0 8px' }}>Request</div>
        <div className="ticks">{ticks.map((t) => <span key={t} style={{ left: `${t * 100}%` }}>{fmtMs(span * t)}</span>)}</div>
      </div>
      <div ref={parent} style={{ flex: 1, overflow: 'auto' }}>
        <div style={{ height: v.getTotalSize(), position: 'relative' }}>
          {v.getVirtualItems().map((vi) => {
            const s = sorted[vi.index]
            const start = ((s.timings.startedAt ?? t0) - t0) / span
            const ph = phasesOf(s)
            const sum = ph.reduce((a, p) => a + p.ms, 0)
            const total = s.timings.total ?? sum
            return (
              <div
                key={s.id}
                className={`wfrow ${s.id === selectedId ? 'sel' : ''}`}
                style={{ transform: `translateY(${vi.start}px)`, top: 0 }}
                onClick={() => onSelect(s.id)}
                onMouseMove={(e) => setTip({ x: e.clientX, y: e.clientY, s })}
                onMouseLeave={() => setTip(null)}
              >
                <div className="lbl"><StatusPill status={s.response.status} /><MethodBadge method={s.request.method} /><span className="url" title={s.request.url}>{hostOf(s)}{(() => { try { return new URL(s.request.url).pathname } catch { return '' } })()}</span></div>
                <div className="lane">
                  <div className="wseg" style={{ left: `${start * 100}%`, width: `${Math.max(0.3, (total / span) * 100)}%` }}>
                    {ph.length ? ph.map((p) => <span key={p.key} className={`ph-${p.key}`} style={{ flex: p.ms }} />) : <span className="ph-total" style={{ flex: 1 }} />}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>
      {tip && (
        <div className="tip" style={{ left: Math.min(tip.x + 14, window.innerWidth - 380), top: tip.y + 14 }} role="tooltip">
          <b>{tip.s.request.method} {tip.s.request.url}</b>
          {phasesOf(tip.s).map((p) => <div key={p.key}><span><i className={`ph-${p.key}`} />{PHASE_LABEL[p.key]}</span><span>{fmtMs(p.ms)}</span></div>)}
          <div><span><b>Total</b></span><span>{tip.s.timings.total != null ? fmtMs(tip.s.timings.total) : '—'}</span></div>
        </div>
      )}
    </div>
  )
}
