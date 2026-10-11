import { describe, expect, it } from 'vitest'
import type { Session } from '../../model/session'
import { emptyBody } from '../../model/session'
import { applyFilters, emptyFilters } from './filters'
import { runQuickExec } from './quickexec'

const mk = (url: string, status: number, method = 'GET', ct = 'text/html'): Session => ({
  id: url,
  seq: 1,
  source: 't',
  request: { method, url, httpVersion: '', headers: [], body: emptyBody() },
  response: { status, statusText: '', httpVersion: '', headers: [{ name: 'Content-Type', value: ct }], body: emptyBody() },
  timings: {},
  net: {},
  meta: {},
})

const data = [mk('https://a.test/x', 200), mk('https://b.test/y', 404), mk('https://b.test/z', 503, 'POST', 'application/json')]

describe('filters', () => {
  it('filters by host, status class and regex url', () => {
    expect(applyFilters(data, { ...emptyFilters(), hosts: ['b.test'] })).toHaveLength(2)
    expect(applyFilters(data, { ...emptyFilters(), statusClasses: [4, 5] })).toHaveLength(2)
    expect(applyFilters(data, { ...emptyFilters(), text: '/\\/[yz]$/' })).toHaveLength(2)
  })
  it('quickexec status and select', () => {
    const r = runQuickExec('=5xx')
    expect(r.kind).toBe('filter')
    if (r.kind === 'filter') expect(data.filter(r.test)).toHaveLength(1)
    const s = runQuickExec('select json')
    if (s.kind === 'select') expect(data.filter(s.test)).toHaveLength(1)
    expect(runQuickExec('>zz').kind).toBe('error')
  })
})
