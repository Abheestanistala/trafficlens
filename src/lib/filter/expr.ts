import type { Session } from '../../model/session'
import { bodyText } from '../http/body'
import { getHeader } from '../http/headers'
import { contentType, hostOf, responseSize } from './derive'

/**
 * mitmproxy-flavoured filter expressions:
 *   ~u re  url     ~m METHOD   ~c code   ~d domain   ~t content-type
 *   ~h re  any header ("Name: value")   ~hq / ~hs  request / response header only
 *   ~b re  any body   ~bq / ~bs  request / response body
 *   ~s >N  response size   ~dur >N  duration ms   ~src file
 *   &  |  !  ( )   -- bare words match the URL
 */
type Tok = { t: 'op' | 'flag' | 'word'; v: string }

const tokenize = (src: string): Tok[] => {
  const out: Tok[] = []
  let i = 0
  while (i < src.length) {
    const c = src[i]
    if (/\s/.test(c)) i++
    else if ('&|!()'.includes(c)) (out.push({ t: 'op', v: c }), i++)
    else {
      let j = i
      let w = ''
      if (c === '"' || c === "'") {
        j++
        while (j < src.length && src[j] !== c) w += src[j++]
        if (j >= src.length) throw new Error('Unterminated quote')
        j++
      } else {
        while (j < src.length && !/[\s&|()]/.test(src[j])) w += src[j++]
      }
      out.push({ t: c === '~' ? 'flag' : 'word', v: w })
      i = j
    }
  }
  return out
}

const re = (p: string): RegExp => {
  try {
    return new RegExp(p, 'i')
  } catch {
    throw new Error(`Bad regex: ${p}`)
  }
}

const cmp = (spec: string, n: number): boolean => {
  const m = /^([<>]=?|=)?(\d+(?:\.\d+)?)([kmg]?)$/i.exec(spec)
  if (!m) throw new Error(`Bad number: ${spec}`)
  const v = Number(m[2]) * ({ '': 1, k: 1024, m: 1024 ** 2, g: 1024 ** 3 } as Record<string, number>)[m[3].toLowerCase()]
  switch (m[1]) {
    case '>': return n > v
    case '>=': return n >= v
    case '<': return n < v
    case '<=': return n <= v
    default: return n === v
  }
}

type Pred = (s: Session) => boolean

export const parseExpr = (src: string): Pred => {
  const toks = tokenize(src)
  let p = 0
  const peek = () => toks[p]
  const next = () => toks[p++]

  const atom = (): Pred => {
    const t = next()
    if (!t) throw new Error('Unexpected end of expression')
    if (t.t === 'op' && t.v === '(') {
      const e = or()
      if (next()?.v !== ')') throw new Error('Missing )')
      return e
    }
    if (t.t === 'op' && t.v === '!') {
      const e = atom()
      return (s) => !e(s)
    }
    if (t.t === 'word') {
      const r = re(t.v.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
      return (s) => r.test(s.request.url)
    }
    if (t.t === 'flag') {
      const flag = t.v.slice(1).toLowerCase()
      const arg = next()
      if (!arg || arg.t === 'op') throw new Error(`Flag ${t.v} needs an argument`)
      const a = arg.v
      switch (flag) {
        case 'u': { const r = re(a); return (s) => r.test(s.request.url) }
        case 'm': return (s) => s.request.method.toLowerCase() === a.toLowerCase()
        case 'c': return /^\dxx$/i.test(a) ? (s) => String(s.response.status)[0] === a[0] : (s) => String(s.response.status) === a
        case 'd': { const r = re(a); return (s) => r.test(hostOf(s)) }
        case 't': { const r = re(a); return (s) => r.test(contentType(s)) }
        case 'h': case 'hq': case 'hs': {
          const r = re(a)
          return (s) =>
            (flag !== 'hs' && s.request.headers.some((h) => r.test(`${h.name}: ${h.value}`))) ||
            (flag !== 'hq' && s.response.headers.some((h) => r.test(`${h.name}: ${h.value}`)))
        }
        case 'b': case 'bq': case 'bs': {
          const r = re(a)
          return (s) =>
            (flag !== 'bs' && r.test(bodyText(s.request.body, s.request.headers))) ||
            (flag !== 'bq' && r.test(bodyText(s.response.body, s.response.headers)))
        }
        case 's': return (s) => cmp(a, responseSize(s))
        case 'dur': return (s) => cmp(a, s.timings.total ?? 0)
        case 'src': { const r = re(a); return (s) => r.test(s.source) }
        case 'hasheader': return (s) => getHeader(s.response.headers, a) != null || getHeader(s.request.headers, a) != null
        default: throw new Error(`Unknown flag ~${flag}`)
      }
    }
    throw new Error(`Unexpected "${t.v}"`)
  }
  const and = (): Pred => {
    let l = atom()
    // implicit AND between adjacent terms, like mitmproxy
    while (peek() && (peek().v === '&' || (peek().v !== '|' && peek().v !== ')'))) {
      if (peek().v === '&') next()
      const r = atom()
      const ll = l
      l = (s) => ll(s) && r(s)
    }
    return l
  }
  const or = (): Pred => {
    let l = and()
    while (peek()?.v === '|') {
      next()
      const r = and()
      const ll = l
      l = (s) => ll(s) || r(s)
    }
    return l
  }
  if (!toks.length) throw new Error('Empty expression')
  const e = or()
  if (p < toks.length) throw new Error(`Unexpected "${toks[p].v}"`)
  return e
}
