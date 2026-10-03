import { useEffect, useState } from 'preact/hooks'
import { Store } from '../store'
import { go } from '../app'
import { session, update, useSession, resetCase } from '../lib/session'
import { recordMfcc } from '../lib/media'
import { WORDS, type Mfcc, type VoiceTemplates, type Word } from '../adapters'
import { Btn, Screen, AudioBtn } from './ui'
import { t } from '../content/i18n'
import { demoMode, loadDemo } from '../lib/demo'
import { locate, asOfDates, nearestDate, DEMO_AREA, DEMO_AREA_NAME, DEMO_SHORTCUT_DATE, type Area } from '../lib/plot'

export function Pin({ onUnlock }: { onUnlock: (pin: string) => Promise<void> }) {
  const [pin, setPin] = useState('')
  const [first, setFirst] = useState<boolean | null>(null)
  const [err, setErr] = useState('')
  useEffect(() => { void Store.hasPin().then((h) => setFirst(!h)) }, [])
  const submit = async () => {
    if (pin.length < 4) { setErr('PIN needs at least 4 digits'); return }
    try { await onUnlock(pin) } catch (e) { setErr((e as Error).message === 'bad-pin' ? 'Wrong PIN' : 'Could not unlock') }
  }
  return (
    <Screen title={first ? 'Choose an agent PIN' : 'Enter agent PIN'}>
      <p class="big">🔒</p>
      <p class="muted">Farmer records on this phone are encrypted with this PIN. If you forget it the records cannot be read.</p>
      <input type="password" inputMode="numeric" autocomplete="off" value={pin} onInput={(e) => setPin(e.currentTarget.value)} aria-label="PIN" />
      {err && <p style={{ color: 'var(--warn)' }}>{err}</p>}
      <Btn onClick={submit}>{first ? 'Set PIN' : 'Unlock'}</Btn>
      <a href="#/officer">Officer page (no PIN)</a>
    </Screen>
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
    <div class="card" role="group" aria-label={t('area_title')}>
      <b>{t('area_title')}</b>
      <p class="area-now">{status === 'busy' ? t('area_locating') : areaText(s.area)}</p>
      {(status === 'denied' || status === 'unavailable') && <p class="muted">{t('area_failed')}</p>}
      {status === 'outside' && <p class="muted">{t('area_outside')}</p>}
      <Btn kind={s.area?.kind === 'gps' ? 'primary' : 'ghost'} disabled={status === 'busy'} onClick={useGps}>📍 {t('use_my_location')}</Btn>
      <Btn kind={s.area?.kind === 'demo' ? 'primary' : 'ghost'} onClick={useDemo}>🗺️ {t('use_demo_area')}</Btn>
    </div>
  )
}

const fmtDate = (d: string) => { try { return new Date(d + 'T00:00:00Z').toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }) } catch { return d } }

export function AsOfPicker() {
  const s = useSession()
  const [dates, setDates] = useState<string[]>([])
  useEffect(() => { void asOfDates().then(setDates) }, [])
  if (!dates.length) return null
  return (
    <div class="card">
      <label><b>{t('asof_label')}</b>
        <select class="full" aria-label={t('asof_label')} value={s.asOf} onChange={(e) => update({ asOf: e.currentTarget.value, plot: null })}>
          <option value="">{t('asof_latest', { date: fmtDate(dates[dates.length - 1]) })}</option>
          {[...dates].reverse().map((d) => <option key={d} value={d}>{fmtDate(d)}</option>)}
        </select>
      </label>
      <p class="muted">{t('asof_note')}</p>
      <Btn kind="ghost" onClick={async () => update({ asOf: await nearestDate(DEMO_SHORTCUT_DATE), plot: null })}>🎬 {t('asof_demo_btn')}</Btn>
    </div>
  )
}

