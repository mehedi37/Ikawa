import { useRef, useState } from 'preact/hooks'
import { Camera, Loader2, X } from 'lucide-preact'
import { go } from '../app'
import { session, update, useSession, type Shot } from '../lib/session'
import { processBlob } from '../lib/shots'
import { t } from '../content/i18n'
import { MIN_LEAVES, TARGET_LEAVES } from '../lib/analyze'
import { Btn, Screen, OptImg } from './ui'

const REASON: Record<string, string> = { blurry: 'Blurry: hold still', too_dark: 'Too dark: find light', too_bright: 'Too bright: shade it' }

function Bag({ title, tone, shots, onAdd, onRemove }: { title: string; tone: 'worst' | 'good'; shots: Shot[]; onAdd: (f: File) => Promise<void>; onRemove: (i: number) => void }) {
  const ref = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const ok = shots.filter((s) => s.gate.ok).length
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
      <input ref={ref} type="file" accept="image/*" capture="environment" hidden onChange={async (e) => {
        const f = e.currentTarget.files?.[0]; e.currentTarget.value = ''
        if (!f) return
        setBusy(true); try { await onAdd(f) } finally { setBusy(false) }
      }} />
      <Btn kind="secondary" icon={busy ? Loader2 : Camera} disabled={busy} onClick={() => ref.current?.click()}>{busy ? 'Checking the photo…' : t('take_photo')}</Btn>
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
