import { useMemo, useState } from 'react'
import type { Session } from '../../model/session'
import { runAnalyzers, severityRank, type Finding, type Severity } from '../../lib/analyze/findings'
import { rulesAsAnalyzers, useCompiledRules } from '../../lib/rules'
import { usePrefs } from '../../store/prefs'
import { download } from '../../lib/export'
import { I } from '../icons'

const SEV_ICON: Record<Severity, React.ReactNode> = { critical: I.cross, serious: I.warn, warning: I.warn, info: I.info }
const SEV_LABEL: Record<Severity, string> = { critical: 'Critical', serious: 'Serious', warning: 'Warning', info: 'Info' }

export const useFindings = (sessions: Session[]): Finding[] => {
  const rules = usePrefs((s) => s.rules)
  const compiled = useCompiledRules(rules)
  return useMemo(() => runAnalyzers(sessions, rulesAsAnalyzers(compiled.ok)), [sessions, compiled])
}

export function FindingsView({ sessions, findings, onOpen }: { sessions: Session[]; findings: Finding[]; onOpen: (id: string) => void }) {
  const [open, setOpen] = useState<Set<string>>(new Set())
  const [sev, setSev] = useState<Severity | 'all'>('all')
  const byId = useMemo(() => new Map(sessions.map((s) => [s.id, s])), [sessions])
  const counts = useMemo(() => {
    const c: Record<Severity, number> = { critical: 0, serious: 0, warning: 0, info: 0 }
    findings.forEach((f) => c[f.severity]++)
    return c
  }, [findings])
  const shown = findings.filter((f) => sev === 'all' || f.severity === sev)

  return (
    <div className="page">
      <div className="row" style={{ marginBottom: 4 }}>
        <h2 className="grow1">Findings</h2>
        <button onClick={() => download('findings.json', JSON.stringify(findings.map((f) => ({ ...f, sessions: f.sessionIds.map((id) => byId.get(id)?.request.url) })), null, 2))} disabled={!findings.length}>Export JSON</button>
      </div>
      <p className="muted">Automatic checks for errors, redirects, performance, caching, CORS, cookies and auth, plus your custom rules.</p>
      <div className="seg" style={{ marginBottom: 12 }} role="group" aria-label="Filter by severity">
        <button aria-pressed={sev === 'all'} onClick={() => setSev('all')}>All ({findings.length})</button>
        {(Object.keys(counts) as Severity[]).map((k) => <button key={k} aria-pressed={sev === k} onClick={() => setSev(k)} disabled={!counts[k]}>{SEV_LABEL[k]} ({counts[k]})</button>)}
      </div>
      {!shown.length && <div className="callout good">{findings.length ? 'Nothing at this severity.' : 'No issues detected in this capture.'}</div>}
      {shown.sort((a, b) => severityRank(a.severity) - severityRank(b.severity)).map((f) => {
        const isOpen = open.has(f.id)
        return (
          <div key={f.id} className={`finding sev-${f.severity}`}>
            <button className="fh" aria-expanded={isOpen} onClick={() => setOpen((o) => { const n = new Set(o); if (n.has(f.id)) n.delete(f.id); else n.add(f.id); return n })}>
              <span className="ic" aria-hidden="true"><span style={{ width: 13, height: 13, display: 'inline-flex' }}>{SEV_ICON[f.severity]}</span></span>
              <span className="grow1"><div className="fc">{SEV_LABEL[f.severity]} · {f.category}</div><div className="ft">{f.title}</div></span>
              <span className="muted">{f.sessionIds.length} session{f.sessionIds.length === 1 ? '' : 's'} {isOpen ? '▾' : '▸'}</span>
            </button>
            {isOpen && (
              <>
                <div className="fd">{f.detail}</div>
                <div className="sess">
                  {f.sessionIds.slice(0, 30).map((id) => { const s = byId.get(id); return s && <button key={id} className="link" onClick={() => onOpen(id)}>#{s.seq} {s.response.status} {s.request.method} {s.request.url}</button> })}
                  {f.sessionIds.length > 30 && <span className="muted">…and {f.sessionIds.length - 30} more</span>}
                </div>
              </>
            )}
          </div>
        )
      })}
    </div>
  )
}
