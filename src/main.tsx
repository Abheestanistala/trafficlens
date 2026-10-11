import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { registerAnalyzer, listAnalyzers } from './lib/analyze/findings'
import { parseExpr } from './lib/filter/expr'

// Plugin hook: from the devtools console (or a bookmarklet) add your own analyzers, e.g.
//   HTK.registerAnalyzer({ id: 'x', name: 'X', run: (sessions) => [{ severity: 'info', category: 'X', title: '…', detail: '', sessionIds: [] }] })
// Note the strict CSP forbids loading remote scripts, so plugins are registered from trusted local code only.
;(window as unknown as { HTK: unknown }).HTK = { registerAnalyzer, listAnalyzers, parseExpr }

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
