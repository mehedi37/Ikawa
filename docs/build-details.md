# IKAWA — the coffee detective that only speaks when it's sure

> ⚠️ **Partly superseded (2026-10-04).** This document was written before the build. Where it conflicts with `docs/decisions.md`, **the decision log wins**. Key changes: setting is now **Kenya (Kirinyaga) + Kiswahili** (D-019, D-029; the Rwanda/Kinyarwanda text below is historical); the vision model is **MobileNetV2** (D-027); **JMuBEN is 98% copies** (D-028); a field-photo shortcut failure was found and fixed (D-030, D-031); size claim is "≈ 14 MB one-time install, ≤ 6 MB model + data" (D-025). Measured results: `docs/evidence/README.md`. Verified problem facts: `docs/problem-evidence.md`.


> *Small AI for Development Hackathon · Agriculture track (Annex B) · Hack-Nation × World Bank Youth Summit, Oct 3–4 2026*

**One line:** Ikawa ("coffee" in Kinyarwanda) is an offline coffee-farm detective. It works out *why* a smallholder's yield fell (it does more than label one leaf). It ranks the likely causes with honest confidence, tells the farmer what to do by voice in her own language, and hands the case to a human extension worker when it isn't sure.

**Design principle:** *It can only choose. It never invents.* Every AI output in Ikawa is a **typed decision from a closed list, with a probability attached**. Below a threshold, the only allowed answer is *"Not sure — I'm sending this to a person."* That one rule handles hallucinations, the pass/fail fail-safe and the human-in-the-loop requirement together, and it does so by design, so we don't need a disclaimer for it.

> **Track hygiene.** The PDF covers all three tracks. This entry follows **only**: the common sections (§01–§10: background, Small AI, rules, guardrails, data, deliverables, judging), the common datasets (§7.3), and **Annex B (Agriculture)**. Nothing is taken from Annex A (Health) or Annex C (Tourism) as a requirement. Where we *voluntarily* adopt a good practice that appears in another annex, it is labelled as such (see §8).
>
> **Related docs:** `business-plan.md` · `decisions.md` (decision log) · `tech-stack.md` · `data-access.md` (what we verified we can actually download).

> ⚠️ Every item marked **[verify]** must be checked before submission. Every number left as `[cite]` must be filled from a real source with country and year. **Do not submit invented figures.** The brief scores data honesty.

---

