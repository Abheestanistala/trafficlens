import { lazy, Suspense, useMemo, useState } from 'react'
import type { Session } from '../../model/session'
import { bodyText } from '../../lib/http/body'
import { diffCaptures } from '../../lib/capture-diff'
import { getHeader } from '../../lib/http/headers'
import { useWorkspace } from '../../store/workspace'
import { StatusPill } from '../Badges'

const MonacoDiff = lazy(() => import('../MonacoDiff'))

const headersText = (s: Session, which: 'request' | 'response') =>
  `${which === 'request' ? `${s.request.method} ${s.request.url}` : `${s.response.status} ${s.response.statusText}`}\n` +
  s[which].headers.map((h) => `${h.name}: ${h.value}`).sort().join('\n')

const language = (s: Session) => { const ct = getHeader(s.response.headers, 'content-type') ?? ''; return ct.includes('json') ? 'json' : ct.includes('html') ? 'html' : ct.includes('xml') ? 'xml' : 'plaintext' }

function SessionDiff({ a, b }: { a?: Session; b?: Session }) {
  const [part, setPart] = useState<'reqH' | 'resH' | 'reqB' | 'resB'>('resB')
  if (!a || !b) return <div className="callout">Pick two sessions: select a row, then use <b>Set as A</b> / <b>Set as B</b> in the Sessions toolbar (or from a capture-diff row below).</div>
  const [o, m] = {
    reqH: [headersText(a, 'request'), headersText(b, 'request')],
    resH: [headersText(a, 'response'), headersText(b, 'response')],
    reqB: [bodyText(a.request.body, a.request.headers), bodyText(b.request.body, b.request.headers)],
    resB: [bodyText(a.response.body, a.response.headers), bodyText(b.response.body, b.response.headers)],
  }[part]
  const pretty = (t: string) => { try { return JSON.stringify(JSON.parse(t), null, 2) } catch { return t } }
  return (
    <div className="panel" style={{ padding: 0, overflow: 'hidden' }}>
      <div className="tabs">
        {([['reqH', 'Request headers'], ['resH', 'Response headers'], ['reqB', 'Request body'], ['resB', 'Response body']] as const).map(([k, l]) => <button key={k} className={part === k ? 'on' : ''} onClick={() => setPart(k)}>{l}</button>)}
        <span className="grow1" />
        <span className="muted size">A #{a.seq} ⇄ B #{b.seq}</span>
      </div>
      <div style={{ height: 420 }}>
        <Suspense fallback={<div className="pad muted">Loading diff…</div>}>
          <MonacoDiff original={part.endsWith('B') ? pretty(o) : o} modified={part.endsWith('B') ? pretty(m) : m} language={part.endsWith('B') ? language(b) : 'plaintext'} />
        </Suspense>
      </div>
    </div>
  )
}

export function CompareView({ sessions, files }: { sessions: Session[]; files: string[] }) {
  const { compareA, compareB, set, reveal } = useWorkspace()
  const byId = useMemo(() => new Map(sessions.map((s) => [s.id, s])), [sessions])
  const [srcA, setSrcA] = useState(files[0] ?? '')
  const [srcB, setSrcB] = useState(files[1] ?? files[0] ?? '')
  const [showSame, setShowSame] = useState(false)
  const rows = useMemo(() => (srcA && srcB && srcA !== srcB ? diffCaptures(sessions, srcA, srcB) : []), [sessions, srcA, srcB])
  const counts = useMemo(() => rows.reduce<Record<string, number>>((c, r) => ((c[r.kind] = (c[r.kind] ?? 0) + 1), c), {}), [rows])

  return (
    <div className="page">
      <h2>Compare</h2>
      <p className="muted">Diff two sessions byte-for-byte, or two whole captures matched by method and URL.</p>
      <div className="panel"><h3>Session diff</h3><SessionDiff a={compareA ? byId.get(compareA) : undefined} b={compareB ? byId.get(compareB) : undefined} /></div>
      <div className="panel">
        <h3>Capture diff</h3>
        {files.length < 2 ? <div className="callout">Open at least two capture files (Open… accepts several) to diff them. Each file is a separate side.</div> : (
          <>
            <div className="row" style={{ marginBottom: 10, flexWrap: 'wrap' }}>
              <label className="row">A <select value={srcA} onChange={(e) => setSrcA(e.target.value)}>{files.map((f) => <option key={f}>{f}</option>)}</select></label>
              <span>⇄</span>
              <label className="row">B <select value={srcB} onChange={(e) => setSrcB(e.target.value)}>{files.map((f) => <option key={f}>{f}</option>)}</select></label>
              <label className="row"><input type="checkbox" checked={showSame} onChange={(e) => setShowSame(e.target.checked)} />Show unchanged</label>
              <span className="muted">{(['changed', 'added', 'removed', 'same'] as const).map((k) => `${counts[k] ?? 0} ${k}`).join(' · ')}</span>
            </div>
            {srcA === srcB && <div className="callout warn">Pick two different files.</div>}
            <table className="kv sans"><tbody>
              {rows.filter((r) => showSame || r.kind !== 'same').slice(0, 500).map((r) => (
                <tr key={r.key} className="click" onClick={() => { if (r.a && r.b) { set({ compareA: r.a.id, compareB: r.b.id }); window.scrollTo(0, 0) } else reveal((r.a ?? r.b)!.id) }}>
                  <th><span className={`tag dk-${r.kind}`}>{r.kind}</span></th>
                  <td><span className="url">{r.key}</span>
                    <div className="row muted">{r.a && <StatusPill status={r.a.response.status} />}{r.a && r.b && '→'}{r.b && <StatusPill status={r.b.response.status} />}<span>{r.changes.join(' · ')}</span></div></td>
                </tr>
              ))}
            </tbody></table>
          </>
        )}
      </div>
    </div>
  )
}
