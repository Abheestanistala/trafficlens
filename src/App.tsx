import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Group, Panel, Separator } from 'react-resizable-panels'
import { LIST_VIEWS, useWorkspace, type View } from './store/workspace'
import { usePrefs } from './store/prefs'
import { applyFilters } from './lib/filter/filters'
import { toCurl } from './lib/export'
import { SessionGrid } from './ui/SessionGrid'
import { Inspector } from './ui/inspectors/Inspector'
import { FilterPanel } from './ui/FilterPanel'
import { QuickExecBar } from './ui/QuickExecBar'
import { ExportDialog } from './ui/ExportDialog'
import { TimelineView } from './ui/views/TimelineView'
import { FindingsView, useFindings } from './ui/views/FindingsView'
import { StatsView } from './ui/views/StatsView'
import { SearchView } from './ui/views/SearchView'
import { ToolsView } from './ui/views/ToolsView'
import { WorkspacesView } from './ui/views/WorkspacesView'
import { RulesView } from './ui/views/RulesView'
import { I } from './ui/icons'

const CompareView = lazy(() => import('./ui/views/CompareView').then((m) => ({ default: m.CompareView })))

const NAV: { id: View; label: string; icon: React.ReactNode; needsData: boolean }[] = [
  { id: 'sessions', label: 'Sessions', icon: I.sessions, needsData: true },
  { id: 'timeline', label: 'Timeline', icon: I.timeline, needsData: true },
  { id: 'findings', label: 'Findings', icon: I.findings, needsData: true },
  { id: 'stats', label: 'Stats', icon: I.stats, needsData: true },
  { id: 'search', label: 'Find', icon: I.search, needsData: true },
  { id: 'compare', label: 'Compare', icon: I.compare, needsData: true },
  { id: 'tools', label: 'Tools', icon: I.tools, needsData: false },
  { id: 'workspaces', label: 'Saved', icon: I.workspaces, needsData: false },
  { id: 'rules', label: 'Rules', icon: I.rules, needsData: false },
]