export function Home() {
  const s = useSession()
  return (
    <Screen title="Ikawa ☕">
      <p class="big">🌱 → 🔍 → 🗣️</p>
      <p>Why did the coffee yield drop? Bring 5 leaves from the worst row and 5 from a good row.</p>
      <label>Farmer ID<input type="text" value={s.farmerId} onInput={(e) => update({ farmerId: e.currentTarget.value.toUpperCase().slice(0, 5) })} /></label>
      <AreaPicker />
      <AsOfPicker />
      <Btn onClick={() => { resetCase(); go('consent') }}>{t('start')}</Btn>
      {demoMode() && <Btn kind="ghost" onClick={async () => { await loadDemo('rust'); go('photos') }}>Demo run 1: leaf rust case</Btn>}
      {demoMode() && <Btn kind="ghost" onClick={async () => { await loadDemo('mite'); go('photos') }}>Demo run 2: leaf the app cannot read</Btn>}
      <Btn kind="ghost" onClick={() => go('coop')}>Cooperative: saved cases</Btn>
      <Btn kind="ghost" onClick={() => go('officer')}>Officer page</Btn>
    </Screen>
  )
}

const CONSENTS = [
  { key: 'service', clip: 'C01', emoji: '☕' },
  { key: 'registry', clip: 'C02', emoji: '📒' },
  { key: 'photos', clip: 'C03', emoji: '📷' },
] as const

export function Consent() {
  const s = useSession()
  const done = s.consents.service !== null && s.consents.registry !== null && s.consents.photos !== null
  const set = (k: (typeof CONSENTS)[number]['key'], v: boolean) => update({ consents: { ...s.consents, [k]: v } })
  return (
    <Screen step="Step 1 of 5" title="Consent">
      <p class="muted">Ask the farmer each question. Each answer is separate. Saying no to 2 and 3 does not stop the service. A spoken yes will be added later.</p>
      {CONSENTS.map((c) => (
        <div class="card" key={c.key}>
          <p class="big">{c.emoji}</p>
          <p>{t(c.clip)}</p>
          <AudioBtn id={c.clip} />
          <div class="row">
            <button type="button" class={'btn ghost' + (s.consents[c.key] === true ? ' sel' : '')} onClick={() => set(c.key, true)}>👍 {t('yes')}</button>
            <button type="button" class={'btn ghost' + (s.consents[c.key] === false ? ' sel' : '')} onClick={() => set(c.key, false)}>👎 {t('no')}</button>
          </div>
        </div>
      ))}
      {s.consents.service === false && <div class="card warn">Without consent to the service, Ikawa cannot continue.</div>}
      <Btn disabled={!done || s.consents.service !== true} onClick={async () => {
        await session.store?.putFarmer({ id: s.farmerId, consents: { service: true, registry: !!s.consents.registry, photos: !!s.consents.photos }, createdAt: Date.now() })
        go('voice')
      }}>{t('next')}</Btn>
    </Screen>
  )
}

const LABEL: Record<Word, string> = { yes: '👍 Say YES', no: '👎 Say NO', unsure: '🤷 Say NOT SURE' }

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
    } catch { setErr('Microphone not available. You can skip: questions will use tap buttons.') }
    setBusy(null)
  }
  const save = async () => {
    update({ templates: clips as VoiceTemplates })
    const f = await session.store?.getFarmer(s.farmerId)
    if (f) await session.store?.putFarmer({ ...f, voice: clips })
    go('photos')
  }
  return (
    <Screen step="Step 2 of 5" title="Voice setup">
      <p class="muted">Tap, then the farmer says the word, 2 times each. Ikawa learns her own voice. No language needed.</p>
      {WORDS.map((w) => (
        <div class="card" key={w}>
          <Btn kind="ghost" disabled={busy !== null} onClick={() => rec(w)}>{busy === w ? '🎙️ Listening…' : LABEL[w]}</Btn>
          <p>{'●'.repeat(clips[w].length)}{'○'.repeat(Math.max(0, 2 - clips[w].length))} <span class="muted">{clips[w].length}/2</span></p>
        </div>
      ))}
      {err && <p style={{ color: 'var(--warn)' }}>{err}</p>}
      <Btn disabled={!complete} onClick={save}>{t('next')}</Btn>
      <Btn kind="ghost" onClick={() => { update({ templates: null }); go('photos') }}>Skip (tap answers only)</Btn>
    </Screen>
  )
}
