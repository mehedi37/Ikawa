import { describe, expect, it } from 'vitest'
import vignettes from '../../../detective/vignettes.json'
import { rank, THRESHOLDS, partlyOffYear } from './detective'
import { CAUSE_IDS } from './types'
import type { DetectiveInput } from './types'
import { PRIORS, FACTORS, UNVERIFIED, SOURCES } from './priors'

const cases = vignettes.cases as unknown as {
  id: string
  synthetic: boolean
  rationale: string
  input: DetectiveInput
  expect: { top?: string; abstain: boolean; reasons?: string[] }
}[]

describe('vignettes (SYNTHETIC)', () => {
  it('has about 30 cases, all labelled synthetic', () => {
    expect(cases.length).toBeGreaterThanOrEqual(28)
    expect(cases.every((c) => c.synthetic === true && c.rationale.length > 10)).toBe(true)
  })
  for (const c of cases) {
    it(`${c.id}: ${c.rationale}`, () => {
      const r = rank(c.input)
      if (c.expect.abstain) {
        expect(r.abstain, JSON.stringify(r.causes.slice(0, 3))).toBe(true)
        if (c.expect.reasons?.length) expect(c.expect.reasons.some((x) => r.abstainReasons.includes(x as never)), `want any of ${c.expect.reasons}, got ${r.abstainReasons}`).toBe(true)
      } else {
        expect(r.abstain, JSON.stringify([r.abstainReasons, r.causes.slice(0, 3)])).toBe(false)
        expect(r.top).toBe(c.expect.top)
      }
    })
  }
})

describe('invariants', () => {
  for (const c of cases) {
    it(`${c.id} sums to 1, sorted, deterministic, notChecked has roots`, () => {
      const r = rank(c.input)
      expect(r.causes.reduce((a, x) => a + x.p, 0)).toBeCloseTo(1, 9)
      expect(r.causes.length).toBe(CAUSE_IDS.length)
      for (let i = 1; i < r.causes.length; i++) expect(r.causes[i - 1].p).toBeGreaterThanOrEqual(r.causes[i].p)
      expect(rank(c.input)).toEqual(r)
      expect(r.notChecked).toContain('roots')
      expect(r.top).toBe(r.causes[0].id)
    })
  }
})

describe('specific behaviour', () => {
  const healthy = [0.88, 0.03, 0.03, 0.02, 0.02, 0.02]
  const base = (o: Partial<DetectiveInput['answers']> = {}): DetectiveInput => ({
    vision: { bagProbs: healthy, contrast: 0.05, usable: true },
    answers: { lastSeasonHeavy: 2, flowersDropped: 2, bugSeen: 2, berryHoles: 2, treeAgeOver20: 2, wholeFarm: 2, ...o },
    plot: null,
  })
  it('unsure answers equal missing evidence', () => {
    const a = rank(base())
    expect(a.evidence.filter((e) => e.includes('_'))).not.toContain('bugSeen_1')
    expect(a.evidence.some((e) => /^(lastSeasonHeavy|flowersDropped|bugSeen|berryHoles|treeAgeOver20|wholeFarm)_/.test(e))).toBe(false)
  })
  it('lastSeasonHeavy raises normal_off_year', () => {
    const p = (r: ReturnType<typeof rank>) => r.causes.find((c) => c.id === 'normal_off_year')!.p
    expect(p(rank(base({ lastSeasonHeavy: 1 })))).toBeGreaterThan(p(rank(base())))
  })
  it('can say "partly a normal off-year"', () => {
    expect(partlyOffYear(rank(base({ lastSeasonHeavy: 1 })))).toBe(true)
  })
  it('low contrast weakens rust', () => {
    const rust = [0.05, 0.85, 0.03, 0.02, 0.03, 0.02]
    const pr = (c: number) => rank({ ...base(), vision: { bagProbs: rust, contrast: c, usable: true } }).causes.find((x) => x.id === 'leaf_rust')!.p
    expect(pr(0.6)).toBeGreaterThan(pr(0.02))
  })
  it('money rule: leaf_rust top under 0.75 abstains', () => {
    const r = rank({ ...base(), vision: { bagProbs: [0.2, 0.55, 0.1, 0.05, 0.05, 0.05], contrast: 0.3, usable: true } })
    if (r.top === 'leaf_rust' && r.causes[0].p < THRESHOLDS.moneyTop) expect(r.abstainReasons).toContain('money_needs_high_conf')
  })
  it('unusable photo abstains and ignores leaf evidence', () => {
    const r = rank({ ...base(), vision: { bagProbs: [0, 1, 0, 0, 0, 0], contrast: 0.9, usable: false } })
    expect(r.abstainReasons).toContain('photo_unusable')
    expect(r.evidence.some((e) => e.startsWith('leaf:'))).toBe(false)
  })
  it('thresholds match D-012', () => {
    expect(THRESHOLDS.visionTop).toBe(0.6)
    expect(THRESHOLDS.topCause).toBe(0.45)
    expect(THRESHOLDS.topTwoGap).toBe(0.15)
    expect(THRESHOLDS.moneyTop).toBe(0.75)
  })
})

describe('priors honesty', () => {
  it('every prior and factor has a source that is a known URL or UNVERIFIED', () => {
    const known = new Set<string>([UNVERIFIED, ...Object.values(SOURCES)])
    for (const p of Object.values(PRIORS)) expect(known.has(p.source)).toBe(true)
    for (const f of Object.values(FACTORS)) expect(known.has(f.source)).toBe(true)
  })
  it('priors sum to 1', () => {
    expect(Object.values(PRIORS).reduce((a, p) => a + p.value, 0)).toBeCloseTo(1, 9)
  })
})
