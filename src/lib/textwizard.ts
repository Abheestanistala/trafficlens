import { gunzipSync, gzipSync, strFromU8, strToU8, unzlibSync, zlibSync } from 'fflate'
import { decodeJwt } from './jwt'
import { fromBase64, toBase64 } from './http/body'

export type WizardOp = { id: string; label: string; run: (input: string) => string }

const ent: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }
const b64u = (s: string) => {
  const p = s.trim().replace(/-/g, '+').replace(/_/g, '/')
  return fromBase64(p + '='.repeat((4 - (p.length % 4)) % 4))
}

export const OPS: WizardOp[] = [
  { id: 'b64e', label: 'Base64 encode', run: (s) => toBase64(strToU8(s)) },
  { id: 'b64d', label: 'Base64 decode', run: (s) => strFromU8(b64u(s)) },
  { id: 'urle', label: 'URL encode', run: (s) => encodeURIComponent(s) },
  { id: 'urld', label: 'URL decode', run: (s) => decodeURIComponent(s.replace(/\+/g, ' ')) },
  { id: 'htmle', label: 'HTML encode', run: (s) => s.replace(/[&<>"']/g, (c) => ent[c]) },
  { id: 'htmld', label: 'HTML decode', run: (s) => s.replace(/&(amp|lt|gt|quot|#39|#x27);/g, (_, e) => ({ amp: '&', lt: '<', gt: '>', quot: '"', '#39': "'", '#x27': "'" })[e as string]!) },
  { id: 'hexe', label: 'Hex encode', run: (s) => [...strToU8(s)].map((b) => b.toString(16).padStart(2, '0')).join('') },
  { id: 'hexd', label: 'Hex decode', run: (s) => strFromU8(Uint8Array.from(s.replace(/[^0-9a-f]/gi, '').match(/../g) ?? [], (h) => parseInt(h, 16))) },
  { id: 'jwt', label: 'JWT decode', run: (s) => { const j = decodeJwt(s.replace(/^Bearer\s+/i, '')); if (!j) throw new Error('Not a valid JWT'); return JSON.stringify({ header: j.header, payload: j.payload, expires: j.expiresAt ? new Date(j.expiresAt).toISOString() : undefined }, null, 2) } },
  { id: 'gz', label: 'gzip → base64', run: (s) => toBase64(gzipSync(strToU8(s))) },
  { id: 'gunz', label: 'gunzip (base64 in)', run: (s) => strFromU8(gunzipSync(fromBase64(s.trim()))) },
  { id: 'defl', label: 'deflate → base64', run: (s) => toBase64(zlibSync(strToU8(s))) },
  { id: 'infl', label: 'inflate (base64 in)', run: (s) => strFromU8(unzlibSync(fromBase64(s.trim()))) },
  { id: 'ts', label: 'Timestamp ↔ date', run: (s) => { const t = s.trim(); if (/^\d{9,13}$/.test(t)) { const n = Number(t); return new Date(t.length <= 10 ? n * 1000 : n).toISOString() } const d = Date.parse(t); if (Number.isNaN(d)) throw new Error('Unrecognised date or epoch'); return `${Math.floor(d / 1000)} (s)\n${d} (ms)` } },
  { id: 'jsonp', label: 'JSON pretty-print', run: (s) => JSON.stringify(JSON.parse(s), null, 2) },
]
