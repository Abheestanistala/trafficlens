import { describe, expect, it } from 'vitest'
import { importSaz } from '../importers/saz'
import { importHar } from '../importers/har'
import type { Session } from '../model/session'
import { emptyBody } from '../model/session'
import { runAnalyzers, registerAnalyzer } from './analyze/findings'
import { diffCaptures } from './capture-diff'
import { decodeJwt } from './jwt'
import { defaultRedact, redactSessions } from './redact'
import { exportSaz } from './saz-export'
import { searchSessions } from './search'
import { analyzeCaching } from './http/caching'
import { bodyText } from './http/body'

const mk = (n: number, url: string, status: number, o: Partial<Session> & { loc?: string; src?: string; reqH?: [string, string][]; resH?: [string, string][]; body?: string } = {}): Session => ({
  id: `s${n}`, seq: n, source: o.src ?? 'a',
  request: { method: 'GET', url, httpVersion: 'HTTP/1.1', headers: (o.reqH ?? []).map(([name, value]) => ({ name, value })), body: emptyBody() },
  response: { status, statusText: 'x', httpVersion: 'HTTP/1.1', headers: [...(o.resH ?? []), ...(o.loc ? [['Location', o.loc]] : [])].map(([name, value]) => ({ name, value })), body: { raw: new TextEncoder().encode(o.body ?? ''), decoded: true } },
  timings: o.timings ?? { total: 100 }, net: {}, meta: {},
})

describe('analyzers', () => {
  it('flags errors, loops and chains', () => {
    const list = [mk(1, 'https://x.test/a', 302, { loc: '/b' }), mk(2, 'https://x.test/b', 302, { loc: '/a' }), mk(3, 'https://x.test/e', 500)]
    const f = runAnalyzers(list)
    expect(f[0].severity).toBe('critical')
    expect(f.some((x) => x.title.startsWith('Redirect loop'))).toBe(true)
    expect(f.some((x) => x.title.includes('server errors'))).toBe(true)
  })
  it('expired JWT and plugin hook', () => {
    const p = btoa(JSON.stringify({ exp: 1000 })).replace(/=/g, '')
    const jwt = `eyJhbGciOiJub25lIn0.${p}.sig`
    const s = mk(1, 'https://x.test/', 200, { reqH: [['Authorization', `Bearer ${jwt}`]], timings: { startedAt: 5_000_000 } })
    expect(decodeJwt(jwt)?.expiresAt).toBe(1_000_000)
    expect(runAnalyzers([s]).some((f) => f.title.includes('expired JWT'))).toBe(true)
    registerAnalyzer({ id: 'plug', name: 'plug', run: () => [{ severity: 'info', category: 'X', title: 'hello', detail: '', sessionIds: [] }] })
    expect(runAnalyzers([]).some((f) => f.title === 'hello')).toBe(true)
  })
})

describe('redact / saz export / search / diff / caching', () => {
  it('redacts headers, query and body', () => {
    const s = mk(1, 'https://x.test/?token=abc&q=1', 200, { reqH: [['Authorization', 'Bearer z'], ['Cookie', 'a=b']], body: '{"password":"hunter2","ok":1}' })
    const r = redactSessions([s], defaultRedact())
    expect(r.sessions[0].request.url).not.toContain('abc')
    expect(r.sessions[0].request.url).toContain('q=1')
    expect(r.sessions[0].request.headers.every((h) => h.value === '[REDACTED]')).toBe(true)
    expect(bodyText(r.sessions[0].response.body, [])).not.toContain('hunter2')
    expect(r.headersMasked).toBe(2)
  })
  it('SAZ export round-trips', () => {
    const src = [mk(1, 'https://x.test/a?z=1', 200, { resH: [['Content-Type', 'application/json']], body: '{"a":1}' }), mk(2, 'https://x.test/b', 404)]
    const back = importSaz(exportSaz(src), 'r.saz')
    expect(back).toHaveLength(2)
    expect(back[0].response.status).toBe(200)
    expect(bodyText(back[0].response.body, back[0].response.headers)).toBe('{"a":1}')
    expect(back[1].response.status).toBe(404)
  })
  it('HAR export shape re-imports', async () => {
    const { toHar } = await import('./export')
    const back = importHar(JSON.stringify(toHar([mk(1, 'https://x.test/a', 200, { body: 'hi', resH: [['Content-Type', 'text/plain']] })])), 'h')
    expect(bodyText(back[0].response.body, back[0].response.headers)).toBe('hi')
  })
  it('search and capture diff', () => {
    const l = [mk(1, 'https://x.test/a', 200, { body: 'needle here' }), mk(2, 'https://x.test/a', 500, { src: 'b' }), mk(3, 'https://x.test/n', 200, { src: 'b' })]
    expect(searchSessions(l, 'NEEDLE', { regex: false, caseSensitive: false, scopes: ['resBody'] })).toHaveLength(1)
    const d = diffCaptures(l, 'a', 'b')
    expect(d.find((r) => r.kind === 'changed')?.changes[0]).toContain('200 → 500')
    expect(d.some((r) => r.kind === 'added')).toBe(true)
  })
  it('caching verdicts', () => {
    expect(analyzeCaching([{ name: 'Cache-Control', value: 'public, max-age=60' }]).verdict).toBe('cacheable')
    expect(analyzeCaching([{ name: 'Cache-Control', value: 'no-store' }]).verdict).toBe('no-store')
    expect(analyzeCaching([]).verdict).toBe('none')
  })
})
