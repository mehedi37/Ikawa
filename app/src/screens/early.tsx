import { useEffect, useState } from 'preact/hooks'
import { Lock, MapPin, Map as MapIcon, Mic, ThumbsUp, ThumbsDown, CircleHelp, ShieldCheck, NotebookPen, Camera, Inbox, MessageSquareText } from 'lucide-preact'
import { Store } from '../store'
import { go } from '../app'
import { session, update, useSession, resetCase } from '../lib/session'
import { recordMfcc } from '../lib/media'
import { encodeTemplates } from '../lib/voicecodec'
import { WORDS, type Mfcc, type VoiceTemplates, type Word } from '../adapters'
import { Btn, Screen, AudioBtn, Pict } from './ui'
import { t } from '../content/i18n'
import { demoMode, demoHref, DEMO_RUNS } from '../lib/demo'
import { locate, asOfDates, nearestDate, DEMO_AREA, DEMO_AREA_NAME, DEMO_SHORTCUT_DATE, type Area } from '../lib/plot'

/** The three scripted cases. On the PIN screen this is the judges' way in: no set-up, separate storage. */
export function DemoPanel({ compact = false }: { compact?: boolean }) {
  return (
    <section class="demo-panel" aria-labelledby="demo-h">
      <h2 id="demo-h">{compact ? 'Run a guided demo' : 'See it work in two minutes'}</h2>
      {!compact && <p>Three real cases with field photos and scripted answers. It needs no PIN and keeps nothing in the real records.</p>}
      <ul class="demo-list">
        {DEMO_RUNS.map((d) => (
          <li key={d.run}>
            <a class="demo-run" href={demoHref(d.run)}>
              <span class="demo-title">{d.title}</span>
              <span class="demo-out">{d.outcome}</span>
            </a>
          </li>
        ))}
      </ul>
    </section>
  )
}

export function Pin({ onUnlock }: { onUnlock: (pin: string) => Promise<void> }) {
  const [pin, setPin] = useState('')
  const [first, setFirst] = useState<boolean | null>(null)
  const [err, setErr] = useState('')
  useEffect(() => { void Store.hasPin().then((h) => setFirst(!h)) }, [])
  const submit = async () => {
    if (pin.length < 4) { setErr('The PIN needs at least 4 digits.'); return }
    try { await onUnlock(pin) } catch (e) { setErr((e as Error).message === 'bad-pin' ? 'That PIN is not right. Try again.' : 'Could not open the records on this phone.') }
  }
  return (
    <main>
      <p class="intro">Ikawa helps a coffee farmer find out why her yield dropped, offline, and hands the case to a person when it is not sure.</p>
      <DemoPanel />
      <section class="agent">
        <div class="section-head"><Pict icon={Lock} tone="quiet" /><h1 id="pin-h">{first ? 'Choose an agent PIN' : 'Enter agent PIN'}</h1></div>
        <p class="muted">For the cooperative agent. Farmer records on this phone are encrypted with this PIN. If it is forgotten, the records cannot be read.</p>
        <form onSubmit={(e) => { e.preventDefault(); void submit() }}>
          <input class="field pin" type="password" inputMode="numeric" autocomplete="off" value={pin} onInput={(e) => setPin(e.currentTarget.value)} aria-label="PIN" placeholder="4 or more digits" />
          {err && <p class="error" role="alert">{err}</p>}
          <Btn onClick={submit}>{first ? 'Set PIN' : 'Unlock'}</Btn>
        </form>
        <a class="textlink" href="#/officer">Extension officer? Decode a case SMS</a>
      </section>
    </main>
  )
}

export const areaText = (a: Area | null) =>
  !a ? t('area_none') : a.kind === 'demo' ? t('area_demo', { name: DEMO_AREA_NAME, lat: a.lat, lon: a.lon }) : t('area_gps', { lat: a.lat, lon: a.lon })

