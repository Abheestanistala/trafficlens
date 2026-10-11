import { unzipSync } from 'fflate'
import type { Session } from '../model/session'
import { parseRawMessage } from '../lib/http/raw'
import { getHeader } from '../lib/http/headers'

const dec = new TextDecoder()

const attr = (xml: string, tag: string, name: string): string | undefined =>
  new RegExp(`<${tag}[^>]*\\s${name}="([^"]*)"`, 'i').exec(xml)?.[1]

const flags = (xml: string): Record<string, string> => {
  const out: Record<string, string> = {}
  for (const m of xml.matchAll(/<SessionFlag\s+N="([^"]*)"\s+V="([^"]*)"/gi)) out[m[1].toLowerCase()] = m[2]
  return out
}

const ms = (a?: string, b?: string): number | undefined => {
  if (!a || !b) return undefined
  const d = Date.parse(b) - Date.parse(a)
  return d >= 0 ? d : undefined
}

export const importSaz = (data: Uint8Array, source: string): Session[] => {
  const files = unzipSync(data)
  const ids = new Set<number>()
  for (const name of Object.keys(files)) {
    const m = /^raw\/(\d+)_c\.txt$/i.exec(name)
    if (m) ids.add(Number(m[1]))
  }
  // SAZ stores origin-form targets only; infer HTTPS from CONNECT tunnels seen in the capture.
  const secureHosts = new Set<string>()
  for (const n of ids) {
    const first = dec.decode(files[`raw/${n}_c.txt`].subarray(0, 300)).split(/\r?\n/, 1)[0]
    const m = /^CONNECT\s+([^\s:]+)(?::(\d+))?/i.exec(first)
    if (m) secureHosts.add(m[1])
  }
  return [...ids]
    .sort((a, b) => a - b)
    .map((n) => {
      const c = files[`raw/${n}_c.txt`]
      const s = files[`raw/${n}_s.txt`]
      const mx = files[`raw/${n}_m.xml`]
      const req = parseRawMessage(c)
      const res = s ? parseRawMessage(s) : { startLine: '', headers: [], body: new Uint8Array(0) }
      const [method = 'GET', target = '/', httpVersion = 'HTTP/1.1'] = req.startLine.split(' ')
      const [resVersion = '', status = '0', ...st] = res.startLine.split(' ')
      const xml = mx ? dec.decode(mx) : ''
      const f = flags(xml)
      const host = getHeader(req.headers, 'host') ?? ''
      const url = /^[a-z]+:\/\//i.test(target)
        ? target
        : method === 'CONNECT'
          ? `https://${target}`
          : `${secureHosts.has(host.replace(/:443$/, '')) || /:443$/.test(host) ? 'https' : 'http'}://${host}${target}`
      const begin = attr(xml, 'SessionTimers', 'ClientBeginRequest')
      return {
        id: `${source}#${n}`,
        seq: n,
        source,
        request: { method, url, httpVersion, headers: req.headers, body: { raw: req.body, decoded: false } },
        response: {
          status: Number(status) || 0,
          statusText: st.join(' '),
          httpVersion: resVersion,
          headers: res.headers,
          body: { raw: res.body, decoded: false },
        },
        timings: {
          startedAt: begin ? Date.parse(begin) : undefined,
          total: ms(begin, attr(xml, 'SessionTimers', 'ClientDoneResponse')),
          wait: ms(attr(xml, 'SessionTimers', 'ServerGotRequest'), attr(xml, 'SessionTimers', 'ServerBeginResponse')),
          receive: ms(attr(xml, 'SessionTimers', 'ServerBeginResponse'), attr(xml, 'SessionTimers', 'ServerDoneResponse')),
          connect: ms(attr(xml, 'SessionTimers', 'ClientConnected'), attr(xml, 'SessionTimers', 'ServerConnected')),
        },
        net: { clientIp: f['x-clientip'], serverIp: f['x-hostip'], process: f['x-processinfo'] },
        meta: { comment: f['ui-comments'], color: f['ui-color'] },
      } satisfies Session
    })
}
