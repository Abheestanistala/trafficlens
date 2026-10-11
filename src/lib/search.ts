import type { Session } from '../model/session'
import { bodyText } from './http/body'

export type SearchOpts = { regex: boolean; caseSensitive: boolean; scopes: Scope[] }
export type Scope = 'url' | 'reqHeaders' | 'resHeaders' | 'reqBody' | 'resBody'
export type Hit = { id: string; scope: Scope; snippet: string }

const snip = (text: string, i: number, len: number) =>
  (i > 40 ? '…' : '') + text.slice(Math.max(0, i - 40), i + len + 60).replace(/\s+/g, ' ')

export const makeMatcher = (q: string, o: Pick<SearchOpts, 'regex' | 'caseSensitive'>): RegExp => {
  const src = o.regex ? q : q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return new RegExp(src, o.caseSensitive ? '' : 'i')
}

export const searchSessions = (sessions: Session[], q: string, o: SearchOpts, limit = 2000): Hit[] => {
  if (!q) return []
  const re = makeMatcher(q, o)
  const hits: Hit[] = []
  const test = (s: Session, scope: Scope, text: string) => {
    const m = re.exec(text)
    if (m) hits.push({ id: s.id, scope, snippet: snip(text, m.index, m[0].length) })
  }
  for (const s of sessions) {
    if (hits.length >= limit) break
    if (o.scopes.includes('url')) test(s, 'url', s.request.url)
    if (o.scopes.includes('reqHeaders')) test(s, 'reqHeaders', s.request.headers.map((h) => `${h.name}: ${h.value}`).join('\n'))
    if (o.scopes.includes('resHeaders')) test(s, 'resHeaders', s.response.headers.map((h) => `${h.name}: ${h.value}`).join('\n'))
    if (o.scopes.includes('reqBody') && s.request.body.raw.length) test(s, 'reqBody', bodyText(s.request.body, s.request.headers))
    if (o.scopes.includes('resBody') && s.response.body.raw.length) test(s, 'resBody', bodyText(s.response.body, s.response.headers))
  }
  return hits
}
