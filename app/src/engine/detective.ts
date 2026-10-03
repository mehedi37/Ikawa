// Bayesian detective (D-007) + abstain rules (D-012). Pure, deterministic.
import { CAUSE_IDS } from './types'
import type { AbstainReason, Answers, CauseId, DetectiveInput, DetectiveResult } from './types'
import { DEFAULT_MODEL } from './priors'
import type { Model } from './priors'

export const THRESHOLDS = {
  visionTop: 0.6,
  topCause: 0.45,
  topTwoGap: 0.15,
  moneyTop: 0.75,
  /** wholeFarm=1 with contrast >= this is a contradiction (strong single-row difference) */
  contradictContrast: 0.5,
} as const

export const MONEY_CAUSES: readonly CauseId[] = ['leaf_rust', 'insect_pest', 'soil_acidity_or_nutrient']

const clamp = (x: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, x))

export function rank(input: DetectiveInput, model: Model = DEFAULT_MODEL): DetectiveResult {
  const { vision, answers, plot } = input
  const logp = {} as Record<CauseId, number>
  for (const c of CAUSE_IDS) logp[c] = Math.log(Math.max(model.priors[c], 1e-9))
  const evidence: string[] = []

  const applyFactor = (id: string) => {
    const eff = model.factors[id]
    if (!eff) return
    for (const c of CAUSE_IDS) {
      const m = eff[c]
      if (m !== undefined) logp[c] += Math.log(Math.max(m, 1e-9))
    }
    evidence.push(id)
  }

  const contrast = clamp(Number.isFinite(vision.contrast) ? vision.contrast : 0, 0, 1)
  const bag = vision.bagProbs
  const lp = model.leaf

  // --- leaf evidence (only when the photo was usable) ---
  if (vision.usable && bag.length === 6) {
    const w = lp.wFloor + (1 - lp.wFloor) * Math.min(1, contrast / lp.contrastFull)
    const base = 1 / 6
    const pr = bag[1]
    const pOther = bag[2] + bag[3]
    const pMiner = bag[4]
    const ph = bag[0]
    const dRust = lp.kRust * w * (pr - base)
    const dOther = lp.kOther * w * (pOther - 2 * base)
    const dMiner = lp.kMiner * w * (pMiner - base)
    const dHealthy = lp.kHealthy * w * (ph - base)
    logp.leaf_rust += dRust - dHealthy
    logp.other_leaf_disease += dOther - dHealthy
    logp.insect_pest += dMiner
    if (Math.abs(dRust) > 0.3) evidence.push(dRust > 0 ? 'leaf:rust_high' : 'leaf:rust_low')
    if (Math.abs(dOther) > 0.3) evidence.push(dOther > 0 ? 'leaf:other_disease_high' : 'leaf:other_disease_low')
    if (dMiner > 0.3) evidence.push('leaf:miner_high')
    if (dHealthy > 0.3) evidence.push('leaf:healthy_high')
    if (contrast < lp.contrastLow) applyFactor('contrast_low')
    else if (w >= 0.99) evidence.push('contrast:high')
  }

  // --- plot: rain and soil ---
  if (plot) {
    const d = plot.rainDaysOver40mm90d
    if (d >= 3) applyFactor('rain_wet_90d')
    if (d >= 6) applyFactor('rain_very_wet_90d')
    if (d === 0) applyFactor('rain_none_90d')
    const a = plot.rainAnomalyFloweringPct
    if (a <= -25) applyFactor('flowering_dry_strong')
    else if (a < -10) applyFactor('flowering_dry_mild')
    else applyFactor('flowering_normal')
    const ph = plot.soilPh
    if (ph !== null && Number.isFinite(ph)) {
      if (ph < 5.0) applyFactor('ph_low_strong')
      else if (ph < 5.4) applyFactor('ph_low_mild')
      else if (ph <= 6.5) applyFactor('ph_ok')
      else applyFactor('ph_high')
    }
  }

  // --- answers (2 = unsure = no evidence) ---
  const keys = Object.keys(answers) as (keyof Answers)[]
  for (const k of keys) {
    const v = answers[k]
    if (v === 0 || v === 1) {
      const id = `${k}_${v}`
      if (model.factors[id]) applyFactor(id)
    }
  }

  // --- normalise (softmax in log space; deterministic) ---
  const mx = Math.max(...CAUSE_IDS.map((c) => logp[c]))
  const raw = CAUSE_IDS.map((c) => Math.exp(logp[c] - mx))
  const z = raw.reduce((a, b) => a + b, 0)
  const causes = CAUSE_IDS.map((id, i) => ({ id, p: raw[i] / z }))
  // stable sort: ties keep CAUSE_IDS order
  causes.sort((a, b) => b.p - a.p)
  const top = causes[0].id

  // --- abstain rules (contracts.md §6) ---
  const reasons: AbstainReason[] = []
  if (!vision.usable) reasons.push('photo_unusable')
  else if (Math.max(...bag) < THRESHOLDS.visionTop) reasons.push('vision_low_conf')
  if (causes[0].p < THRESHOLDS.topCause) reasons.push('top_cause_low')
  if (causes[0].p - causes[1].p < THRESHOLDS.topTwoGap) reasons.push('top_two_close')
  if (answers.wholeFarm === 1 && vision.usable && contrast >= THRESHOLDS.contradictContrast) reasons.push('answers_contradict')
  if (top === 'unknown') reasons.push('top_is_unknown')
  if (MONEY_CAUSES.includes(top) && causes[0].p < THRESHOLDS.moneyTop) reasons.push('money_needs_high_conf')

  return {
    causes,
    top,
    abstain: reasons.length > 0,
    abstainReasons: reasons,
    evidence,
    notChecked: ['roots'],
  }
}

/** True when the off-year explains a meaningful share even if it is not the top cause. */
export function partlyOffYear(r: DetectiveResult, minP = 0.2): boolean {
  const c = r.causes.find((x) => x.id === 'normal_off_year')
  return !!c && c.p >= minP
}
