import { useEffect, useState } from 'react'
import { deleteWorkspace, getWorkspace, listWorkspaces, saveWorkspace } from '../../lib/storage/db'
import { useWorkspace } from '../../store/workspace'

type Item = Awaited<ReturnType<typeof listWorkspaces>>[number]

export function WorkspacesView() {
  const { sessions, files, loadSessions, set } = useWorkspace()
  const [items, setItems] = useState<Item[]>([])
  const [name, setName] = useState('')
  const [msg, setMsg] = useState('')
  const refresh = () => listWorkspaces().then(setItems).catch((e) => setMsg(String(e)))
  useEffect(() => { void refresh() }, [])

  const save = async () => {
    try {
      await saveWorkspace({ id: crypto.randomUUID(), name: name || files.join(', ') || 'Untitled', savedAt: Date.now(), files, sessions })
      setName('')
      setMsg('Saved in this browser only.')
      void refresh()
    } catch (e) {
      setMsg(`Could not save (storage quota?): ${e instanceof Error ? e.message : e}`)
    }
  }
  return (
    <div className="page">
      <h2>Workspaces</h2>
      <p className="muted">Save the loaded captures in this browser's IndexedDB to reopen them later. Nothing leaves your machine. Saved data includes cookies and tokens unless you redact it first.</p>
      <div className="panel">
        <h3>Save current</h3>
        <div className="row"><input className="grow1" aria-label="Workspace name" placeholder={files.join(', ') || 'Name'} value={name} onChange={(e) => setName(e.target.value)} /><button className="primary" disabled={!sessions.length} onClick={() => void save()}>Save {sessions.length.toLocaleString()} sessions</button></div>
        {msg && <div className="muted" style={{ marginTop: 6 }}>{msg}</div>}
      </div>
      <div className="panel">
        <h3>Saved</h3>
        {!items.length && <div className="muted">Nothing saved yet.</div>}
        <table className="kv sans"><tbody>
          {items.map((w) => (
            <tr key={w.id}>
              <th>{w.name}</th>
              <td><span className="muted">{new Date(w.savedAt).toLocaleString()} · {w.files.join(', ')}</span></td>
              <td style={{ whiteSpace: 'nowrap', textAlign: 'right' }}>
                <button onClick={async () => { const x = await getWorkspace(w.id); if (x) { loadSessions(x.name, x.files, x.sessions); set({ view: 'sessions' }) } }}>Open</button>{' '}
                <button className="ghost" onClick={async () => { await deleteWorkspace(w.id); void refresh() }}>Delete</button>
              </td>
            </tr>
          ))}
        </tbody></table>
      </div>
    </div>
  )
}