export default function App() {
  const ws = useWorkspace()
  const { sessions, files, selectedId, filters, loading, error, showFilters, view, load, select, set, clear, exportOpen, compareA, compareB } = ws
  const { theme, setTheme } = usePrefs()
  const input = useRef<HTMLInputElement>(null)
  const [dragging, setDragging] = useState(false)
  const rows = useMemo(() => applyFilters(sessions, filters), [sessions, filters])
  const findings = useFindings(sessions)
  const sel = sessions.find((s) => s.id === selectedId)
  const hot = findings.filter((f) => f.severity === 'critical' || f.severity === 'serious').length

  useEffect(() => { document.documentElement.dataset.theme = theme }, [theme])
  const onFiles = useCallback((list: FileList | null) => { if (list && list.length) void load([...list]) }, [load])

  const inspector = sel ? (
    <Group orientation="horizontal">
      <Panel minSize="20%"><Inspector title="Request" isResponse={false} session={sel} message={sel.request} startLine={`${sel.request.method} ${sel.request.url} ${sel.request.httpVersion}`} /></Panel>
      <Separator className="sep v" />
      <Panel minSize="20%"><Inspector title="Response" isResponse session={sel} message={sel.response} startLine={`${sel.response.httpVersion} ${sel.response.status} ${sel.response.statusText}`} /></Panel>
    </Group>
  ) : <div className="empty muted">Select a session to inspect it</div>

  const gridTools = (
    <>
      <button disabled={!sel} onClick={() => set({ compareA: selectedId })} aria-pressed={!!selectedId && compareA === selectedId}>Set as A</button>
      <button disabled={!sel} onClick={() => set({ compareB: selectedId })} aria-pressed={!!selectedId && compareB === selectedId}>Set as B</button>
      {compareA && compareB && <button className="ghost" onClick={() => set({ view: 'compare' })}>Compare A⇄B →</button>}
    </>
  )

  const listView = (() => {
    switch (view) {
      case 'timeline': return <TimelineView rows={rows} selectedId={selectedId} onSelect={select} />
      case 'findings': return <FindingsView sessions={sessions} findings={findings} onOpen={(id) => { select(id) }} />
      case 'stats': return <StatsView rows={rows} onSelect={select} />
      case 'search': return <SearchView sessions={sessions} onOpen={select} />
      default: return <SessionGrid rows={rows} selectedId={selectedId} onSelect={select} extraTools={gridTools} />
    }
  })()

  const body = () => {
    if (view === 'tools') return <ToolsView />
    if (view === 'workspaces') return <WorkspacesView />
    if (view === 'rules') return <RulesView />
    if (!sessions.length) {
      return (
        <div className="empty">
          <div className="drop">
            <h2>{loading ? 'Parsing…' : 'Drop a capture here'}</h2>
            <p className="muted" style={{ margin: '0 0 14px' }}>HAR · Fiddler SAZ · Charles JSON/XML session</p>
            <button className="primary" onClick={() => input.current?.click()}>Choose files…</button>
            <p className="muted" style={{ marginBottom: 0 }}>Parsed locally in your browser. Nothing is uploaded.</p>
          </div>
        </div>
      )
    }
    if (view === 'compare') return <Suspense fallback={<div className="pad muted">Loading…</div>}><CompareView sessions={sessions} files={files} /></Suspense>
    return (
      <Group orientation="horizontal" className="grow1">
        {showFilters && view === 'sessions' && (<><Panel defaultSize="17%" minSize="12%" maxSize="35%"><FilterPanel all={sessions} /></Panel><Separator className="sep v" /></>)}
        <Panel minSize="35%">
          <Group orientation="vertical">
            <Panel defaultSize={view === 'sessions' || view === 'timeline' ? '48%' : '55%'} minSize="15%">{listView}</Panel>
            <Separator className="sep h" />
            <Panel minSize="15%">{inspector}</Panel>
          </Group>
        </Panel>
      </Group>
    )
  }

  return (
    <div className={`app ${dragging ? 'dropping' : ''}`}
      onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
      onDragLeave={(e) => { if (e.currentTarget === e.target) setDragging(false) }}
      onDrop={(e) => { e.preventDefault(); setDragging(false); onFiles(e.dataTransfer.files) }}>
      <header className="topbar">
        <div className="brand"><span className="logo" aria-hidden="true">⌁</span>Traffic Lens</div>
        <button className="primary" onClick={() => input.current?.click()}>Open</button>
        <input ref={input} type="file" hidden multiple accept=".har,.saz,.chlsj,.chlx,.json,.xml" onChange={(e) => { onFiles(e.target.files); e.target.value = '' }} aria-label="Open capture files" />
        {sessions.length > 0 && LIST_VIEWS.includes(view) && <QuickExecBar visible={rows} />}
        <span className="grow1" />
        {sessions.length > 0 && (
          <>
            <div className="files" aria-label="Loaded files">{files.map((f) => <span key={f} className="file-chip" title={f}>{f}</span>)}</div>
            {LIST_VIEWS.includes(view) && view === 'sessions' && <button onClick={() => set({ showFilters: !showFilters })} aria-pressed={showFilters}>Filters</button>}
            <button disabled={!sel} onClick={() => sel && void navigator.clipboard.writeText(toCurl(sel))}>Copy cURL</button>
            <button onClick={() => set({ exportOpen: true })}>Export…</button>
            <button className="ghost" onClick={clear}>Clear</button>
          </>
        )}
        <button className="ghost" onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')} aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`} title="Toggle theme" style={{ width: 32, padding: 4 }}>
          <span style={{ width: 18, height: 18, display: 'inline-flex' }}>{theme === 'dark' ? I.sun : I.moon}</span>
        </button>
      </header>
      <nav className="rail" aria-label="Views">
        {NAV.map((n) => (
          <button key={n.id} aria-current={view === n.id ? 'page' : undefined} title={n.label} disabled={n.needsData && !sessions.length} onClick={() => set({ view: n.id })}>
            {n.icon}<span>{n.label}</span>
            {n.id === 'findings' && hot > 0 && <span className="badge" aria-label={`${hot} serious findings`}>{hot}</span>}
          </button>
        ))}
      </nav>
      <main className="content">
        {error && <pre className="error" role="alert">{error}</pre>}
        {body()}
      </main>
      <footer className="status">
        <span>{rows.length.toLocaleString()} / {sessions.length.toLocaleString()} sessions</span>
        {sel && <span>#{sel.seq} selected</span>}
        {loading && <span>Parsing…</span>}
        <span className="grow1" />
        <span>100% local · no uploads</span>
      </footer>
      {exportOpen && <ExportDialog rows={rows} selected={sel} onClose={() => set({ exportOpen: false })} />}
    </div>
  )
}
