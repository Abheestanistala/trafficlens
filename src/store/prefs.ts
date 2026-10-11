import { create } from 'zustand'

export type Theme = 'dark' | 'light'
export type CustomColumn = { id: string; label: string; from: 'req' | 'res'; header: string }
export const BUILTIN_COLUMNS = [
  { id: 'seq', label: '#', w: '52px' },
  { id: 'status', label: 'Result', w: '84px' },
  { id: 'method', label: 'Method', w: '80px' },
  { id: 'host', label: 'Host', w: '190px' },
  { id: 'url', label: 'URL', w: 'minmax(220px,1fr)' },
  { id: 'type', label: 'Type', w: '110px' },
  { id: 'size', label: 'Size', w: '120px' },
  { id: 'time', label: 'Time', w: '130px' },
  { id: 'process', label: 'Process / Comment', w: '150px' },
] as const

export const RULE_COLORS = ['blue', 'orange', 'aqua', 'yellow', 'magenta', 'green', 'violet', 'red'] as const
export type RuleColor = (typeof RULE_COLORS)[number]
export type Rule = {
  id: string
  name: string
  expr: string
  enabled: boolean
  color?: RuleColor // highlight rows
  alert?: { severity: 'critical' | 'serious' | 'warning' | 'info'; message: string } // also raise a finding
}

type Prefs = {
  theme: Theme
  visibleColumns: string[]
  customColumns: CustomColumn[]
  rules: Rule[]
  setTheme: (t: Theme) => void
  setColumns: (ids: string[]) => void
  addCustomColumn: (c: Omit<CustomColumn, 'id'>) => void
  removeCustomColumn: (id: string) => void
  setRules: (r: Rule[]) => void
}

const KEY = 'htk-prefs-v1'
const load = (): Partial<Prefs> => {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? '{}')
  } catch {
    return {}
  }
}
const saved = load()
const systemDark = typeof matchMedia !== 'undefined' && matchMedia('(prefers-color-scheme: dark)').matches

export const usePrefs = create<Prefs>((set, get) => {
  const persist = () => {
    const { theme, visibleColumns, customColumns, rules } = get()
    localStorage.setItem(KEY, JSON.stringify({ theme, visibleColumns, customColumns, rules }))
  }
  const upd = (p: Partial<Prefs>) => (set(p), persist())
  return {
    theme: saved.theme ?? (systemDark ? 'dark' : 'light'),
    visibleColumns: saved.visibleColumns ?? BUILTIN_COLUMNS.map((c) => c.id),
    customColumns: saved.customColumns ?? [],
    rules: saved.rules ?? [
      { id: 'r-slow', name: 'Slow (> 2 s)', expr: '~dur >2000', enabled: true, color: 'orange' },
    ],
    setTheme: (theme) => upd({ theme }),
    setColumns: (visibleColumns) => upd({ visibleColumns }),
    addCustomColumn: (c) => {
      const id = `c:${c.from}:${c.header.toLowerCase()}`
      if (get().customColumns.some((x) => x.id === id)) return
      upd({ customColumns: [...get().customColumns, { ...c, id }], visibleColumns: [...get().visibleColumns, id] })
    },
    removeCustomColumn: (id) => upd({ customColumns: get().customColumns.filter((c) => c.id !== id), visibleColumns: get().visibleColumns.filter((c) => c !== id) }),
    setRules: (rules) => upd({ rules }),
  }
})
