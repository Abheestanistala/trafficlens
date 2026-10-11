import { useEffect, useMemo, useRef, useState } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import type { Session } from '../model/session'
import { hostOf, responseSize } from '../lib/filter/derive'
import { getHeader } from '../lib/http/headers'
import { BUILTIN_COLUMNS, usePrefs } from '../store/prefs'
import { firstColor, useCompiledRules } from '../lib/rules'
import { KindLabel, MethodBadge, StatusPill } from './Badges'
import { I } from './icons'
import { fmtBytes } from '../lib/stats'

const ROW = 28

const pathOf = (s: Session): string => {
  try {
    const u = new URL(s.request.url)
    return u.pathname + u.search
  } catch {
    return s.request.url
  }
}

const Meter = ({ value, max, label, slowAt }: { value: number; max: number; label: string; slowAt?: [number, number] }) => {
  const cls = slowAt ? (value > slowAt[1] ? 'vslow' : value > slowAt[0] ? 'slow' : '') : ''
  return (
    <div className={`meter num ${cls}`}>
      <span className="mv">{label}</span>
      <span className="mb" style={{ width: `${Math.max(2, (value / (max || 1)) * 100)}%` }} />
    </div>
  )
}

function ColumnChooser() {
  const { visibleColumns, setColumns, customColumns, addCustomColumn, removeCustomColumn } = usePrefs()
  const [open, setOpen] = useState(false)
  const [header, setHeader] = useState('')
  const [from, setFrom] = useState<'req' | 'res'>('res')
  const all = [...BUILTIN_COLUMNS.map((c) => ({ id: c.id as string, label: c.label as string })), ...customColumns.map((c) => ({ id: c.id, label: c.label }))]
  const toggle = (id: string) => setColumns(visibleColumns.includes(id) ? visibleColumns.filter((x) => x !== id) : all.map((c) => c.id).filter((x) => x === id || visibleColumns.includes(x)))
  return (
    <div style={{ position: 'relative' }}>
      <button className="ghost row" onClick={() => setOpen(!open)} aria-expanded={open} aria-haspopup="dialog" style={{ gap: 6 }}>
        <span style={{ width: 15, height: 15, display: 'inline-flex' }}>{I.cols}</span>Columns
      </button>
      {open && (
        <div className="pop" role="dialog" aria-label="Choose columns" style={{ top: 32, left: 0, width: 280 }}>
          {all.map((c) => (
            <label key={c.id} className="row" style={{ padding: '2px 0' }}>
              <input type="checkbox" checked={visibleColumns.includes(c.id)} onChange={() => toggle(c.id)} />
              <span className="grow1">{c.label}</span>
              {c.id.startsWith('c:') && <button className="ghost" aria-label={`Remove column ${c.label}`} onClick={() => removeCustomColumn(c.id)}>✕</button>}
            </label>
          ))}
          <div className="sectionh" style={{ marginTop: 10 }}>Add header column</div>
          <div className="row">
            <select value={from} onChange={(e) => setFrom(e.target.value as 'req' | 'res')} aria-label="Header source">
              <option value="res">Response</option>
              <option value="req">Request</option>
            </select>
            <input className="grow1" placeholder="e.g. server, x-request-id" value={header} onChange={(e) => setHeader(e.target.value)} aria-label="Header name" />
            <button disabled={!header.trim()} onClick={() => { addCustomColumn({ label: `${from === 'req' ? '→' : '←'} ${header.trim()}`, from, header: header.trim() }); setHeader('') }}>Add</button>
          </div>
        </div>
      )}
    </div>
  )
}

