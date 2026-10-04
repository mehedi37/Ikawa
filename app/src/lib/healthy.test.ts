import { describe, it, expect } from 'vitest'
import { analyze, leavesLookHealthy, nonLeafCauses, HEALTHY_MIN_P, HEALTHY_MAX_CONTRAST } from './analyze'
import { healthyCard } from '../content/cards'
import type { Answers } from '../adapters'
import type { Shot } from './session'

const shot = (p: number[]): Shot => ({ url: '', probs: p, gate: { ok: true } })
const H = [0.95, 0.02, 0.01, 0.01, 0.005, 0.005]
const R = [0.05, 0.9, 0.02, 0.01, 0.01, 0.01]
const unsure: Answers = { lastSeasonHeavy: 2, flowersDropped: 2, bugSeen: 2, berryHoles: 2, treeAgeOver20: 2, wholeFarm: 2 }

describe('healthy-leaves UI state', () => {
  it('thresholds are named', () => { expect(HEALTHY_MIN_P).toBe(0.8); expect(HEALTHY_MAX_CONTRAST).toBe(0.1) })
  it('needs both bags healthy and a small contrast', () => {
    expect(leavesLookHealthy(H, H, 0)).toBe(true)
    expect(leavesLookHealthy(H, null, 0)).toBe(false)
    expect(leavesLookHealthy(R, H, 0.85)).toBe(false)
    expect(leavesLookHealthy(H, H, 0.2)).toBe(false)
  })
  it('all-healthy photos -> healthy state, non-leaf causes and a free card', () => {
    const a = analyze(Array(5).fill(shot(H)), Array(5).fill(shot(H)), unsure, null)
    expect(a.result.abstain).toBe(true)
    expect(a.healthy).toBe(true)
    const top = nonLeafCauses(a.result)
    expect(top.length).toBe(3)
    expect(top.map((c) => c.id)).not.toContain('leaf_rust')
    const c = healthyCard(top.map((x) => x.id))
    if (c) expect(c.costsMoney).toBe(false)
  })
  it('rust worst row is not the healthy state', () => {
    const a = analyze(Array(5).fill(shot(R)), Array(5).fill(shot(H)), unsure, null)
    expect(a.healthy).toBe(false)
  })
  it('healthyCard never returns a money card', () => {
    for (const cs of [['soil_acidity_or_nutrient'], ['insect_pest'], ['normal_off_year', 'soil_acidity_or_nutrient']] as const)
      expect(healthyCard([...cs])?.costsMoney ?? false).toBe(false)
    expect(healthyCard(['normal_off_year'])?.cause).toBe('normal_off_year')
  })
})
