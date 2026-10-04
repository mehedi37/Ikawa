import { rank, CAUSE_IDS, type Answers, type DetectiveResult, type PlotContext, type CaseFile } from '../adapters'
import type { Shot } from './session'

const mean = (rows: number[][]) => rows[0].map((_, i) => rows.reduce((s, r) => s + r[i], 0) / rows.length)
const disease = (p: number[]) => p[1] + p[2] + p[3] + p[4] // rust, cercospora, phoma, leaf_miner
export const MIN_LEAVES = 3
export const TARGET_LEAVES = 5

const argmax = (a: number[]) => a.reduce((k, p, i) => (p > a[k] ? i : k), 0)
const NOT_COFFEE = 5

/** True when the worst-row leaves cannot be read: too few usable photos, or the top class is not_coffee (D-031). */
export function cannotRead(worst: Shot[]): boolean {
  const w = worst.filter((s) => s.gate.ok && s.probs).map((s) => s.probs!)
  return w.length < MIN_LEAVES || argmax(mean(w)) === NOT_COFFEE
}

/** The detective is only called with a usable bag. Otherwise we return a fixed 'cannot read' result
 *  (abstain, reason photo_unusable => SMS escalation bit 1) without calling rank(). */
export function analyze(worst: Shot[], good: Shot[], answers: Answers, plot: PlotContext | null): { result: DetectiveResult; bag: number[]; contrast: number; cannotRead: boolean; healthy: boolean } {
  const w = worst.filter((s) => s.gate.ok && s.probs).map((s) => s.probs!)
  const g = good.filter((s) => s.gate.ok && s.probs).map((s) => s.probs!)
  const bag = w.length ? mean(w) : [0, 0, 0, 0, 0, 1]
  if (cannotRead(worst)) {
    const ids = CAUSE_IDS.filter((c) => c !== 'unknown')
    const result: DetectiveResult = {
      causes: [{ id: 'unknown', p: 1 }, ...ids.map((id) => ({ id, p: 0 }))], top: 'unknown', abstain: true,
      abstainReasons: ['photo_unusable'], evidence: [], notChecked: ['leaf', 'roots', ...(plot ? [] : ['no_plot_data'])],
    }
    return { result, bag, contrast: 0, cannotRead: true, healthy: false }
  }
  const contrast = g.length ? Math.min(1, Math.max(0, disease(bag) - disease(mean(g)))) : 0
  const result = rank({ vision: { bagProbs: bag, contrast, usable: true }, answers, plot })
  if (!plot && !result.notChecked.includes('no_plot_data')) result.notChecked = [...result.notChecked, 'no_plot_data']
  const healthy = result.abstain && leavesLookHealthy(bag, g.length >= MIN_LEAVES ? mean(g) : null, contrast)
  return { result, bag, contrast, cannotRead: false, healthy }
}

/** UI-level "your leaves look healthy" state (the detective is untouched). Both bags must look healthy:
 *  mean P(healthy) >= HEALTHY_MIN_P in the worst-row bag AND in the good-row bag, and the worst-vs-good
 *  contrast (contracts.md section 11) must be at most HEALTHY_MAX_CONTRAST. */
export const HEALTHY_MIN_P = 0.8
export const HEALTHY_MAX_CONTRAST = 0.1
export function leavesLookHealthy(worstBag: number[], goodBag: number[] | null, contrast: number): boolean {
  return !!goodBag && worstBag[0] >= HEALTHY_MIN_P && goodBag[0] >= HEALTHY_MIN_P && contrast <= HEALTHY_MAX_CONTRAST
}
/** Causes a leaf photo can speak to; the healthy state lists only the others. */
export const LEAF_CAUSES = ['leaf_rust', 'other_leaf_disease'] as const
export function nonLeafCauses(r: DetectiveResult, n = 3): { id: DetectiveResult['top']; p: number }[] {
  return r.causes.filter((c) => !(LEAF_CAUSES as readonly string[]).includes(c.id) && c.id !== 'unknown').slice(0, n)
}

export function escalationMask(r: DetectiveResult): number {
  const a = r.abstainReasons
  return (a.includes('photo_unusable') ? 1 : 0) | (a.includes('vision_low_conf') ? 2 : 0) |
    (a.some((x) => ['top_cause_low', 'top_two_close', 'top_is_unknown', 'money_needs_high_conf'].includes(x)) ? 4 : 0) |
    (a.includes('answers_contradict') ? 8 : 0)
}

export const LEAF_NAMES = ['healthy', 'leaf_rust', 'cercospora', 'phoma', 'leaf_miner', 'not_coffee'] as const

export function toCaseFile(farmerId: string, r: DetectiveResult, bag: number[], contrast: number, answers: Answers, plot: PlotContext | null): CaseFile {
  let k = 0; bag.forEach((p, i) => { if (p > bag[k]) k = i })
  return {
    farmerId,
    causes: r.causes.slice(0, 3).map((c) => ({ id: c.id, p: c.p })),
    vision: { top: LEAF_NAMES[k], prob: bag[k], contrast },
    soilPh: plot?.soilPh ?? null, rainAnomalyPct: Math.round(plot?.rainAnomalyFloweringPct ?? 0),
    rainDays: plot?.rainDaysOver40mm90d ?? 0, answers, lat: plot?.lat ?? 0, lon: plot?.lon ?? 0,
    escalation: escalationMask(r),
  }
}
