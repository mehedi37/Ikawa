import { useEffect, useState } from 'preact/hooks'
import { go } from '../app'
import { session, update, useSession } from '../lib/session'
import { recordMfcc } from '../lib/media'
import { loadPlot } from '../lib/plot'
import { areaText } from './early'
import { analyze, toCaseFile, escalationMask, nonLeafCauses } from '../lib/analyze'
import { classify, encodeCase, parseOfficerReply, type Answers, type AnswerCode } from '../adapters'
import { QUESTIONS } from '../content/questions'
import { cardForCause, getCard, escalationCard, healthyCard } from '../content/cards'
import { isMachineDrafted, t, useLang } from '../content/i18n'
import { AudioBtn, Bar, Btn, Screen, nice, evText, OptImg } from './ui'

export function Questions() {
  const s = useSession()
  useLang()
  const [i, setI] = useState(0)
  const [msg, setMsg] = useState('')
  const [listening, setListening] = useState(false)
  const q = QUESTIONS[i]
  const answer = (v: AnswerCode) => {
    update({ answers: { ...s.answers, [q.key]: v } })
    setMsg('')
    if (i + 1 < QUESTIONS.length) setI(i + 1); else go('result')
  }
  const speak = async () => {
    setListening(true); setMsg('')
    try {
      const r = classify(await recordMfcc(), s.templates!)
      if (r.word && r.confident) answer(({ yes: 1, no: 0, unsure: 2 } as const)[r.word])
      else setMsg('I did not catch that. Please tap an answer.')
    } catch { setMsg('Could not use the microphone. Please tap an answer.') }
    setListening(false)
  }
  const [yes, no] = q.custom ?? [t('yes'), t('no')]
  return (
    <Screen step={`Question ${i + 1} of ${QUESTIONS.length}`} title={t(q.id)}>
      <p class="big">{q.emoji}</p>
      {q.img && <OptImg name={q.img} alt={t(q.id)} />}
      <AudioBtn id={q.id} />
      {s.templates && <Btn kind="ghost" disabled={listening} onClick={speak}>{listening ? '🎙️ Listening…' : '🎙️ Answer by voice'}</Btn>}
      {msg && <p style={{ color: 'var(--warn)' }}>{msg}</p>}
      <div class="row">
        <button type="button" class="btn" onClick={() => answer(1)}>👍 {yes}</button>
        <button type="button" class="btn" onClick={() => answer(0)}>👎 {no}</button>
      </div>
      <Btn kind="ghost" onClick={() => answer(2)}>🤷 {t('unsure')}</Btn>
      {i > 0 && <Btn kind="ghost" onClick={() => setI(i - 1)}>{t('back')}</Btn>}
    </Screen>
  )
}

