import type { Header } from '../../model/session'
import { dechunk } from './body'
import { getHeader, parseHeaderLines } from './headers'

export type RawMessage = { startLine: string; headers: Header[]; body: Uint8Array }

const dec = new TextDecoder('latin1')

/** Split a raw HTTP message (as Fiddler stores in SAZ) into start line, headers and body. */
export const parseRawMessage = (buf: Uint8Array): RawMessage => {
  let end = -1
  let sepLen = 4
  for (let i = 0; i < buf.length - 1; i++) {
    if (buf[i] === 13 && buf[i + 1] === 10 && buf[i + 2] === 13 && buf[i + 3] === 10) {
      end = i
      break
    }
    if (buf[i] === 10 && buf[i + 1] === 10) {
      end = i
      sepLen = 2
      break
    }
  }
  const head = end < 0 ? buf : buf.subarray(0, end)
  let body = end < 0 ? new Uint8Array(0) : buf.subarray(end + sepLen)
  const lines = dec.decode(head).split(/\r?\n/)
  const startLine = lines.shift() ?? ''
  const headers = parseHeaderLines(lines)
  if (/chunked/i.test(getHeader(headers, 'transfer-encoding') ?? '')) body = dechunk(body)
  return { startLine, headers, body }
}