/** Where is the farm? GPS if allowed and inside the Kirinyaga grid, otherwise the demo area. Never blocks. */
export function AreaPicker() {
  const s = useSession()
  const [status, setStatus] = useState<'idle' | 'busy' | 'denied' | 'unavailable' | 'outside'>('idle')
  const useGps = async () => {
    setStatus('busy')
    const r = await locate()
    if (r.ok) { update({ area: { lat: r.lat, lon: r.lon, kind: 'gps' }, plot: null, plotExtra: null }); setStatus('idle') }
    else setStatus(r.reason)
  }
  const useDemo = () => { setStatus('idle'); update({ area: { ...DEMO_AREA, kind: 'demo' }, plot: null, plotExtra: null }) }
  useEffect(() => { if (!session.area && !demoMode()) void useGps() }, [])
  return (
    <section class="group" role="group" aria-label={t('area_title')}>
      <h2>{t('area_title')}</h2>
      <p class="area-now">{status === 'busy' ? t('area_locating') : areaText(s.area)}</p>
      {(status === 'denied' || status === 'unavailable') && <p class="muted">{t('area_failed')}</p>}
      {status === 'outside' && <p class="muted">{t('area_outside')}</p>}
      <div class="pair">
        <Btn kind={s.area?.kind === 'gps' ? 'primary' : 'secondary'} icon={MapPin} disabled={status === 'busy'} onClick={useGps}>{t('use_my_location')}</Btn>
        <Btn kind={s.area?.kind === 'demo' ? 'primary' : 'secondary'} icon={MapIcon} onClick={useDemo}>{t('use_demo_area')}</Btn>
      </div>
    </section>
  )
}

const fmtDate = (d: string) => { try { return new Date(d + 'T00:00:00Z').toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }) } catch { return d } }

export function AsOfPicker() {
  const s = useSession()
  const [dates, setDates] = useState<string[]>([])
  useEffect(() => { void asOfDates().then(setDates) }, [])
  if (!dates.length) return null
  return (
    <section class="group">
      <label class="field-label" for="asof">{t('asof_label')}</label>
      <select id="asof" class="field" aria-label={t('asof_label')} value={s.asOf} onChange={(e) => update({ asOf: e.currentTarget.value, plot: null })}>
        <option value="">{t('asof_latest', { date: fmtDate(dates[dates.length - 1]) })}</option>
        {[...dates].reverse().map((d) => <option key={d} value={d}>{fmtDate(d)}</option>)}
      </select>
      <p class="muted small">{t('asof_note')}</p>
      <button type="button" class="textlink" onClick={async () => update({ asOf: await nearestDate(DEMO_SHORTCUT_DATE), plot: null })}>{t('asof_demo_btn')}</button>
    </section>
  )
}

export function Home() {
  const s = useSession()
  return (
    <Screen title="Ikawa" lead="Why did the coffee yield drop? Bring 5 leaves from the worst row and 5 from a good row.">
      <ol class="howto" aria-label="How a case works">
        <li><Pict icon={Camera} /><span>Photograph both bags of leaves</span></li>
        <li><Pict icon={CircleHelp} /><span>Answer six picture questions</span></li>
        <li><Pict icon={MessageSquareText} /><span>Hear one action, or send the case to a person</span></li>
      </ol>
      <section class="group">
        <label class="field-label" for="fid">Farmer ID</label>
        <input id="fid" class="field" type="text" value={s.farmerId} onInput={(e) => update({ farmerId: e.currentTarget.value.toUpperCase().slice(0, 5) })} />
      </section>
      <AreaPicker />
      <AsOfPicker />
      <div class="actions"><Btn onClick={() => { resetCase(); go('consent') }}>{t('start')}</Btn></div>
      {!demoMode() && <DemoPanel compact />}
      <nav class="footer-links" aria-label="Other pages">
        <a href="#/coop"><Inbox size={18} aria-hidden="true" /> Cooperative: saved cases</a>
        <a href="#/officer"><NotebookPen size={18} aria-hidden="true" /> Officer page</a>
      </nav>
    </Screen>
  )
}

const CONSENTS = [
  { key: 'service', clip: 'C01', icon: ShieldCheck },
  { key: 'registry', clip: 'C02', icon: NotebookPen },
  { key: 'photos', clip: 'C03', icon: Camera },
] as const

