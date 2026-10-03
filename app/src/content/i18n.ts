// Language packs: src/content/packs/<lang>.json (bundled, so they work offline).
// Missing keys / cards fall back to English. Machine-drafted packs/cards are always flagged.
import { useEffect, useState } from 'preact/hooks'

export interface PackCard { id: string; cause: string; costsMoney: boolean; text: string; reviewed: boolean; sources?: unknown }
export interface Pack {
  lang: string; name: string; machineDrafted: boolean; engine?: string
  cards: PackCard[]; strings: Record<string, string>
}
export type Lang = string

// Built-in minimal English so the build and app never depend on the pack files existing.
export const EN_FALLBACK: Record<string, string> = {
  appName: 'Ikawa', start: 'Start a case', next: 'Next', back: 'Back', yes: 'Yes', no: 'No', unsure: 'Not sure',
  take_photo: 'Add leaf photo', worst_row: 'Worst row', good_row: 'Good row', play_audio: 'Play audio',
  result_title: 'Result', not_sure_title: 'Not sure. Sending to a person.',
  not_sure_body: 'I cannot tell the cause with enough confidence. A person will look at your case.',
  send_sms: 'Open SMS', evidence_used: 'Evidence I used', what_i_could_not_check: 'What I could not check',
  machine_drafted_notice: 'Machine-drafted translation — not checked by a native speaker',
  demoModel: 'DEMO MODEL: results are NOT real',
  Q01: "Was last season's harvest unusually big?", Q02: 'Did flowers drop early or fail to set fruit?',
  Q03: 'Do you see this bug (antestia or berry borer)?', Q04: 'Are there berries with small holes?',
  Q05: 'Are most trees older than about 20 years?', Q06: 'Is the problem across the whole farm, or one area?',
  C01: 'Ikawa may look at my leaves and answers to help me.',
  C02: 'My name and plot may be shared with my cooperative registry.',
  C03: 'My leaf photos may be used to improve the model.',
}

const files = import.meta.glob('./packs/*.json', { eager: true, import: 'default' }) as Record<string, Pack>
export const PACKS: Record<string, Pack> = {}
for (const [path, p] of Object.entries(files)) {
  // ignore anything that is not a valid pack (wrong shape, QA scratch files)
  if (!p || Array.isArray(p) || typeof p !== 'object' || typeof p.lang !== 'string' || !Array.isArray(p.cards) || typeof p.strings !== 'object') { console.warn('[i18n] ignoring invalid pack', path); continue }
  PACKS[p.lang] = p
}
export const availableLangs = (): { lang: string; name: string }[] =>
  [{ lang: 'en', name: PACKS.en?.name ?? 'English' }, ...Object.values(PACKS).filter((p) => p.lang !== 'en').map((p) => ({ lang: p.lang, name: p.name }))]

/** Language used on first run (before the agent picks one). Change this one constant to switch the default. */
export const DEFAULT_LANG: Lang = 'en'
const KEY = 'ikawa.lang'
const readSaved = (): Lang => { try { const l = localStorage.getItem(KEY); if (l && (l === 'en' || PACKS[l])) return l } catch { /* private mode */ } return PACKS[DEFAULT_LANG] || DEFAULT_LANG === 'en' ? DEFAULT_LANG : 'en' }
let current: Lang = readSaved()
const subs = new Set<() => void>()
export const getLang = (): Lang => current
export const setLang = (l: Lang) => {
  current = l === 'en' || PACKS[l] ? l : 'en'
  try { localStorage.setItem(KEY, current) } catch { /* ignore */ }
  subs.forEach((f) => f())
}
export function useLang(): Lang {
  const [, force] = useState(0)
  useEffect(() => { const f = () => force((n) => n + 1); subs.add(f); return () => { subs.delete(f) } }, [])
  return current
}

export const activePack = (): Pack | undefined => PACKS[current]
export const isMachineDrafted = (): boolean => !!PACKS[current]?.machineDrafted

/** Look up a UI string: active pack, then English pack, then built-in English, then the key. */
export function t(key: string, vars?: Record<string, string | number>): string {
  const s = raw(key)
  return vars ? s.replace(/\{(\w+)\}/g, (m, k) => (k in vars ? String(vars[k]) : m)) : s
}
/** Like t() but returns `fallback` (not the key) when no pack has the key. */
export function tOr(key: string, fallback: string): string {
  const s = raw(key)
  return s === key ? fallback : s
}
function raw(key: string): string {
  return PACKS[current]?.strings?.[key] || PACKS.en?.strings?.[key] || EN_FALLBACK[key] || key
}
/** True when `key` was not available in the active language (so English is shown). */
export const isFallback = (key: string): boolean => current !== 'en' && !PACKS[current]?.strings?.[key]
