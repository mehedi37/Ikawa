import { describe, expect, it } from 'vitest'
import { classify, dtw, extractMfcc, WORDS, type VoiceTemplates, type Word } from './voice'

const SR = 16000
let seed = 7
const rnd = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 2 ** 32)
const gauss = () => Math.sqrt(-2 * Math.log(rnd() + 1e-12)) * Math.cos(2 * Math.PI * rnd())

// A "word" = sequence of segments: [f1 Hz, f2 Hz, noisiness 0..1, relative duration]
const DEFS: Record<Word, number[][]> = {
  yes: [[300, 2200, 0.0, 1], [700, 1200, 0.0, 1.5], [4000, 4500, 0.9, 0.8]],
  no: [[250, 800, 0.0, 1.6], [500, 900, 0.0, 1.4]],
  unsure: [[3500, 5000, 0.8, 0.8], [400, 1900, 0.0, 1], [900, 1300, 0.0, 1], [350, 700, 0.0, 1.2]],
}

function synth(word: Word, pitch: number, stretch: number, noiseSnr: number | null): Float32Array {
  const segs = DEFS[word]
  const pre = Math.round(0.15 * SR)
  const parts: number[] = new Array(pre).fill(0)
  let ph1 = 0, ph2 = 0
  for (const [f1, f2, nz, dur] of segs) {
    const n = Math.round(0.14 * dur * stretch * SR)
    for (let i = 0; i < n; i++) {
      const env = Math.sin((Math.PI * (i + 0.5)) / n) ** 0.5
      ph1 += (2 * Math.PI * f1 * pitch) / SR
      ph2 += (2 * Math.PI * f2 * pitch) / SR
      const tone = Math.sin(ph1) + 0.6 * Math.sin(ph2)
      parts.push(env * ((1 - nz) * tone + nz * gauss() * 1.2) * 0.3)
    }
  }
  for (let i = 0; i < pre; i++) parts.push(0)
  const x = Float32Array.from(parts)
  let p = 0
  for (const v of x) p += v * v
  p /= x.length
  const sigma = noiseSnr === null ? 0.0005 : Math.sqrt(p / 10 ** (noiseSnr / 10))
  for (let i = 0; i < x.length; i++) x[i] += gauss() * sigma
  return x
}

const mf = (w: Word, pitch: number, stretch: number, snr: number | null) => extractMfcc(synth(w, pitch, stretch, snr), SR)

function enrol(pitch: number): VoiceTemplates {
  const t = { yes: [], no: [], unsure: [] } as VoiceTemplates
  for (const w of WORDS) for (const s of [0.95, 1.05]) t[w].push(mf(w, pitch, s, null))
  return t
}

function accuracy(snr: number | null, trials = 30): { acc: number; conf: number } {
  let ok = 0, conf = 0, n = 0
  for (let sp = 0; sp < 3; sp++) {
    const basePitch = [1, 0.85, 1.2][sp] // different "speakers" via pitch shift
    const tpl = enrol(basePitch)
    for (let t = 0; t < trials / 3; t++)
      for (const w of WORDS) {
        const r = classify(mf(w, basePitch * (0.95 + rnd() * 0.1), 0.8 + rnd() * 0.5, snr), tpl)
        const best = WORDS.slice().sort((a, b) => r.distances[a] - r.distances[b])[0]
        if (best === w) ok++
        if (r.confident) conf++
        n++
      }
  }
  return { acc: ok / n, conf: conf / n }
}

describe('voice', () => {
  it('extracts 13-coeff MFCC frames with silence trimmed', () => {
    const m = mf('yes', 1, 1, null)
    expect(m[0]).toHaveLength(13)
    const total = Math.floor((synth('yes', 1, 1, null).length - 400) / 160) + 1
    expect(m.length).toBeLessThan(total)
    expect(m.length).toBeGreaterThan(20)
  })
  it('dtw: identical = 0, symmetric-ish, time-warp tolerant', () => {
    const a = mf('yes', 1, 1, null), b = mf('yes', 1, 1.3, null), c = mf('no', 1, 1, null)
    expect(dtw(a, a)).toBeCloseTo(0, 6)
    expect(dtw(a, b)).toBeLessThan(dtw(a, c))
  })
  it('classifies >= 90% across simulated speakers and stretches (clean)', () => {
    const { acc } = accuracy(null)
    expect(acc).toBeGreaterThanOrEqual(0.9)
  })
  it('degrades gracefully with noise', () => {
    const clean = accuracy(null).acc, mid = accuracy(10).acc, bad = accuracy(0).acc
    console.log('accuracy clean/10dB/0dB', clean, mid, bad)
    expect(mid).toBeGreaterThanOrEqual(0.75)
    expect(bad).toBeLessThanOrEqual(clean + 0.02)
    expect(bad).toBeGreaterThan(1 / 3)
  })
  it('is confident on clean words', () => {
    expect(accuracy(null).conf).toBeGreaterThan(0.8)
  })
  it('confident=false on pure noise and on silence', () => {
    const tpl = enrol(1)
    for (let i = 0; i < 20; i++) {
      const noise = Float32Array.from({ length: SR }, () => gauss() * 0.1)
      const r = classify(extractMfcc(noise, SR), tpl)
      expect(r.confident).toBe(false)
      expect(r.word).toBeNull()
    }
    const r = classify(extractMfcc(new Float32Array(SR), SR), tpl)
    expect(r.confident).toBe(false)
  })
})
