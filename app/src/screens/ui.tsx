import { useEffect, useState } from 'preact/hooks'
import type { ComponentChildren } from 'preact'
import { isDemo, onDemoChange, initVision } from '../engine/vision'
import { playClip } from '../lib/media'
import { t, tOr, useLang, setLang, availableLangs, isMachineDrafted, getLang } from '../content/i18n'
import { demoMode } from '../lib/demo'

export function DemoBanner() {
  const [d, setD] = useState(isDemo())
  useEffect(() => { void initVision().then(() => setD(isDemo())); return onDemoChange(() => setD(isDemo())) }, [])
  return d ? <div class="demo" role="alert">{t('demoModel')}</div> : null
}

export function LangBar() {
  useLang()
  const langs = availableLangs()
  return (
    <div class="langbar">
      {demoMode() && <span class="chip">DEMO SCENARIO</span>}
      {langs.length > 1 && (
        <select aria-label="Language" value={getLang()} onChange={(e) => setLang(e.currentTarget.value)}>
          {langs.map((l) => <option key={l.lang} value={l.lang}>{l.name} ({l.lang})</option>)}
        </select>
      )}
      {isMachineDrafted() && <div class="badge" role="note">Machine-drafted translation — not checked by a native speaker{getLang() !== 'en' && t('machine_drafted_notice') !== 'Machine-drafted translation — not checked by a native speaker' ? <><br />{t('machine_drafted_notice')}</> : null}</div>}
    </div>
  )
}

export const Screen = ({ title, step, children }: { title: string; step?: string; children: ComponentChildren }) => (
  <main>
    {step && <p class="step">{step}</p>}
    <h1>{title}</h1>
    {children}
  </main>
)

export const Btn = (p: { onClick?: () => void; kind?: 'primary' | 'ghost' | 'danger'; disabled?: boolean; children: ComponentChildren }) => (
  <button type="button" class={'btn ' + (p.kind ?? 'primary')} disabled={p.disabled} onClick={p.onClick}>{p.children}</button>
)

export function AudioBtn({ id }: { id: string }) {
  const [missing, setMissing] = useState(false)
  return (
    <span>
      <button type="button" class="btn ghost audio" aria-label={t('play_audio')} onClick={async () => setMissing(!(await playClip(id)))}>🔊 {t('play_audio')}</button>
      {missing && <small class="muted"> (audio {id} not available yet)</small>}
    </span>
  )
}

export const Bar = ({ label, p, hi }: { label: string; p: number; hi?: boolean }) => (
  <div class="bar-row">
    <div class="bar-label"><span>{label}</span><b>{Math.round(p * 100)}%</b></div>
    <div class="bar"><div class={'fill' + (hi ? ' hi' : '')} style={{ width: `${Math.max(2, p * 100)}%` }} /></div>
  </div>
)

export const nice = (id: string) => id.replace(/_/g, ' ')

/** Plain-language text for a detective evidence id ('ev'), not-checked id ('nc') or abstain reason ('ab'). */
export const evText = (kind: 'ev' | 'nc' | 'ab', id: string) => tOr(`${kind}.${id}`, nice(id.replace(/^.*:/, '')))

const EXTS = ['webp', 'jpg', 'jpeg', 'png', 'svg']
/** Optional picture from public/img/<name>.<ext>; tries each extension and renders nothing if none exists. */
export function OptImg({ name, alt, exts = EXTS }: { name: string; alt: string; exts?: string[] }) {
  const [i, setI] = useState(0)
  if (i >= exts.length) return null
  return <img class="optimg" src={`${import.meta.env.BASE_URL}img/${name}.${exts[i]}`} alt={alt} onError={() => setI(i + 1)} />
}
