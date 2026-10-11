import { useState } from 'react'
import { OPS } from '../../lib/textwizard'

export function ToolsView() {
  const [input, setInput] = useState('')
  const [output, setOutput] = useState('')
  const [err, setErr] = useState('')
  const [last, setLast] = useState('')
  const run = (id: string) => {
    const op = OPS.find((o) => o.id === id)!
    try {
      setOutput(op.run(input))
      setErr('')
    } catch (e) {
      setErr(`${op.label}: ${e instanceof Error ? e.message : String(e)}`)
    }
    setLast(op.label)
  }
  return (
    <div className="page">
      <h2>TextWizard</h2>
      <p className="muted">Encode, decode and inspect snippets. Everything runs locally.</p>
      <div className="panel">
        <div className="field"><label htmlFor="tw-in">Input</label><textarea id="tw-in" className="big" value={input} onChange={(e) => setInput(e.target.value)} placeholder="Paste a token, payload or encoded value…" /></div>
        <div className="seg" role="group" aria-label="Operations">{OPS.map((o) => <button key={o.id} onClick={() => run(o.id)} disabled={!input}>{o.label}</button>)}</div>
        {err && <div className="callout bad">{err}</div>}
        <div className="field"><label htmlFor="tw-out">Output {last && <span className="muted">· {last}</span>}</label><textarea id="tw-out" className="big" readOnly value={output} /></div>
        <div className="row"><button disabled={!output} onClick={() => setInput(output)}>Use output as input</button><button disabled={!output} onClick={() => void navigator.clipboard.writeText(output)}>Copy output</button></div>
      </div>
    </div>
  )
}
