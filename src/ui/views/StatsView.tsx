import { useMemo } from 'react'
import type { Session } from '../../model/session'
import { computeStats, fmtBytes } from '../../lib/stats'
import { responseSize } from '../../lib/filter/derive'
import { StatusPill } from '../Badges'

const Bars = ({ items, fmt }: { items: { label: string; value: number; sub?: string }[]; fmt: (n: number) => string }) => {
  const max = Math.max(1, ...items.map((i) => i.value))
  return (
    <div className="bars" role="table">
      {items.map((i) => (
        <div key={i.label} style={{ display: 'contents' }} role="row">
          <span className="lab" title={i.label} role="cell">{i.label || '(none)'}</span>
          <span className="track" role="cell"><div className="fill" style={{ width: `${(i.value / max) * 100}%` }} /></span>
          <span className="val" role="cell">{fmt(i.value)}{i.sub && <span className="muted"> · {i.sub}</span>}</span>
        </div>
      ))}
    </div>
  )
}

export function StatsView({ rows, onSelect }: { rows: Session[]; onSelect: (id: string) => void }) {
  const st = useMemo(() => computeStats(rows), [rows])
  return (
    <div className="page">
      <h2>Statistics</h2>
      <p className="muted">For the {rows.length.toLocaleString()} sessions currently shown (filters apply).</p>
      <div className="cards">
        <div className="card"><b>{st.count.toLocaleString()}</b><span>requests</span></div>
        <div className="card"><b>{fmtBytes(st.bytesIn)}</b><span>received</span></div>
        <div className="card"><b>{fmtBytes(st.bytesOut)}</b><span>sent</span></div>
        <div className="card"><b>{(st.spanMs / 1000).toFixed(1)} s</b><span>capture span</span></div>
        {st.byStatus.map(([k, n]) => <div className="card" key={k}><b>{n}</b><span><StatusPill status={Number(k[0]) * 100} /> {k}</span></div>)}
      </div>
      <div className="cols2">
        <div className="panel"><h3>Bytes by content type</h3><Bars items={st.byKind.map(([k, v]) => ({ label: k, value: v.bytes, sub: `${v.count} req` }))} fmt={fmtBytes} /></div>
        <div className="panel"><h3>Bytes by host (top 15)</h3><Bars items={st.byHost.map(([k, v]) => ({ label: k, value: v.bytes, sub: `${v.count} req` }))} fmt={fmtBytes} /></div>
        <div className="panel"><h3>Slowest requests</h3>
          <table className="kv sans"><tbody>{st.slowest.map((s) => <tr key={s.id} className="click" onClick={() => onSelect(s.id)}><th>{Math.round(s.timings.total ?? 0)} ms</th><td><span className="url">{s.request.method} {s.request.url}</span></td></tr>)}</tbody></table></div>
        <div className="panel"><h3>Largest responses</h3>
          <table className="kv sans"><tbody>{st.largest.map((s) => <tr key={s.id} className="click" onClick={() => onSelect(s.id)}><th>{fmtBytes(responseSize(s))}</th><td><span className="url">{s.request.method} {s.request.url}</span></td></tr>)}</tbody></table></div>
      </div>
    </div>
  )
}
