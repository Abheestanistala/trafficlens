import { wrap } from 'comlink'
import type { ParseApi } from './parse.worker'
import type { Session } from '../model/session'
import type { Hit, SearchOpts } from '../lib/search'

let api: ReturnType<typeof wrap<ParseApi>> | undefined
const w = () => (api ??= wrap<ParseApi>(new Worker(new URL('./parse.worker.ts', import.meta.url), { type: 'module' })))

export const parseFile = async (file: File, uniqueName: string, prefix: string, baseSeq: number): Promise<Session[]> =>
  w().parse(uniqueName, await file.arrayBuffer(), prefix, baseSeq)
export const restoreSessions = (s: Session[]) => w().restore(s)
export const resetWorker = () => w().reset()
export const searchInWorker = (q: string, o: SearchOpts): Promise<Hit[]> => w().search(q, o)
