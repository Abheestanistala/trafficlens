import { zipSync, strToU8 } from 'fflate'
import type { Header, Session } from '../model/session'
import { bodyBytes } from './http/body'

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;')
const iso = (ms?: number) => (ms == null ? undefined : new Date(ms).toISOString())

const cleanHeaders = (hs: Header[], len: number): Header[] => [
  ...hs.filter((h) => !/^(content-encoding|transfer-encoding|content-length)$/i.test(h.name)),
  ...(len > 0 || hs.some((h) => h.name.toLowerCase() === 'content-length') ? [{ name: 'Content-Length', value: String(len) }] : []),
]

const join = (start: string, hs: Header[], body: Uint8Array): Uint8Array => {
  const head = strToU8(`${start}\r\n${hs.map((h) => `${h.name}: ${h.value}`).join('\r\n')}\r\n\r\n`)
  const out = new Uint8Array(head.length + body.length)
  out.set(head)
  out.set(body, head.length)
  return out
}

/** Write a Fiddler-compatible .saz. Bodies are stored decoded (Content-Encoding/chunking removed). */
export const exportSaz = (sessions: Session[]): Uint8Array => {
  const files: Record<string, Uint8Array> = {}
  sessions.forEach((s, i) => {
    const n = i + 1
    const u = (() => { try { return new URL(s.request.url) } catch { return null } })()
    const target = u ? u.pathname + u.search : s.request.url
    const rq = bodyBytes(s.request.body, s.request.headers)
    const rs = bodyBytes(s.response.body, s.response.headers)
    const reqHeaders = cleanHeaders(s.request.headers, rq.length)
    if (u && !reqHeaders.some((h) => h.name.toLowerCase() === 'host')) reqHeaders.unshift({ name: 'Host', value: u.host })
    files[`raw/${n}_c.txt`] = join(`${s.request.method} ${s.request.method === 'CONNECT' ? u?.host ?? target : target} ${s.request.httpVersion || 'HTTP/1.1'}`, reqHeaders, rq)
    files[`raw/${n}_s.txt`] = join(`${s.response.httpVersion || 'HTTP/1.1'} ${s.response.status} ${s.response.statusText}`.trimEnd(), cleanHeaders(s.response.headers, rs.length), rs)
    const t = s.timings
    const begin = t.startedAt
    const attrs = [
      ['ClientBeginRequest', iso(begin)],
      ['ClientDoneResponse', begin != null && t.total != null ? iso(begin + t.total) : undefined],
    ].filter(([, v]) => v).map(([k, v]) => `${k}="${v}"`).join(' ')
    const flags = [
      ['x-clientip', s.net.clientIp], ['x-hostip', s.net.serverIp], ['x-processinfo', s.net.process],
      ['ui-comments', s.meta.comment], ['ui-color', s.meta.color],
    ].filter(([, v]) => v).map(([k, v]) => `<SessionFlag N="${k}" V="${esc(String(v))}" />`).join('')
    files[`raw/${n}_m.xml`] = strToU8(`<?xml version="1.0" encoding="utf-8"?><Session SID="${n}" BitFlags="0"><SessionTimers ${attrs} /><PipeInfo /><SessionFlags>${flags}</SessionFlags></Session>`)
  })
  files['[Content_Types].xml'] = strToU8('<?xml version="1.0" encoding="utf-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="txt" ContentType="text/plain" /><Default Extension="xml" ContentType="application/xml" /></Types>')
  return zipSync(files)
}