## Table of contents
1. [The story](#1-the-story)
2. [Why this is different](#2-why-this-is-different-the-small-details-we-noticed)
3. [What Ikawa does — the user journey](#3-what-ikawa-does--the-user-journey)
4. [The AI: Choice Engine](#4-the-ai-choice-engine-our-own-offline-jev-style-design)
5. [Architecture & tech stack](#5-architecture--tech-stack)
6. [Data: what we use, what it misses](#6-data-what-we-use-and-what-it-does-not-cover)
7. [Evidence it works: evaluation plan](#7-evidence-it-works--evaluation-plan)
8. [Responsible AI](#8-responsible-ai-passfail)
9. [Requirement traceability matrix](#9-requirement-traceability-matrix--every-line-of-the-pdf)
10. [What we do beyond the brief](#10-what-we-do-beyond-the-brief)
11. [Weekend build plan](#11-weekend-build-plan)
12. [Video script (2–5 min)](#12-video-script-25-min)
13. [Decisions we made and why](#13-decisions-we-made-and-why)
14. [Submission checklist](#14-submission-checklist)

---

## 1. The story

Noor is 38. She has farmed two hectares in the highlands for eleven years: coffee on the upper slope, maize and beans below. This season her coffee yield dropped and **she does not know why.**

She has three possible explanations and no way to tell them apart:
- a **disease** (the orange powder on some leaves?),
- the **weather** (that night it rained ~40 mm and the third row has looked bad since),
- the **soil** (the third row has always been the weakest).

And there is a fourth that nobody ever tells her: **it may be normal.** Arabica coffee bears in alternating heavy and light years (biennial bearing). If last season was heavy, a drop this season can be expected.

The extension officer comes **twice a year at best**. At harvest a middleman names a price for her parchment that she cannot check. Her own phone is a basic phone, and it **stays at the house** while she works the slope. Her daughter's smartphone is home only at weekends.

Most tools would give Noor a leaf classifier. That answers *"what is on this leaf?"*, which she didn't ask, and it can't give the most useful answer of all: *"don't spend money on spray; this is mostly a normal off-year, here's how to protect next season."*

**Ikawa answers the question she actually asked:** *"Why did my yield drop, and what is the one thing I should do this week?"* When it doesn't know, it says so and gets a human to her case without anyone travelling.

### Where we set it
We set Ondera in **Rwanda's western coffee highlands** (e.g. Nyamasheke / Rusizi near Lake Kivu) **[verify district choice]** because:
- Rwanda's smallholder Arabica is grown in highland cooperatives, which matches Noor's profile.
- **Kinyarwanda** has one of the largest open voice datasets in Mozilla Common Voice, so we can build and *test* honestly.
- Rwanda already runs a farmer-promoter extension model (*Twigire Muhinzi*) and a digital input/farmer platform (*Smart Nkunganire System*) **[verify both]**. Ikawa plugs into existing institutions, which the brief lists as a precondition.
- The less-supported-language question has a concrete answer: we stress-test with **Kirundi** (closely related, less data) and explain how the voice layer works even for a language with **no** dataset (see §4.3).

---

## 2. Why this is different (the small details we noticed)

Other teams will build *"photo → disease name"*. We read the brief line by line and designed around these details:

| Detail in the brief | What most teams will do | What Ikawa does |
|---|---|---|
| "Her coffee yields have slipped and she is not sure **why**" | Classify a leaf | Ranks **causes of the yield drop** (disease, pest, rain damage, drought at flowering, soil acidity, old trees, normal off-year) |
| "For most of the day she is out on the slope, and **the phone is at the house**" | Assume real-time use in the field | **Leaf-bag protocol**: during the week she picks leaves into a bag. They are photographed in the evening, at the weekend, or by the farmer promoter. Results reach her basic phone by SMS and wait for her. |
| Two phones: her **basic phone**, daughter's **smartphone at weekends** | Build a smartphone-only app | Two channels. The smartphone (daughter's or the cooperative farmer promoter's) runs the AI. Noor's basic phone gets the result in Kinyarwanda by SMS, and she can start a case by SMS. |
| iSDAsoil: "context for why **the third row** is struggling"; CHIRPS: "grounds **'40 mm overnight'**" | Ignore the hints | Our demo case *is* the third row after the 40 mm night. We pull **real** CHIRPS rainfall and iSDAsoil pH for the plot's coordinates, stored offline. |
| "The binding constraint is the absence of a **farmer registry**" | Ignore it | Each consented case creates or updates a registry record, so the registry grows as a by-product of a service farmers actually want. It's registered **in Noor's own name**, because women farmers are often missing from registries. |
| "She buys **3G data bundles** when she needs them" | Ship a 100 MB+ model | The whole app is **under 5 MB**, small enough to share over Bluetooth or Xender between neighbours. Updates are small deltas. |
| "Expect to be asked how the tool would fare in a **less-supported** language" | Say "we'd fine-tune later" | The voice-answer layer matches the farmer's **own voice samples**, so it works in *any* language, including unwritten ones (§4.3). |
| "A buyer names a price she has **no independent reference** for" | Build an "AI price predictor" | Use **no AI** here, and say so. A cached official reference price via SMS is the right tool. The judges asked exactly this: *"if SMS could do it, don't use AI."* **Checked:** the annex's suggested source (WFP via HDX) has **no coffee** for Rwanda, but it does have **maize and beans**, which are Noor's other crops. So the price card covers maize and beans from WFP, plus coffee from the official seasonal reference price **[verify NAEB source]**. |
| "**1.2 billion young people**… only 420 million jobs" | Not addressed | The cooperative's **youth digital agent / farmer promoter** runs Ikawa for many farmers, which creates a paid youth role. |
| Pass/fail: "**not sure — ask a person**" | Add a confidence number | Abstaining is the **core feature**. The extension officer replies with a **one-code SMS** (e.g. `A07`) and Noor's app plays the full advice card in Kinyarwanda. |
| Rwanda's main coffee pest context **[verify]**: *antestia bug* (linked to "potato taste defect"), coffee berry borer | Only use leaf datasets | Pictogram questions ("Do you see this bug?" / "Berries with holes?") bring in pests that leaf datasets don't cover. |

**Paired comparison (our favourite detail):** Noor brings 5 leaves from the **worst** row and 5 from a **good** row. If both bags look the same to the vision model, the leaves are probably **not** the cause. The detective then shifts weight toward soil, drainage or roots. One control group turns a single classifier into a reasoning step.

---

## 3. What Ikawa does — the user journey

### 3.1 Actors
| Actor | Device | Role |
|---|---|---|
| **Noor** (farmer) | Basic phone (calls, SMS, mobile money) | Collects the leaf bag and answers questions (voice or tap, when on the smartphone). Receives the result by SMS. Makes the final decision. |
| **Agent**: daughter (weekends) *or* cooperative farmer promoter (youth agent) | Low-end Android smartphone | Runs Ikawa offline: photographs leaves, plays questions, shows the result. |
| **Extension officer** | Any phone | Receives escalated cases by SMS. Replies with an advice code. |
| **Cooperative** | Laptop / phone, occasional internet | Receives synced, consented registry records and the anonymised "Rust Radar" map. |

### 3.2 Journey (where it sits in her week)
```
MON–FRI  Noor notices the third row looks bad.
         She picks 5 leaves from it + 5 from a healthy row into two bags
         (pictogram card from the cooperative shows how).
         Optional: she SMSes "IKAWA" to the cooperative agent number → case opened.

EVENING  Agent or daughter opens Ikawa (airplane mode is fine).
/ WEEKEND 1. Consent: Noor hears the consent message in Kinyarwanda and records her
            "yes" (her voice sample doubles as her voice template, see §4.3).
         2. Photos: 5 + 5 leaves on a dark cloth (on-screen guide checks blur/light).
         3. Questions: ~6 audio questions with picture buttons, answered by voice or tap:
            tree age? last season heavy? flowers dropped? bug picture? berry holes?
            whole farm or one area?
         4. Ikawa looks up rainfall (CHIRPS) + soil (iSDAsoil) for the plot, offline.
         5. Case result:
              "Most likely: leaf rust (62%). Also likely: heavy rain damage on the lower
               rows (21%). Last season was heavy, so part of this drop is normal."
            + ONE action card this week, played as Kinyarwanda audio with a picture.
            + "What I am NOT sure about" line.
         6. Noor decides. Ikawa never orders a purchase.

IF UNSURE   The case file is packed into one SMS (§5.4) and queued.
            It sends when there is signal → extension officer.
            Officer replies "A07" → Noor's SMS + the agent's app plays advice card A07.

SYNC        When the agent has data: consented registry record + anonymised case
(optional)  → cooperative. Rust Radar map updates.
```

### 3.3 Outputs (all from a closed list)
- **Cause ranking**: 8 causes + `unknown`, each with a probability.
- **Action card**: 1 of ~30 cards, each a short Kinyarwanda audio clip, a pictogram and a text line. All written from official extension guidance and reviewed by a native speaker **[verify sources: NAEB / RAB coffee guidelines, CABI]**.
- **Uncertainty line**: what it couldn't check (e.g. "I cannot see the roots").
- **Escalation**: `SEND TO PERSON` when the thresholds in §4.5 trigger.

---

## 4. The AI: Choice Engine (our own offline Jev-style design)

### 4.1 Why not use Jev or ElevenLabs directly
- **Jev (TypeSafe AI)** is a proprietary cloud API, and we know of no open-source version. A cloud call would break the rule *"its core feature works offline."* **But the idea behind it is good and we can build it ourselves:** *the model returns a typed choice from a fixed set, with probabilities, instead of free text.* That is our **Choice Engine**. It's built from small, open, offline parts, and it matches the brief's glossary: *"Fixed list of answers — if it can say anything, it cannot be checked for safety."*
- **ElevenLabs** is cloud-only, and Kinyarwanda support is uncertain. We **dropped it**. Voice output is pre-rendered from a fixed list (§4.4), so we need no runtime text-to-speech at all.

### 4.2 Choice 1 — Leaf vision (computer vision)
- **Model:** MobileNetV3-Small (ImageNet-pretrained, via `timm`), fine-tuned.
- **Classes (closed set):** `healthy`, `leaf_rust`, `cercospora`, `phoma`, `leaf_miner`, `other_damage`, **`not_a_coffee_leaf / unusable_photo`**.
  - The last class is trained on PlantVillage non-coffee leaves, blurred or dark photos, and random backgrounds. The model can say *"that's not something I can read."*
- **Calibration:** temperature scaling on a validation split, so that "70%" actually means about 70%. We report Expected Calibration Error (ECE).
- **Export:** PyTorch → ONNX → int8 quantization. Target **≤ 3 MB**, inference **< 300 ms** on a low-end Android CPU.
- **Paired-bag logic:** the bag-level result is the mean of the 5 leaf probabilities. **Contrast** = worst-row bag minus good-row bag. Low contrast lowers the weight of leaf causes in §4.5.
- **Photo quality gate (no AI needed):** a blur check (variance of Laplacian) and a brightness check run before inference. We use plain rules where rules are enough.

### 4.3 Choice 2 — Voice answers that work in any language (pattern recognition)
The problem: there is no small offline speech recogniser for Kinyarwanda, and none at all for many local languages.

Our answer: **we don't do speech recognition.** We only need to know *which of 2–4 options* she said.
- At consent, Noor says each answer word once or twice ("yego" = yes, "oya" = no, "simbizi" = don't know **[verify spellings with native speaker]**). These become her **voice templates**.
- At question time, we extract audio features (MFCCs, via Meyda in the browser) and compare her answer to her own templates with **Dynamic Time Warping**. The nearest template wins, and distances are turned into probabilities.
- If no template is clearly closest, she can tap the picture button instead. Every voice question also has a tap answer.
- **Why this matters:** it's **language-independent and speaker-specific**. It works the same for Kinyarwanda, Kirundi, or a language with no written form or dataset. Model size is **0 MB** (the templates are a few KB). This is our answer to *"how would it fare in a less-supported language?"*
- **Honest limits:** wind, other voices nearby, and a different speaker (e.g. her daughter answering for her) all reduce accuracy. We measure this (§7).

### 4.4 Voice output — pre-rendered, fixed list
- All ~30 action cards and ~10 questions/prompts are written in Kinyarwanda and **recorded once** (preferably by a native speaker; fallback: Meta MMS-TTS `kin` at build time, licensed CC BY-NC, so for a production version we would re-record **[verify licence]**).
- They're encoded as Opus at ~12 kbps, about 10 KB per clip, roughly **400 KB in total**.
- Since nothing is generated at runtime, **nothing can be hallucinated in her language.**

### 4.5 Choice 3 — The Detective (cause ranking, probabilistic reasoning)
A small **Bayesian scorer** (naive-Bayes-style, written by hand). It's explainable line by line, which a neural network wouldn't be.

**Causes (closed set):** `leaf_rust`, `other_leaf_disease`, `insect_pest` (antestia / berry borer), `heavy_rain_damage` (erosion, waterlogging, nutrient wash-out), `drought_at_flowering`, `soil_acidity_or_nutrient`, `old_trees_need_stumping`, `normal_off_year` (biennial bearing), `unknown`.

**Evidence → likelihoods:**
| Evidence | Source | Example effect |
|---|---|---|
| Leaf class probabilities + bag contrast | §4.2 | High rust + high contrast → ↑ `leaf_rust` |
| Rain anomaly during the flowering window | CHIRPS, stored for the plot | Dry flowering season → ↑ `drought_at_flowering` |
| Days with ≥ 40 mm rain in the last 90 days | CHIRPS daily | ↑ `heavy_rain_damage`; rain splash also spreads rust spores |
| Topsoil pH, N, organic carbon | iSDAsoil 30 m | pH < ~5 **[verify threshold for Arabica]** → ↑ `soil_acidity_or_nutrient` |
| "Last season was heavy?" | Voice/tap | Yes → ↑ `normal_off_year` |
| Tree age > ~15–20 yrs **[verify]** | Voice/tap | ↑ `old_trees_need_stumping` |
| Bug picture / berry holes | Pictogram question | ↑ `insect_pest` |
| One area vs whole farm | Voice/tap | One area → ↑ soil / drainage / local pest. Whole farm → ↑ weather / off-year. |

- **Priors and likelihood tables** are *expert-set* from published extension guidance and are **labelled as such**. They aren't learned from data, because no labelled Rwandan "cause of yield drop" dataset exists. We state that gap openly (§6.3).
- **Result:** probabilities over the causes, the top 2 shown with an "evidence used" line, and an action card chosen by the top cause.

### 4.6 Abstain rules (the fail-safe)
Ikawa says **"Not sure — sending to a person"** when **any** of these hold:
1. The vision model's top probability is < 0.60, or the photo was judged `unusable`.
2. The detective's top cause is < 0.45, **or** the gap between the top two causes is < 0.15.
3. The answers contradict each other (e.g. "whole farm" + strong single-row contrast).
4. The top cause is `unknown`.
5. The recommended action costs money (e.g. fungicide), unless confidence is ≥ 0.75. **Spending advice needs high confidence or a human.**

Thresholds are set from the validation curves in §7 (we choose them by checking accuracy against how often the tool abstains). We report how often Ikawa abstains, and we treat abstaining as a feature, not a weakness.

---

## 5. Architecture & tech stack

### 5.1 Why an offline web app (installable PWA)
- It runs in Chrome on the Android phones people **already have**. No app store needed.
- After the first load it works **fully offline** (service worker).
- It can also be wrapped as a ~5 MB APK (Capacitor / TWA) for **side-loading via Bluetooth or Xender** **[optional]**.
- Judges can open a link and try it, which helps the video and the "working prototype" deliverable.

### 5.2 Components
```
┌────────────────────── Smartphone (offline) ──────────────────────┐
│ UI: big buttons, pictograms, audio-first, Kinyarwanda + English  │
│                                                                  │
│ Photo gate (blur/light) → Leaf model (ONNX Runtime Web, int8)    │
│ Voice: Meyda MFCC → DTW vs farmer's templates                    │
│ Plot data: CHIRPS + iSDAsoil grid for co-op area (JSON, ~300 KB) │
│ Detective: Bayesian scorer (JS)  →  Abstain rules                │
│ Action cards: Opus audio + pictograms (~400 KB)                  │
│ Storage: IndexedDB, encrypted (WebCrypto AES-GCM, agent PIN)     │
│ Outbox: SMS case code (sms: link) / sync queue                   │
└──────────────────────────────────────────────────────────────────┘
        │ SMS (2G is enough)                │ data, when available
        ▼                                   ▼
 Extension officer phone           Cooperative dashboard (static page)
 ↳ reply "A07"                     ↳ registry + Rust Radar map (anonymised)
        │
        ▼
 Noor's basic phone: Kinyarwanda SMS summary + advice code
```

### 5.3 Stack
| Layer | Choice | Why |
|---|---|---|
| Training | Python, PyTorch, `timm`, `onnxruntime` quantization | Fast fine-tuning on a laptop GPU or Colab |
| Data prep | `rasterio`/`xarray` for CHIRPS + iSDAsoil → per-cell JSON | Precomputed so the phone does only lookups |
| App | Vite + TypeScript + Preact, Workbox service worker (full rationale in `tech-stack.md`) | Small bundle, offline |
| Inference | `onnxruntime-web` (WASM) | Runs on low-end CPUs, no GPU needed |
| Audio | Meyda (MFCC), our DTW implementation, `<audio>` with Opus | No ML model download for voice |
| Storage | IndexedDB + WebCrypto | Encrypted on the device |
| Messaging | `sms:` intent with prefilled body; officer decoder page | No server needed for the core flow |

### 5.4 The one-SMS case file (store-and-forward)
Fits in under 160 GSM-7 characters, e.g.:
```
IK1|F0423|R:LR62,HR21,OY12|V:LR.71/c.48|S:pH5.1|C:-38/2x40|Q:1,0,1,2,0,1|G:-2.48,29.1|E3
```
`F` farmer ID · `R` top causes with % · `V` vision result + bag contrast · `S` soil · `C` rain anomaly % / count of ≥ 40 mm days · `Q` answers · `G` coarse location (≈1 km) · `E` reason for escalating.
The officer pastes it into an offline decoder page, or reads it directly. They reply `A07`, and Noor gets SMS card 07 in Kinyarwanda.

### 5.5 Size budget (we check this in CI)
| Item | Target |
|---|---|
| Leaf model (int8 ONNX) | ≤ 3 MB |
| ONNX Runtime WASM | ~1.5 MB **[measure]** |
| Audio cards | ~400 KB |
| Plot data (one cooperative area) | ~300 KB |
| App code + pictograms | ~500 KB |
| **Total** | **≤ ~6 MB** (download over 3G in about a minute **[measure]**) |

---

## 6. Data: what we use and what it does not cover

### 6.1 Problem data ("the problem is real") — fill with country + year
| Claim | Source | Value |
|---|---|---|
| Coffee yield trend, Rwanda | FAOSTAT | `[cite]` |
| Share of employment in agriculture | World Development Indicators | `[cite]` |
| Extension workers per farmer / visit frequency | MINAGRI / RAB reports, or the brief ("twice a year") | `[cite]` |
| Women's phone vs smartphone ownership | GSMA Mobile Gender Gap Report | `[cite]` |
| Mobile money use by women | Global Findex | `[cite]` |
| Signal coverage in coffee districts | OpenCelliD | `[map]` |
| Household farm context | World Bank Microdata (Rwanda EICV / agricultural surveys) | `[cite]` |

### 6.2 Build data ("what Ikawa learns from")
"✅" means we checked the licence/size/access on 2026-10-03 (details in `data-access.md`).

| Dataset | In annex? | Used for | Licence | Size | Checked |
|---|---|---|---|---|---|
| **BRACOL** (Arabica leaves, Brazil) | Annex B | Leaf classes | CC BY 4.0 | 165 MB zip | ✅ |
| **JMuBEN + JMuBEN2** (Arabica leaves, Kirinyaga, Kenya; real field conditions, pathologist-assisted) | Our addition | Main training set (East African) | CC BY 4.0 | 58,555 images (rust 8,337 · cercospora 7,682 · phoma 6,572 · miner 16,979 · healthy 18,985) | ✅ |
| **RoCoLe** (Robusta leaves, Ecuador, smartphone, field) | Our addition | Held-out field test (rust vs healthy) | CC BY 4.0 | 1,560 images | ✅ |
| PlantVillage (non-coffee) | Annex B | `not_a_coffee_leaf` class | as listed on Kaggle | subset | ☐ Kaggle account |
| PlantVillage → PlantDoc | Annex B | Showing the studio-to-field accuracy drop | as listed | subset | ☐ |
| iBean (Makerere, Uganda field photos) | Annex B | **Stretch:** bean pack (Noor's lower-slope crop) as a replicability demo | see repo | ~1.3k | ☐ |
| **CHIRPS** daily rainfall (Africa, 0.05°) | Annex B | Detective evidence | see CHC terms | daily files to 2025-12-31 confirmed | ✅ access |
| **NASA POWER** | Annex B | Daily rain/temperature for **2026** (CHIRPS final files lag) | open, no key | API | ✅ pulled Rwanda point |
| **iSDAsoil** | Annex B | Soil pH, N, organic carbon at 30 m | CC BY 4.0 **[verify]** | Africa-wide cloud GeoTIFF; read only our window | ✅ access |
| **SoilGrids** | Annex B | Soil pH backup / cross-check | CC BY 4.0 **[verify]** | REST API | ✅ pulled pH 5.1 at a Nyamasheke point |
| **WFP food prices — Rwanda** (HDX) | Annex B | Price card for **maize and beans** (**no coffee in this dataset**) | see HDX | 157,691 rows, 2000-01 → 2026-08 | ✅ |
| FAOSTAT (bulk download) | Annex B | Rwanda coffee yield trend (problem data) | CC BY 4.0 **[verify]** | bulk zip (API now needs a token) | ✅ access |
| Mozilla Common Voice — Kinyarwanda | Common §7.3 | Testing the voice layer with many speakers | CC0 | account needed | ☐ |
| Meta MMS-TTS `kin` (fallback voice) | Common §7.3 (MMS) | Pre-rendering audio cards | **CC BY-NC 4.0** (non-commercial) | build-time only | ✅ |
| Extension guidance (NAEB / RAB / CABI) | Our addition | Action cards + detective priors | cite | — | ☐ |
| **Synthetic case vignettes** (written by us) | — | Testing the detective | ours, **labelled SYNTHETIC** | ~30 cases | — |

> **Leakage warning (JMuBEN):** JMuBEN contains heavily **augmented copies** of a smaller number of original photos. A random train/test split puts near-duplicates on both sides and **inflates accuracy**. We split by original image group (perceptual-hash clustering) and report this. Expert judges look for this kind of mistake.

### 6.3 What our data does NOT cover (this is scored, so we say it upfront)
1. **No Rwandan leaf images.** The leaf data is from Brazil, Kenya and Ecuador. Lighting, varieties and disease stages differ. *Mitigation:* we test on a separate field dataset, abstain when unsure, and offer a "give back" loop where consented photos confirmed by an officer become Rwandan training data.
2. **Only leaves.** No roots, stems or berries. Root rot, nematodes and berry diseases are invisible to the model. The detective uses pictogram questions for some and says *"I cannot see the roots."*
3. **CHIRPS is ~5 km.** It can't see one slope's microclimate. iSDAsoil values are **predicted**, not lab-measured. We show both as context, not proof.
4. **The detective's priors are expert-set**, not learned. No labelled "cause of yield drop" dataset exists. Its test cases are **synthetic** and labelled so.
5. **Voice templates depend on the speaker.** If someone else answers for Noor, accuracy drops, and noise lowers it further.
6. **Nutrient deficiency vs disease** can look alike on a leaf. We abstain rather than guess.
7. **Price reference:** WFP has **no coffee** prices for Rwanda (checked). Coffee prices depend on an official seasonal bulletin reaching the cooperative, and we show its date when it's old.
8. **Rainfall timeliness:** CHIRPS final daily files we confirmed run to the end of 2025. For 2026 we use NASA POWER, which is coarser (~50 km).

---

## 7. Evidence it works — evaluation plan

| Test | Method | Metric we report |
|---|---|---|
| Leaf model, in-distribution | Held-out split of BRACOL + JMuBEN | Accuracy, per-class recall, confusion matrix |
| **Leaf model, field shift** | Train on studio/curated → test on RoCoLe / field photos | **Accuracy drop**, stated honestly |
| Calibration | Before and after temperature scaling | ECE, reliability plot |
| **Selective accuracy** | Sweep the abstain threshold | Accuracy on answered cases vs % abstained, to choose the operating point |
| Unusable/OOD photos | Blurred, dark, non-coffee, random | % correctly refused |
| Voice DTW | 3+ speakers × 3 words × quiet/noisy; plus **Kirundi and a second unrelated language** recorded by team members | Accuracy, % falling back to tap |
| Detective | ~30 **synthetic** vignettes from extension literature, checked by someone with agronomy knowledge if possible | Top-1 / top-2 agreement, abstain rate on deliberately ambiguous cases |
| Offline | Full journey in airplane mode, recorded | Pass/fail on video |
| Low-end device | Chrome DevTools 4× CPU throttle + a real cheap Android if available | Inference ms, peak memory |
| Size | Build script | Total MB vs §5.5 budget |

---

## 8. Responsible AI (pass/fail)

| Concern | What Ikawa does |
|---|---|
| **Human makes the final call** | Ikawa never acts. It gives possible causes plus one suggested action. Spending advice needs high confidence or an officer (§4.6 rule 5). |
| **Hallucination** | Impossible by design: closed lists everywhere, pre-recorded audio, no generative text at runtime. |
| **Fail-safe** | Abstain rules → one-SMS escalation → officer reply code. |
| **Consent** | Read aloud in Kinyarwanda, recorded as Noor's own spoken "yes", with separate yes/no for (a) service, (b) registry sharing, (c) using photos to improve the model. Each can be withdrawn by SMS. |
| **Where the data sits / who can read it** | Encrypted on the agent's phone. Only consented, minimal fields sync to the cooperative. Location is rounded to ~1 km in shared data. |
| **Phone lost or shared** *(this exact question is a Health-annex requirement, not an Agriculture one; we adopt it voluntarily because farmer records and location are sensitive)* | This matters a lot because the daughter's phone is shared. Agent PIN, encrypted storage, cases deleted from the phone after confirmed sync, nothing visible on the lock screen. |
| **Bias** | Model trained on non-Rwandan leaves (stated). Field-shift test reported. Abstaining protects users where the model is weak. Registry records women in their own name. Voice layer works for any language/accent because it uses her own templates. |
| **Over-reliance** | Every result shows "what I could not check". The "normal off-year" verdict stops the tool pushing unnecessary inputs. |
| **Commercial neutrality** | Action cards name practices and categories, not brands. No input seller pays to appear. |

---

## 9. Requirement traceability matrix — every line of the PDF

### 9.1 The Rules (§06)
| PDF requirement | Ikawa | Where |
|---|---|---|
| Runs on a device the user already has | Low-end Android (daughter's or the cooperative agent's) + Noor's basic phone via SMS | §3.1, §5.1 |
| Core feature works offline | Model, plot data, detective, audio all stored on the phone. SMS needs only 2G, no data. | §5 |
| Model files small enough to side-load / send over weak connection | ≤ ~6 MB total. Bluetooth/Xender shareable | §5.5 |
| ≥ 1 interaction in a local language, voice or text; **name it** | **Kinyarwanda**: voice questions, voice answers, audio action cards, SMS | §4.3–4.4 |
| "Expect to be asked about a less-supported language" | Voice layer works in any language by design; tested on Kirundi + one more; card re-recording workflow | §4.3, §7 |

### 9.2 AI Guardrails
| PDF requirement | Ikawa | Where |
|---|---|---|
| A person makes the final call | Suggests only, never acts | §8 |
| Flags what it is unsure of | Probabilities + "what I couldn't check" line | §3.3 |
| Agentic workflows check in with the user | Not agentic. Escalation is sent only after the agent/Noor confirms | §3.2 |
| Avoid hallucinations | Closed lists + pre-recorded audio | §4 |

### 9.3 What you will build (§05)
| PDF requirement | Ikawa | Where |
|---|---|---|
| Working prototype (app/chatbot/SMS/voice) | Offline web app + SMS layer + officer decoder page | §5 |
| Clear answer: what AI is used | CV (leaf model), pattern recognition (DTW voice), probabilistic reasoning (detective) | §4 |
| Why AI beats SMS/spreadsheet/search | SMS can't see a leaf; search can't weigh 8 causes against *her* rain, soil and answers; a spreadsheet can't hear her. Where SMS **is** enough (price), we use SMS. | §2, §13 |
| Proof it works on at least one case | Third-row demo case + evaluation numbers | §7, §12 |

### 9.4 Annex B challenge — "help Noor make, communicate or act on one better agricultural decision"
| Listed example | Covered? |
|---|---|
| Identifying a crop or post-harvest problem | ✅ Core |
| Timing a farming activity | ✅ Action cards are time-bound ("this week"; "after harvest: stump the oldest row") |
| Accessing localized advisory | ✅ Kinyarwanda audio cards |
| Documenting a field observation | ✅ Case file + registry record |
| Improving quality / value addition | ◑ Stretch: post-harvest drying/sorting cards |
| Connecting evidence to pricing, market or extension next step | ✅ One-SMS escalation to extension; ◑ cached reference price (no AI, on purpose) |
| Precondition: farmer registry | ✅ Registry as by-product |
| Precondition: trust in the advisory system | ✅ Officer stays in the loop; advice from official guidance |
| "Voice-based advisory where literacy is a constraint" | ✅ Audio-first, pictograms |

### 9.5 Data (§07)
| PDF requirement | Ikawa | Where |
|---|---|---|
| Cite every data source | Tables with source, licence, size | §6 |
| Problem data with source, year, country | §6.1 | §6.1 |
| Build data with name, source, licence, size | §6.2 | §6.2 |
| **State what the data does not cover (scored)** | 7 explicit gaps | §6.3 |
| Synthetic data labelled | Detective vignettes labelled SYNTHETIC | §6.2 |
| Use both common + sector datasets | Common: Common Voice, MMS, GSMA, Findex, OpenCelliD, WDI, Microdata. Sector: BRACOL, CHIRPS, iSDAsoil, NASA POWER, FAOSTAT, PlantVillage/PlantDoc | §6 |

### 9.6 Deliverables (§08)
| Required | Status |
|---|---|
| Prototype + code/link | Repo + hosted PWA link |
| Video 2–5 min (**required for the shortlist**) | Script in §12 |
| One-sentence problem statement in the template | §12, scene 1 |
| AI capabilities + why not simpler + guardrails | §12, scene 3 |
| End-to-end demo | §12, scene 4 |
| Where it sits in the user's day + tech stack | §3.2, §5 |
| "Your take": what localizing AI means to us | §12, scene 6 |

### 9.7 Judging criteria (§09)
| Criterion | Weight | Our strongest evidence |
|---|---|---|
| Built solution (Small AI fidelity) | 25% | Full journey in airplane mode on a throttled low-end device; ≤ 6 MB |
| Development relevance & impact | 20% | Answers Noor's actual question; the "normal off-year" verdict saves her money; registry and youth agent role |
| Data grounding | 15% | Real CHIRPS + iSDAsoil for the plot; 7 stated gaps; licences listed |
| Evidence it works | 15% | Field-shift drop, calibration, selective-accuracy curve, voice test across languages |
| Clarity, design, inclusivity, AI value | 15% | Audio-first + pictograms + basic-phone channel; explicit "where we chose NOT to use AI" |
| Scalability & replicability | 10% | Swap the crop model + action cards + plot grid for any crop or country; the voice layer needs no language data |
| Responsible AI | Pass/fail | §8 |

---

## 10. What we do beyond the brief

1. **"It may be normal" verdict.** Biennial bearing detection means the tool can tell Noor *not* to spend money. Few advisory tools ever say this.
2. **Paired-bag comparison.** A control group turns one classifier into a reasoning step.
3. **Voice that needs no language data.** It uses the farmer's own voice templates, so it works for unwritten languages.
4. **One-code officer reply.** An officer can handle a case in one SMS, and Noor still gets full audio advice in her language.
5. **Registry as a by-product**, with women registered in their own names.
6. **Youth agent role.** One trained youth agent per cooperative serves many farmers, which links to the brief's jobs challenge **[estimate farmers per agent from co-op size, cite]**.
7. **Rust Radar (stretch).** Anonymised cases → a cooperative-level early-warning map that tells the officer where to go on the next visit.
8. **Give-back loop.** Consented photos confirmed by an officer become the first Rwandan coffee-leaf dataset, which could be contributed back like Common Voice.
9. **"Where we chose not to use AI" slide.** Price reference, photo-quality gate and SMS transport are plain rules. That shows judgment, which the criteria reward.

---

## 11. Weekend build plan

> Rule: **the core loop must work end-to-end by the midpoint.** Everything else is a stretch goal.

| Block | Who | Task | Done when |
|---|---|---|---|
| H0–1 | All | Lock scope, create repo, confirm district + Kinyarwanda speaker contact | Repo + this doc |
| H1–4 | ML | Download BRACOL/JMuBEN/RoCoLe, train MobileNetV3-Small, export int8 ONNX | ≤ 3 MB model + metrics |
| H1–4 | App | PWA shell, offline service worker, camera + photo gate, ONNX in browser | Photo → class offline |
| H1–4 | Data | CHIRPS + iSDAsoil → per-cell JSON for the chosen area | JSON ≤ 300 KB |
| H4–7 | App | Detective scorer + abstain rules + result screen | Ranked causes shown |
| H4–7 | Content | Write ~30 action cards + 10 prompts in English → Kinyarwanda (native check) → audio | Opus clips |
| H7–9 | App | DTW voice answers + tap fallback; consent flow | Voice answer works |
| H9–10 | App | SMS case code + officer decoder page + reply-code handling | Escalation works |
| **Midpoint** | All | **Airplane-mode end-to-end run on a cheap phone** | ✅ core done |
| Day 2 AM | ML/Data | Evaluation runs (§7), calibration, threshold choice; fill `[cite]` values | Numbers in README |
| Day 2 AM | App | Encryption, PIN, registry record, size check | §5.5 met |
| Day 2 midday | Stretch | Rust Radar page / price card / APK wrap | Optional |
| Day 2 PM | All | Record video (§12), README, data citations, submit **well before deadline** | Submitted |

---

## 12. Video script (2–5 min)

1. **Problem (0:00–0:30).** Noor at the third row. Problem statement:
   > *"Because of Ikawa, Noor will know the most likely reason her coffee yield fell and the one action to take **within the same week** she notices it, instead of waiting up to six months for an extension visit or spending money on the wrong fix; we know because extension officers reach her area about twice a year `[cite]` and Rwandan smallholder coffee yields `[cite FAOSTAT trend]`."*
2. **The insight (0:30–0:50).** "She didn't ask *what's on this leaf*. She asked *why*. And sometimes the answer is: *it's normal*."
3. **The AI (0:50–1:40).** Three closed-list choices: leaf vision, voice templates, the detective. Why simpler tools fail (and where we deliberately used SMS). Guardrails: the abstain rules on screen.
4. **Demo (1:40–3:30).** **Airplane mode ON, visible.** Leaf bags → photos → Kinyarwanda audio questions answered by voice → CHIRPS shows the 40 mm night → result with two causes + "part of this is a normal off-year" → audio card plays. Second case: an ambiguous photo → *"Not sure — sending to a person"* → SMS code → officer replies `A07` → Noor's basic phone receives the card.
5. **Evidence (3:30–4:10).** Field-shift accuracy drop, calibration plot, selective-accuracy curve, voice test in Kinyarwanda + Kirundi + one more language, size budget, data gaps slide.
6. **Our take (4:10–4:50).** *"Localizing AI isn't translating a big model into a small language. It's an AI small enough to share by Bluetooth, humble enough to say 'I don't know', and built so the knowledge stays with the cooperative and the farmers whose photos make it better."*

---

## 13. Decisions we made and why

| Decision | Alternative rejected | Why |
|---|---|---|
| Cause ranking (detective) | Single leaf classifier | Answers the farmer's actual question; differentiates us |
| Own Choice Engine (offline) | Jev API | Must work offline; we keep the typed-choice-with-probability design |
| Pre-rendered audio | ElevenLabs / runtime TTS | Offline, no hallucination, tiny; Kinyarwanda support uncertain |
| DTW voice templates | On-device speech recognition | No small Kinyarwanda ASR exists; works in any language; 0 MB |
| Hand-built Bayesian scorer | Neural net / LLM | No labelled data exists; explainable; tiny |
| No AI for price | "AI price predictor" | The judges' own rule: if SMS can do it, use SMS |
| PWA (+ optional APK) | Native-only app | Judges can try it; offline; small; side-loadable |
| Rwanda + Kinyarwanda | Generic/unnamed | Real data, honest testing, real institutions to connect to |

---

## 14. Submission checklist

- [ ] Working prototype link + repo with README
- [ ] Video 2–5 min, **airplane mode visible in the demo**
- [ ] Problem statement sentence in the exact template, with real citations
- [ ] Language named: **Kinyarwanda**, with the less-supported-language answer
- [ ] All `[cite]` filled; all `[verify]` checked (dataset licences, Kinyarwanda strings, institutions)
- [ ] Data tables: source, licence, size for every dataset
- [ ] "What our data does not cover" slide
- [ ] Synthetic data labelled SYNTHETIC
- [ ] Evaluation numbers: field shift, calibration, selective accuracy, voice, size, latency
- [ ] Responsible AI: consent, storage, lost/shared phone, bias, human oversight
- [ ] "Where we chose not to use AI" slide
- [ ] "What localizing AI means to us" in our own words
- [ ] Submitted with time to spare
