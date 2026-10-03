# Ikawa — Business Plan

> ⚠️ **Partly superseded (2026-10-04).** This document was written before the build. Where it conflicts with `docs/decisions.md`, **the decision log wins**. Key changes: setting is now **Kenya (Kirinyaga) + Kiswahili** (D-019, D-029; the Rwanda/Kinyarwanda text below is historical); the vision model is **MobileNetV2** (D-027); **JMuBEN is 98% copies** (D-028); a field-photo shortcut failure was found and fixed (D-030, D-031); size claim is "≈ 14 MB one-time install, ≤ 6 MB model + data" (D-025). Measured results: `docs/evidence/README.md`. Verified problem facts: `docs/problem-evidence.md`.


*Small AI for Development Hackathon · Agriculture track · Draft v1, 2026-10-03*

> Figures marked `[cite]` need a real source. Figures marked `[est]` are our working assumptions and are labelled as such in the pitch. Nothing in this plan should be presented as a measured result until it is one.

---

## 1. The story (what we pitch)

### The hook

> **"The best advice Ikawa ever gave Noor was: don't buy anything."**

Noor's coffee yield dropped. A neighbour says it's rust and she should buy fungicide. That would cost a large share of what her coffee earns `[cite input price vs. income]`. Ikawa looks at her leaves, her plot's rainfall, her soil and her answers, and says:

> *"Last season was a heavy crop. Most of this drop is a normal off-year. Some rust is on the third row, but it's light. Don't spray. Prune and mulch the third row this week. I'm not sure about the soil, so I've sent your case to the extension officer."*

Two days later her basic phone buzzes with an SMS in Kinyarwanda from the officer. She never had to travel.

### The three beats

1. **The real question.** Noor didn't ask "what is on this leaf?". She asked "why did my yield drop?". Ikawa is a **detective, not a classifier**.
2. **Honesty.** Ikawa can only choose from a fixed list and **says "I'm not sure"** instead of guessing. When it's unsure, a human gets the case in one SMS.
3. **It stays local.** Under 6 MB, shared by Bluetooth, works in airplane mode. Each case grows the cooperative's farmer registry and, with consent, the first Rwandan coffee-leaf dataset.

### Our take on "what localizing AI means"

> *"Localizing AI doesn't mean squeezing a giant model into a small language. It means an AI small enough to share between neighbours, honest enough to say 'I don't know', and built so the knowledge, and the data, stay with the farmers and the cooperative."*

---

## 2. Problem

| Layer     | Problem                                                                             | Evidence                                                                    |
| --------- | ----------------------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| Farmer    | Doesn't know why her yield fell; acts on guesses; may spend on the wrong fix        | Annex B scenario; FAOSTAT Rwanda coffee yield trend`[cite]`               |
| Extension | An officer visits "twice a year at best"; collects data by hand; alerts arrive late | Annex B; MINAGRI/RAB extension ratio`[cite]`                              |
| System    | No working farmer registry → nobody can reach farmers at scale                     | Annex B (Ukraine example: a registry unlocked services for 150,000 farmers) |
| Market    | No independent price reference at the farm gate                                     | Annex B.**Checked:** WFP data has no coffee price for Rwanda          |
| Access    | Women are less likely to own smartphones; data bundles bought only when needed      | GSMA Mobile Gender Gap`[cite]`; §05 persona                              |

---

## 3. Solution

Ikawa is an offline, under-6 MB web app run by a youth agent or a family member's smartphone. Noor reaches it with her basic phone by SMS.

| Feature                                                   | AI?                        | Value                                                         |
| --------------------------------------------------------- | -------------------------- | ------------------------------------------------------------- |
| Leaf vision with a "can't read this" class                | ✅ Computer vision         | Spots rust, cercospora, phoma, leaf miner; refuses bad photos |
| Voice answers from her own voice samples                  | ✅ Pattern recognition     | Works in any language, 0 MB                                   |
| Yield detective (ranks the causes)                        | ✅ Probabilistic reasoning | Answers "why", including "it's normal"                        |
| Abstain → one-SMS case to the officer → reply code      | Rules                      | Human in the loop at almost no cost                           |
| Audio action cards in Kinyarwanda                         | Pre-recorded               | No hallucination, no literacy needed                          |
| Farmer registry record                                    | Rules                      | Fixes the system bottleneck                                   |
| Price card (maize/beans from WFP + official coffee price) | ❌ on purpose              | SMS-level problem, so we use an SMS-level tool                |

---

## 4. Customers and who pays

**The farmer never pays.** The people who benefit from scale pay.

| Segment                                                                  | What they get                                                                     | Why they'd pay                                                                                                                    | Model`[est]`                 |
| ------------------------------------------------------------------------ | --------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- | ------------------------------ |
| **Coffee cooperatives / washing stations**                         | A geolocated farmer registry, early warning (Rust Radar), better-quality cherries | Fewer losses, better grades, and traceability for buyers                                                                          | Annual licence per cooperative |
| **Exporters / specialty buyers**                                   | Plot-level geolocation + farm records                                             | EU Deforestation Regulation (EUDR) requires geolocation of coffee plots for EU imports**[verify current application date]** | Per-farmer traceability fee    |
| **Government extension (MINAGRI/RAB, NAEB)**                       | Better-targeted visits, case data, registry that plugs into existing systems      | Cost per farmer reached is far below a physical visit                                                                             | Programme contract             |
| **Development partners** (World Bank AgriConnect, IFAD, FAO, NGOs) | A replicable, auditable advisory tool                                             | Directly matches AgriConnect's goal of reaching 300M farmers (Annex B)                                                            | Grant-funded pilots → scale   |

