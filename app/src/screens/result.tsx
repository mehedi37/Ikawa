import { useEffect, useState } from 'preact/hooks'
import {
  ThumbsUp, ThumbsDown, CircleHelp, Mic, ShoppingBasket, Flower2, Bug, Cherry, TreeDeciduous, Map as MapIcon,
  UserRound, Camera, Leaf, Send, Loader2, type LucideIcon,
} from 'lucide-preact'
import { go } from '../app'
import { session, update, useSession } from '../lib/session'
import { recordMfcc } from '../lib/media'
import { loadPlot } from '../lib/plot'
import { areaText } from './early'
import { analyze, toCaseFile, escalationMask, nonLeafCauses } from '../lib/analyze'
import { classify, encodeCase, parseOfficerReply, type Answers, type AnswerCode } from '../adapters'
import { QUESTIONS } from '../content/questions'
import { cardForCause, getCard, escalationCard, healthyCard, type Card } from '../content/cards'
import { isMachineDrafted, t, useLang } from '../content/i18n'
import { AudioBtn, Bar, Btn, Screen, nice, evText, OptImg, Pict, causeIcon, dedupeEvidence } from './ui'

const Q_ICON: Record<string, LucideIcon> = {
  lastSeasonHeavy: ShoppingBasket, flowersDropped: Flower2, bugSeen: Bug, berryHoles: Cherry, treeAgeOver20: TreeDeciduous, wholeFarm: MapIcon,
}

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
      else setMsg('I did not catch that. Tap an answer instead.')
    } catch { setMsg('The microphone is not available. Tap an answer instead.') }
    setListening(false)
  }
  const [yes, no] = q.custom ?? [t('yes'), t('no')]
  return (
    <Screen step={`Question ${i + 1} of ${QUESTIONS.length}`} title={t(q.id)}>
      {q.img ? <OptImg name={q.img} alt={t(q.id)} /> : <div class="q-pict"><Pict icon={Q_ICON[q.key] ?? CircleHelp} /></div>}
      <div class="q-tools">
        <AudioBtn id={q.id} />
        {s.templates && <Btn kind="secondary" icon={Mic} disabled={listening} onClick={speak}>{listening ? 'Listening…' : 'Answer by voice'}</Btn>}
      </div>
      {msg && <p class="error" role="alert">{msg}</p>}
      <div class="choice">
        <button type="button" class="btn choice-btn" onClick={() => answer(1)}><ThumbsUp size={22} aria-hidden="true" /><span>{yes}</span></button>
        <button type="button" class="btn choice-btn" onClick={() => answer(0)}><ThumbsDown size={22} aria-hidden="true" /><span>{no}</span></button>
      </div>
      <Btn kind="secondary" icon={CircleHelp} onClick={() => answer(2)}>{t('unsure')}</Btn>
      {i > 0 && <Btn kind="quiet" onClick={() => setI(i - 1)}>{t('back')}</Btn>}
    </Screen>
  )
}

/** The one thing to do this week, joined to the verdict so it is never buried. */
function ActionCard({ card, heading }: { card: Card; heading: string }) {
  return (
    <div class="action">
      <div class="section-head"><Pict icon={causeIcon(card.cause)} tone={card.cause === 'any' ? 'cherry' : 'leaf'} /><h3>{heading}</h3></div>
      <p class="action-text">{card.text}</p>
      {card.fallback && <p class="muted small">Translation missing: English shown.</p>}
      {isMachineDrafted()
        ? <p class="badge">{t('machine_drafted_notice')}</p>
        : !card.reviewed && <p class="muted small">Written from cited guidance; not yet reviewed by an agronomist.</p>}
      <AudioBtn id={card.id} />
    </div>
  )
}

function FarmFacts() {
  const s = useSession()
  return (
    <section class="group facts">
      <h2>{t('area_title')}</h2>
      <p>{areaText(s.area)}</p>
      {s.plotExtra?.rainAsOf && <p class="muted small">{t('rain_asof', { date: s.plotExtra.rainAsOf })}</p>}
      {s.plotExtra?.maxDailyMm != null && <p class="muted small">{t('rain_caption', { mm: s.plotExtra.maxDailyMm })}</p>}
    </section>
  )
}

const NotChecked = ({ ids }: { ids: string[] }) => (
  <section class="group">
    <h2>{t('what_i_could_not_check')}</h2>
    <ul class="plain">{ids.map((e) => <li key={e}>{evText('nc', e)}</li>)}</ul>
  </section>
)