export function Consent() {
  const s = useSession()
  const done = s.consents.service !== null && s.consents.registry !== null && s.consents.photos !== null
  const set = (k: (typeof CONSENTS)[number]['key'], v: boolean) => update({ consents: { ...s.consents, [k]: v } })
  return (
    <Screen step="Step 1 of 5" title="Consent" lead="Ask the farmer each question. Each answer is separate. Saying no to the second and third does not stop the service.">
      {CONSENTS.map((c) => (
        <section class="question-card" key={c.key}>
          <div class="section-head"><Pict icon={c.icon} /><p class="q">{t(c.clip)}</p></div>
          {c.key === 'photos' && <p class="muted small">{t('consent_photos_note')}</p>}
          <AudioBtn id={c.clip} />
          <div class="choice">
            <button type="button" class={'btn choice-btn' + (s.consents[c.key] === true ? ' sel' : '')} aria-pressed={s.consents[c.key] === true} onClick={() => set(c.key, true)}><ThumbsUp size={22} aria-hidden="true" /><span>{t('yes')}</span></button>
            <button type="button" class={'btn choice-btn' + (s.consents[c.key] === false ? ' sel' : '')} aria-pressed={s.consents[c.key] === false} onClick={() => set(c.key, false)}><ThumbsDown size={22} aria-hidden="true" /><span>{t('no')}</span></button>
          </div>
        </section>
      ))}
      {s.consents.service === false && <p class="notice cherry">Without consent to the service, Ikawa cannot continue.</p>}
      <div class="actions">
        <Btn disabled={!done || s.consents.service !== true} onClick={async () => {
          await session.store?.putFarmer({ id: s.farmerId, consents: { service: true, registry: !!s.consents.registry, photos: !!s.consents.photos }, createdAt: Date.now() })
          go('voice')
        }}>{t('next')}</Btn>
      </div>
    </Screen>
  )
}

const LABEL: Record<Word, string> = { yes: 'Say YES', no: 'Say NO', unsure: 'Say NOT SURE' }

export function VoiceSetup() {
  const s = useSession()
  const [clips, setClips] = useState<Record<Word, Mfcc[]>>({ yes: [], no: [], unsure: [] })
  const [busy, setBusy] = useState<Word | null>(null)
  const [err, setErr] = useState('')
  const complete = WORDS.every((w) => clips[w].length >= 2)
  const rec = async (w: Word) => {
    setErr(''); setBusy(w)
    try {
      const m = await recordMfcc()
      if (!m.length) throw new Error('nothing recorded')
      setClips((c) => ({ ...c, [w]: [...c[w], m] }))
    } catch { setErr('The microphone is not available. Skip this step and answer the questions by tapping.') }
    setBusy(null)
  }
  const save = async () => {
    update({ templates: clips as VoiceTemplates })
    const f = await session.store?.getFarmer(s.farmerId)
    if (f) await session.store?.putFarmer({ ...f, voice: encodeTemplates(clips as VoiceTemplates) })
    go('photos')
  }
  return (
    <Screen step="Step 2 of 5" title="Voice setup" lead="Tap a button, then the farmer says the word. Twice for each word. Ikawa matches her own voice, so any language works.">
      {WORDS.map((w) => (
        <section class="voice-row" key={w}>
          <Btn kind="secondary" icon={Mic} disabled={busy !== null} onClick={() => rec(w)}>{busy === w ? 'Listening…' : LABEL[w]}</Btn>
          <span class="dots" aria-label={`${clips[w].length} of 2 recorded`}>
            {[0, 1].map((i) => <span key={i} class={i < clips[w].length ? 'on' : ''} />)}
          </span>
        </section>
      ))}
      {err && <p class="error" role="alert">{err}</p>}
      <div class="actions">
        <Btn disabled={!complete} onClick={save}>{t('next')}</Btn>
        <Btn kind="quiet" onClick={() => { update({ templates: null }); go('photos') }}>Skip (tap answers only)</Btn>
      </div>
    </Screen>
  )
}
