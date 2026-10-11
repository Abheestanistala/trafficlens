import { parseExpr } from '../../lib/filter/expr'
import { RULE_COLORS, usePrefs, type Rule } from '../../store/prefs'

const SEVS = ['critical', 'serious', 'warning', 'info'] as const
const check = (expr: string) => { try { parseExpr(expr); return '' } catch (e) { return e instanceof Error ? e.message : String(e) } }

export function RulesView() {
  const { rules, setRules } = usePrefs()
  const upd = (id: string, p: Partial<Rule>) => setRules(rules.map((r) => (r.id === id ? { ...r, ...p } : r)))
  return (
    <div className="page">
      <h2>Rules</h2>
      <p className="muted">Custom rules use the filter expression language (e.g. <code>~d api.example.com &amp; ~c 5xx</code>). A rule can colour matching rows and/or raise a finding. Saved in this browser.</p>
      <details className="panel"><summary style={{ cursor: 'pointer' }}>Expression reference</summary>
        <table className="kv sans"><tbody>
          {[['~u re', 'URL matches'], ['~m GET', 'method'], ['~c 404 / 5xx', 'status'], ['~d re', 'host'], ['~t re', 'content type'], ['~h re / ~hq / ~hs', 'any / request / response header ("Name: value")'], ['~b re / ~bq / ~bs', 'any / request / response body'], ['~s >10k', 'response size'], ['~dur >2000', 'duration ms'], ['~src re', 'capture file name'], ['& | ! ( )', 'combine; adjacent terms mean AND']].map(([a, b]) => <tr key={a}><th><code>{a}</code></th><td>{b}</td></tr>)}
        </tbody></table>
      </details>
      {rules.map((r) => {
        const err = check(r.expr)
        return (
          <div className="panel" key={r.id}>
            <div className="row">
              <label className="row"><input type="checkbox" checked={r.enabled} onChange={(e) => upd(r.id, { enabled: e.target.checked })} aria-label="Enabled" /></label>
              <input className="grow1" aria-label="Rule name" value={r.name} onChange={(e) => upd(r.id, { name: e.target.value })} />
              <button className="ghost" onClick={() => setRules(rules.filter((x) => x.id !== r.id))}>Delete</button>
            </div>
            <div className="field"><label>Expression</label><input className="mono" aria-invalid={!!err} value={r.expr} onChange={(e) => upd(r.id, { expr: e.target.value })} />{err && <span className="hint err">{err}</span>}</div>
            <div className="row" style={{ flexWrap: 'wrap' }}>
              <span className="muted">Highlight</span>
              <button aria-pressed={!r.color} onClick={() => upd(r.id, { color: undefined })}>none</button>
              {RULE_COLORS.map((c) => <button key={c} className={`c-${c}`} aria-pressed={r.color === c} aria-label={`Highlight ${c}`} onClick={() => upd(r.id, { color: c })}><span className="hl-swatch" /></button>)}
              <span className="muted" style={{ marginLeft: 12 }}>Finding</span>
              <select aria-label="Finding severity" value={r.alert?.severity ?? ''} onChange={(e) => upd(r.id, { alert: e.target.value ? { severity: e.target.value as (typeof SEVS)[number], message: r.alert?.message ?? '' } : undefined })}>
                <option value="">none</option>{SEVS.map((s) => <option key={s}>{s}</option>)}
              </select>
              {r.alert && <input className="grow1" aria-label="Finding message" placeholder="Message shown in Findings" value={r.alert.message} onChange={(e) => upd(r.id, { alert: { ...r.alert!, message: e.target.value } })} />}
            </div>
          </div>
        )
      })}
      <button className="primary" onClick={() => setRules([...rules, { id: crypto.randomUUID(), name: 'New rule', expr: '~c 5xx', enabled: true, color: 'red' }])}>Add rule</button>
    </div>
  )
}
