// SMS case file codec (contracts.md §8). Output is always <= 160 GSM-7 chars.
import type { Answers, CauseId, LeafClass } from './types'

export const CAUSE_CODES: Record<CauseId, string> = {
  leaf_rust: 'LR',
  other_leaf_disease: 'OL',
  insect_pest: 'IP',
  heavy_rain_damage: 'HR',
  drought_at_flowering: 'DR',
  soil_acidity_or_nutrient: 'SA',
  old_trees_need_stumping: 'OY',
  normal_off_year: 'NO',
  unknown: 'UK',
}
export const LEAF_CODES: Record<LeafClass, string> = {
  healthy: 'HE',
  leaf_rust: 'LR',
  cercospora: 'CE',
  phoma: 'PH',
  leaf_miner: 'LM',
  not_coffee: 'NC',
}
const ANSWER_KEYS = ['lastSeasonHeavy', 'flowersDropped', 'bugSeen', 'berryHoles', 'treeAgeOver20', 'wholeFarm'] as const

export const SMS_MAX_CHARS = 160

export interface CaseFile {
  farmerId: string // e.g. "F0423"
  causes: { id: CauseId; p: number }[] // 1..3, p in 0..1 (whole percent)
  vision: { top: LeafClass; prob: number; contrast: number } // 2 decimals each
  soilPh: number | null // 1 decimal
  rainAnomalyPct: number // integer
  rainDays: number // integer >= 0
  answers: Answers
  lat: number // 2 decimals
  lon: number
  escalation: number // bitmask 0..15
}

const invert = <T extends string>(m: Record<T, string>) =>
  Object.fromEntries(Object.entries(m).map(([k, v]) => [v, k])) as Record<string, T>
const CAUSE_BY_CODE = invert(CAUSE_CODES)
const LEAF_BY_CODE = invert(LEAF_CODES)

const fail = (msg: string): never => {
  throw new Error(`smscodec: ${msg}`)
}
const r2 = (x: number) => {
  const v = Math.round(x * 100) / 100
  return v === 0 ? 0 : v
}
const frac = (x: number) => {
  const s = r2(x).toFixed(2)
  return s.startsWith('0.') ? s.slice(1) : s // 0.71 -> .71 ; 1.00 stays
}
const unfrac = (s: string, what: string) => {
  if (!/^\d?\.\d{2}$|^1\.00$/.test(s)) fail(`bad ${what} "${s}"`)
  return Number(s)
}
const num2 = (x: number) => String(r2(x))

export function encodeCase(c: CaseFile): string {
  if (!/^F\d{1,6}$/.test(c.farmerId)) fail(`bad farmerId "${c.farmerId}"`)
  if (c.causes.length < 1 || c.causes.length > 3) fail('causes must have 1..3 entries')
  const R = c.causes.map((x) => {
    const code = CAUSE_CODES[x.id] ?? fail(`unknown cause "${x.id}"`)
    if (!(x.p >= 0 && x.p <= 1)) fail(`cause p out of range: ${x.p}`)
    return code + Math.round(x.p * 100)
  })
  const vcode = LEAF_CODES[c.vision.top] ?? fail(`unknown leaf class "${c.vision.top}"`)
  const { prob, contrast } = c.vision
  if (!(prob >= 0 && prob <= 1) || !(contrast >= 0 && contrast <= 1)) fail('vision prob/contrast out of 0..1')
  let S = 'pH-'
  if (c.soilPh !== null) {
    if (!(c.soilPh >= 0 && c.soilPh < 14.05)) fail(`soilPh out of range: ${c.soilPh}`)
    S = 'pH' + (Math.round(c.soilPh * 10) / 10).toFixed(1)
  }
  if (!Number.isInteger(Math.round(c.rainAnomalyPct)) || c.rainAnomalyPct < -100 || c.rainAnomalyPct > 999)
    fail(`rainAnomalyPct out of range: ${c.rainAnomalyPct}`)
  if (!(c.rainDays >= 0 && c.rainDays <= 999)) fail(`rainDays out of range: ${c.rainDays}`)
  const Q = ANSWER_KEYS.map((k) => {
    const v = c.answers[k] as number
    if (v !== 0 && v !== 1 && v !== 2) fail(`answer ${k} must be 0|1|2`)
    return v
  })
  if (!(c.lat >= -90 && c.lat <= 90) || !(c.lon >= -180 && c.lon <= 180)) fail('lat/lon out of range')
  if (!Number.isInteger(c.escalation) || c.escalation < 0 || c.escalation > 15) fail('escalation must be 0..15')
  const out = [
    'IK1',
    c.farmerId,
    'R:' + R.join(','),
    `V:${vcode}${frac(prob)}/c${frac(contrast)}`,
    'S:' + S,
    `C:${Math.round(c.rainAnomalyPct)}/${Math.round(c.rainDays)}`,
    'Q:' + Q.join(','),
    `G:${num2(c.lat)},${num2(c.lon)}`,
    'E' + c.escalation,
  ].join('|')
  if (out.length > SMS_MAX_CHARS) fail('encoded case exceeds 160 chars')
  return out
}

