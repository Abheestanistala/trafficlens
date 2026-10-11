export type Header = { name: string; value: string }

export type Body = {
  /** Wire bytes as captured (possibly content-encoded). */
  raw: Uint8Array
  /** True when `raw` is already decoded (e.g. HAR text) and must not be decompressed again. */
  decoded: boolean
}

export type HttpMessage = {
  headers: Header[]
  body: Body
}

export type Timings = {
  startedAt?: number // epoch ms
  blocked?: number
  dns?: number
  connect?: number
  ssl?: number
  send?: number
  wait?: number
  receive?: number
  total?: number // ms
}

export type Session = {
  id: string
  seq: number
  source: string
  request: HttpMessage & { method: string; url: string; httpVersion: string }
  response: HttpMessage & { status: number; statusText: string; httpVersion: string }
  timings: Timings
  net: { clientIp?: string; serverIp?: string; process?: string }
  meta: { comment?: string; color?: string }
}

export const emptyBody = (): Body => ({ raw: new Uint8Array(0), decoded: true })
