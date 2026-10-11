import type { Header } from '../../model/session'

export const getHeader = (headers: Header[], name: string): string | undefined => {
  const n = name.toLowerCase()
  return headers.find((h) => h.name.toLowerCase() === n)?.value
}

export const getHeaders = (headers: Header[], name: string): string[] => {
  const n = name.toLowerCase()
  return headers.filter((h) => h.name.toLowerCase() === n).map((h) => h.value)
}

export const parseHeaderLines = (lines: string[]): Header[] => {
  const out: Header[] = []
  for (const line of lines) {
    if (!line) continue
    if ((line[0] === ' ' || line[0] === '\t') && out.length) {
      out[out.length - 1].value += ' ' + line.trim()
      continue
    }
    const i = line.indexOf(':')
    if (i <= 0) continue
    out.push({ name: line.slice(0, i).trim(), value: line.slice(i + 1).trim() })
  }
  return out
}
