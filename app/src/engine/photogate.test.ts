import { describe, expect, it } from 'vitest'
import { photoGate } from './photogate'

function make(w: number, h: number, f: (x: number, y: number) => number) {
  const data = new Uint8ClampedArray(w * h * 4)
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const v = f(x, y)
      const i = (y * w + x) * 4
      data[i] = data[i + 1] = data[i + 2] = v
      data[i + 3] = 255
    }
  return { data, width: w, height: h }
}
let seed = 1
const rnd = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 2 ** 32)
const texture = (x: number, y: number) => 128 + (((x >> 1) + (y >> 1)) % 2 ? 50 : -50) + (rnd() - 0.5) * 20

function blur(img: ReturnType<typeof make>, r: number) {
  const { width: w, height: h } = img
  const out = make(w, h, (x, y) => {
    let s = 0, n = 0
    for (let dy = -r; dy <= r; dy++)
      for (let dx = -r; dx <= r; dx++) {
        const xx = Math.min(w - 1, Math.max(0, x + dx)), yy = Math.min(h - 1, Math.max(0, y + dy))
        s += img.data[(yy * w + xx) * 4]; n++
      }
    return s / n
  })
  return out
}

describe('photoGate', () => {
  const sharp = make(96, 96, texture)
  it('accepts a sharp, well-lit image', () => expect(photoGate(sharp)).toEqual({ ok: true }))
  it('rejects a blurred image', () => expect(photoGate(blur(sharp, 4))).toEqual({ ok: false, reason: 'blurry' }))
  it('rejects a flat image as blurry', () => expect(photoGate(make(64, 64, () => 128)).reason).toBe('blurry'))
  it('rejects a dark image', () =>
    expect(photoGate(make(96, 96, (x, y) => texture(x, y) * 0.15)).reason).toBe('too_dark'))
  it('rejects a bright image', () =>
    expect(photoGate(make(96, 96, (x, y) => 255 - (255 - texture(x, y)) * 0.1)).reason).toBe('too_bright'))
  it('rejects empty input', () => expect(photoGate({ data: new Uint8ClampedArray(0), width: 0, height: 0 }).ok).toBe(false))
})
