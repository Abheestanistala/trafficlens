import { useMemo, useState } from 'react'
import { zipSync, strToU8 } from 'fflate'
import type { Session } from '../model/session'
import { defaultRedact, redactSessions, type RedactOptions } from '../lib/redact'
import { download, toHar } from '../lib/export'
import { exportSaz } from '../lib/saz-export'
import { runAnalyzers } from '../lib/analyze/findings'

const downloadBytes = (name: string, data: Uint8Array, type: string) => {
  const a = document.createElement('a')
  a.href = URL.createObjectURL(new Blob([data as BlobPart], { type }))
  a.download = name
  a.click()
  setTimeout(() => URL.revokeObjectURL(a.href), 1000)
}
const lines = (s: string) => s.split('\n').map((x) => x.trim()).filter(Boolean)

export function ExportDialog({ rows, selected, onClose }: { rows: Session[]; selected?: Session; onClose: () => void }) {
  const [scope, setScope] = useState<'filtered' | 'selected'>('filtered')
  const [redact, setRedact] = useState(true)
  const [o, setO] = useState<RedactOptions>(defaultRedact())
  const base = scope === 'selected' && selected ? [selected] : rows
  const report = useMemo(() => (redact ? redactSessions(base, o) : { sessions: base, headersMasked: 0, bodyHits: 0, urlsMasked: 0 }), [base, o, redact])
  const patch = (p: Partial<RedactOptions>) => setO({ ...o, ...p })

  return (
    <div className="modal-bg" onClick={onClose}>
      <div className="modal" role="dialog" aria-modal="true" aria-label="Export" onClick={(e) => e.stopPropagation()}>
        <h2>Export</h2>
        <p className="muted" style={{ marginTop: 0 }}>Share a capture without leaking secrets. Redaction is applied to the exported copy only.</p>
        <div className="seg" role="group" aria-label="Scope">
          <button aria-pressed={scope === 'filtered'} onClick={() => setScope('filtered')}>Filtered ({rows.length})</button>
          <button aria-pressed={scope === 'selected'} disabled={!selected} onClick={() => setScope('selected')}>Selected session</button>
        </div>
        <label className="row" style={{ margin: '14px 0 4px' }}><input type="checkbox" checked={redact} onChange={(e) => setRedact(e.target.checked)} /><b>Redact sensitive data</b></label>
        {redact && (
          <div style={{ paddingLeft: 22 }}>
            <label className="row"><input type="checkbox" checked={o.cookies} onChange={(e) => patch({ cookies: e.target.checked })} />Cookie / Set-Cookie headers</label>
            <label className="row"><input type="checkbox" checked={o.authHeaders} onChange={(e) => patch({ authHeaders: e.target.checked })} />Authorization headers</label>
            <label className="row"><input type="checkbox" checked={o.dropBodies} onChange={(e) => patch({ dropBodies: e.target.checked })} />Remove all bodies</label>
            <div className="field"><label htmlFor="rx-h">Extra header names (one per line)</label><textarea id="rx-h" className="big" style={{ minHeight: 56 }} value={o.extraHeaders.join('\n')} onChange={(e) => patch({ extraHeaders: lines(e.target.value) })} /></div>
            <div className="field"><label htmlFor="rx-q">Query parameters to mask</label><textarea id="rx-q" className="big" style={{ minHeight: 56 }} value={o.queryParams.join('\n')} onChange={(e) => patch({ queryParams: lines(e.target.value) })} /></div>
            <div className="field"><label htmlFor="rx-b">Body patterns (regex, one per line)</label><textarea id="rx-b" className="big" style={{ minHeight: 56 }} value={o.bodyPatterns.join('\n')} onChange={(e) => patch({ bodyPatterns: lines(e.target.value) })} /></div>
            <div className="callout good">Will mask {report.headersMasked} header values, {report.urlsMasked} URLs and {report.bodyHits} body matches.</div>
            <div className="callout warn">Pattern redaction is best-effort. Review the output before sharing; URL paths and unlisted fields are not touched.</div>
          </div>
        )}
        <div className="actions">
          <button onClick={onClose}>Close</button>
          <button onClick={() => downloadBytes('export.saz', exportSaz(report.sessions), 'application/zip')}>Download SAZ</button>
          <button onClick={() => download('export.har', JSON.stringify(toHar(report.sessions), null, 2))}>Download HAR</button>
          <button className="primary" onClick={() => {
            const f = runAnalyzers(report.sessions)
            downloadBytes('bundle.zip', zipSync({
              'capture.har': strToU8(JSON.stringify(toHar(report.sessions), null, 2)),
              'findings.json': strToU8(JSON.stringify(f, null, 2)),
              'README.txt': strToU8(`HTK Traffic Lens bundle\nSessions: ${report.sessions.length}\nRedacted: ${redact ? 'yes' : 'NO'}\nCreated: ${new Date().toISOString()}\n`),
            }), 'application/zip')
          }}>Download bundle (.zip)</button>
        </div>
      </div>
    </div>
  )
}
