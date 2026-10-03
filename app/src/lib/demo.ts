import { session, update } from './session'
import { processBlob } from './shots'
import { DEMO_AREA, DEMO_SHORTCUT_DATE, nearestDate } from './plot'
import type { Answers } from '../adapters'

/** `?demo=1` preloads a scripted scenario so a video can be recorded without fumbling.
 *  `?demo=1&run=mite` (or the Home button) loads the second run: a leaf the app cannot read. */
export const demoMode = (): boolean => { try { return new URLSearchParams(location.search).get('demo') === '1' } catch { return false } }
export const demoRun = (): 'rust' | 'mite' => { try { return new URLSearchParams(location.search).get('run') === 'mite' ? 'mite' : 'rust' } catch { return 'rust' } }
export const DEMO_PIN = '1234'
// Scripted: worst row = leaf rust photos (or mite photos), good row = healthy photos, Kirinyaga demo area,
// rain as of the date closest to mid-May 2026 (after the April heavy rains).
export const DEMO_ANSWERS: Answers = { lastSeasonHeavy: 0, flowersDropped: 0, bugSeen: 0, berryHoles: 0, treeAgeOver20: 0, wholeFarm: 0 }
const BASE = import.meta.env.BASE_URL

export async function loadDemo(run: 'rust' | 'mite' = demoRun()) {
  const get = async (n: string) => processBlob(await (await fetch(`${BASE}demo/${n}.jpg`)).blob())
  const worstName = run === 'mite' ? 'mite' : 'rust'
  const worst = await Promise.all([1, 2, 3].map((i) => get(worstName + i)))
  const good = await Promise.all([1, 2, 3].map((i) => get('healthy' + i)))
  const consents = { service: true, registry: true, photos: true }
  update({ worst, good, answers: DEMO_ANSWERS, area: { ...DEMO_AREA, kind: 'demo' }, asOf: await nearestDate(DEMO_SHORTCUT_DATE), plot: null, plotExtra: null, result: null, cannotRead: false, farmerId: 'F0423', consents })
  await session.store?.putFarmer({ id: 'F0423', consents, createdAt: Date.now() })
}
