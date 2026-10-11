import { lazy, Suspense, useMemo, useState } from 'react'
import type { Header, HttpMessage, Session } from '../../model/session'
import { bodyBytes } from '../../lib/http/body'
import { getHeader } from '../../lib/http/headers'
import { analyzeCaching } from '../../lib/http/caching'
import { decodeJwt, findJwts } from '../../lib/jwt'
import { phasesOf, PHASE_LABEL } from '../../lib/timing'
import { StatusPill, MethodBadge } from '../Badges'

const MonacoView = lazy(() => import('../MonacoView'))
const dec = new TextDecoder()

type Tab = 'headers' | 'text' | 'syntax' | 'json' | 'form' | 'hex' | 'image' | 'cookies' | 'auth' | 'caching' | 'raw' | 'timing'

const languageFor = (ct: string): string => {
  if (ct.includes('json')) return 'json'
  if (ct.includes('html')) return 'html'
  if (ct.includes('xml')) return 'xml'
  if (ct.includes('javascript')) return 'javascript'
  if (ct.includes('css')) return 'css'
  return 'plaintext'
}

const prettyJson = (t: string): string | null => {
  try {
    return JSON.stringify(JSON.parse(t), null, 2)
  } catch {
    return null
  }
}

const hexDump = (b: Uint8Array, limit = 64 * 1024): string => {
  const lines: string[] = []
  const n = Math.min(b.length, limit)
  for (let i = 0; i < n; i += 16) {
    const row = b.subarray(i, Math.min(i + 16, n))
    const hex = [...row].map((x) => x.toString(16).padStart(2, '0')).join(' ').padEnd(47)
    const asc = [...row].map((x) => (x >= 32 && x < 127 ? String.fromCharCode(x) : '.')).join('')
    lines.push(`${i.toString(16).padStart(8, '0')}  ${hex}  ${asc}`)
  }
  if (b.length > limit) lines.push(`… ${b.length - limit} more bytes`)
  return lines.join('\n')
}

