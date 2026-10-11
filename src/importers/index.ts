import type { Session } from '../model/session'
import { importHar } from './har'
import { importSaz } from './saz'
import { importCharlesJson } from './charles'
import { importCharlesXml } from './charlesXml'

const dec = new TextDecoder()

export const importFile = (name: string, data: Uint8Array): Session[] => {
  const lower = name.toLowerCase()
  // ZIP magic "PK" => Fiddler SAZ
  if (data[0] === 0x50 && data[1] === 0x4b) return importSaz(data, name)
  if (lower.endsWith('.chls')) {
    throw new Error('Native Charles .chls files are binary. In Charles use File > Export Session… and choose JSON or HAR.')
  }
  const text = dec.decode(data)
  if (lower.endsWith('.chlx') || /^\s*<\?xml|^\s*<charles-session/i.test(text.slice(0, 200))) return importCharlesXml(text, name)
  const head = text.trimStart()[0]
  if (head !== '{' && head !== '[') throw new Error(`Unrecognised file format: ${name}`)
  const json = JSON.parse(text)
  if (json?.log?.entries) return importHar(text, name)
  if (Array.isArray(json)) return importCharlesJson(text, name)
  throw new Error(`Unrecognised JSON structure in ${name}`)
}
