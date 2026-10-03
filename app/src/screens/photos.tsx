import { useRef, useState } from 'preact/hooks'
import { go } from '../app'
import { session, update, useSession, type Shot } from '../lib/session'
import { processBlob } from '../lib/shots'
import { t } from '../content/i18n'
import { MIN_LEAVES, TARGET_LEAVES } from '../lib/analyze'
import { Btn, Screen, OptImg } from './ui'

const REASON: Record<string, string> = { blurry: 'Blurry. Hold still.', too_dark: 'Too dark. Find light.', too_bright: 'Too bright. Shade it.' }

function Bag({ title, emoji, shots, onAdd, onRemove }: { title: string; emoji: string; shots: Shot[]; onAdd: (f: File) => Promise<void>; onRemove: (i: number) => void }) {
  const ref = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const ok = shots.filter((s) => s.gate.ok).length
  return (
    <div class="card">
      <h2>{emoji} {title} <small>{ok}/{TARGET_LEAVES}</small></h2>
      <div class="thumbs">
        {shots.map((s, i) => (
          <button type="button" key={i} class={'thumb ' + (s.gate.ok ? 'good' : 'bad')} onClick={() => onRemove(i)} aria-label="Remove photo">
            <img src={s.url} alt="leaf" /><span>{s.gate.ok ? 'OK' : REASON[s.gate.reason ?? ''] ?? 'Retake photo'}</span>
          </button>
        ))}
      </div>
      <input ref={ref} type="file" accept="image/*" capture="environment" hidden onChange={async (e) => {
        const f = e.currentTarget.files?.[0]; e.currentTarget.value = ''
        if (!f) return
        setBusy(true); try { await onAdd(f) } finally { setBusy(false) }
      }} />
      <Btn disabled={busy} onClick={() => ref.current?.click()}>{busy ? '⏳ Checking…' : '📷 ' + t('take_photo')}</Btn>
      <p class="muted">Leaf on a dark cloth. Tap a photo to remove it. Red = retake.</p>
    </div>
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
    <Screen step="Step 3 of 5" title="Leaf photos">
      <OptImg name="leaf_guide" alt="How to photograph a leaf" exts={['svg', 'png', 'jpg', 'webp']} />
      <Bag title={t('worst_row')} emoji="🥀" shots={s.worst} onAdd={add('worst')} onRemove={rm('worst')} />
      <Bag title={t('good_row')} emoji="🌿" shots={s.good} onAdd={add('good')} onRemove={rm('good')} />
      {!ready && <p class="muted">At least {MIN_LEAVES} good photos per bag (5 is best).</p>}
      <Btn disabled={!ready} onClick={() => go('questions')}>{t('next')}</Btn>
    </Screen>
  )
}
