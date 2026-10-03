// Photo gate: plain rules, no AI (contracts.md §2).
export interface GateImage {
  data: Uint8ClampedArray
  width: number
  height: number
}
export interface PhotoGate {
  ok: boolean
  reason?: 'blurry' | 'too_dark' | 'too_bright'
}

/** Variance of the Laplacian below this => blurry (greyscale 0..255 scale). */
export const BLUR_VARIANCE_MIN = 60
/** Mean greyscale brightness below this => too dark. */
export const BRIGHTNESS_MIN = 45
/** Mean greyscale brightness above this => too bright. */
export const BRIGHTNESS_MAX = 220

function toGrey(img: GateImage): Float32Array {
  const { data, width, height } = img
  const g = new Float32Array(width * height)
  for (let i = 0; i < g.length; i++) {
    g[i] = 0.299 * data[i * 4] + 0.587 * data[i * 4 + 1] + 0.114 * data[i * 4 + 2]
  }
  return g
}

export function meanBrightness(img: GateImage): number {
  const g = toGrey(img)
  let s = 0
  for (let i = 0; i < g.length; i++) s += g[i]
  return g.length ? s / g.length : 0
}

export function laplacianVariance(img: GateImage): number {
  const { width: w, height: h } = img
  if (w < 3 || h < 3) return 0
  const g = toGrey(img)
  let sum = 0
  let sumSq = 0
  let n = 0
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const i = y * w + x
      const l = g[i - 1] + g[i + 1] + g[i - w] + g[i + w] - 4 * g[i]
      sum += l
      sumSq += l * l
      n++
    }
  }
  const mean = sum / n
  return sumSq / n - mean * mean
}

export function photoGate(img: GateImage): PhotoGate {
  if (img.width * img.height === 0 || img.data.length < img.width * img.height * 4) {
    return { ok: false, reason: 'blurry' }
  }
  const b = meanBrightness(img)
  if (b < BRIGHTNESS_MIN) return { ok: false, reason: 'too_dark' }
  if (b > BRIGHTNESS_MAX) return { ok: false, reason: 'too_bright' }
  if (laplacianVariance(img) < BLUR_VARIANCE_MIN) return { ok: false, reason: 'blurry' }
  return { ok: true }
}
