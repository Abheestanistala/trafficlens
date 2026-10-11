import type { Body, Header, Session } from '../model/session'
import { emptyBody } from '../model/session'
import { fromBase64 } from '../lib/http/body'

/* eslint-disable @typescript-eslint/no-explicit-any */
const enc = new TextEncoder()

const hdrs = (list: any): Header[] =>
  Array.isArray(list) ? list.map((h) => ({ name: String(h.name ?? ''), value: String(h.value ?? '') })) : []

const contentBody = (c: any): Body => {
  if (!c || c.text == null) return emptyBody()
  return {
    raw: c.encoding === 'base64' ? fromBase64(c.text) : enc.encode(String(c.text)),
    decoded: true,
  }
}

const requestBody = (p: any): Body => {
  if (!p || p.text == null) {
    if (p?.params?.length) {
      const s = p.params.map((x: any) => `${encodeURIComponent(x.name)}=${encodeURIComponent(x.value ?? '')}`).join('&')
      return { raw: enc.encode(s), decoded: true }
    }
    return emptyBody()
  }
  return { raw: enc.encode(String(p.text)), decoded: true }
}

const num = (v: any): number | undefined => (typeof v === 'number' && v >= 0 ? v : undefined)

export const importHar = (text: string, source: string): Session[] => {
  const json = JSON.parse(text)
  const entries: any[] = json?.log?.entries
  if (!Array.isArray(entries)) throw new Error('Not a HAR file: log.entries missing')
  return entries.map((e, i) => {
    const t = e.timings ?? {}
    const started = Date.parse(e.startedDateTime)
    return {
      id: `${source}#${i}`,
      seq: i + 1,
      source,
      request: {
        method: e.request?.method ?? 'GET',
        url: e.request?.url ?? '',
        httpVersion: e.request?.httpVersion ?? '',
        headers: hdrs(e.request?.headers),
        body: requestBody(e.request?.postData),
      },
      response: {
        status: e.response?.status ?? 0,
        statusText: e.response?.statusText ?? '',
        httpVersion: e.response?.httpVersion ?? '',
        headers: hdrs(e.response?.headers),
        body: contentBody(e.response?.content),
      },
      timings: {
        startedAt: Number.isNaN(started) ? undefined : started,
        blocked: num(t.blocked),
        dns: num(t.dns),
        connect: num(t.connect),
        ssl: num(t.ssl),
        send: num(t.send),
        wait: num(t.wait),
        receive: num(t.receive),
        total: num(e.time),
      },
      net: { serverIp: e.serverIPAddress, clientIp: undefined, process: undefined },
      meta: { comment: e.comment },
    } satisfies Session
  })
}
