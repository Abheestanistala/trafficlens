// Generates sample captures: node fixtures/make.mjs
import { writeFileSync } from 'node:fs'
import { zipSync, strToU8, gzipSync } from 'fflate'

const entry = (i, url, status, ct, body, ms) => ({
  startedDateTime: new Date(Date.UTC(2026, 0, 1, 0, 0, i)).toISOString(),
  time: ms,
  request: { method: i % 4 === 0 ? 'POST' : 'GET', url, httpVersion: 'h2', headers: [{ name: 'Accept', value: '*/*' }, { name: 'Cookie', value: 'sid=abc; theme=dark' }], postData: i % 4 === 0 ? { mimeType: 'application/x-www-form-urlencoded', text: 'user=bob&pw=secret' } : undefined },
  response: { status, statusText: '', httpVersion: 'h2', headers: [{ name: 'Content-Type', value: ct }, { name: 'Set-Cookie', value: 'sid=xyz; Secure; HttpOnly' }], content: { text: body } },
  timings: { dns: 5, connect: 20, ssl: 15, send: 1, wait: ms - 60, receive: 20 },
})
const hosts = ['api.example.com', 'cdn.example.com', 'auth.example.com']
const entries = Array.from({ length: 40 }, (_, i) => {
  const ok = i % 7 !== 3 && i % 11 !== 5
  return entry(i, `https://${hosts[i % 3]}/v1/item/${i}?x=${i}`, ok ? 200 : i % 2 ? 404 : 503, i % 3 === 1 ? 'text/html' : 'application/json', i % 3 === 1 ? '<html><body>hi</body></html>' : JSON.stringify({ id: i, ok }), 80 + ((i * 37) % 900))
})
writeFileSync('fixtures/sample.har', JSON.stringify({ log: { version: '1.2', creator: { name: 'make.mjs', version: '1' }, entries } }, null, 1))

const chunk = (b) => Buffer.concat([Buffer.from(b.length.toString(16) + '\r\n'), b, Buffer.from('\r\n0\r\n\r\n')])
const files = {
  'raw/1_c.txt': strToU8('CONNECT api.example.com:443 HTTP/1.1\r\nHost: api.example.com:443\r\n\r\n'),
  'raw/1_s.txt': strToU8('HTTP/1.1 200 Connection Established\r\n\r\n'),
  'raw/2_c.txt': strToU8('GET /v1/me HTTP/1.1\r\nHost: api.example.com\r\nAuthorization: Bearer abc\r\n\r\n'),
  'raw/2_s.txt': Buffer.concat([Buffer.from('HTTP/1.1 200 OK\r\nContent-Type: application/json\r\nContent-Encoding: gzip\r\nTransfer-Encoding: chunked\r\n\r\n'), chunk(Buffer.from(gzipSync(strToU8('{"name":"bob","roles":["a","b"]}'))))]),
  'raw/2_m.xml': strToU8('<Session><SessionTimers ClientBeginRequest="2026-01-01T00:00:00.000Z" ServerGotRequest="2026-01-01T00:00:00.010Z" ServerBeginResponse="2026-01-01T00:00:00.150Z" ServerDoneResponse="2026-01-01T00:00:00.170Z" ClientDoneResponse="2026-01-01T00:00:00.180Z"/><SessionFlags><SessionFlag N="x-processinfo" V="chrome:4242"/></SessionFlags></Session>'),
}
writeFileSync('fixtures/sample.saz', zipSync(files))
