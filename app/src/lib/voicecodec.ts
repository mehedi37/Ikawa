// Compact storage for a farmer's voice templates (contracts.md section 9).
// An MFCC clip (frames x 13 numbers) as a JSON number array costs ~18 bytes per number; stored as
// Float32 -> base64 it costs 5.33 bytes per number. The detective/voice engine is unchanged:
// templates are decoded back to number[][] before classify().
import { WORDS, type Mfcc, type VoiceTemplates } from '../adapters'

/** One stored clip: `n` = numbers per frame, `b` = base64 of the little-endian Float32 values. */
export interface PackedClip { n: number; b: string }
export type PackedTemplates = Record<string, PackedClip[]>

function toB64(bytes: Uint8Array): string {
  let s = ''
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
  return btoa(s)
}
function fromB64(b: string): Uint8Array {
  const s = atob(b); const out = new Uint8Array(s.length)
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i)
  return out
}

export function packClip(m: Mfcc): PackedClip {
  const n = m[0]?.length ?? 0
  const f = new Float32Array(m.length * n)
  m.forEach((row, i) => f.set(row, i * n))
  return { n, b: toB64(new Uint8Array(f.buffer)) }
}
export function unpackClip(c: PackedClip): Mfcc {
  const bytes = fromB64(c.b)
  const f = new Float32Array(bytes.buffer, bytes.byteOffset, bytes.byteLength / 4)
  const out: Mfcc = []
  if (!c.n) return out
  for (let i = 0; i < f.length; i += c.n) out.push(Array.from(f.subarray(i, i + c.n)))
  return out
}

export function encodeTemplates(t: VoiceTemplates): PackedTemplates {
  const out: PackedTemplates = {}
  for (const w of WORDS) out[w] = (t[w] ?? []).map(packClip)
  return out
}

/** Reads both the compact format and the old JSON number-array format. Returns null for anything else. */
export function decodeTemplates(v: unknown): VoiceTemplates | null {
  if (!v || typeof v !== 'object') return null
  const src = v as Record<string, unknown>
  const out = {} as VoiceTemplates
  for (const w of WORDS) {
    const clips = Array.isArray(src[w]) ? (src[w] as unknown[]) : []
    out[w] = clips.map((c) => (Array.isArray(c) ? (c as Mfcc) : unpackClip(c as PackedClip)))
  }
  return out
}
