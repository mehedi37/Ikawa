import { useEffect, useState } from 'preact/hooks'
import type { ComponentChildren } from 'preact'
import {
  Volume2, Leaf, Bug, CloudRain, Sun, Sprout, TreeDeciduous, CalendarClock, UserRound, CircleHelp, type LucideIcon,
} from 'lucide-preact'
import { isDemo, onDemoChange, initVision } from '../engine/vision'
import { playClip } from '../lib/media'
import { t, tOr, useLang, setLang, availableLangs, isMachineDrafted, getLang } from '../content/i18n'
import { demoMode, exitDemoHref, DEMO_TIPS } from '../lib/demo'

/** Shown only if the trained model file is missing, so a stub result is never mistaken for a real one. */
export function DemoModelBanner() {
  const [d, setD] = useState(isDemo())
  useEffect(() => { void initVision().then(() => setD(isDemo())); return onDemoChange(() => setD(isDemo())) }, [])
  return d ? <div class="alertbar" role="alert">{t('demoModel')}</div> : null
}

/** The brand mark: a coffee cherry on its leaf. */
const Mark = () => (
  <svg class="mark" viewBox="0 0 32 32" aria-hidden="true">
    <path d="M6 24C6 13 14 6 26 6c0 12-7 20-18 20" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" />
    <circle cx="21" cy="21" r="6" class="cherry" />
  </svg>
)

export function AppBar() {
  useLang()
  const langs = availableLangs()
  return (
    <header class="appbar">
      <a class="brand" href="#/home" aria-label="Ikawa home"><Mark /><span>Ikawa</span></a>
      {demoMode() && <span class="pill">Demo</span>}
      {langs.length > 1 && (
        <select class="lang" aria-label="Language" value={getLang()} onChange={(e) => setLang(e.currentTarget.value)}>
          {langs.map((l) => <option key={l.lang} value={l.lang}>{l.name}</option>)}
        </select>
      )}
    </header>
  )
}

/** Honest label for machine translation, visible whenever the active pack is machine-drafted. */
export function MachineNote() {
  useLang()
  if (!isMachineDrafted()) return null
  const extra = getLang() !== 'en' && t('machine_drafted_notice') !== 'Machine-drafted translation — not checked by a native speaker' ? t('machine_drafted_notice') : null
  return (
    <div class="machine" role="note">
      Machine-drafted translation — not checked by a native speaker{extra && <><br /><span lang={getLang()}>{extra}</span></>}
    </div>
  )
}

export function DemoBar({ route }: { route: string }) {
  if (!demoMode()) return null
  const tip = DEMO_TIPS[route]
  return (
    <div class="demobar">
      <p><b>Guided demo.</b> Real field photos, scripted answers, kept apart from real records. <a href={exitDemoHref()}>Exit demo</a></p>
      {tip && <p class="tip">{tip}</p>}
    </div>
  )
}

/** "Step 3 of 5" or "Question 2 of 6" becomes a segmented progress rail; the text stays for screen readers and tests. */
function Progress({ label }: { label: string }) {
  const m = label.match(/(\d+) of (\d+)/)
  const n = m ? +m[1] : 0
  const of = m ? +m[2] : 0
  return (
    <div class="progress">
      {of > 0 && <div class="rail" aria-hidden="true">{Array.from({ length: of }, (_, i) => <span key={i} class={i < n ? 'on' : ''} />)}</div>}
      <p class="step">{label}</p>
    </div>
  )
}

export const Screen = ({ title, step, lead, children }: { title: string; step?: string; lead?: ComponentChildren; children: ComponentChildren }) => (
  <main>
    {step && <Progress label={step} />}
    <h1>{title}</h1>
    {lead && <p class="lead">{lead}</p>}
    {children}
  </main>
)

type Kind = 'primary' | 'secondary' | 'quiet' | 'danger' | 'ghost'
export const Btn = (p: { onClick?: () => void; kind?: Kind; icon?: LucideIcon; disabled?: boolean; children: ComponentChildren }) => {
  const kind = p.kind === 'ghost' ? 'secondary' : (p.kind ?? 'primary')
  const I = p.icon
  return (
    <button type="button" class={'btn ' + kind} disabled={p.disabled} onClick={p.onClick}>
      {I && <I size={22} strokeWidth={2.2} aria-hidden="true" />}<span>{p.children}</span>
    </button>
  )
}

/** A round pictogram tile: icons carry meaning for readers who read little, and render the same on every phone. */
export const Pict = ({ icon: I, tone = 'leaf' }: { icon: LucideIcon; tone?: 'leaf' | 'cherry' | 'quiet' }) => (
  <span class={'pict ' + tone} aria-hidden="true"><I size={30} strokeWidth={2} /></span>
)

const CAUSE_ICON: Record<string, LucideIcon> = {
  leaf_rust: Leaf, other_leaf_disease: Leaf, insect_pest: Bug, heavy_rain_damage: CloudRain, drought_at_flowering: Sun,
  soil_acidity_or_nutrient: Sprout, old_trees_need_stumping: TreeDeciduous, normal_off_year: CalendarClock,
  unknown: CircleHelp, any: UserRound,
}
export const causeIcon = (cause: string | undefined): LucideIcon => CAUSE_ICON[cause ?? ''] ?? Leaf

export function AudioBtn({ id }: { id: string }) {
  const [missing, setMissing] = useState(false)
  return (
    <span class="audio-wrap">
      <button type="button" class="btn audio" aria-label={t('play_audio')} onClick={async () => setMissing(!(await playClip(id)))}>
        <Volume2 size={22} strokeWidth={2.2} aria-hidden="true" /><span>{t('play_audio')}</span>
      </button>
      {missing && <small class="muted"> (audio {id} not available yet)</small>}
    </span>
  )
}

export const Bar = ({ label, p, hi }: { label: string; p: number; hi?: boolean }) => (
  <div class={'meter' + (hi ? ' hi' : '')}>
    <div class="meter-label"><span>{label}</span><b>{Math.round(p * 100)}%</b></div>
    <div class="meter-track"><div class="meter-fill" style={{ width: `${Math.max(2, p * 100)}%` }} /></div>
  </div>
)

export const nice = (id: string) => { const s = id.replace(/_/g, ' '); return s.charAt(0).toUpperCase() + s.slice(1) }

/** Plain-language text for a detective evidence id ('ev'), not-checked id ('nc') or abstain reason ('ab'). */
export const evText = (kind: 'ev' | 'nc' | 'ab', id: string) => tOr(`${kind}.${id}`, nice(id.replace(/^.*:/, '')))

/** Evidence lines without near-duplicates: "rain on 6+ days" already implies "rain on 3+ days". */
export const dedupeEvidence = (ids: string[]) => ids.includes('rain_very_wet_90d') ? ids.filter((e) => e !== 'rain_wet_90d') : ids

const EXTS = ['webp', 'jpg', 'jpeg', 'png', 'svg']
/** Optional picture from public/img/<name>.<ext>; tries each extension and renders nothing if none exists. */
export function OptImg({ name, alt, exts = EXTS }: { name: string; alt: string; exts?: string[] }) {
  const [i, setI] = useState(0)
  if (i >= exts.length) return null
  return <img class="optimg" src={`${import.meta.env.BASE_URL}img/${name}.${exts[i]}`} alt={alt} onError={() => setI(i + 1)} />
}
