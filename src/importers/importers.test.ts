import { describe, expect, it } from 'vitest'
import { gzipSync, strToU8, zipSync } from 'fflate'
import { importFile } from './index'
import { bodyText } from '../lib/http/body'

const har = {
  log: {
    entries: [
      {
        startedDateTime: '2026-01-01T00:00:00.000Z',
        time: 120,
        request: { method: 'POST', url: 'https://a.test/x?y=1', httpVersion: 'h2', headers: [{ name: 'Host', value: 'a.test' }], postData: { text: '{"a":1}' } },
        response: { status: 404, statusText: 'Not Found', httpVersion: 'h2', headers: [], content: { text: 'aGVsbG8=', encoding: 'base64' } },
        timings: { dns: -1, wait: 50, receive: 10 },
      },
    ],
  },
}

describe('importFile', () => {
  it('imports HAR with base64 bodies and ignores -1 timings', () => {
    const [s] = importFile('t.har', strToU8(JSON.stringify(har)))
    expect(s.request.method).toBe('POST')
    expect(s.response.status).toBe(404)
    expect(bodyText(s.response.body, s.response.headers)).toBe('hello')
    expect(bodyText(s.request.body, s.request.headers)).toBe('{"a":1}')
    expect(s.timings.dns).toBeUndefined()
    expect(s.timings.total).toBe(120)
  })

  it('imports SAZ with chunked + gzip response', () => {
    const gz = gzipSync(strToU8('{"ok":true}'))
    const chunk = (b: Uint8Array) => {
      const parts = [strToU8(b.length.toString(16) + '\r\n'), b, strToU8('\r\n'), strToU8('0\r\n\r\n')]
      return Uint8Array.from(parts.flatMap((p) => [...p]))
    }
    const head = strToU8('HTTP/1.1 200 OK\r\nContent-Encoding: gzip\r\nTransfer-Encoding: chunked\r\n\r\n')
    const res = Uint8Array.from([...head, ...chunk(gz)])
    const saz = zipSync({
      'raw/1_c.txt': strToU8('CONNECT a.test:443 HTTP/1.1\r\nHost: a.test:443\r\n\r\n'),
      'raw/1_s.txt': strToU8('HTTP/1.1 200 Connection Established\r\n\r\n'),
      'raw/2_c.txt': strToU8('GET /api HTTP/1.1\r\nHost: a.test\r\n\r\n'),
      'raw/2_s.txt': res,
      'raw/2_m.xml': strToU8('<Session><SessionFlags><SessionFlag N="x-clientip" V="1.2.3.4"/><SessionFlag N="x-processinfo" V="chrome:1"/></SessionFlags></Session>'),
    })
    const list = importFile('t.saz', saz)
    expect(list).toHaveLength(2)
    const s = list[1]
    expect(s.request.url).toBe('https://a.test/api')
    expect(s.net.process).toBe('chrome:1')
    expect(bodyText(s.response.body, s.response.headers)).toBe('{"ok":true}')
  })

  it('imports Charles JSON', () => {
    const chls = [{ scheme: 'https', host: 'c.test', path: '/p', query: 'q=1', method: 'GET', request: { header: { headers: [] } }, response: { status: 200, header: { headers: [{ name: 'Content-Type', value: 'text/plain' }] }, body: { text: 'hi' } }, durations: { total: 9 } }]
    const [s] = importFile('t.chlsj', strToU8(JSON.stringify(chls)))
    expect(s.request.url).toBe('https://c.test/p?q=1')
    expect(bodyText(s.response.body, s.response.headers)).toBe('hi')
  })

  it('rejects native .chls with guidance', () => {
    expect(() => importFile('x.chls', new Uint8Array([1, 2, 3]))).toThrow(/Export Session/)
  })
})

describe('charles xml (best effort)', () => {
  it('parses transactions', () => {
    const xml = `<?xml version="1.0"?><charles-session><transaction method="GET" protocol="https" host="c.test" path="/p" query="a=1" responseCode="200" startTime="2026-01-01T00:00:00.000Z" endTime="2026-01-01T00:00:00.250Z"><request><headers><header><name>Accept</name><value>*/*</value></header></headers></request><response><headers><header><name>Content-Type</name><value>text/plain</value></header></headers><body encoding="plain">hi &amp; bye</body></response></transaction></charles-session>`
    const [s] = importFile('t.chlx', strToU8(xml))
    expect(s.request.url).toBe('https://c.test/p?a=1')
    expect(s.timings.total).toBe(250)
    expect(bodyText(s.response.body, s.response.headers)).toBe('hi & bye')
  })
})
