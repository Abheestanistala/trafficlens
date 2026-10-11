import type { Body, Header, Session } from '../model/session'
import { emptyBody } from '../model/session'
import { fromBase64 } from '../lib/http/body'

/* eslint-disable @typescript-eslint/no-explicit-any */
const enc = new TextEncoder()

const hdrs = (m: any): Header[] =>
  (m?.header?.headers ?? []).map((h: any) => ({ name: String(h.name), value: String(h.value) }))

const body = (m: any): Body => {
  const b = m?.body
  if (!b) return emptyBody()
  if (b.encoded != null) return { raw: fromBase64(b.encoded), decoded: false }
  if (b.text != null) return { raw: enc.encode(String(b.text)), decoded: true }
  return emptyBody()
}

/** Charles "JSON Session File" (.chlsj). */
export const importCharlesJson = (text: string, source: string): Session[] => {
  const arr = JSON.parse(text)
  if (!Array.isArray(arr)) throw new Error('Not a Charles JSON session (expected an array)')
  return arr.map((t: any, i: number) => {
    const port = t.actualPort && ![80, 443].includes(t.actualPort) ? `:${t.actualPort}` : ''
    const url = `${t.scheme}://${t.host}${port}${t.path ?? ''}${t.query ? `?${t.query}` : ''}`
    const started = Date.parse(t.times?.start)
    return {
      id: `${source}#${i}`,
      seq: i + 1,
      source,
      request: {
        method: t.method ?? 'GET',
        url,
        httpVersion: t.protocolVersion ?? '',
        headers: hdrs(t.request),
        body: body(t.request),
      },
      response: {
        status: t.response?.status ?? 0,
        statusText: t.response?.statusText ?? '',
        httpVersion: t.protocolVersion ?? '',
        headers: hdrs(t.response),
        body: body(t.response),
      },
      timings: {
        startedAt: Number.isNaN(started) ? undefined : started,
        total: t.durations?.total,
        dns: t.durations?.dns,
        connect: t.durations?.connect,
        ssl: t.durations?.ssl,
        send: t.durations?.request,
        wait: t.durations?.latency,
        receive: t.durations?.response,
      },
      net: { serverIp: t.remoteAddress?.split('/')?.[1], clientIp: t.clientAddress?.split('/')?.[1] },
      meta: { comment: t.notes },
    } satisfies Session
  })
}