**Youth agents** earn a per-case or monthly fee from the cooperative or programme, which creates jobs and ties into the brief's background on youth employment (1.2 billion young people vs 420 million jobs, §01).

---

## 5. Competition and why we're different

| Existing approach                                              | What it does                                    | Gap Ikawa fills                                                                    |
| -------------------------------------------------------------- | ----------------------------------------------- | ---------------------------------------------------------------------------------- |
| **Plantix**-style apps `[verify features]`             | Photo diagnosis, mostly online, smartphone only | Offline, basic-phone channel, "why did yield drop", abstains                       |
| **PlantVillage Nuru** `[verify crops/coffee coverage]` | Offline AI diagnosis on phone (key prior art)   | Cause ranking with weather + soil, registry, SMS escalation, voice in any language |
| **LLM farmer chatbots** (e.g. Farmer.Chat) `[verify]`  | Free-text advice, needs data                    | No hallucination by design, works offline, under 6 MB                              |
| **SMS / IVR advisory** (e.g. push messages, 3-2-1 lines) | Generic broadcasts                              | Advice specific to*her* plot, leaves and answers                                 |
| **Extension officer visits**                             | Trusted, expert                                 | Twice a year; Ikawa makes each visit count and handles routine cases remotely      |

**Defensible edge:** (1) framing around causes of the yield drop, (2) the closed-list + abstain design, (3) voice that needs no language data, (4) the registry and local dataset that build up with use.

---

## 6. SWOT

| Strengths                                           | Weaknesses                                               |
| --------------------------------------------------- | -------------------------------------------------------- |
| Answers the farmer's real question (unique framing) | Detective priors are hand-set; tested on synthetic cases |
| No hallucination by design; abstaining is built in  | No Rwandan leaf images yet                               |
| Under 6 MB, works fully offline, no server          | Depends on an agent or family smartphone                 |
| Real rain/soil data per plot (verified access)      | Voice templates are speaker-dependent                    |
| Fixes the registry bottleneck                       | Native-language quality depends on one reviewer          |

| Opportunities                                          | Threats                                              |
| ------------------------------------------------------ | ---------------------------------------------------- |
| AgriConnect's 300M-farmer goal; World Bank programmes  | Rwanda's good coverage → "why offline?"             |
| EUDR traceability demand**[verify]**             | Big players (Plantix, Nuru) add similar features     |
| Give-back dataset → the first Rwandan coffee-leaf set | Wrong advice harms trust; liability                  |
| Same pipeline for beans, maize, other crops/countries  | MMS-TTS non-commercial licence blocks commercial use |

---

## 7. Strong points (why we can win)

1. **The framing.** "Detective, not classifier" is the one line judges will remember. It comes straight from Annex B's "she cannot say why".
2. **The pass/fail fail-safe is the product itself.** Most teams will add a confidence number on top. Ours is "not sure → one SMS → officer reply code → audio in her language".
3. **Small details that show we read the brief closely:** phone at the house, daughter's phone at weekends, third row, 40 mm overnight, registry bottleneck, data bundles, women's phone access.
4. **Honest about where we don't use AI** (price, photo-quality check, transport). That directly answers the 15% "would a simpler tool do the same?" criterion.
5. **Real data, actually pulled:** NASA POWER rain, SoilGrids pH 5.1 for a real Rwandan point, WFP prices. We also found that WFP has **no coffee prices** in Rwanda, which shows we checked the data ourselves.
6. **Expert-level ML care:** split by original image to avoid JMuBEN augmentation leakage, calibration, selective-accuracy curve, field-shift test.
7. **Answer to the less-supported-language question:** voice that works in any language, plus a real test in Kirundi and one unrelated language.
8. **Scale story:** swap the crop pack (iBean demo) and the region's rain/soil grid, and the voice layer works for any language.

## 8. Weakest points (how we could lose) and how we protect against them

Ranked by how likely each is to cost us first place.

