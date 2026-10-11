import type { Session } from '../model/session'
import { bodyBytes, bodyText, toBase64 } from './http/body'
import { getHeader } from './http/headers'

const isText = (ct: string) => /text|json|xml|javascript|html|x-www-form/i.test(ct)

export const toHar = (sessions: Session[]) => ({
  log: {
    version: '1.2',
    creator: { name: 'HTK Traffic Lens', version: '0.1' },
    entries: sessions.map((s) => {
      const ct = getHeader(s.response.headers, 'content-type') ?? ''
      const bytes = bodyBytes(s.response.body, s.response.headers)
      const url = new URL(s.request.url, 'http://invalid')
      return {
        startedDateTime: new Date(s.timings.startedAt ?? 0).toISOString(),
        time: s.timings.total ?? 0,
        request: {
          method: s.request.method,
          url: s.request.url,
          httpVersion: s.request.httpVersion || 'HTTP/1.1',
          cookies: [],
          headers: s.request.headers,
          queryString: [...url.searchParams].map(([name, value]) => ({ name, value })),
          headersSize: -1,
          bodySize: s.request.body.raw.length,
          ...(s.request.body.raw.length
            ? { postData: { mimeType: getHeader(s.request.headers, 'content-type') ?? '', text: bodyText(s.request.body, s.request.headers) } }
            : {}),
        },
        response: {
          status: s.response.status,
          statusText: s.response.statusText,
          httpVersion: s.response.httpVersion || 'HTTP/1.1',
          cookies: [],
          headers: s.response.headers,
          content: isText(ct)
            ? { size: bytes.length, mimeType: ct, text: new TextDecoder().decode(bytes) }
            : { size: bytes.length, mimeType: ct, text: toBase64(bytes), encoding: 'base64' },
          redirectURL: getHeader(s.response.headers, 'location') ?? '',
          headersSize: -1,
          bodySize: s.response.body.raw.length,
        },
        cache: {},
        timings: {
          send: s.timings.send ?? 0,
          wait: s.timings.wait ?? 0,
          receive: s.timings.receive ?? 0,
        },
      }
    }),
  },
})

const sh = (v: string) => `'${v.replace(/'/g, `'\\''`)}'`

export const toCurl = (s: Session): string => {
  const parts = ['curl', '-X', s.request.method, sh(s.request.url)]
  for (const h of s.request.headers) {
    if (/^(host|content-length|:)/i.test(h.name)) continue
    parts.push('-H', sh(`${h.name}: ${h.value}`))
  }
  if (s.request.body.raw.length) parts.push('--data-raw', sh(bodyText(s.request.body, s.request.headers)))
  return parts.join(' ')
}

export const download = (name: string, data: string, type = 'application/json') => {
  const a = document.createElement('a')
  a.href = URL.createObjectURL(new Blob([data], { type }))
  a.download = name
  a.click()
  setTimeout(() => URL.revokeObjectURL(a.href), 1000)
}
