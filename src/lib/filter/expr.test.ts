import { describe, expect, it } from 'vitest'
import type { Session } from '../../model/session'
import { emptyBody } from '../../model/session'
import { parseExpr } from './expr'

const mk = (url: string, status: number, method = 'GET', ct = 'text/html', body = ''): Session => ({
  id: url, seq: 1, source: 'a.har',
  request: { method, url, httpVersion: '', headers: [], body: emptyBody() },
  response: { status, statusText: '', httpVersion: '', headers: [{ name: 'Content-Type', value: ct }], body: { raw: new TextEncoder().encode(body), decoded: true } },
  timings: { total: 500 }, net: {}, meta: {},
})
const d = [mk('https://a.test/x', 200), mk('https://b.test/y', 404, 'POST'), mk('https://b.test/z', 503, 'POST', 'application/json', '{"err":"boom"}')]
const run = (e: string) => d.filter(parseExpr(e)).length

describe('expr', () => {
  it('flags and boolean ops', () => {
    expect(run('~m POST')).toBe(2)
    expect(run('~m POST & ~c 5xx')).toBe(1)
    expect(run('~c 404 | ~c 200')).toBe(2)
    expect(run('!~m POST')).toBe(1)
    expect(run('(~c 404 | ~c 503) ~d b.test')).toBe(2)
    expect(run('~bs boom')).toBe(1)
    expect(run('~dur >100')).toBe(3)
    expect(run('b.test/y')).toBe(1)
  })
  it('errors', () => {
    expect(() => parseExpr('~zz x')).toThrow(/Unknown flag/)
    expect(() => parseExpr('(~c 200')).toThrow(/Missing/)
    expect(() => parseExpr('~u')).toThrow(/argument/)
  })
})
