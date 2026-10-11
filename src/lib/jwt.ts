const b64url = (s: string): string => {
  const p = s.replace(/-/g, '+').replace(/_/g, '/')
  return new TextDecoder().decode(Uint8Array.from(atob(p + '='.repeat((4 - (p.length % 4)) % 4)), (c) => c.charCodeAt(0)))
}

export type Jwt = { header: unknown; payload: Record<string, unknown>; expiresAt?: number; issuedAt?: number }

export const decodeJwt = (token: string): Jwt | null => {
  const parts = token.trim().split('.')
  if (parts.length !== 3 || !parts.every((p) => /^[\w-]*$/.test(p))) return null
  try {
    const header = JSON.parse(b64url(parts[0]))
    const payload = JSON.parse(b64url(parts[1]))
    if (typeof payload !== 'object' || payload === null) return null
    return {
      header,
      payload,
      expiresAt: typeof payload.exp === 'number' ? payload.exp * 1000 : undefined,
      issuedAt: typeof payload.iat === 'number' ? payload.iat * 1000 : undefined,
    }
  } catch {
    return null
  }
}

/** Find JWTs in Authorization / Cookie style header values. */
export const findJwts = (value: string): string[] => value.match(/eyJ[\w-]+\.[\w-]+\.[\w-]*/g) ?? []