| #  | Risk                                                 | Why it would lose                                             | Mitigation                                                                                                 | Owner   |
| -- | ---------------------------------------------------- | ------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- | ------- |
| 1  | **Demo doesn't work end-to-end**               | Built solution is 25%; a broken demo is fatal                 | Scope rule D-015: core loop by the midpoint; record the video early; stretch goals only after              | All     |
| 2  | **Bad Kinyarwanda**                            | A native-speaking judge notices immediately; credibility gone | Native speaker reviews every string and clip; if none available, revisit D-003                             | Content |
| 3  | **Synthetic detective evaluation dismissed**   | "Evidence it works" (15%) looks weak                          | Cite each likelihood; sensitivity analysis; agronomist review if possible; be explicit that it's synthetic | Data    |
| 4  | **Inflated vision accuracy**                   | Experts spot leakage → trust collapses                       | Group split, report field-shift drop honestly                                                              | ML      |
| 5  | **"Noor isn't using it, an agent is"**         | Judges may say it's not her device                            | Basic-phone SMS channel; she starts cases and makes every decision; agents create jobs                     | Pitch   |
| 6  | **"Why offline in Rwanda?"**                   | Undercuts the core constraint                                 | OpenCelliD valley gaps, data-bundle cost, phone-at-house persona detail                                    | Data    |
| 7  | **"How is this different from Nuru/Plantix?"** | Looks like a copy                                             | Competition table ready (§5); lead with cause ranking + abstain                                           | Pitch   |
| 8  | **Voice demo fails live**                      | Looks fragile                                                 | Tap fallback always visible; show measured accuracy in noise                                               | App     |
| 9  | **Too many features, unclear story**           | Clarity is 15%; judges lose the thread                        | One story (Noor, third row, "don't buy anything") carries the whole video                                  | Video   |
| 10 | **Video weak or late**                         | No video = not shortlisted                                    | Draft the video structure on Day 1; record by Day 2 midday                                                 | Video   |
| 11 | **Authenticity: non-Rwandan team**             | "Your take" sounds generic                                    | Speak honestly about our own context and what we learned; consider our home region                         | All     |
| 12 | **Licence slip** (MMS-TTS NC, Kaggle terms)    | Responsible-AI pass/fail doubt                                | Licence table; state NC limits and the production plan                                                     | Data    |

---

## 9. Impact model

| Metric                                                        | How we'd measure in a pilot                           |
| ------------------------------------------------------------- | ----------------------------------------------------- |
| Farmers reached per agent per season                          | Case logs`[est target]`                             |
| % of cases resolved without escalation, and accuracy of those | Officer review sample                                 |
| Money**not** spent on unnecessary inputs                | Before/after survey; "don't buy" verdicts followed up |
| Officer response time to escalated cases                      | SMS timestamps                                        |
| Registry records created (by gender)                          | Registry export                                       |
| Yield change next season vs comparison group                  | Cooperative delivery records                          |
| Consented images added to the local dataset                   | Give-back loop                                        |

---

## 10. Go-to-market roadmap

| Phase                         | When             | Goal                                                                                                                   | Success test                                   |
| ----------------------------- | ---------------- | ---------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------- |
| **0. Hackathon**        | Oct 3–4, 2026   | Working offline prototype + video                                                                                      | Shortlist → sector winner                     |
| **1. Seoul**            | Oct 19–22, 2026 | Ignite talk; meet a cooperative partner, ministry contacts, AgriConnect team                                           | 1 pilot partner + 1 funder conversation        |
| **2. Field validation** | Months 1–3      | 1 cooperative, 5 youth agents, ~500 farmers`[est]`; collect consented Rwandan leaf images; native-speaker recordings | Field accuracy, abstain rate, officer workload |
| **3. Pilot**            | Months 4–9      | 3–5 cooperatives; retrain on local data; registry export into existing national systems**[verify which]**       | Cost per farmer reached; "don't buy" savings   |
| **4. Scale**            | Year 2           | Second crop (beans/maize) + second country                                                                             | Licence revenue covers agent costs             |

---

## 11. Costs `[est]` — all assumptions, to validate

| Item                                       | Hackathon                         | Pilot (1 cooperative, 6 months)        |
| ------------------------------------------ | --------------------------------- | -------------------------------------- |
| Hosting                                    | US$0 (static hosting)             | ~US$0–20/month                        |
| Cloud AI calls                             | US$0 (none; everything on device) | US$0                                   |
| Low-end Android phones for agents          | —                                | 5 ×`[est price]`                    |
| Agent stipends                             | —                                | 5 × 6 months ×`[est]`              |
| Native-speaker recordings + review         | Volunteer                         | `[est]`                              |
| Agronomist review of action cards + priors | Volunteer                         | `[est]`                              |
| SMS (escalation + results)                 | Test credit                       | ~2 SMS per case ×`[local SMS rate]` |

**Key point:** the cost per farmer is mostly human (agents, officers), not compute. That's the right shape for a development tool, and it also creates jobs.

---

## 12. Team and roles (fill in)

| Role              | Person           | Responsibility                                            |
| ----------------- | ---------------- | --------------------------------------------------------- |
| ML lead           |                  | Leaf model, calibration, evaluation                       |
| App lead          |                  | PWA, offline, voice, SMS                                  |
| Data + content    |                  | Rain/soil grid, detective priors, action cards, citations |
| Story + video     |                  | Pitch, video, "our take", submission                      |
| Language reviewer | (native speaker) | Every Kinyarwanda string and clip                         |

---

## 13. The ask (for Seoul)

1. **One cooperative partner** in a coffee district for field validation.
2. **Introductions** to national extension and the registry owners, so we plug in rather than duplicate.
3. **A small pilot grant** for agent phones, stipends and native-speaker recordings.
4. **Agronomy partners** to validate the action cards and the detective's priors.
