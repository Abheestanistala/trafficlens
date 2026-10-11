import type { Header } from '../../model/session'
import { getHeader } from './headers'

export type CacheInfo = {
  verdict: 'no-store' | 'revalidate' | 'cacheable' | 'heuristic' | 'none'
  maxAge?: number
  directives: string[]
  validators: string[]
  notes: string[]
}

export const analyzeCaching = (headers: Header[]): CacheInfo => {
  const cc = (getHeader(headers, 'cache-control') ?? '').toLowerCase()
  const directives = cc.split(',').map((d) => d.trim()).filter(Boolean)
  const maxAgeRaw = directives.find((d) => d.startsWith('s-maxage=')) ?? directives.find((d) => d.startsWith('max-age='))
  const maxAge = maxAgeRaw ? Number(maxAgeRaw.split('=')[1]) : undefined
  const validators = ['etag', 'last-modified'].filter((h) => getHeader(headers, h))
  const notes: string[] = []
  let verdict: CacheInfo['verdict']
  if (directives.includes('no-store')) verdict = 'no-store'
  else if (directives.includes('no-cache') || maxAge === 0) verdict = 'revalidate'
  else if (maxAge != null && maxAge > 0) verdict = 'cacheable'
  else if (getHeader(headers, 'expires')) verdict = 'cacheable'
  else if (validators.length) {
    verdict = 'heuristic'
    notes.push('No explicit freshness: browsers apply heuristic caching from Last-Modified.')
  } else verdict = 'none'
  if (verdict === 'cacheable' && !validators.length) notes.push('No ETag/Last-Modified: cannot revalidate after expiry.')
  if (getHeader(headers, 'pragma')?.includes('no-cache') && !cc) notes.push('Only legacy Pragma: no-cache is set.')
  if (getHeader(headers, 'vary')?.trim() === '*') notes.push('Vary: * makes the response effectively uncacheable.')
  return { verdict, maxAge, directives, validators, notes }
}
