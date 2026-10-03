// Voice answers by template matching (contracts.md §9, D-006): MFCC + DTW, no ASR.
import Meyda from 'meyda'

export type Word = 'yes' | 'no' | 'unsure'
export const WORDS: Word[] = ['yes', 'no', 'unsure']
export type Mfcc = number[][] // frames x NUM_COEFFS
export type VoiceTemplates = Record<Word, Mfcc[]>
export interface VoiceResult {
  word: Word | null
  distances: Record<Word, number>
  confident: boolean
}

export const NUM_COEFFS = 13
export const WINDOW_MS = 25
export const HOP_MS = 10
/** Sakoe-Chiba band half-width as a fraction of the longer sequence (never below the length gap). */
export const DTW_BAND_FRACTION = 0.3
/** Nearest distance must be below this fraction of the 2nd-best word's distance. */
export const CONFIDENCE_RATIO_MAX = 0.8
/** Nearest distance (normalised DTW) must be below this absolute ceiling. */
export const CONFIDENCE_DISTANCE_MAX = 2.6
/** Frames whose RMS is below this fraction of the clip's loudest frame count as silence. */
export const SILENCE_GATE_FRACTION = 0.2
/** Clips whose loudest frame RMS is below this are treated as empty. */
export const MIN_SPEECH_RMS = 1e-3

const nextPow2 = (n: number) => 2 ** Math.ceil(Math.log2(n))

/** Trim leading/trailing silence with an energy gate; returns the voiced span of frame indices. */
function frameRms(frames: Float32Array[]): number[] {
  return frames.map((f) => {
    let s = 0
    for (let i = 0; i < f.length; i++) s += f[i] * f[i]
    return Math.sqrt(s / f.length)
  })
}

export function extractMfcc(samples: Float32Array, sampleRate: number): Mfcc {
  const win = Math.round((WINDOW_MS / 1000) * sampleRate)
  const hop = Math.round((HOP_MS / 1000) * sampleRate)
  const size = nextPow2(win)
  const frames: Float32Array[] = []
  for (let start = 0; start + win <= samples.length; start += hop) {
    const f = new Float32Array(size) // zero-padded to power of two (Meyda requirement)
    f.set(samples.subarray(start, start + win))
    frames.push(f)
  }
  if (frames.length === 0) return []
  const rms = frameRms(frames)
  const peak = Math.max(...rms)
  if (peak < MIN_SPEECH_RMS) return []
  const gate = peak * SILENCE_GATE_FRACTION
  let lo = 0
  let hi = frames.length - 1
  while (lo < hi && rms[lo] < gate) lo++
  while (hi > lo && rms[hi] < gate) hi--
  const M = Meyda as unknown as Record<string, unknown> & {
    extract: (f: string, s: Float32Array) => number[] | null
  }
  M.bufferSize = size
  M.sampleRate = sampleRate
  M.numberOfMFCCCoefficients = NUM_COEFFS
  M.melBands = 26
  M.windowingFunction = 'hanning'
  const out: Mfcc = []
  for (let i = lo; i <= hi; i++) {
    const c = M.extract('mfcc', frames[i])
    if (c) out.push(Array.from(c).slice(0, NUM_COEFFS).map((v) => (Number.isFinite(v) ? v : 0)))
  }
  return normalise(out)
}

/** Per-utterance mean/variance normalisation of each coefficient. */
function normalise(m: Mfcc): Mfcc {
  if (m.length === 0) return m
  const n = m.length
  const out = m.map((r) => r.slice())
  for (let k = 0; k < NUM_COEFFS; k++) {
    let mean = 0
    for (let i = 0; i < n; i++) mean += m[i][k]
    mean /= n
    let v = 0
    for (let i = 0; i < n; i++) v += (m[i][k] - mean) ** 2
    const sd = Math.sqrt(v / n) || 1
    for (let i = 0; i < n; i++) out[i][k] = (m[i][k] - mean) / sd
  }
  return out
}

/** DTW with Sakoe-Chiba band. Returns path cost normalised by path length (Euclidean frame distance / sqrt(dim)). */
export function dtw(a: Mfcc, b: Mfcc): number {
  const n = a.length
  const m = b.length
  if (n === 0 || m === 0) return Infinity
  const band = Math.max(Math.ceil(DTW_BAND_FRACTION * Math.max(n, m)), Math.abs(n - m))
  const dim = a[0].length
  const INF = Infinity
  let prev = new Float64Array(m + 1).fill(INF)
  let prevLen = new Float64Array(m + 1)
  prev[0] = 0
  for (let i = 1; i <= n; i++) {
    const cur = new Float64Array(m + 1).fill(INF)
    const curLen = new Float64Array(m + 1)
    const jc = Math.round((i * m) / n)
    const jlo = Math.max(1, jc - band)
    const jhi = Math.min(m, jc + band)
    for (let j = jlo; j <= jhi; j++) {
      let d = 0
      for (let k = 0; k < dim; k++) {
        const x = a[i - 1][k] - b[j - 1][k]
        d += x * x
      }
      d = Math.sqrt(d / dim)
      let best = prev[j - 1]
      let bl = prevLen[j - 1]
      if (prev[j] < best) { best = prev[j]; bl = prevLen[j] }
      if (cur[j - 1] < best) { best = cur[j - 1]; bl = curLen[j - 1] }
      if (best === INF) continue
      cur[j] = best + d
      curLen[j] = bl + 1
    }
    prev = cur
    prevLen = curLen
  }
  return prev[m] === INF ? INF : prev[m] / prevLen[m]
}

export function classify(clipMfcc: Mfcc, templates: VoiceTemplates): VoiceResult {
  const distances = { yes: Infinity, no: Infinity, unsure: Infinity } as Record<Word, number>
  for (const w of WORDS) for (const t of templates[w] ?? []) distances[w] = Math.min(distances[w], dtw(clipMfcc, t))
  const ranked = WORDS.filter((w) => Number.isFinite(distances[w])).sort((x, y) => distances[x] - distances[y])
  if (ranked.length === 0) return { word: null, distances, confident: false }
  const best = ranked[0]
  const second = ranked.length > 1 ? distances[ranked[1]] : Infinity
  const confident =
    distances[best] < CONFIDENCE_DISTANCE_MAX &&
    (ranked.length < 2 || distances[best] < CONFIDENCE_RATIO_MAX * second)
  return { word: confident ? best : null, distances, confident }
}
