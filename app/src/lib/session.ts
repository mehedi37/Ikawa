import { useEffect, useState } from 'preact/hooks'
import type { Answers, DetectiveResult, PlotContext, VoiceTemplates } from '../adapters'
import type { Store } from '../store'
import type { Area, PlotExtra } from './plot'

export interface Shot { url: string; probs: number[] | null; gate: { ok: boolean; reason?: string } }
export interface Session {
  store: Store | null
  farmerId: string
  consents: { service: boolean | null; registry: boolean | null; photos: boolean | null }
  templates: VoiceTemplates | null
  worst: Shot[]
  good: Shot[]
  answers: Partial<Answers>
  plot: PlotContext | null
  plotExtra: PlotExtra | null
  area: Area | null
  /** '' = latest available rain date */
  asOf: string
  /** true when no leaf could be read: the detective was NOT called */
  cannotRead: boolean
  /** true when both bags look healthy and the detective abstained (UI state, see analyze.ts) */
  healthy: boolean
  result: DetectiveResult | null
  caseId: string | null
  sms: string | null
}
export const newFarmerId = () => 'F' + String(Math.floor(Math.random() * 10000)).padStart(4, '0')
const fresh = (store: Store | null): Session => ({
  store, farmerId: newFarmerId(), consents: { service: null, registry: null, photos: null },
  templates: null, worst: [], good: [], answers: {}, plot: null, plotExtra: null, area: null, asOf: '', cannotRead: false, healthy: false, result: null, caseId: null, sms: null,
})
export const session: Session = fresh(null)
const subs = new Set<() => void>()
export const update = (p: Partial<Session>) => { Object.assign(session, p); subs.forEach((f) => f()) }
export const resetCase = () => update({ ...fresh(session.store), store: session.store, area: session.area, asOf: session.asOf })
export function useSession(): Session {
  const [, force] = useState(0)
  useEffect(() => { const f = () => force((n) => n + 1); subs.add(f); return () => { subs.delete(f) } }, [])
  return session
}