export function decodeCase(s: string): CaseFile {
  if (typeof s !== 'string') return fail('input must be a string')
  const parts = s.trim().split('|')
  if (parts.length !== 9 || parts[0] !== 'IK1') return fail('not an IK1 case file')
  const [, F, R, V, S, C, Q, G, E] = parts
  if (!/^F\d{1,6}$/.test(F)) fail(`bad farmer id "${F}"`)
  const pre = (p: string, v: string, name: string) => (v.startsWith(p) ? v.slice(p.length) : fail(`missing ${name} field`))
  const causes = pre('R:', R, 'R')
    .split(',')
    .map((t) => {
      const m = /^([A-Z]{2})(\d{1,3})$/.exec(t) ?? fail(`bad cause "${t}"`)
      const id = CAUSE_BY_CODE[m![1]] ?? fail(`unknown cause code "${m![1]}"`)
      const pct = Number(m![2])
      if (pct > 100) fail(`cause percent > 100`)
      return { id, p: pct / 100 }
    })
  if (causes.length > 3) fail('too many causes')
  const vm = /^([A-Z]{2})(\d?\.\d{2})\/c(\d?\.\d{2})$/.exec(pre('V:', V, 'V')) ?? fail(`bad V field "${V}"`)
  const top = LEAF_BY_CODE[vm![1]] ?? fail(`unknown leaf code "${vm![1]}"`)
  const prob = unfrac(vm![2], 'prob')
  const contrast = unfrac(vm![3], 'contrast')
  if (prob > 1 || contrast > 1) fail('vision value > 1')
  const sv = pre('S:', S, 'S')
  const sm = /^pH(-|\d{1,2}\.\d)$/.exec(sv) ?? fail(`bad S field "${S}"`)
  const soilPh = sm![1] === '-' ? null : Number(sm![1])
  const cm = /^(-?\d{1,3})\/(\d{1,3})$/.exec(pre('C:', C, 'C')) ?? fail(`bad C field "${C}"`)
  const qs = pre('Q:', Q, 'Q').split(',')
  if (qs.length !== 6 || !qs.every((x) => /^[012]$/.test(x))) fail(`bad Q field "${Q}"`)
  const answers = Object.fromEntries(ANSWER_KEYS.map((k, i) => [k, Number(qs[i])])) as unknown as Answers
  const gm = /^(-?\d{1,2}(?:\.\d{1,2})?),(-?\d{1,3}(?:\.\d{1,2})?)$/.exec(pre('G:', G, 'G')) ?? fail(`bad G field "${G}"`)
  const lat = Number(gm![1])
  const lon = Number(gm![2])
  if (Math.abs(lat) > 90 || Math.abs(lon) > 180) fail('lat/lon out of range')
  const em = /^E(\d{1,2})$/.exec(E) ?? fail(`bad E field "${E}"`)
  const escalation = Number(em![1])
  if (escalation > 15) fail('escalation > 15')
  return {
    farmerId: F,
    causes,
    vision: { top, prob, contrast },
    soilPh,
    rainAnomalyPct: Number(cm![1]),
    rainDays: Number(cm![2]),
    answers,
    lat,
    lon,
    escalation,
  }
}

/** Officer reply like "A07" -> "A07" (case/space tolerant). Cards A01..A30. */
export function parseOfficerReply(text: string): string | null {
  const m = /\bA\s*0*([1-9]\d?)\b/i.exec(String(text))
  if (!m) return null
  const n = Number(m[1])
  return n >= 1 && n <= 30 ? 'A' + String(n).padStart(2, '0') : null
}
