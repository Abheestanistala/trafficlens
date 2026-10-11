import { contentKind } from '../lib/filter/derive'
import type { Session } from '../model/session'
import { I } from './icons'

const statusIcon = (c: number) => (c === 2 ? I.check : c === 3 ? I.redirect : c === 4 ? I.warn : c === 5 ? I.cross : I.none)

/** Status is always icon + number, never colour alone. */
export const StatusPill = ({ status }: { status: number }) => {
  const c = Math.floor(status / 100)
  return (
    <span className={`pill s${c}`} title={`HTTP ${status || 'no response'}`}>
      {statusIcon(c)}
      {status || '—'}
    </span>
  )
}

export const MethodBadge = ({ method }: { method: string }) => <span className={`method m-${method.toUpperCase()}`}>{method}</span>

export const KindLabel = ({ s }: { s: Session }) => {
  const k = contentKind(s)
  return (
    <span className={`kind k-${k}`}>
      <i />
      {k === 'none' ? '' : k}
    </span>
  )
}
