import { useState } from 'react'
import type { Session } from '../../model/session'
import type { Scope } from '../../lib/search'
import { searchInWorker } from '../../workers/client'
import { useWorkspace } from '../../store/workspace'

const SCOPES: [Scope, string][] = [['url', 'URL'], ['reqHeaders', 'Request headers'], ['resHeaders', 'Response headers'], ['reqBody', 'Request body'], ['resBody', 'Response body']]

export function SearchView({ sessions, onOpen }: { sessions: Session[]; onOpen: (id: string) => void }) {
  const hits = useWorkspace((s) => s.searchHits)
  const set = useWorkspace((s) => s.set)
  const [q, setQ] = useState('')
  const [regex, setRegex] = useState(false)
  const [cs, setCs] = useState(false)
  const [scopes, setScopes] = useState<Scope[]>(['url', 'reqHeaders', 'resHeaders', 'reqBody', 'resBody'])
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const byId = new Map(sessions.map((s) => [s.id, s]))

  const run = async () => {
    setBusy(true)
    setErr('')
    try {
      set({ searchHits: await searchInWorker(q, { regex, caseSensitive: cs, scopes }) })
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e))
    }
    setBusy(false)
  }

  return (
    <div className="page">
      <h2>Find</h2>
      <p className="muted">Full-text search across URLs, headers and decoded bodies. Runs in a background worker.</p>
      <div className="row" style={{ marginBottom: 8 }}>
        <input className="grow1" autoFocus aria-label="Search text" placeholder="Search text or regex…" value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && q && void run()} />
        <button className="primary" disabled={!q || busy} onClick={() => void run()}>{busy ? 'Searching…' : 'Search'}</button>
      </div>
      <div className="row" style={{ flexWrap: 'wrap', marginBottom: 12 }}>
        <label className="row"><input type="checkbox" checked={regex} onChange={(e) => setRegex(e.target.checked)} />Regex</label>
        <label className="row"><input type="checkbox" checked={cs} onChange={(e) => setCs(e.target.checked)} />Match case</label>
        <span className="muted">·</span>
        {SCOPES.map(([k, l]) => <label key={k} className="row"><input type="checkbox" checked={scopes.includes(k)} onChange={() => setScopes(scopes.includes(k) ? scopes.filter((x) => x !== k) : [...scopes, k])} />{l}</label>)}
      </div>
      {err && <div className="callout bad">{err}</div>}
      {hits.length > 0 && <div className="muted" style={{ marginBottom: 6 }}>{hits.length.toLocaleString()} hit{hits.length > 1 ? 's' : ''}{hits.length >= 2000 ? ' (limit reached)' : ''}</div>}
      <table className="kv sans"><tbody>
        {hits.map((h, i) => { const s = byId.get(h.id); return s && (
          <tr key={i} className="click" onClick={() => onOpen(h.id)}>
            <th>#{s.seq} <span className="tag dk-same">{SCOPES.find(([k]) => k === h.scope)?.[1]}</span></th>
            <td><div className="url" style={{ color: 'var(--accent)' }}>{s.request.method} {s.request.url}</div><div className="muted">{h.snippet}</div></td>
          </tr>
        ) })}
      </tbody></table>
    </div>
  )
}