export function Result() {
  const s = useSession()
  useLang()
  const [busy, setBusy] = useState(true)
  useEffect(() => {
    void (async () => {
      const answers = { lastSeasonHeavy: 2, flowersDropped: 2, bugSeen: 2, berryHoles: 2, treeAgeOver20: 2, wholeFarm: 2, ...session.answers } as Answers
      const loaded = await loadPlot(session.area, session.asOf)
      const plot = loaded?.plot ?? null
      const { result, bag, contrast, cannotRead, healthy } = analyze(session.worst, session.good, answers, plot)
      const cf = toCaseFile(session.farmerId, result, bag, contrast, answers, plot)
      const sms = encodeCase(cf)
      const caseId = `${session.farmerId}-${Date.now()}`
      update({ result, plot, plotExtra: loaded?.extra ?? null, cannotRead, healthy, sms, caseId })
      await session.store?.putCase({ id: caseId, farmerId: session.farmerId, createdAt: Date.now(), sms,
        payload: { causes: result.causes, abstain: result.abstain, abstainReasons: result.abstainReasons, escalation: escalationMask(result),
          answers, plot, registryConsent: session.consents.registry, photoConsent: session.consents.photos } })
      setBusy(false)
    })()
  }, [])
  const r = s.result
  if (busy || !r) return <Screen title="Thinking…"><p class="big">🔍</p></Screen>
  const retake = () => { update({ worst: [], result: null, healthy: false, sms: null, caseId: null }); go('photos') }
  if (s.cannotRead) {
    return (
      <Screen step="Step 5 of 5" title={t('cannot_read_title')}>
        <div class="card cannot"><p class="big">🍃❓</p><p>{t('cannot_read_body')}</p>
          <ul class="plain">{r.abstainReasons.map((a) => <li key={a}>{evText('ab', a)}</li>)}</ul></div>
        <Btn onClick={retake}>📷 {t('retake')}</Btn>
        <Btn kind="ghost" onClick={() => go('escalate')}>{t('send_person')}</Btn>
        <p class="muted">{areaText(s.area)}</p>
      </Screen>
    )
  }
  if (s.healthy) {
    const top = nonLeafCauses(r)
    const hc = healthyCard(top.map((c) => c.id))
    return (
      <Screen step="Step 5 of 5" title={t('healthy_title')}>
        <div class="card ok healthy"><p class="big">🍃✅</p><p>{t('healthy_body')}</p></div>
        {top.map((c) => <Bar key={c.id} label={nice(c.id)} p={c.p} />)}
        {hc && !hc.costsMoney && (
          <div class="card ok">
            <p class="big">{hc.pictogram}</p><p>{hc.text}</p>
            {hc.fallback && <small class="muted">Translation missing: English shown. </small>}
            {(!hc.reviewed || isMachineDrafted()) && <small class="badge">{t('machine_drafted_notice')}</small>}
            <div><AudioBtn id={hc.id} /></div>
          </div>
        )}
        <div class="card"><b>{t('what_i_could_not_check')}</b><ul class="plain">{r.notChecked.map((e) => <li key={e}>{evText('nc', e)}</li>)}</ul></div>
        <div class="card"><b>{t('area_title')}</b><p>{areaText(s.area)}</p></div>
        <Btn kind="ghost" onClick={() => go('escalate')}>{t('send_anyway')}</Btn>
        <Btn kind="ghost" onClick={() => go('home')}>Finish</Btn>
      </Screen>
    )
  }
  const card = r.abstain ? escalationCard() : cardForCause(r.top, r.causes[0].p)
  return (
    <Screen step="Step 5 of 5" title={t('result_title')}>
      {r.abstain ? (
        <div class="card warn"><p class="big">🧑‍🌾❓</p><h2>{t('not_sure_title')}</h2><p>{t('not_sure_body')}</p>
          <ul class="plain">{r.abstainReasons.map((a) => <li key={a}>{evText('ab', a)}</li>)}</ul></div>
      ) : <h2>Most likely: {nice(r.top)}</h2>}
      {r.causes.filter((c) => c.p >= 0.03).slice(0, 5).map((c, k) => <Bar key={c.id} label={nice(c.id)} p={c.p} hi={k === 0 && !r.abstain} />)}
      <div class="card"><b>{t('evidence_used')}</b><ul class="plain">{r.evidence.map((e) => <li key={e}>{evText('ev', e)}</li>)}</ul></div>
      <div class="card"><b>{t('what_i_could_not_check')}</b><ul class="plain">{r.notChecked.map((e) => <li key={e}>{evText('nc', e)}</li>)}</ul></div>
      <div class="card"><b>{t('area_title')}</b><p>{areaText(s.area)}</p>
        {s.plotExtra?.rainAsOf && <p class="muted">{t('rain_asof', { date: s.plotExtra.rainAsOf })}</p>}
        {s.plotExtra?.maxDailyMm != null && <p class="muted">{t('rain_caption', { mm: s.plotExtra.maxDailyMm })}</p>}
      </div>
      <div class={'card ' + (card.costsMoney ? '' : 'ok')}>
        <p class="big">{card.pictogram}</p><p>{card.text}</p>
        {card.fallback && <small class="muted">Translation missing: English shown. </small>}
        {(!card.reviewed || isMachineDrafted()) && <small class="badge">{t('machine_drafted_notice')}</small>}
        <div><AudioBtn id={card.id} /></div>
      </div>
      <Btn kind={r.abstain ? 'primary' : 'ghost'} onClick={() => go('escalate')}>{r.abstain ? t('send_person') : 'Ask a person anyway'}</Btn>
      <Btn kind="ghost" onClick={() => go('home')}>Finish</Btn>
    </Screen>
  )
}

export function Escalate() {
  const s = useSession()
  useLang()
  const [num, setNum] = useState(() => { try { return localStorage.getItem('ikawa.officer') ?? '' } catch { return '' } })
  const [reply, setReply] = useState('')
  const [queued, setQueued] = useState(false)
  const code = parseOfficerReply(reply)
  const card = code ? getCard(code) : undefined
  const sms = s.sms ?? ''
  const link = `sms:${num}?body=${encodeURIComponent(sms)}`
  const send = async () => {
    try { localStorage.setItem('ikawa.officer', num) } catch { /* ignore */ }
    if (s.caseId) { await s.store?.queueSms({ id: s.caseId, caseId: s.caseId, sms, createdAt: Date.now() }); setQueued(true) }
  }
  return (
    <Screen title={t('send_person')}>
      <p class="big">✉️</p>
      <div class="card"><code>{sms}</code><br /><small class="muted">{sms.length} / 160 characters</small></div>
      <label>Officer phone number<input type="tel" value={num} onInput={(e) => setNum(e.currentTarget.value)} /></label>
      <a class="btn" href={link} onClick={send}>📤 {t('send_sms')}</a>
      {queued && <p>Saved in outbox on this phone.</p>}
      <h2>Officer reply</h2>
      <input type="text" placeholder="A07" value={reply} onInput={(e) => setReply(e.currentTarget.value)} aria-label="Officer reply code" />
      {reply && !code && <p style={{ color: 'var(--warn)' }}>Not a valid code (A01 to A30).</p>}
      {code && !card && <div class="card warn">Card {code} is not on this phone yet.</div>}
      {card && <div class="card ok"><p class="big">{card.pictogram}</p><p>{card.text}</p>{(!card.reviewed || isMachineDrafted()) && <small class="badge">{t('machine_drafted_notice')}</small>}<AudioBtn id={card.id} /></div>}
      <Btn kind="ghost" onClick={() => go('home')}>Done</Btn>
    </Screen>
  )
}
