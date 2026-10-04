import { useEffect, useState } from 'preact/hooks'
import { go } from '../app'
import { session } from '../lib/session'
import { share } from '../lib/media'
import { decodeCase, type CaseFile } from '../adapters'
import type { CaseRecord } from '../store'
import { allCards, getCard } from '../content/cards'
import { useLang } from '../content/i18n'
import { AudioBtn, Btn, Screen, nice } from './ui'

export function Officer() {
  useLang()
  const [text, setText] = useState('')
  const [pickCode, setPickCode] = useState('')
  let c: CaseFile | null = null, err = ''
  if (text.trim()) { try { c = decodeCase(text.trim()) } catch (e) { err = (e as Error).message } }
  const card = pickCode ? getCard(pickCode) : undefined
  return (
    <Screen title="Officer">
      <p class="muted">Paste the case SMS.</p>
      <textarea rows={3} value={text} onInput={(e) => setText(e.currentTarget.value)} aria-label="Case SMS" />
      {err && <div class="card warn">Could not read this SMS: {err}</div>}
      {c && (
        <div class="card"><table><tbody>
          <tr><td>Farmer</td><td>{c.farmerId}</td></tr>
          <tr><td>Likely causes</td><td>{c.causes.map((x) => `${nice(x.id)} ${Math.round(x.p * 100)}%`).join(', ')}</td></tr>
          <tr><td>Leaf model</td><td>{nice(c.vision.top)} {Math.round(c.vision.prob * 100)}%, worst vs good row contrast {c.vision.contrast}</td></tr>
          <tr><td>Soil pH</td><td>{c.soilPh ?? 'unknown'}</td></tr>
          <tr><td>Rain</td><td>{c.rainAnomalyPct}% vs normal at flowering, {c.rainDays} days of 40 mm+</td></tr>
          <tr><td>Answers</td><td>{Object.entries(c.answers).map(([k, v]) => `${k}: ${v === 1 ? 'yes' : v === 0 ? 'no' : '?'}`).join('; ')}</td></tr>
          <tr><td>Location</td><td>{c.lat}, {c.lon}</td></tr>
          <tr><td>Why sent</td><td>{[c.escalation & 1 && 'photo', c.escalation & 2 && 'vision unsure', c.escalation & 4 && 'cause unsure', c.escalation & 8 && 'answers contradict'].filter(Boolean).join(', ') || '-'}</td></tr>
        </tbody></table></div>
      )}
      <h2>Reply with a card</h2>
      <div class="row" style={{ flexWrap: 'wrap' }}>
        {allCards().map((k) => (
          <button type="button" key={k.id} class={'btn ghost' + (pickCode === k.id ? ' sel' : '')} style={{ flex: '1 0 30%' }} onClick={() => setPickCode(k.id)}>{k.pictogram} {k.id}</button>
        ))}
      </div>
      {card && <div class="card ok"><p class="big">{card.pictogram}</p><p>{card.text}</p><p>Send this SMS to the farmer: <b>{card.id}</b></p>
        <a class="btn" href={`sms:?body=${encodeURIComponent(card.id)}`}>📤 Reply by SMS</a><AudioBtn id={card.id} /></div>}
      <Btn kind="ghost" onClick={() => go('home')}>Home</Btn>
    </Screen>
  )
}

type Row = CaseRecord & { synced: boolean }
const mb = (b: number) => (b >= 1e9 ? `${(b / 1e9).toFixed(1)} GB` : `${(b / 1e6).toFixed(1)} MB`)

export function Coop() {
  const [rows, setRows] = useState<Row[]>([])
  const [sel, setSel] = useState<Set<string>>(new Set())
  const [exported, setExported] = useState(false)
  const [est, setEst] = useState<{ usage?: number; quota?: number } | null>(null)
  const load = async () => {
    setRows(((await session.store?.listCases()) ?? []).sort((a, b) => b.createdAt - a.createdAt))
    try { setEst((await navigator.storage?.estimate?.()) ?? null) } catch { setEst(null) }
  }
  useEffect(() => { void load() }, [])
  const nSynced = rows.filter((r) => r.synced).length
  const chosen = rows.filter((r) => sel.has(r.id))
  // Respect registry consent: without it, farmer id and location are left out.
  const flat = (r: Row) => {
    const p = r.payload as { causes?: { id: string; p: number }[]; abstain?: boolean; escalation?: number; registryConsent?: boolean; plot?: { lat: number; lon: number } | null }
    const reg = !!p.registryConsent
    return { case: r.id, farmer: reg ? r.farmerId : '', lat: reg ? p.plot?.lat ?? '' : '', lon: reg ? p.plot?.lon ?? '' : '',
      date: new Date(r.createdAt).toISOString(), top: p.causes?.[0]?.id ?? '', topP: p.causes?.[0]?.p ?? '', abstain: !!p.abstain, escalation: p.escalation ?? 0 }
  }
  const delSynced = async () => { await session.store?.deleteSynced(); setSel(new Set()); await load() }
  const exportAs = async (kind: 'json' | 'csv') => {
    const data = chosen.map(flat)
    if (kind === 'json') await share('ikawa-cases.json', 'application/json', JSON.stringify(data, null, 2))
    else {
      const keys = Object.keys(flat(chosen[0]))
      const body = data.map((d) => keys.map((k) => JSON.stringify(String((d as Record<string, unknown>)[k] ?? ''))).join(','))
      await share('ikawa-cases.csv', 'text/csv', [keys.join(','), ...body].join('\n'))
    }
    setExported(true)
  }
  return (
    <Screen title="Cooperative cases">
      <div class="card storage" aria-label="Storage on this phone">
        <b>Storage on this phone</b>
        <p>{rows.length} cases: {nSynced} synced, {rows.length - nSynced} not synced</p>
        {est?.usage != null && <p>Used {mb(est.usage)} of {est.quota ? mb(est.quota) : '?'}</p>}
        <p class="muted">Photos are not stored on this phone.</p>
        <Btn kind="danger" disabled={!nSynced} onClick={delSynced}>Delete synced cases from this phone</Btn>
      </div>
      {!rows.length && <p>No cases on this phone.</p>}
      {rows.map((r) => (
        <label class="card" key={r.id} style={{ display: 'block' }}>
          <input type="checkbox" checked={sel.has(r.id)} onChange={() => { const n = new Set(sel); n.has(r.id) ? n.delete(r.id) : n.add(r.id); setSel(n) }} />
          {' '}<b>{r.farmerId}</b> {new Date(r.createdAt).toLocaleDateString()} {r.synced ? '✅ synced' : '⏳ not synced'}
          <br /><small class="muted">{nice(flat(r).top as string)}</small>
        </label>
      ))}
      <div class="row"><Btn disabled={!chosen.length} onClick={() => exportAs('json')}>JSON</Btn><Btn disabled={!chosen.length} onClick={() => exportAs('csv')}>CSV</Btn></div>
      {exported && <div class="card">Did the cooperative receive the file? Only then mark synced.
        <Btn kind="ghost" onClick={async () => { await session.store?.markSynced(chosen.map((r) => r.id)); setExported(false); await load() }}>Yes, mark selected as synced</Btn></div>}
      <Btn kind="ghost" onClick={() => go('home')}>Home</Btn>
    </Screen>
  )
}
