import type { Session } from '../../model/session'
import { bodyBytes } from '../http/body'
import { getHeader } from '../http/headers'

export const hostOf = (s: Session): string => {
  try {
    return new URL(s.request.url).host
  } catch {
    return ''
  }
}

export const contentType = (s: Session): string =>
  (getHeader(s.response.headers, 'content-type') ?? '').split(';')[0].trim().toLowerCase()

export const responseSize = (s: Session): number => {
  const cl = getHeader(s.response.headers, 'content-length')
  if (s.response.body.decoded) return s.response.body.raw.length || (cl ? Number(cl) : 0)
  return s.response.body.raw.length
}

export const decodedResponseSize = (s: Session): number => bodyBytes(s.response.body, s.response.headers).length

export const contentKind = (s: Session): string => {
  const t = contentType(s)
  if (t.startsWith('image/')) return 'image'
  if (t.includes('json')) return 'json'
  if (t.includes('html')) return 'html'
  if (t.includes('javascript') || t.includes('ecmascript')) return 'script'
  if (t.includes('css')) return 'css'
  if (t.includes('xml')) return 'xml'
  if (t.startsWith('text/')) return 'text'
  if (t.startsWith('font/') || t.includes('font')) return 'font'
  return t ? 'other' : 'none'
}
