import type { CauseId } from '../adapters'
import { THRESHOLDS } from '../adapters'
import { PACKS, getLang, type PackCard } from './i18n'
// Action cards come from the language packs (src/content/packs/*.json). The block below is a
// minimal English fallback so the app still works if a pack file is missing.
// ALL FALLBACK TEXT IS PLACEHOLDER (reviewed: false).
export interface Card {
  id: string
  cause: CauseId | 'any'
  costsMoney: boolean
  text: string
  pictogram: string
  reviewed: boolean
  /** true when the active language lacked this card and English text is shown */
  fallback: boolean
}
const PICTO: Record<string, string> = {
  leaf_rust: '🍂', other_leaf_disease: '🌿', insect_pest: '🐛', heavy_rain_damage: '🌧️', drought_at_flowering: '☀️',
  soil_acidity_or_nutrient: '🪨', old_trees_need_stumping: '🌳', normal_off_year: '🛑', unknown: '❓', any: '📝',
}
const f = (id: string, cause: string, costsMoney: boolean, text: string): PackCard => ({ id, cause, costsMoney, text: '[PLACEHOLDER] ' + text, reviewed: false })
const FALLBACK_CARDS: PackCard[] = [
  f('A01', 'leaf_rust', true, 'Leaf rust is likely. Ask the extension officer about a fungicide before you buy anything.'),
  f('A02', 'leaf_rust', false, 'Light rust. Prune to open the canopy and remove fallen leaves. Do not spray yet.'),
  f('A03', 'other_leaf_disease', false, 'A leaf disease is likely. Remove badly spotted leaves and keep the row clean.'),
  f('A04', 'insect_pest', false, 'Pest signs. Pick and destroy damaged berries, clean up fallen berries.'),
  f('A05', 'insect_pest', true, 'Heavy pest signs. Ask the officer about traps or control before buying.'),
  f('A06', 'heavy_rain_damage', false, 'Heavy rain damage. Dig drainage channels and mulch bare soil on the slope.'),
  f('A07', 'drought_at_flowering', false, 'Dry spell at flowering. Mulch around the trees and keep shade trees.'),
  f('A08', 'soil_acidity_or_nutrient', true, 'Soil may be too acidic or poor. Get a soil check, then ask the officer about lime or manure.'),
  f('A09', 'old_trees_need_stumping', false, 'Old trees. Plan to stump a part of the farm each year. Ask the officer how.'),
  f('A10', 'normal_off_year', false, 'Part of this drop is a normal off-year after a big harvest. Do not buy anything. Prune and mulch.'),
  f('A11', 'unknown', false, 'I am not sure. A person will look at your case. Wait for the reply.'),
  f('A12', 'any', false, 'General care: mulch, prune, keep rows clean and write down what you see each week.'),
]

/** All cards for the active language, English fills any gap. Sorted by id. */
export function allCards(): Card[] {
  const lang = getLang()
  const base = PACKS.en?.cards?.length ? PACKS.en.cards : FALLBACK_CARDS
  const own = new Map((PACKS[lang]?.cards ?? []).map((c) => [c.id.toUpperCase(), c]))
  const ids = new Set([...base.map((c) => c.id.toUpperCase()), ...own.keys()])
  const baseMap = new Map(base.map((c) => [c.id.toUpperCase(), c]))
  return [...ids].sort().map((id) => {
    const o = lang !== 'en' ? own.get(id) : undefined
    const src = (o && o.text ? o : baseMap.get(id) ?? o)!
    const useOwn = !!(o && o.text)
    return { id, cause: src.cause as Card['cause'], costsMoney: src.costsMoney, text: src.text,
      pictogram: PICTO[src.cause] ?? '📝', reviewed: !!src.reviewed && (lang === 'en' || useOwn), fallback: lang !== 'en' && !useOwn }
  })
}
export const getCard = (id: string): Card | undefined => allCards().find((c) => c.id === id.toUpperCase())
/** Kept for the officer page list. */
export const CARDS = new Proxy({} as Record<string, Card>, {
  get: (_, k: string) => getCard(k), ownKeys: () => allCards().map((c) => c.id),
  getOwnPropertyDescriptor: (_, k: string) => (getCard(k) ? { enumerable: true, configurable: true, value: getCard(k) } : undefined),
})

/** Pick one card for the detective's top cause. Money cards only when the detective's confidence allows
 *  (top >= THRESHOLDS.moneyTop). Falls back to the 'any' card. */
export function cardForCause(cause: CauseId, topP: number): Card {
  const all = allCards()
  const allowMoney = topP >= THRESHOLDS.moneyTop
  const mine = all.filter((c) => c.cause === cause && (allowMoney || !c.costsMoney))
  if (mine.length) return mine.find((c) => allowMoney === c.costsMoney) ?? mine[0]
  return all.find((c) => c.cause === 'any' && !c.costsMoney) ?? all.find((c) => c.cause === 'any') ?? all[0]
}

/** The card shown when the detective abstains: the 'any' escalation card. */
export function escalationCard(): Card {
  const all = allCards()
  return all.find((c) => c.cause === 'any' && !c.costsMoney) ?? all.find((c) => c.cause === 'unknown') ?? all[0]
}
