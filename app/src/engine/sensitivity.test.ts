import { describe, expect, it } from 'vitest'
import vignettes from '../../../detective/vignettes.json'
import { rank } from './detective'
import { DEFAULT_MODEL } from './priors'
import type { Model } from './priors'
import type { CauseId, DetectiveInput } from './types'

// Small seeded PRNG so the test is reproducible.
function mulberry32(a: number) {
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function perturb(m: Model, rnd: () => number, mag: number): Model {
  const j = (x: number) => x * (1 + (rnd() * 2 - 1) * mag)
  const priors = { ...m.priors }
  let s = 0
  for (const k of Object.keys(priors) as CauseId[]) { priors[k] = j(priors[k]); s += priors[k] }
  for (const k of Object.keys(priors) as CauseId[]) priors[k] /= s
  const factors: Model['factors'] = {}
  for (const [id, eff] of Object.entries(m.factors)) {
    factors[id] = {}
    for (const [c, v] of Object.entries(eff)) factors[id][c as CauseId] = j(v as number)
  }
  const leaf = { ...m.leaf, kRust: j(m.leaf.kRust), kOther: j(m.leaf.kOther), kMiner: j(m.leaf.kMiner), kHealthy: j(m.leaf.kHealthy) }
  return { priors, factors, leaf }
}

const cases = vignettes.cases as unknown as { id: string; input: DetectiveInput; expect: { abstain: boolean } }[]
const TRIALS = 500

describe('sensitivity: +-20% on every prior and likelihood', () => {
  const rows: string[] = []
  const flips: Record<string, number> = {}
  const abstainFlips: Record<string, number> = {}
  for (const c of cases) {
    const rnd = mulberry32(12345 + c.id.charCodeAt(2) * 31 + c.id.charCodeAt(1))
    const base = rank(c.input)
    let f = 0, af = 0
    for (let t = 0; t < TRIALS; t++) {
      const r = rank(c.input, perturb(DEFAULT_MODEL, rnd, 0.2))
      if (r.top !== base.top) f++
      if (r.abstain !== base.abstain) af++
    }
    flips[c.id] = f / TRIALS
    abstainFlips[c.id] = af / TRIALS
    rows.push(`${c.id} top=${base.top.padEnd(26)} topFlip=${(100 * f / TRIALS).toFixed(1).padStart(5)}%  abstainFlip=${(100 * af / TRIALS).toFixed(1).padStart(5)}%`)
  }
  it('reports flip rate per vignette', () => {
    console.log('\nSENSITIVITY (+-20%, ' + TRIALS + ' trials)\n' + rows.join('\n'))
    const mean = Object.values(flips).reduce((a, b) => a + b, 0) / cases.length
    console.log('mean top-cause flip rate: ' + (100 * mean).toFixed(1) + '%')
    expect(Object.keys(flips).length).toBe(cases.length)
  })
  it('perturbed outputs are still valid distributions', () => {
    const rnd = mulberry32(7)
    const r = rank(cases[0].input, perturb(DEFAULT_MODEL, rnd, 0.2))
    expect(r.causes.reduce((a, x) => a + x.p, 0)).toBeCloseTo(1, 9)
  })
  it('clear-cut cases (expected non-abstain) are mostly stable', () => {
    const clear = cases.filter((c) => !c.expect.abstain)
    const mean = clear.reduce((a, c) => a + flips[c.id], 0) / clear.length
    expect(mean).toBeLessThan(0.25)
  })
})
