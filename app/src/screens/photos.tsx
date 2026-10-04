import { useRef, useState } from 'preact/hooks'
import { Camera, Images, Loader2, X } from 'lucide-preact'
import { go } from '../app'
import { session, update, useSession, type Shot } from '../lib/session'
import { processBlob } from '../lib/shots'
import { t, tOr } from '../content/i18n'
import { MIN_LEAVES, TARGET_LEAVES } from '../lib/analyze'
import { Btn, Screen, OptImg } from './ui'

const REASON: Record<string, string> = { blurry: 'Blurry: hold still', too_dark: 'Too dark: find light', too_bright: 'Too bright: shade it' }

function Bag({ title, tone, shots, onAdd, onRemove }: { title: string; tone: 'worst' | 'good'; shots: Shot[]; onAdd: (f: File) => Promise<void>; onRemove: (i: number) => void }) {
  const cam = useRef<HTMLInputElement>(null)
  const gallery = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const ok = shots.filter((s) => s.gate.ok).length
  // Each chosen file goes through the same photo gate and model, one after another.
  const addFiles = async (input: HTMLInputElement) => {
    const files = Array.from(input.files ?? []); input.value = ''
    if (!files.length) return
    setBusy(true); try { for (const f of files) await onAdd(f) } finally { setBusy(false) }
  }
  return (
    <section class={'bag ' + tone}>
      <div class="bag-head">
        <h2>{title}</h2>
        <span class={'count' + (ok >= MIN_LEAVES ? ' done' : '')}>{ok} of {TARGET_LEAVES}</span>
      </div>
      {shots.length > 0 && (
        <div class="thumbs">
          {shots.map((s, i) => (
            <button type="button" key={i} class={'thumb ' + (s.gate.ok ? 'good' : 'bad')} onClick={() => onRemove(i)} aria-label="Remove photo">
              <img src={s.url} alt="leaf" />
              <span class="thumb-x" aria-hidden="true"><X size={14} strokeWidth={3} /></span>
              {!s.gate.ok && <span class="thumb-msg">{REASON[s.gate.reason ?? ''] ?? 'Retake photo'}</span>}
            </button>
          ))}
        </div>
      )}
      {/* `capture` opens the camera straight away; the second input has none, so the phone offers its gallery and files. */}
      <input ref={cam} data-src="camera" type="file" accept="image/*" capture="environment" hidden onChange={(e) => addFiles(e.currentTarget)} />
      <input ref={gallery} data-src="gallery" type="file" accept="image/*" multiple hidden onChange={(e) => addFiles(e.currentTarget)} />
      {busy
        ? <Btn kind="secondary" icon={Loader2} disabled>Checking the photos…</Btn>
        : (
          <div class="pair-row">
            <Btn kind="secondary" icon={Camera} onClick={() => cam.current?.click()}>{t('take_photo')}</Btn>
            <Btn kind="secondary" icon={Images} onClick={() => gallery.current?.click()}>{tOr('choose_photo', 'Choose from phone')}</Btn>
          </div>
        )}
    </section>
  )
}

export function Photos() {
  const s = useSession()
  const add = (which: 'worst' | 'good') => async (f: File) => {
    let shot: Shot
    try { shot = await processBlob(f) } catch { shot = { url: URL.createObjectURL(f), probs: null, gate: { ok: false, reason: 'unreadable' } } }
    update({ [which]: [...session[which], shot] })
  }
  const rm = (which: 'worst' | 'good') => (i: number) => update({ [which]: s[which].filter((_, j) => j !== i) })
  const n = (a: Shot[]) => a.filter((x) => x.gate.ok).length
  const ready = n(s.worst) >= MIN_LEAVES && n(s.good) >= MIN_LEAVES
  return (
    <Screen step="Step 3 of 5" title="Leaf photos" lead="One leaf per photo, flat on a dark cloth, in daylight. Tap a photo to remove it.">
      <OptImg name="leaf_guide" alt="How to photograph a leaf" exts={['svg', 'png', 'jpg', 'webp']} />
      <Bag title={t('worst_row')} tone="worst" shots={s.worst} onAdd={add('worst')} onRemove={rm('worst')} />
      <Bag title={t('good_row')} tone="good" shots={s.good} onAdd={add('good')} onRemove={rm('good')} />
      <div class="actions">
        {!ready && <p class="muted small">At least {MIN_LEAVES} clear photos in each bag; 5 is best.</p>}
        <Btn disabled={!ready} onClick={() => go('questions')}>{t('next')}</Btn>
      </div>
    </Screen>
  )
}
