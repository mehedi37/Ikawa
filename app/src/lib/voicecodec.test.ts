import { describe, it, expect } from 'vitest'
import { encodeTemplates, decodeTemplates, packClip, unpackClip } from './voicecodec'
import type { Mfcc, VoiceTemplates } from '../adapters'

// ~1 s clip at 10 ms hop: 100 frames x 13 coefficients = 1300 numbers, like a real recording.
const clip = (seed: number): Mfcc => Array.from({ length: 100 }, (_, i) => Array.from({ length: 13 }, (_, j) => Math.sin(seed * 7.13 + i * 0.37 + j * 1.91) * 25.123456789))
const T: VoiceTemplates = { yes: [clip(1), clip(2)], no: [clip(3), clip(4)], unsure: [clip(5), clip(6)] }

describe('voice template codec', () => {
  it('round-trips within float32 precision', () => {
    const back = decodeTemplates(JSON.parse(JSON.stringify(encodeTemplates(T))))!
    for (const w of ['yes', 'no', 'unsure'] as const) {
      expect(back[w].length).toBe(2)
      back[w].forEach((m, k) => {
        expect(m.length).toBe(100)
        m.forEach((row, i) => row.forEach((x, j) => expect(x).toBeCloseTo(Math.fround(T[w][k][i][j]), 6)))
      })
    }
  })
  it('is at least 3x smaller than the JSON number-array format', () => {
    const old = JSON.stringify(T).length, packed = JSON.stringify(encodeTemplates(T)).length
    console.log(`voice templates per farmer: JSON arrays ${old} B -> packed ${packed} B (${(old / packed).toFixed(1)}x)`)
    expect(packed * 3).toBeLessThan(old)
  })
  it('still reads the old number-array format', () => {
    const back = decodeTemplates(JSON.parse(JSON.stringify(T)))!
    expect(back.yes[0]).toEqual(T.yes[0])
  })
  it('handles empty and invalid input', () => {
    expect(unpackClip(packClip([]))).toEqual([])
    expect(decodeTemplates(null)).toBeNull()
    expect(decodeTemplates({})).toEqual({ yes: [], no: [], unsure: [] })
  })
})
