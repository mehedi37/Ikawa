import { describe, expect, it } from 'vitest'
import { CAUSE_CODES, LEAF_CODES, decodeCase, encodeCase, parseOfficerReply, type CaseFile } from './smscodec'

let seed = 42
const rnd = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 2 ** 32)
const ri = (a: number, b: number) => a + Math.floor(rnd() * (b - a + 1))
const pick = <T,>(a: T[]) => a[ri(0, a.length - 1)]
const ans = () => ri(0, 2)

function randomCase(): CaseFile {
  return {
    farmerId: 'F' + String(ri(0, 999999)).padStart(ri(1, 6), '0').slice(0, 6),
    causes: Array.from({ length: ri(1, 3) }, () => ({ id: pick(Object.keys(CAUSE_CODES)) as never, p: ri(0, 100) / 100 })),
    vision: { top: pick(Object.keys(LEAF_CODES)) as never, prob: ri(0, 100) / 100, contrast: ri(0, 100) / 100 },
    soilPh: rnd() < 0.2 ? null : ri(0, 140) / 10,
    rainAnomalyPct: ri(-100, 999),
    rainDays: ri(0, 999),
    answers: { lastSeasonHeavy: ans(), flowersDropped: ans(), bugSeen: ans(), berryHoles: ans(), treeAgeOver20: ans(), wholeFarm: ans() } as never,
    lat: ri(-9000, 9000) / 100,
    lon: ri(-18000, 18000) / 100,
    escalation: ri(0, 15),
  }
}

const example: CaseFile = {
  farmerId: 'F0423',
  causes: [{ id: 'leaf_rust', p: 0.62 }, { id: 'heavy_rain_damage', p: 0.21 }, { id: 'old_trees_need_stumping', p: 0.12 }],
  vision: { top: 'leaf_rust', prob: 0.71, contrast: 0.48 },
  soilPh: 5.1, rainAnomalyPct: -38, rainDays: 2,
  answers: { lastSeasonHeavy: 1, flowersDropped: 0, bugSeen: 1, berryHoles: 2, treeAgeOver20: 0, wholeFarm: 1 } as never,
  lat: -2.48, lon: 29.1, escalation: 3,
}

describe('smscodec', () => {
  it('matches the contract example exactly', () => {
    expect(encodeCase(example)).toBe('IK1|F0423|R:LR62,HR21,OY12|V:LR.71/c.48|S:pH5.1|C:-38/2|Q:1,0,1,2,0,1|G:-2.48,29.1|E3')
    expect(decodeCase(encodeCase(example))).toEqual(example)
  })
  it('2000 random cases: <=160 chars, GSM-7 safe, lossless', () => {
    for (let i = 0; i < 2000; i++) {
      const c = randomCase()
      const s = encodeCase(c)
      expect(s.length).toBeLessThanOrEqual(160)
      expect(s).toMatch(/^[A-Za-z0-9|:,./\-]+$/)
      expect(decodeCase(s)).toEqual(c)
    }
  })
  it('rounds lat/lon to 2 decimals', () => {
    const d = decodeCase(encodeCase({ ...example, lat: -2.4849, lon: 29.1051 }))
    expect([d.lat, d.lon]).toEqual([-2.48, 29.11])
  })
  it('rejects malformed input clearly', () => {
    for (const bad of ['', 'hello', 'IK2|F1|R:LR1|V:LR.71/c.48|S:pH5.1|C:1/1|Q:1,0,1,2,0,1|G:1,1|E3',
      encodeCase(example).replace('LR62', 'ZZ62'), encodeCase(example).replace('Q:1,0,1,2,0,1', 'Q:1,0,1'),
      encodeCase(example).replace('E3', 'E99'), encodeCase(example).replace('G:-2.48', 'G:-92.48')])
      expect(() => decodeCase(bad)).toThrow(/smscodec/)
    expect(() => encodeCase({ ...example, farmerId: 'bob' })).toThrow(/farmerId/)
    expect(() => encodeCase({ ...example, escalation: 16 })).toThrow(/escalation/)
    expect(() => encodeCase({ ...example, causes: [] })).toThrow(/causes/)
  })
  it('parses officer replies', () => {
    expect(parseOfficerReply('A07')).toBe('A07')
    expect(parseOfficerReply(' a7 please')).toBe('A07')
    expect(parseOfficerReply('A31')).toBeNull()
    expect(parseOfficerReply('thanks')).toBeNull()
  })
})
