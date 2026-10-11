import { useMemo } from 'react'
import type { Session } from '../model/session'
import { hostOf, contentKind } from '../lib/filter/derive'
import { emptyFilters } from '../lib/filter/filters'
import { useWorkspace } from '../store/workspace'

const KINDS = ['html', 'json', 'script', 'css', 'image', 'xml', 'text', 'font', 'other', 'none']

export function FilterPanel({ all }: { all: Session[] }) {
  const { filters: f, setFilters } = useWorkspace()
  const hosts = useMemo(() => {
    const m = new Map<string, number>()
    for (const s of all) m.set(hostOf(s), (m.get(hostOf(s)) ?? 0) + 1)
    return [...m].sort((a, b) => b[1] - a[1]).slice(0, 50)
  }, [all])
  const counts = useMemo(() => {
    const k = new Map<string, number>()
    const st = new Map<number, number>()
    for (const s of all) {
      k.set(contentKind(s), (k.get(contentKind(s)) ?? 0) + 1)
      const c = Math.floor(s.response.status / 100)
      st.set(c, (st.get(c) ?? 0) + 1)
    }
    return { k, st }
  }, [all])
  const toggle = <T,>(arr: T[], v: T) => (arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v])
  const num = (v: string) => (v === '' ? undefined : Number(v))
  const active = f.text || f.hosts.length || f.statusClasses.length || f.kinds.length || f.hideConnects || f.hide304 || f.minSize != null || f.minDuration != null

  return (
    <aside className="filters scroll" aria-label="Filters">
      <div className="row"><h4 className="grow1" style={{ margin: 0 }}>Filters</h4>{active ? <button className="ghost" onClick={() => setFilters({ ...emptyFilters(), quick: f.quick })}>Reset</button> : null}</div>
      <label>URL contains or /regex/
        <input value={f.text} onChange={(e) => setFilters({ text: e.target.value })} placeholder="/api/ or /v\d+/" />
      </label>
      <div><h4>Status</h4>
        <div className="seg">{[2, 3, 4, 5, 0].map((c) => (
          <button key={c} aria-pressed={f.statusClasses.includes(c)} disabled={!counts.st.get(c)} onClick={() => setFilters({ statusClasses: toggle(f.statusClasses, c) })}>{c ? `${c}xx` : 'none'} <span className="muted">{counts.st.get(c) ?? 0}</span></button>
        ))}</div></div>
      <div><h4>Content type</h4>
        {KINDS.filter((k) => counts.k.has(k)).map((k) => (
          <label key={k} className="chk"><input type="checkbox" checked={f.kinds.includes(k)} onChange={() => setFilters({ kinds: toggle(f.kinds, k) })} /><span className={`kind k-${k}`}><i />{k}</span><span className="cnt">{counts.k.get(k)}</span></label>
        ))}</div>
      <div><h4>Hide</h4>
        <label className="chk"><input type="checkbox" checked={f.hideConnects} onChange={(e) => setFilters({ hideConnects: e.target.checked })} />CONNECT tunnels</label>
        <label className="chk"><input type="checkbox" checked={f.hide304} onChange={(e) => setFilters({ hide304: e.target.checked })} />304 Not Modified</label></div>
      <div><h4>Thresholds</h4>
        <label>Min size (bytes)<input type="number" min={0} value={f.minSize ?? ''} onChange={(e) => setFilters({ minSize: num(e.target.value) })} /></label>
        <label style={{ marginTop: 6 }}>Min duration (ms)<input type="number" min={0} value={f.minDuration ?? ''} onChange={(e) => setFilters({ minDuration: num(e.target.value) })} /></label></div>
      <div><h4>Hosts</h4>
        {hosts.map(([h, n]) => (
          <label key={h} className="chk"><input type="checkbox" checked={f.hosts.includes(h)} onChange={() => setFilters({ hosts: toggle(f.hosts, h) })} /><span className="grow1 url" style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{h || '(none)'}</span><span className="cnt">{n}</span></label>
        ))}</div>
    </aside>
  )
}
