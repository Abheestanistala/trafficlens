import type { Session } from '../../model/session'
import { contentKind, contentType, hostOf } from '../filter/derive'
import { getHeader, getHeaders } from '../http/headers'
import { analyzeCaching } from '../http/caching'
import { decodeJwt, findJwts } from '../jwt'

export type Severity = 'critical' | 'serious' | 'warning' | 'info'
export type Finding = { id: string; severity: Severity; category: string; title: string; detail: string; sessionIds: string[] }
export type Analyzer = { id: string; name: string; run: (sessions: Session[]) => Omit<Finding, 'id'>[] }

const SEV_ORDER: Severity[] = ['critical', 'serious', 'warning', 'info']
export const severityRank = (s: Severity) => SEV_ORDER.indexOf(s)

const abs = (base: string, loc: string): string | null => {
  try {
    return new URL(loc, base).href
  } catch {
    return null
  }
}
const norm = (u: string) => u.split('#')[0]

const builtin: Analyzer[] = [
  {
    id: 'errors', name: 'HTTP errors',
    run: (all) => {
      const out: Omit<Finding, 'id'>[] = []
      const group = (pred: (s: Session) => boolean, severity: Severity, title: string, detail: string) => {
        const hit = all.filter(pred)
        if (hit.length) out.push({ severity, category: 'Errors', title: `${hit.length} ${title}`, detail, sessionIds: hit.map((s) => s.id) })
      }
      group((s) => s.response.status >= 500, 'critical', 'server errors (5xx)', 'The server failed to fulfil valid requests. Check the response bodies for stack traces or upstream timeouts.')
      group((s) => s.response.status === 401 || s.response.status === 403, 'serious', 'authentication/authorization failures (401/403)', 'Credentials were missing, expired or insufficient.')
      group((s) => s.response.status >= 400 && s.response.status < 500 && s.response.status !== 401 && s.response.status !== 403 && s.request.method !== 'OPTIONS', 'warning', 'client errors (4xx)', 'Often broken links (404), bad payloads (400/422) or throttling (429).')
      group((s) => s.response.status === 0 && s.request.method !== 'CONNECT', 'serious', 'requests with no response', 'Aborted, blocked, timed out or failed at the network layer.')
      return out
    },
  },
  {
    id: 'redirects', name: 'Redirect chains and loops',
    run: (all) => {
      const out: Omit<Finding, 'id'>[] = []
      const byUrl = new Map<string, Session[]>()
      for (const s of all) byUrl.set(norm(s.request.url), [...(byUrl.get(norm(s.request.url)) ?? []), s])
      const seenHeads = new Set<string>()
      const isRedirect = (s: Session) => s.response.status >= 300 && s.response.status < 400 && !!getHeader(s.response.headers, 'location')
      for (const head of all.filter(isRedirect)) {
        const chain: Session[] = []
        const visited = new Set<string>()
        let cur: Session | undefined = head
        let loop = false
        while (cur && isRedirect(cur)) {
          if (visited.has(cur.id)) { loop = true; break }
          visited.add(cur.id)
          chain.push(cur)
          const nx = abs(cur.request.url, getHeader(cur.response.headers, 'location')!)
          cur = nx ? byUrl.get(norm(nx))?.find((s) => s.seq > cur!.seq) ?? byUrl.get(norm(nx))?.[0] : undefined
        }
        if (cur && !loop) chain.push(cur)
        const first = chain[0]
        if (seenHeads.has(first.id) || chain.some((c) => seenHeads.has(c.id) && c !== first)) continue
        if (loop || chain.length >= 4) {
          chain.forEach((c) => seenHeads.add(c.id))
          out.push({
            severity: loop ? 'critical' : 'warning',
            category: 'Redirects',
            title: loop ? `Redirect loop starting at ${first.request.url}` : `Redirect chain of ${chain.length - 1} hops`,
            detail: chain.map((c) => `${c.response.status} ${c.request.url}`).join('\n→ '),
            sessionIds: chain.map((c) => c.id),
          })
        }
      }
      return out
    },
  },
  {
    id: 'slow', name: 'Slow responses',
    run: (all) => {
      const out: Omit<Finding, 'id'>[] = []
      const slow = all.filter((s) => (s.timings.total ?? 0) > 3000)
      if (slow.length) out.push({ severity: 'warning', category: 'Performance', title: `${slow.length} requests slower than 3 s`, detail: 'Slowest: ' + [...slow].sort((a, b) => b.timings.total! - a.timings.total!).slice(0, 3).map((s) => `${Math.round(s.timings.total!)} ms ${s.request.url}`).join('; '), sessionIds: slow.map((s) => s.id) })
      const ttfb = all.filter((s) => (s.timings.wait ?? 0) > 1000 && (s.timings.total ?? 0) <= 3000)
      if (ttfb.length) out.push({ severity: 'info', category: 'Performance', title: `${ttfb.length} requests with server wait over 1 s`, detail: 'Long time-to-first-byte points at slow backend processing rather than network transfer.', sessionIds: ttfb.map((s) => s.id) })
      return out
    },
  },
  {
    id: 'compression', name: 'Uncompressed text',
    run: (all) => {
      const hit = all.filter((s) => ['html', 'json', 'script', 'css', 'xml', 'text'].includes(contentKind(s)) && s.response.body.raw.length > 100 * 1024 && !getHeader(s.response.headers, 'content-encoding') && s.response.status === 200)
      return hit.length ? [{ severity: 'warning', category: 'Performance', title: `${hit.length} large text responses without compression`, detail: 'Responses over 100 KB with no Content-Encoding. Enable gzip or brotli.', sessionIds: hit.map((s) => s.id) }] : []
    },
  },
  {
    id: 'caching', name: 'Caching',
    run: (all) => {
      const hit = all.filter((s) => s.request.method === 'GET' && s.response.status === 200 && ['script', 'css', 'image', 'font'].includes(contentKind(s)) && analyzeCaching(s.response.headers).verdict === 'none')
      return hit.length ? [{ severity: 'info', category: 'Caching', title: `${hit.length} static assets with no caching headers`, detail: 'Add Cache-Control (e.g. immutable fingerprinted assets) to avoid repeat downloads.', sessionIds: hit.map((s) => s.id) }] : []
    },
  },
  {
    id: 'duplicates', name: 'Duplicate requests',
    run: (all) => {
      const m = new Map<string, Session[]>()
      for (const s of all) if (s.request.method === 'GET') m.set(s.request.url, [...(m.get(s.request.url) ?? []), s])
      return [...m].filter(([, l]) => l.length >= 3 && contentKind(l[0]) !== 'none').map(([u, l]) => ({ severity: 'info' as const, category: 'Performance', title: `Requested ${l.length}× : ${u}`, detail: 'The same GET was issued repeatedly. Consider caching, de-duplication or polling intervals.', sessionIds: l.map((s) => s.id) }))
    },
  },
  {
    id: 'cors', name: 'CORS',
    run: (all) => {
      const out: Omit<Finding, 'id'>[] = []
      const pre = all.filter((s) => s.request.method === 'OPTIONS' && s.response.status >= 400)
      if (pre.length) out.push({ severity: 'serious', category: 'CORS', title: `${pre.length} failed CORS preflight requests`, detail: 'The browser will block the real request when the preflight is rejected.', sessionIds: pre.map((s) => s.id) })
      const miss = all.filter((s) => s.response.status < 400 && s.response.status > 0 && getHeader(s.request.headers, 'origin') && !getHeader(s.response.headers, 'access-control-allow-origin') && (() => { try { return new URL(getHeader(s.request.headers, 'origin')!).host !== new URL(s.request.url).host } catch { return false } })())
      if (miss.length) out.push({ severity: 'warning', category: 'CORS', title: `${miss.length} cross-origin responses lack Access-Control-Allow-Origin`, detail: 'The response will be unreadable to the calling page.', sessionIds: miss.map((s) => s.id) })
      return out
    },
  },
  {
    id: 'mixed', name: 'Mixed content',
    run: (all) => {
      const hit = all.filter((s) => s.request.url.startsWith('http://') && (getHeader(s.request.headers, 'referer') ?? '').startsWith('https://'))
      return hit.length ? [{ severity: 'serious', category: 'Security', title: `${hit.length} insecure http:// requests from https pages`, detail: 'Mixed content is blocked or downgraded by browsers.', sessionIds: hit.map((s) => s.id) }] : []
    },
  },
  {
    id: 'cookies', name: 'Cookies',
    run: (all) => {
      const noSecure: Session[] = []
      const noSame: Session[] = []
      const big: Session[] = []
      for (const s of all) {
        const sc = getHeaders(s.response.headers, 'set-cookie')
        if (!sc.length) continue
        if (s.request.url.startsWith('https://') && sc.some((c) => !/;\s*secure/i.test(c))) noSecure.push(s)
        if (sc.some((c) => !/;\s*samesite=/i.test(c))) noSame.push(s)
        if (sc.some((c) => c.length > 4096)) big.push(s)
      }
      const out: Omit<Finding, 'id'>[] = []
      if (noSecure.length) out.push({ severity: 'warning', category: 'Security', title: `${noSecure.length} cookies set over https without Secure`, detail: 'Cookies without Secure may be sent over plain http.', sessionIds: noSecure.map((s) => s.id) })
      if (noSame.length) out.push({ severity: 'info', category: 'Security', title: `${noSame.length} responses set cookies without SameSite`, detail: 'Browsers default to Lax; be explicit.', sessionIds: noSame.map((s) => s.id) })
      if (big.length) out.push({ severity: 'warning', category: 'Security', title: `${big.length} oversized cookies (>4 KB)`, detail: 'Browsers drop cookies larger than ~4096 bytes.', sessionIds: big.map((s) => s.id) })
      return out
    },
  },
  {
    id: 'auth', name: 'Authentication',
    run: (all) => {
      const out: Omit<Finding, 'id'>[] = []
      const expired: Session[] = []
      for (const s of all) {
        const v = getHeader(s.request.headers, 'authorization') ?? ''
        for (const t of findJwts(v)) {
          const j = decodeJwt(t)
          const at = s.timings.startedAt ?? Date.now()
          if (j?.expiresAt && j.expiresAt < at) { expired.push(s); break }
        }
      }
      if (expired.length) out.push({ severity: 'serious', category: 'Auth', title: `${expired.length} requests sent an expired JWT`, detail: 'The token exp claim was before the request time. Check refresh logic.', sessionIds: expired.map((s) => s.id) })
      const retried = all.filter((s) => s.response.status === 401 && all.some((o) => o.seq > s.seq && o.request.url === s.request.url && o.response.status >= 200 && o.response.status < 300))
      if (retried.length) out.push({ severity: 'info', category: 'Auth', title: `${retried.length} requests failed with 401 then succeeded on retry`, detail: 'Likely a token refresh round-trip; confirm it is expected.', sessionIds: retried.map((s) => s.id) })
      return out
    },
  },
  {
    id: 'hsts', name: 'Security headers',
    run: (all) => {
      const docs = all.filter((s) => s.request.url.startsWith('https://') && contentType(s) === 'text/html' && s.response.status === 200)
      const hosts = new Set(docs.filter((s) => !getHeader(s.response.headers, 'strict-transport-security')).map(hostOf))
      return hosts.size ? [{ severity: 'info', category: 'Security', title: `${hosts.size} HTML hosts without Strict-Transport-Security`, detail: [...hosts].join(', '), sessionIds: docs.filter((s) => hosts.has(hostOf(s))).map((s) => s.id) }] : []
    },
  },
]

/** Plugin hook: third parties (or the user via window.HTK) can register extra analyzers. */
const plugins: Analyzer[] = []
export const registerAnalyzer = (a: Analyzer) => {
  const i = plugins.findIndex((p) => p.id === a.id)
  if (i >= 0) plugins[i] = a
  else plugins.push(a)
}
export const listAnalyzers = () => [...builtin, ...plugins]

export const runAnalyzers = (sessions: Session[], extra: Analyzer[] = []): Finding[] => {
  const all: Finding[] = []
  for (const a of [...listAnalyzers(), ...extra]) {
    try {
      a.run(sessions).forEach((f, i) => all.push({ ...f, id: `${a.id}:${i}` }))
    } catch (e) {
      all.push({ id: `${a.id}:error`, severity: 'info', category: 'Analyzer', title: `Analyzer "${a.name}" failed`, detail: String(e), sessionIds: [] })
    }
  }
  return all.sort((a, b) => severityRank(a.severity) - severityRank(b.severity) || b.sessionIds.length - a.sessionIds.length)
}
