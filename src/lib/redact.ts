import type { Header, Session } from '../model/session'
import { bodyText } from './http/body'

export type RedactOptions = {
  cookies: boolean
  authHeaders: boolean
  extraHeaders: string[] // header names, case-insensitive
  queryParams: string[] // names; '*' not supported on purpose
  bodyPatterns: string[] // regex sources, applied to decoded text bodies
  dropBodies: boolean
}

export const defaultRedact = (): RedactOptions => ({
  cookies: true,
  authHeaders: true,
  extraHeaders: ['x-api-key', 'x-auth-token', 'x-csrf-token'],
  queryParams: ['token', 'access_token', 'api_key', 'apikey', 'password', 'secret', 'code'],
  bodyPatterns: ['"(?:password|passwd|secret|token|access_token|refresh_token|client_secret)"\\s*:\\s*"[^"]*"'],
  dropBodies: false,
})

const MASK = '[REDACTED]'
const enc = new TextEncoder()

const redactHeaders = (hs: Header[], o: RedactOptions): Header[] => {
  const names = new Set(o.extraHeaders.map((h) => h.toLowerCase()))
  if (o.cookies) ['cookie', 'set-cookie'].forEach((n) => names.add(n))
  if (o.authHeaders) ['authorization', 'proxy-authorization'].forEach((n) => names.add(n))
  return hs.map((h) => (names.has(h.name.toLowerCase()) ? { name: h.name, value: MASK } : h))
}

const redactUrl = (u: string, o: RedactOptions): string => {
  try {
    const url = new URL(u)
    const names = new Set(o.queryParams.map((p) => p.toLowerCase()))
    for (const k of [...url.searchParams.keys()]) if (names.has(k.toLowerCase())) url.searchParams.set(k, MASK)
    return url.href
  } catch {
    return u
  }
}

export type RedactReport = { sessions: Session[]; headersMasked: number; bodyHits: number; urlsMasked: number }

export const redactSessions = (list: Session[], o: RedactOptions): RedactReport => {
  let headersMasked = 0
  let bodyHits = 0
  let urlsMasked = 0
  const pats = o.bodyPatterns.filter(Boolean).map((p) => new RegExp(p, 'gi'))
  const countMasked = (a: Header[], b: Header[]) => a.reduce((n, h, i) => n + (h.value !== b[i].value ? 1 : 0), 0)
  const body = (m: { headers: Header[]; body: Session['request']['body'] }) => {
    if (o.dropBodies) return { raw: new Uint8Array(0), decoded: true }
    if (!pats.length || !m.body.raw.length) return m.body
    let text = bodyText(m.body, m.headers)
    let changed = false
    for (const p of pats) text = text.replace(p, () => ((changed = true), bodyHits++, MASK))
    return changed ? { raw: enc.encode(text), decoded: true } : m.body
  }
  const sessions = list.map((s) => {
    const rq = redactHeaders(s.request.headers, o)
    const rs = redactHeaders(s.response.headers, o)
    headersMasked += countMasked(s.request.headers, rq) + countMasked(s.response.headers, rs)
    const url = redactUrl(s.request.url, o)
    if (url !== s.request.url) urlsMasked++
    return { ...s, request: { ...s.request, url, headers: rq, body: body(s.request) }, response: { ...s.response, headers: rs, body: body(s.response) } }
  })
  return { sessions, headersMasked, bodyHits, urlsMasked }
}