export function SessionGrid({ rows, selectedId, onSelect, extraTools }: { rows: Session[]; selectedId?: string; onSelect: (id: string) => void; extraTools?: React.ReactNode }) {
  const parent = useRef<HTMLDivElement>(null)
  const { visibleColumns, customColumns, rules } = usePrefs()
  const compiled = useCompiledRules(rules)
  const v = useVirtualizer({ count: rows.length, getScrollElement: () => parent.current, estimateSize: () => ROW, overscan: 15 })
  const idx = rows.findIndex((r) => r.id === selectedId)
  const cols = useMemo(() => {
    const builtin = BUILTIN_COLUMNS.filter((c) => visibleColumns.includes(c.id)).map((c) => ({ id: c.id as string, label: c.label as string, w: c.w as string }))
    const custom = customColumns.filter((c) => visibleColumns.includes(c.id)).map((c) => ({ id: c.id, label: c.label, w: '150px' }))
    return [...builtin, ...custom]
  }, [visibleColumns, customColumns])
  const template = cols.map((c) => c.w).join(' ')
  const maxSize = useMemo(() => rows.reduce((m, s) => Math.max(m, responseSize(s)), 0), [rows])
  const maxTime = useMemo(() => rows.reduce((m, s) => Math.max(m, s.timings.total ?? 0), 0), [rows])

  useEffect(() => {
    if (idx >= 0) v.scrollToIndex(idx, { align: 'auto' })
  }, [idx, v])

  const onKey = (e: React.KeyboardEvent) => {
    const d = e.key === 'ArrowDown' ? 1 : e.key === 'ArrowUp' ? -1 : e.key === 'PageDown' ? 10 : e.key === 'PageUp' ? -10 : e.key === 'Home' ? -1e9 : e.key === 'End' ? 1e9 : 0
    if (!d) return
    e.preventDefault()
    const next = Math.max(0, Math.min(rows.length - 1, (idx < 0 ? 0 : idx) + d))
    if (rows[next]) onSelect(rows[next].id)
  }

  const cell = (id: string, s: Session): React.ReactNode => {
    switch (id) {
      case 'seq': return <span className="num">{s.seq}</span>
      case 'status': return <StatusPill status={s.response.status} />
      case 'method': return <MethodBadge method={s.request.method} />
      case 'host': return <span className="url">{hostOf(s)}</span>
      case 'url': return <span className="url">{pathOf(s)}</span>
      case 'type': return <KindLabel s={s} />
      case 'size': return <Meter value={responseSize(s)} max={maxSize} label={fmtBytes(responseSize(s))} />
      case 'time': return s.timings.total != null ? <Meter value={s.timings.total} max={maxTime} label={`${Math.round(s.timings.total)} ms`} slowAt={[1000, 3000]} /> : null
      case 'process': return <span className="muted">{s.net.process ?? s.meta.comment ?? ''}</span>
      default: {
        const c = customColumns.find((x) => x.id === id)
        return <span className="url">{c ? getHeader(c.from === 'req' ? s.request.headers : s.response.headers, c.header) ?? '' : ''}</span>
      }
    }
  }

  return (
    <div className="gridwrap">
      <div className="gtools">
        <ColumnChooser />
        {extraTools}
        <span className="grow1" />
        <span className="muted">{rows.length.toLocaleString()} sessions</span>
      </div>
      <div className="grid" role="grid" aria-label="Sessions" aria-rowcount={rows.length}>
        <div className="grow ghead" style={{ gridTemplateColumns: template }} role="row">
          {cols.map((c) => <div key={c.id} role="columnheader">{c.label}</div>)}
        </div>
        <div ref={parent} className="gbody" tabIndex={0} onKeyDown={onKey}>
          <div style={{ height: v.getTotalSize(), position: 'relative' }}>
            {v.getVirtualItems().map((vi) => {
              const s = rows[vi.index]
              const color = firstColor(compiled.ok, s)
              return (
                <div
                  key={s.id}
                  role="row"
                  aria-selected={s.id === selectedId}
                  className={`grow ${vi.index % 2 ? 'alt' : ''} ${color ? `hl c-${color}` : ''} ${s.id === selectedId ? 'sel' : ''} ${s.request.method === 'CONNECT' ? 'dim' : ''}`}
                  style={{ gridTemplateColumns: template, top: 0, transform: `translateY(${vi.start}px)` }}
                  onClick={() => onSelect(s.id)}
                >
                  {cols.map((c) => <div key={c.id} role="gridcell" title={c.id === 'url' ? s.request.url : undefined}>{cell(c.id, s)}</div>)}
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}
