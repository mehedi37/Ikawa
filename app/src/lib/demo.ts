import { session, update } from './session'
import { processBlob } from './shots'
import { DEMO_AREA, DEMO_SHORTCUT_DATE, nearestDate } from './plot'
import type { Answers } from '../adapters'

/** `?demo=1` runs a guided demo with real field photos and scripted answers, in a separate throwaway
 *  database (DEMO_DB), so judges can see the whole flow without setting anything up.
 *  `&run=mite` loads a leaf the model cannot read; `&run=healthy` loads healthy leaves in both bags. */
export type DemoRun = 'rust' | 'mite' | 'healthy'
export const DEMO_RUNS: { run: DemoRun; title: string; outcome: string }[] = [
  { run: 'rust', title: 'A leaf-rust case', outcome: 'Ends on a ranked result and one action, read aloud.' },
  { run: 'mite', title: 'A leaf it cannot read', outcome: 'Mite damage it never learned, so it hands the case to a person.' },
  { run: 'healthy', title: 'Healthy leaves', outcome: 'The leaves look fine, so it looks past them, to the heavy April rains.' },
]
const param = (k: string) => { try { return new URLSearchParams(location.search).get(k) } catch { return null } }
export const demoMode = (): boolean => param('demo') === '1'
export const demoRun = (): DemoRun => { const r = param('run'); return r === 'mite' || r === 'healthy' ? r : 'rust' }
/** Link that starts a demo run from a clean page load. */
export const demoHref = (run: DemoRun) => `${import.meta.env.BASE_URL}?demo=1${run === 'rust' ? '' : `&run=${run}`}#/photos`
/** Leaves the demo: back to the real app and its PIN-protected store. */
export const exitDemoHref = () => `${import.meta.env.BASE_URL}#/home`
export const DEMO_PIN = '1234'

/** One line per screen, shown only in the demo: what is pre-filled and what to look at. */
export const DEMO_TIPS: Record<string, string> = {
  photos: 'In the field, the agent photographs 5 leaves per bag. Real photos from field datasets are already loaded here. Tap Next.',
  questions: 'Six picture questions, answered by voice or tap. Answer anything; the evidence comes mostly from the leaves and the rain.',
  result: 'This is the decision screen. Open "Why I think so" to see every piece of evidence it used.',
  escalate: 'The whole case fits in one SMS. Copy it, then paste it into the officer page to see the other side.',
}

// Scripted answers: nothing unusual reported, so the leaves and the rain carry the evidence.
export const DEMO_ANSWERS: Answers = { lastSeasonHeavy: 0, flowersDropped: 0, bugSeen: 0, berryHoles: 0, treeAgeOver20: 0, wholeFarm: 0 }
const BASE = import.meta.env.BASE_URL

export async function loadDemo(run: DemoRun = demoRun()) {
  const get = async (n: string) => processBlob(await (await fetch(`${BASE}demo/${n}.jpg`)).blob())
  const worstName = run === 'mite' ? 'mite' : run === 'healthy' ? 'healthy' : 'rust'
  const worst = await Promise.all([1, 2, 3].map((i) => get(worstName + i)))
  const good = await Promise.all([1, 2, 3].map((i) => get('healthy' + i)))
  const consents = { service: true, registry: true, photos: true }
  update({ worst, good, answers: DEMO_ANSWERS, area: { ...DEMO_AREA, kind: 'demo' }, asOf: await nearestDate(DEMO_SHORTCUT_DATE), plot: null, plotExtra: null, result: null, cannotRead: false, farmerId: 'F0423', consents })
  await session.store?.putFarmer({ id: 'F0423', consents, createdAt: Date.now() })
}
