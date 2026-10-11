import { useState } from 'react'
import type { Session } from '../model/session'
import { runQuickExec } from '../lib/filter/quickexec'
import { parseExpr } from '../lib/filter/expr'
import { emptyFilters } from '../lib/filter/filters'
import { useWorkspace } from '../store/workspace'
import { I } from './icons'

const looksLikeExpr = (q: string) => /^[~(!]/.test(q.trim())

export function QuickExecBar({ visible }: { visible: Session[] }) {
  const { filters, setFilters, clear, select } = useWorkspace()
  const [text, setText] = useState('')
  const [msg, setMsg] = useState<{ t: string; err?: boolean } | null>(null)

  const run = () => {
    const q = text.trim()
    if (!q) return
    setMsg(null)
    if (looksLikeExpr(q)) {
      try {
        setFilters({ quick: [...filters.quick, { label: q, test: parseExpr(q) }] })
        setText('')
      } catch (e) {
        setMsg({ t: e instanceof Error ? e.message : String(e), err: true })
      }
      return
    }
    const r = runQuickExec(q)
    if (r.kind === 'error') return setMsg({ t: r.message, err: true })
    if (r.kind === 'clear-sessions') clear()
    else if (r.kind === 'clear-filters') setFilters(emptyFilters())
    else if (r.kind === 'filter') setFilters({ quick: [...filters.quick, { label: r.label, test: r.test }] })
    else {
      const n = visible.filter(r.test)
      if (n[0]) select(n[0].id)
      setMsg({ t: `${n.length} match “${r.label}” — first selected` })
    }
    setText('')
  }

  return (
    <div className="quickexec">
      <div className="qbox">
        <span className="qicon">{I.search}</span>
        <input
          aria-label="QuickExec"
          placeholder="Filter…  ?text  =404  >10k  @host  ~m POST & ~c 5xx  select json"
          value={text}
          onChange={(e) => { setText(e.target.value); setMsg(null) }}
          onKeyDown={(e) => e.key === 'Enter' && run()}
        />
      </div>
      <div className="chips">
        {filters.quick.map((q) => (
          <span key={q.label} className="chip" title={q.label}>{q.label}<button aria-label={`Remove filter ${q.label}`} onClick={() => setFilters({ quick: filters.quick.filter((x) => x !== q) })}>✕</button></span>
        ))}
      </div>
      {msg && <span className={`hint ${msg.err ? 'err' : ''}`} role="status">{msg.t}</span>}
    </div>
  )
}
