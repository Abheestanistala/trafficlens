import type { Body, Header, Session } from '../model/session'
import { emptyBody } from '../model/session'
import { fromBase64 } from '../lib/http/body'

/**
 * Best-effort Charles XML session (.chlx) reader. DOMParser is unavailable in workers, so this
 * uses a small tag scanner. Layout handled: <transaction ...attrs><request><headers><header><name/><value/></header>…
 * </headers><body encoding="base64|plain">…</body></request><response …>…</response></transaction>
 */
const unesc = (s: string) => s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, '&')
const attrs = (tag: string): Record<string, string> => {
  const o: Record<string, string> = {}
  for (const m of tag.matchAll(/([\w:-]+)="([^"]*)"/g)) o[m[1]] = unesc(m[2])
  return o
}
const block = (xml: string, tag: string): { open: string; inner: string } | null => {
  const m = new RegExp(`<${tag}(\\s[^>]*)?>([\\s\\S]*?)</${tag}>`, 'i').exec(xml)
  return m ? { open: m[1] ?? '', inner: m[2] } : null
}
const headersOf = (xml: string): Header[] =>
  [...(block(xml, 'headers')?.inner ?? '').matchAll(/<header>\s*<name>([\s\S]*?)<\/name>\s*<value>([\s\S]*?)<\/value>\s*<\/header>/gi)].map((m) => ({ name: unesc(m[1]), value: unesc(m[2]) }))
const bodyOf = (xml: string): Body => {
  const b = block(xml, 'body')
  if (!b || !b.inner.trim()) return emptyBody()
  const at = attrs(b.open)
  const inner = b.inner.replace(/^<!\[CDATA\[|\]\]>$/g, '').trim()
  return at.encoding === 'base64' || at.encoded === 'true' ? { raw: fromBase64(inner.replace(/\s+/g, '')), decoded: false } : { raw: new TextEncoder().encode(unesc(inner)), decoded: true }
}

export const importCharlesXml = (xml: string, source: string): Session[] => {
  const txs = [...xml.matchAll(/<transaction(\s[^>]*)?>([\s\S]*?)<\/transaction>/gi)]
  if (!txs.length) throw new Error('No <transaction> elements found - is this a Charles XML session?')
  return txs.map((m, i) => {
    const a = attrs(m[1] ?? '')
    const req = block(m[2], 'request')
    const res = block(m[2], 'response')
    const resAttrs = attrs(res?.open ?? '')
    const port = a.port && !['80', '443', ''].includes(a.port) ? `:${a.port}` : ''
    const scheme = a.protocol ?? a.scheme ?? 'https'
    const started = Date.parse(a.startTime ?? '')
    const ended = Date.parse(a.endTime ?? '')
    return {
      id: `${source}#${i}`, seq: i + 1, source,
      request: { method: a.method ?? 'GET', url: `${scheme}://${a.host ?? ''}${port}${a.path ?? ''}${a.query ? `?${a.query}` : ''}`, httpVersion: a.protocolVersion ?? '', headers: headersOf(req?.inner ?? ''), body: bodyOf(req?.inner ?? '') },
      response: { status: Number(a.responseCode ?? resAttrs.status ?? 0) || 0, statusText: resAttrs.reason ?? '', httpVersion: a.protocolVersion ?? '', headers: headersOf(res?.inner ?? ''), body: bodyOf(res?.inner ?? '') },
      timings: { startedAt: Number.isNaN(started) ? undefined : started, total: !Number.isNaN(started) && !Number.isNaN(ended) ? ended - started : undefined },
      net: {}, meta: {},
    } satisfies Session
  })
}
