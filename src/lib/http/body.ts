import { gunzipSync, inflateSync, unzlibSync } from 'fflate'
import type { Body, Header } from '../../model/session'
import { getHeader } from './headers'

const dec = new TextDecoder('utf-8', { fatal: false })

/** Decode `Transfer-Encoding: chunked`. Returns input unchanged if it is not valid chunked data. */
export const dechunk = (buf: Uint8Array): Uint8Array => {
  const parts: Uint8Array[] = []
  let pos = 0
  let total = 0
  while (pos < buf.length) {
    let eol = pos
    while (eol < buf.length - 1 && !(buf[eol] === 13 && buf[eol + 1] === 10)) eol++
    if (eol >= buf.length - 1) return buf
    const sizeStr = dec.decode(buf.subarray(pos, eol)).split(';')[0].trim()
    if (!/^[0-9a-fA-F]+$/.test(sizeStr)) return buf
    const size = parseInt(sizeStr, 16)
    pos = eol + 2
    if (size === 0) break
    if (pos + size > buf.length) return buf
    parts.push(buf.subarray(pos, pos + size))
    total += size
    pos += size + 2
  }
  const out = new Uint8Array(total)
  let o = 0
  for (const p of parts) {
    out.set(p, o)
    o += p.length
  }
  return out
}

/** Undo Content-Encoding (gzip/deflate). Unsupported encodings (br, zstd) are returned as-is with `ok:false`. */
export const decodeContent = (
  bytes: Uint8Array,
  headers: Header[],
): { bytes: Uint8Array; ok: boolean; encoding?: string } => {
  const enc = getHeader(headers, 'content-encoding')?.toLowerCase().trim()
  if (!enc || enc === 'identity') return { bytes, ok: true }
  try {
    if (enc === 'gzip' || enc === 'x-gzip') return { bytes: gunzipSync(bytes), ok: true, encoding: enc }
    if (enc === 'deflate') {
      try {
        return { bytes: unzlibSync(bytes), ok: true, encoding: enc }
      } catch {
        return { bytes: inflateSync(bytes), ok: true, encoding: enc }
      }
    }
  } catch {
    /* fall through */
  }
  return { bytes, ok: false, encoding: enc }
}

export const bodyBytes = (body: Body, headers: Header[]): Uint8Array =>
  body.decoded ? body.raw : decodeContent(body.raw, headers).bytes

export const bodyText = (body: Body, headers: Header[]): string => dec.decode(bodyBytes(body, headers))

export const toBase64 = (bytes: Uint8Array): string => {
  let s = ''
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
  return btoa(s)
}

export const fromBase64 = (b64: string): Uint8Array => Uint8Array.from(atob(b64), (c) => c.charCodeAt(0))