const HeaderTable = ({ headers }: { headers: Header[] }) =>
  headers.length === 0 ? (
    <div className="muted pad">No headers</div>
  ) : (
    <table className="kv">
      <tbody>
        {headers.map((h, i) => (
          <tr key={i}>
            <th>{h.name}</th>
            <td>{h.value}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )

const parseCookies = (m: HttpMessage, response: boolean) =>
  response
    ? m.headers.filter((h) => h.name.toLowerCase() === 'set-cookie').map((h) => {
        const [pair, ...attrs] = h.value.split(';').map((x) => x.trim())
        const i = pair.indexOf('=')
        return { name: pair.slice(0, i), value: pair.slice(i + 1), attrs }
      })
    : (getHeader(m.headers, 'cookie') ?? '').split(';').filter(Boolean).map((p) => {
        const i = p.indexOf('=')
        return { name: p.slice(0, i).trim(), value: p.slice(i + 1).trim(), attrs: [] as string[] }
      })

function AuthPanel({ headers, now }: { headers: Header[]; now: number }) {
  const auth = getHeader(headers, 'authorization') ?? getHeader(headers, 'proxy-authorization') ?? ''
  const scheme = auth.split(' ')[0]
  let basic: string | null = null
  if (/^basic$/i.test(scheme)) {
    try { basic = atob(auth.slice(6).trim()) } catch { basic = null }
  }
  const jwts = [...new Set([...findJwts(auth), ...findJwts(getHeader(headers, 'cookie') ?? '')])].map((t) => ({ t, j: decodeJwt(t) })).filter((x) => x.j)
  return (
    <div className="scroll">
      {auth && <table className="kv sans"><tbody><tr><th>Scheme</th><td>{scheme}</td></tr>{basic && <tr><th>Decoded</th><td>{basic.replace(/:.*/, ':••••••')} <span className="muted">(password hidden)</span></td></tr>}</tbody></table>}
      {jwts.map(({ t, j }, i) => {
        const expired = j!.expiresAt != null && j!.expiresAt < now
        return (
          <div key={i}>
            <div className={`callout ${expired ? 'bad' : j!.expiresAt ? 'good' : ''}`}>
              {j!.expiresAt ? (expired ? `Expired ${new Date(j!.expiresAt).toISOString()}` : `Valid until ${new Date(j!.expiresAt).toISOString()}`) : 'JWT without exp claim'}
              {j!.expiresAt && !expired && <span className="muted"> (relative to capture time)</span>}
            </div>
            <pre className="mono">{JSON.stringify({ header: j!.header, payload: j!.payload }, null, 2)}</pre>
            <div className="muted pad" style={{ wordBreak: 'break-all' }}>{t.slice(0, 80)}…</div>
          </div>
        )
      })}
      {!auth && !jwts.length && <div className="muted pad">No Authorization header or JWT found.</div>}
    </div>
  )
}

function CachingPanel({ headers }: { headers: Header[] }) {
  const c = analyzeCaching(headers)
  const tone = c.verdict === 'cacheable' ? 'good' : c.verdict === 'none' ? 'warn' : ''
  const text = { 'no-store': 'Not cacheable (no-store)', revalidate: 'Cacheable but must revalidate every time', cacheable: `Fresh for ${c.maxAge != null ? `${c.maxAge} s` : 'until Expires'}`, heuristic: 'Heuristically cacheable', none: 'No caching headers' }[c.verdict]
  return (
    <div className="scroll">
      <div className={`callout ${tone}`}><b>{text}</b></div>
      <table className="kv sans"><tbody>
        {['cache-control', 'expires', 'etag', 'last-modified', 'age', 'vary', 'pragma'].map((n) => getHeader(headers, n) && <tr key={n}><th>{n}</th><td>{getHeader(headers, n)}</td></tr>)}
        <tr><th>Validators</th><td>{c.validators.join(', ') || 'none'}</td></tr>
      </tbody></table>
      {c.notes.map((n) => <div key={n} className="callout warn">{n}</div>)}
    </div>
  )
}

function TimingPanel({ session }: { session: Session }) {
  const ph = phasesOf(session)
  const total = ph.reduce((a, p) => a + p.ms, 0) || 1
  return (
    <div className="scroll pad">
      <div style={{ display: 'flex', gap: 2, height: 14, marginBottom: 12 }} role="img" aria-label="Timing breakdown">
        {ph.map((p) => <span key={p.key} className={`ph-${p.key}`} style={{ flex: p.ms / total, borderRadius: 4, minWidth: 3 }} title={`${PHASE_LABEL[p.key]}: ${Math.round(p.ms)} ms`} />)}
      </div>
      <table className="kv sans"><tbody>
        {ph.map((p) => <tr key={p.key}><th><i className={`ph-${p.key}`} style={{ display: 'inline-block', width: 9, height: 9, borderRadius: 3, marginRight: 8 }} />{PHASE_LABEL[p.key]}</th><td>{Math.round(p.ms)} ms</td></tr>)}
        <tr><th>Total</th><td><b>{session.timings.total != null ? `${Math.round(session.timings.total)} ms` : '—'}</b></td></tr>
        {session.timings.startedAt && <tr><th>Started</th><td>{new Date(session.timings.startedAt).toISOString()}</td></tr>}
        {session.net.serverIp && <tr><th>Server IP</th><td>{session.net.serverIp}</td></tr>}
        {session.net.clientIp && <tr><th>Client IP</th><td>{session.net.clientIp}</td></tr>}
        {session.net.process && <tr><th>Process</th><td>{session.net.process}</td></tr>}
      </tbody></table>
    </div>
  )
}

export function Inspector({ title, message, isResponse, startLine, session }: { title: string; message: HttpMessage; isResponse: boolean; startLine: string; session: Session }) {
  const [tab, setTab] = useState<Tab>('headers')
  const ct = (getHeader(message.headers, 'content-type') ?? '').toLowerCase()
  const bytes = useMemo(() => bodyBytes(message.body, message.headers), [message])
  const text = useMemo(() => dec.decode(bytes), [bytes])
  const json = useMemo(() => (ct.includes('json') || /^\s*[[{]/.test(text) ? prettyJson(text) : null), [ct, text])
  const isImage = ct.startsWith('image/')
  const imgUrl = useMemo(() => (isImage ? URL.createObjectURL(new Blob([bytes as BlobPart], { type: ct })) : ''), [isImage, bytes, ct])
  const cookies = parseCookies(message, isResponse)
  const form = useMemo(() => (ct.includes('x-www-form-urlencoded') ? [...new URLSearchParams(text)] : []), [ct, text])
  const query = useMemo(() => { try { return isResponse ? [] : [...new URL(session.request.url).searchParams] } catch { return [] } }, [isResponse, session])
  const hasAuth = !isResponse && (getHeader(message.headers, 'authorization') || findJwts(getHeader(message.headers, 'cookie') ?? '').length)

  const tabs: [Tab, string][] = [['headers', 'Headers'], ['text', 'Text'], ['syntax', 'Syntax']]
  if (json) tabs.push(['json', 'JSON'])
  if (form.length || query.length) tabs.push(['form', 'Params'])
  if (isImage) tabs.push(['image', 'Image'])
  tabs.push(['hex', 'Hex'])
  if (cookies.length) tabs.push(['cookies', `Cookies (${cookies.length})`])
  if (hasAuth) tabs.push(['auth', 'Auth'])
  if (isResponse) tabs.push(['caching', 'Caching'], ['timing', 'Timing'])
  tabs.push(['raw', 'Raw'])
  const active = tabs.some(([t]) => t === tab) ? tab : 'headers'
  const params = [...query.map(([k, v]) => ['query', k, v]), ...form.map(([k, v]) => ['body', k, v])]
  const now = session.timings.startedAt ?? Date.now()

  return (
    <div className="inspector">
      <div className="tabs" role="tablist" aria-label={`${title} inspectors`}>
        <strong className="pane-title">
          {title}
          {isResponse ? <StatusPill status={session.response.status} /> : <MethodBadge method={session.request.method} />}
        </strong>
        {tabs.map(([t, label]) => (
          <button key={t} role="tab" aria-selected={active === t} className={active === t ? 'on' : ''} onClick={() => setTab(t)}>{label}</button>
        ))}
        <span className="muted size">{bytes.length.toLocaleString()} B</span>
      </div>
      <div className="tabbody">
        {active === 'headers' && <div className="scroll"><div className="startline">{startLine}</div><HeaderTable headers={message.headers} /></div>}
        {active === 'text' && <pre className="scroll mono">{text.slice(0, 2_000_000) || '(empty)'}</pre>}
        {active === 'syntax' && <Suspense fallback={<div className="muted pad">Loading editor…</div>}><MonacoView value={json ?? text} language={languageFor(ct)} /></Suspense>}
        {active === 'json' && json && <Suspense fallback={<div className="muted pad">Loading editor…</div>}><MonacoView value={json} language="json" /></Suspense>}
        {active === 'form' && <div className="scroll"><table className="kv"><tbody>{params.map(([w, k, v], i) => <tr key={i}><th>{k} <span className="muted">· {w}</span></th><td>{v}</td></tr>)}</tbody></table></div>}
        {active === 'image' && <div className="scroll pad"><img src={imgUrl} alt="Response body" style={{ maxWidth: '100%' }} /></div>}
        {active === 'hex' && <pre className="scroll mono">{hexDump(bytes)}</pre>}
        {active === 'cookies' && (
          <div className="scroll"><table className="kv"><tbody>{cookies.map((c, i) => (
            <tr key={i}><th>{c.name}</th><td>{c.value}{c.attrs.length > 0 && <div className="muted">{c.attrs.map((a) => <span key={a} className="tag dk-same" style={{ marginRight: 4 }}>{a}</span>)}</div>}</td></tr>
          ))}</tbody></table></div>
        )}
        {active === 'auth' && <AuthPanel headers={message.headers} now={now} />}
        {active === 'caching' && <CachingPanel headers={message.headers} />}
        {active === 'timing' && <TimingPanel session={session} />}
        {active === 'raw' && <pre className="scroll mono">{startLine}{'\n'}{message.headers.map((h) => `${h.name}: ${h.value}`).join('\n')}{'\n\n'}{text.slice(0, 2_000_000)}</pre>}
      </div>
    </div>
  )
}