const Why = ({ ids }: { ids: string[] }) => (
  <details class="card why">
    <summary>Why I think so <span class="muted small">({ids.length} pieces of evidence)</span></summary>
    <h3>{t('evidence_used')}</h3>
    <ul class="plain">{ids.map((e) => <li key={e}>{evText('ev', e)}</li>)}</ul>
  </details>
)

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
  if (busy || !r) return <Screen title="Weighing the evidence…"><div class="q-pict"><Pict icon={Loader2} tone="quiet" /></div></Screen>
  const retake = () => { update({ worst: [], result: null, healthy: false, sms: null, caseId: null }); go('photos') }

  if (s.cannotRead) {
    return (
      <Screen step="Step 5 of 5" title={t('cannot_read_title')}>
        <section class="verdict cherry">
          <div class="section-head"><Pict icon={Leaf} tone="cherry" /><p class="verdict-body">{t('cannot_read_body')}</p></div>
          <ul class="plain">{r.abstainReasons.map((a) => <li key={a}>{evText('ab', a)}</li>)}</ul>
        </section>
        <div class="actions">
          <Btn icon={Send} onClick={() => go('escalate')}>{t('send_person')}</Btn>
          <Btn kind="secondary" icon={Camera} onClick={retake}>{t('retake')}</Btn>
        </div>
        <FarmFacts />
      </Screen>
    )
  }

  if (s.healthy) {
    const top = nonLeafCauses(r)
    const hc = healthyCard(top.map((c) => c.id))
    return (
      <Screen step="Step 5 of 5" title={t('healthy_title')}>
        <section class="verdict leaf">
          <p class="verdict-body">{t('healthy_body')}</p>
          {hc && !hc.costsMoney && <ActionCard card={hc} heading="One thing you can do" />}
        </section>
        <section class="group">
          <h2>Other possible reasons</h2>
          {top.map((c) => <Bar key={c.id} label={nice(c.id)} p={c.p} />)}
        </section>
        <NotChecked ids={r.notChecked} />
        <FarmFacts />
        <div class="actions">
          <Btn kind="secondary" icon={UserRound} onClick={() => go('escalate')}>{t('send_anyway')}</Btn>
          <Btn kind="quiet" onClick={() => go('home')}>Finish</Btn>
        </div>
      </Screen>
    )
  }

  const card = r.abstain ? escalationCard() : cardForCause(r.top, r.causes[0].p)
  const others = r.causes.filter((c) => c.p >= 0.03).slice(r.abstain ? 0 : 1, 5)
  const evidence = dedupeEvidence(r.evidence)
  return (
    <Screen step="Step 5 of 5" title={t('result_title')}>
      {r.abstain ? (
        <section class="verdict cherry">
          <div class="section-head"><Pict icon={UserRound} tone="cherry" /><h2>{t('not_sure_title')}</h2></div>
          <p class="verdict-body">{t('not_sure_body')}</p>
          <ul class="plain">{r.abstainReasons.map((a) => <li key={a}>{evText('ab', a)}</li>)}</ul>
          <Btn icon={Send} onClick={() => go('escalate')}>{t('send_person')}</Btn>
        </section>
      ) : (
        <section class="verdict leaf">
          <h2 class="verdict-title">Most likely: {nice(r.top).toLowerCase()}</h2>
          <Bar label="How strongly the evidence points here" p={r.causes[0].p} hi />
          <ActionCard card={card} heading="What to do this week" />
        </section>
      )}
      {others.length > 0 && (
        <section class="group">
          <h2>{r.abstain ? 'Possible causes' : 'Less likely'}</h2>
          {others.map((c) => <Bar key={c.id} label={nice(c.id)} p={c.p} />)}
        </section>
      )}
      <Why ids={evidence} />
      <NotChecked ids={r.notChecked} />
      <FarmFacts />
      <div class="actions">
        {!r.abstain && <Btn kind="secondary" icon={UserRound} onClick={() => go('escalate')}>Ask a person anyway</Btn>}
        <Btn kind="quiet" onClick={() => go('home')}>Finish</Btn>
      </div>
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
    <Screen title={t('send_person')} lead="The whole case fits in one text message. It works on 2G, with no data plan.">
      <figure class="sms">
        <code>{sms}</code>
        <figcaption>{sms.length} of 160 characters</figcaption>
      </figure>
      <section class="group">
        <label class="field-label" for="officer">Officer phone number</label>
        <input id="officer" class="field" type="tel" value={num} onInput={(e) => setNum(e.currentTarget.value)} />
        <a class="btn primary" href={link} onClick={send}><Send size={22} aria-hidden="true" /><span>{t('send_sms')}</span></a>
        {queued && <p class="notice leaf">Saved in outbox on this phone.</p>}
      </section>
      <section class="group">
        <h2>Officer reply</h2>
        <p class="muted small">The officer answers with a card code. Type it here to show and play that card.</p>
        <input class="field" type="text" placeholder="A07" value={reply} onInput={(e) => setReply(e.currentTarget.value)} aria-label="Officer reply code" />
        {reply && !code && <p class="error">That is not a card code. Codes run from A01 to A30.</p>}
        {code && !card && <p class="notice cherry">Card {code} is not on this phone yet.</p>}
        {card && <ActionCard card={card} heading={`Card ${card.id}`} />}
      </section>
      <div class="actions"><Btn kind="quiet" onClick={() => go('home')}>Done</Btn></div>
    </Screen>
  )
}
