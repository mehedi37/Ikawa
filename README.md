# Ikawa — an offline coffee-farm "yield detective"

**Small AI for Development Hackathon · Agriculture track (Annex B) · Hack-Nation × World Bank Youth Summit, 3–4 October 2026**

Ikawa helps a smallholder coffee farmer answer the question she actually has, which is *"why did my yield drop, and what should I do this week?"*, not just *"what disease is on this leaf?"*. From a few leaf photos, the rain and soil for her area, and six simple questions, it ranks the likely causes, plays **one** action card as audio in her language, and, whenever the evidence is thin, says **"I cannot read this / I'm not sure — a person will help"** and packs the case into **one SMS** for the extension officer. It runs **fully offline** on a low-end Android phone. **A person always makes the final call.**

| | |
|---|---|
| **Live app** | **https://ikawa-meek-0s-projects.vercel.app** · demo: [`/?demo=1`](https://ikawa-meek-0s-projects.vercel.app/?demo=1) · "cannot read" demo: [`/?demo=1&run=mite`](https://ikawa-meek-0s-projects.vercel.app/?demo=1&run=mite) · officer page: [`/#/officer`](https://ikawa-meek-0s-projects.vercel.app/#/officer) · [`/health.json`](https://ikawa-meek-0s-projects.vercel.app/health.json) |
| **Video (2–5 min)** | *to be recorded — script in [`docs/video-script.md`](docs/video-script.md)* |
| **Setting** | Kirinyaga county, Kenya (Mutira ward, ≈ −0.47°, 37.23°) |
| **Language** | Kiswahili (**machine-drafted, not yet checked by a native speaker**); English fallback; more languages = more packs |
| **Status** | Deployed working prototype; 102 unit tests + 14 browser tests (incl. offline) pass locally **and against the live URL**; Lighthouse mobile: accessibility 100, performance 83 |

> *"Ikawa"* means coffee in several East African languages. The persona, **Noor**, comes from the hackathon brief: two hectares of coffee, a basic phone that stays at the house while she works the slope, her daughter's smartphone at weekends, and an extension officer who visits "twice a year at best".

---

## Contents
1. [The problem](#1-the-problem) · 2. [Who it is for](#2-who-it-is-for) · 3. [What it does](#3-what-it-does-the-user-journey) · 4. [How the AI works](#4-how-the-ai-works) · 5. [Where we chose NOT to use AI](#5-where-we-chose-not-to-use-ai) · 6. [Guardrails](#6-guardrails-and-responsible-ai) · 7. [Results](#7-results-measured) · 8. [Honest limits](#8-honest-limits) · 9. [Data](#9-data) · 10. [Languages](#10-languages-and-localisation) · 11. [How it meets the brief](#11-how-it-meets-the-brief) · 12. [Run it](#12-run-it) · 13. [Deployment](#13-deployment) · 14. [Architecture](#14-architecture-and-repository-layout) · 15. [Status & roadmap](#15-status-and-roadmap) · 16. [Docs map](#16-documentation-map) · 17. [Credits & licences](#17-credits-and-licences)

---

## 1. The problem

> **Because of Ikawa, a smallholder coffee farmer in Kirinyaga will identify the most likely cause of her falling yield, and choose one action (or send the case to an extension officer) within the same week she notices the problem, a decision she would otherwise make late or by guesswork; we know because Kenya's coffee yield was 435 kg/ha in 2023 against 592 kg/ha in 2000 (FAOSTAT), and Kenya's 2023 extension policy states that the extension-staff-to-farmer ratio "has not improved" and targets one officer per 600 farmers by 2029.**

| Verified fact | Value | Source |
|---|---|---|
| Kenya green-coffee yield | **592 kg/ha (2000) → 262 kg/ha (2010) → 435 kg/ha (2023)** | FAOSTAT bulk file, computed by us |
| Coffee area harvested | 160,000 ha (2010) → 111,900 ha (2023) | FAOSTAT |
| Extension coverage | "the ratio of extension staff to farmer has not improved"; target 1 : 600 by 2029 | *Kenya Agricultural Sector Extension Policy*, Dec 2023, p. 8 |

What these facts do **not** prove: that missing advice caused the yield fall (prices, weather, tree age and disease all matter). They show why faster, structured decision support is worth building. Details and second-hand figures we chose *not* to use: [`docs/problem-evidence.md`](docs/problem-evidence.md).

## 2. Who it is for

| Person | Device | Role in Ikawa |
|---|---|---|
| **Noor**, the farmer | Basic phone (calls, SMS, mobile money) | Collects leaves, answers questions (voice or tap), receives the result and the officer's reply by SMS, **makes the decision** |
| **Agent**: her daughter at weekends, or a cooperative youth agent / farmer promoter | Low-end Android smartphone | Runs Ikawa offline: photographs leaves, plays questions, shows the result |
| **Extension officer** | Any phone | Receives escalated cases as one SMS, replies with a card code (e.g. `A07`) |
| **Cooperative** | Laptop/phone, occasional internet | Receives consented farmer records (the registry the brief says is missing) |

## 3. What it does (the user journey)

```
During the week   Noor sees her third row is struggling. She puts 5 leaves from the WORST row and
                  5 from a GOOD row into two bags (the good row is a control group).
Evening/weekend   On the agent's phone, offline:
  1  Consent       three separate yes/no choices: use the service · share my record with my cooperative ·
                   use my photos to improve the tool
  2  Voice setup   she says "yes / no / not sure" twice; these become her personal voice templates (optional)
  3  Photos        each leaf photographed on a dark cloth; a blur/brightness gate asks for retakes
  4  Questions     6 picture questions (bug photo, berry holes, last season big?, flowers dropped?,
                   trees > ~20 years?, whole farm or one area?) answered by voice or tap
  5  Area & date   GPS or "Mutira (demo area)"; the app looks up rain (CHIRPS) and soil (iSDAsoil) offline
  6  Result        ranked causes with probabilities, the evidence used, what it could NOT check,
                   and ONE action card read aloud in Kiswahili
If unsure         "Not sure — I am sending this to a person" → one SMS (≤ 160 characters) to the officer
                  → officer replies "A07" → Noor gets card A07 by SMS and as audio on the agent's phone
```

The two bags matter: if the worst-row leaves look no sicker than the good-row leaves, the leaves are probably **not** the cause, and the detective shifts weight toward soil, drainage, rain or a normal off-year. Sometimes the most useful answer is *"part of this drop is a normal off-year — don't spend money on spray."*

## 4. How the AI works

Design rule: **every AI output is a choice from a closed list, with a probability — and below a threshold the only allowed answer is "not sure, ask a person"**. Nothing is generated at run time, so nothing can be hallucinated.

| Part | AI technique | What it does | Size / speed |
|---|---|---|---|
| **Leaf vision** | Computer vision: MobileNetV2 fine-tuned, temperature-calibrated, **int8** ONNX | 6 classes: `healthy`, `leaf_rust`, `cercospora`, `phoma`, `leaf_miner`, and `not_coffee` = **"I cannot read this leaf"** (not coffee, or a condition outside the five) | **2.4 MB**; ~0.27 s per photo on a 4× throttled laptop CPU |
| **Voice answers** | Pattern recognition: MFCC features + Dynamic Time Warping against the farmer's **own** recorded words | Recognises which of yes / no / not sure she said; tap fallback always on screen | **0 MB of model**; works in **any** language, including unwritten ones |
| **The detective** | Probabilistic reasoning: a hand-built Bayesian scorer | Combines leaf results (+ the worst-vs-good contrast), heavy-rain days, flowering-season rain, soil pH and the six answers into probabilities over 9 causes | Instant; every factor is inspectable |
| **Abstain rules** | Thresholds on the above | Abstains if the photo is unusable, vision confidence < 0.60, top cause < 0.45, top two within 0.15, answers contradict, the top cause is `unknown`, or **an action that costs money** is suggested with confidence < 0.75 | — |

The 9 causes: leaf rust · other leaf disease · insect pest · heavy-rain damage · drought at flowering · soil acidity/nutrients · old trees needing stumping · **normal off-year** · unknown.

## 5. Where we chose NOT to use AI

The brief asks "would a simpler tool do the same job?". We answer it per feature:

| Feature | Tool used | Why |
|---|---|---|
| Photo quality check | Plain rules (variance of Laplacian, brightness) | Rules are enough |
| Escalation | One SMS, no server | Works on 2G, no data plan, no infrastructure |
| Price reference | Plain lookup (WFP maize/bean prices; **WFP has no coffee price for Kenya/Rwanda**, which we checked) | An SMS-level problem deserves an SMS-level tool |
| Action advice | A fixed list of 24 cards written from cited guidance | Safety: the tool can only say checked things |

What AI adds that SMS, a spreadsheet or a search cannot do: reading a leaf photo, and weighing several possible causes against *her* rain, soil and answers.

## 6. Guardrails and responsible AI

| Concern | What Ikawa does |
|---|---|
| Human in the loop | Ikawa suggests, never acts. Money-costing advice needs ≥ 0.75 confidence **or** an officer. |
| Hallucination | Closed lists everywhere; pre-recorded audio; no generative text at run time |
| Fail-safe ("not sure — ask a person") | 7 abstain rules + the "cannot read this leaf" class → one-SMS escalation → officer reply code |
| Consent | Three separate consents (service · registry sharing · photos for improvement) |
| Data on the phone | IndexedDB encrypted with AES-GCM (key derived from the agent's PIN via PBKDF2); cases deleted only after the agent marks them synced; coordinates rounded to 2 decimals (~1 km) |
| Shared / lost phone | PIN-gated, encrypted storage *(adopted voluntarily — this exact question is in the Health annex, not Agriculture)* |
| Bias | Trained on Kenyan, Brazilian and Ecuadorian leaves, none from Kirinyaga phones (stated). Voice works per speaker in any language. Registry records the woman farmer in her own name. |
| Honesty about language | Machine-drafted Kiswahili is labelled in the app and in the video |

## 7. Results (measured)

All numbers come from files in [`docs/evidence/`](docs/evidence/README.md). Nothing was tuned on the held-out sets.

| Run | What changed | In-distribution test | **Held-out field clusters** (RoCoLe C9–C12) | **Unseen mite photos** |
|---|---|---|---|---|
| 1 | Baseline (RoCoLe held out entirely) | 98.96% | **0.0%** — every field photo labelled "not coffee" (a background shortcut) | 97% confident, wrong |
| 2 | Split RoCoLe by whole field cluster + low-res augmentation | 98.44% | **96.6%** | only 2.6% flagged |
| 3 *(shipped)* | Teach mite photos as "cannot read" | **98.51%** | 89.2% of all leaves; **96.6% when it answers**; declines 7.6% | **50% flagged** (23/46) |
| 4 | Same, EfficientNet-Lite0 (pre-registered comparison) | 98.81% | 89.7% | 34.8% flagged → **not adopted** (validation +0.04 pts < the +0.5 rule written in advance; worse on unknown pests; 50% larger) |

| Shipped phone model | Value |
|---|---|
| Architecture / format | MobileNetV2-1.0, ONNX, static int8 (recipe chosen automatically from 3 by measured accuracy) |
| Size | **2.4 MB** (fp32: 8.9 MB) |
| Accuracy after int8 | test 98.67% = fp32 98.67%; field clusters 88.7% vs 89.2% fp32; 98–100% identical predictions |
| Calibration | ECE 0.019 (test), temperature 0.67 |
| Speed (4× CPU throttle) | model load + 6 photos 3.1 s; warm photo ≈ 0.27 s |
| One-time install | ≈ 17 MB precache (13.6 MB is the ONNX Runtime WebAssembly engine) |

Two findings we are proud of because they are uncomfortable:
1. **The famous coffee dataset is 98% copies.** JMuBEN's 58,550 files collapse to **1,082 independent image groups**; its "healthy" class has **63 distinct files**, each stored ~300 times. A normal random split would have reported fake accuracy. We split by group.
2. **Our first model was 0% accurate on real field photos** while scoring 98.96% on its own test set. We kept that run as evidence and fixed the cause.

Also measured: the detective is stable where evidence is clear (0% top-cause flips under ±20% changes to every factor) and unstable where it is ambiguous (40–62% flips). That is exactly where it abstains.

## 8. Honest limits

1. **No Kenyan phone photos** in training. Held-out field clusters share the camera, species (Robusta) and field with the training clusters: a within-dataset test, not a country shift.
2. **Five leaf conditions only.** Roots, stems, berries and nutrient deficiency are invisible to the model. **Half of unseen mite photos are still read as rust.**
3. **Small test sets:** healthy n = 35 (in-distribution), 46 unseen mite photos.
4. **The detective's multipliers are expert guesses** (marked `UNVERIFIED-expert-guess` in `app/src/engine/priors.ts`); only their *directions* are backed by sources.
5. **Rain is a ~5 km satellite estimate** (CHIRPS); it cannot see one slope. Soil values are predicted (iSDAsoil), not lab-measured.
6. **Kiswahili is machine-drafted** (Meta NLLB-200 + manual fixes by a non-native) and **unreviewed**; the audio is Meta MMS-TTS (non-commercial licence).
7. One held-out healthy photo is read as "cannot read" with 0.99 confidence; with it in a 5-leaf bag the "your leaves look healthy" state falls back to "not sure". Safe, but over-cautious.

## 9. Data

| Dataset | Used for | Licence | Size used | Notes |
|---|---|---|---|---|
| **JMuBEN + JMuBEN2** (Arabica, Kirinyaga, Kenya) | Training (5 leaf classes) | CC BY 4.0 | 58,550 files → **1,082 groups** | 98% copies; SHA-256 verified downloads from Mendeley |
| **BRACOL** (Arabica, Brazil) | Training + test | CC BY 4.0 | 1,343 images | Official zip is **truncated upstream**: 1,402 of 1,747 recoverable |
| **RoCoLe** (Robusta, Ecuador, smartphone, field) | Training clusters C1–7, val C8, **held-out C9–12** | CC BY 4.0 | 1,477 images | Mite photos used for the "cannot read" class and the abstention test |
| PlantVillage (non-coffee subset) | "cannot read" class | see source | 1,976 | Studio images |
| Cassava Leaf Disease (Kaggle competition, field photos) | "cannot read" class | competition terms | 2,000 | — |
| **CHIRPS v2.0** daily rain, 0.05° | Heavy-rain days per area and date | see source | 2025 + 2026 (to Aug 31) | Shows real events, e.g. 134 mm on 28 Apr 2026 |
| NASA POWER | Flowering-season rain anomaly | open | 2015–2026 | ~50 km: too coarse for heavy-rain days |
| **iSDAsoil** (30 m) | Topsoil pH per area | CC BY 4.0 | 49 points | Predicted values |
| WFP food prices (HDX), Kenya | Maize/bean price card | see source | 46 series within 150 km of Mutira; nearest Karatina (Nyeri, 11 km), last data Jun 2024 → flagged stale | **No coffee** in the Kenyan or Rwandan WFP files |
| FAOSTAT | Problem evidence | see source | — | — |

"See source" = the licence was not re-checked by us. Pipeline: [`ml/prepare_data.py`](ml/prepare_data.py) (duplicate-aware grouping: byte hash + rotation/flip-invariant perceptual hash, confirmed by thumbnail correlation ≥ 0.95). More: [`docs/data-access.md`](docs/data-access.md).

## 10. Languages and localisation

- **One pack per language:** `app/src/content/packs/<lang>.json` (24 action cards, questions, consent and UI strings) + audio clips in `app/public/audio/`.
- **Kiswahili** was drafted with Meta **NLLB-200** running locally, checked by back-translation (18/54 strings flagged), and the clear errors were fixed by hand (for example "sick leaves" had become "patients' papers", and "leaf" had become "paper"). Every fix is listed in the pack's `manualEdits`. **No string is marked as reviewed.**
- **Adding a language** (e.g. Gikuyu, `kik_Latn`) needs no code: run `ml/translate_content.py` / `ml/translate_missing.py`, render audio with `audio/render.py` (Meta MMS-TTS supports `kik`), and add it to the switcher. Voice answers already work in any language.
- **Native review:** [`docs/review/sw_review.csv`](docs/review/) lists every string, safety-critical lines first, with a message to send to a volunteer reviewer.

## 11. How it meets the brief

| Rule in the PDF (§06) | How Ikawa meets it |
|---|---|
| Runs on a device the user already has | Low-end Android phone (agent/daughter) + Noor's basic phone by SMS |
| Core feature works offline | Model, rain/soil grid, detective, audio all on the phone; proven by `app/e2e/offline.spec.ts` |
| Model small enough to side-load / send over a weak link | 2.4 MB model; data + audio < 1 MB |
| At least one interaction in a local language, named | **Kiswahili**: audio questions, audio action cards, SMS text |
| "How would it fare in a less-supported language?" | Voice templates need no language data; packs are a file; Gikuyu is the next pack |
| Human makes the final call; flags what it is unsure of | Suggest-only; probabilities; "what I could not check"; abstain rules |
| Avoid hallucinations | Closed lists, pre-recorded audio |
| Cite data; say what the data does not cover | §9 and §8 |
| Annex B: help Noor make/act on one better agricultural decision | Diagnose a crop problem, time an action, localised advisory, document an observation, connect to the extension next step |
| Annex B precondition: farmer registry | Each consented case creates a registry record (in the woman farmer's own name) |

Full traceability: [`docs/build-details.md` §9](docs/build-details.md).

## 12. Run it

### The app
```bash
cd app
npm install
npm run dev                      # http://localhost:5173  (demo: /?demo=1  and  /?demo=1&run=mite)
npm test                         # 102 unit tests (vitest)
npm run typecheck                # app + tests
npx playwright install chromium  # once
npx playwright test              # 14 browser tests, incl. the offline proof
LIVE_URL=https://ikawa-meek-0s-projects.vercel.app npx playwright test -c playwright.live.config.ts   # same tests, live site
npm run build && npm run size    # production build + size budget check
```
Routes: `#/officer` (decode a case SMS, reply with a card code), `#/coop` (stored cases, export).

### Rebuild the data and the model (optional)
```bash
uv sync                                                   # Python deps (project venv)
uv run python data/scripts/fetch_open_data.py             # CHIRPS, NASA POWER, iSDAsoil, WFP, FAOSTAT (idempotent)
uv run python geo/build_grid.py && uv run python geo/build_asof.py && uv run python geo/build_prices.py

# Kaggle (needs KAGGLE_API_TOKEN in .env; kernels run on Kaggle's free CPU/GPU)
ml/kaggle/push.sh data-prep      # downloads + verifies + de-duplicates + splits → images.tar + manifest.csv
ml/kaggle/push.sh train          # MobileNetV2, 25 epochs, checkpoints after every epoch, auto-resume

# Phone model (local; needs torch, timm, onnx, onnxruntime)
python ml/export.py --run <train output dir> --data <data-prep output dir> --out app/public/model --calib 100
```
Training is crash-safe: `last.pt` is written atomically after every epoch and on SIGTERM, the last 3 epochs are kept, and `--resume auto` continues from the newest readable checkpoint. A hard-kill test lost at most one epoch and the resumed run reproduced identical numbers.

## 13. Deployment

**Live: https://ikawa-meek-0s-projects.vercel.app** (Vercel, personal scope `meek-0s-projects`, project `ikawa`).
Note: `ikawa.vercel.app` belongs to someone else — always use the URL above.

Ikawa is a **static PWA**: no backend, no database, no API keys at run time. It needs only HTTPS (camera, microphone, GPS and the service worker require a secure context).

| | **Vercel (live)** | **Render (optional mirror, not deployed)** |
|---|---|---|
| Config | [`app/vercel.json`](app/vercel.json) + [`app/.vercelignore`](app/.vercelignore) | [`render.yaml`](render.yaml) (Blueprint, static site) |
| Root / build / output | `app` · `npm ci` · `npm run build` · `dist` | same |
| Headers | `sw.js`, `registerSW.js`, `manifest.webmanifest`: `no-cache` (updates reach phones); `health.json`: `no-store`; `/assets/*`: immutable; `Permissions-Policy` for camera/mic/GPS; `nosniff`; `no-referrer` | same (minus health.json) |
| Access | Vercel Authentication (SSO) **disabled** for this project so judges can open it | — |

Deploy / redeploy:
```bash
cd app
vercel deploy --prod --yes --build-env GIT_COMMIT=$(git rev-parse --short HEAD)
../scripts/healthcheck.sh https://ikawa-meek-0s-projects.vercel.app     # exit 0 = healthy
```

**Health and uptime.** `GET /health.json` returns the commit, build time, model file + SHA-256, data versions and language-pack status; it is written *after* the build so it is never served from the offline cache. [`scripts/healthcheck.sh`](scripts/healthcheck.sh) checks the page, `health.json`, the model, the grids, the service worker, and that the WebAssembly engine is served as `application/wasm`. **No keep-alive cron is needed:** a static site on Vercel's CDN (or a Render *static site*) never sleeps — only Render *web services* spin down when idle, and Ikawa has none. Run the health check after each deploy, or schedule it anywhere (cron, GitHub Actions) as monitoring.

**Does the app grow on the phone?** No photos are ever stored and the model never changes on the device.

| What | Size | Grows? |
|---|---|---|
| Offline cache (app, 2.4 MB model, 13.6 MB engine, grids, audio) | ≈ 17 MB | **No.** Fixed per release; a new deploy replaces changed files (Workbox revisions) and deletes old caches (`cleanupOutdatedCaches`) |
| Each case (causes, answers, area; encrypted) | ≈ 1–2 KB | Yes, until the agent marks it synced and deletes it (Coop page) |
| Each farmer's voice templates (MFCC numbers, not audio) | ≈ 42 KB (was 150 KB before compaction) | Once per farmer |
| Photos | 0 | Never stored |

The Coop page shows storage used/quota; the app asks the browser for persistent storage so records are not evicted.

## 14. Architecture and repository layout

```
┌──────────────────── Agent's phone (offline PWA) ────────────────────┐
│ Preact UI · audio-first · Kiswahili / English packs                 │
│ Photo gate (rules) → Leaf model (onnxruntime-web, int8, 2.4 MB)     │
│ Voice: MFCC + DTW vs farmer's own templates                         │
│ Plot data: plot_grid.json + rain_asof.json (CHIRPS, iSDAsoil)       │
│ Detective (Bayesian scorer) → abstain rules → action card + audio   │
│ IndexedDB, AES-GCM encrypted (PIN)   ·   Outbox: sms: link          │
└──────────────────────────────────────────────────────────────────────┘
         │ one SMS (2G is enough)                    │ export file when online
         ▼                                           ▼
 Extension officer → reply "A07"            Cooperative (registry, cases)
         ▼
 Noor's basic phone: SMS in Kiswahili
```

```
app/            PWA: src/screens (UI) · src/engine (vision, detective, priors, voice, smscodec, photogate)
                src/content/packs (en, sw) · src/store (encrypted IndexedDB) · e2e/ (Playwright) · public/ (model, grid, audio, img, demo)
ml/             prepare_data.py · train.py · export.py · translate_content.py · translate_missing.py · kaggle/ (kernel configs, push.sh)
geo/            build_grid.py · build_asof.py · build_prices.py · tests
detective/      vignettes.json (30 SYNTHETIC test cases) · notes
audio/          render.py (MMS-TTS → Opus)
data/scripts/   fetch_open_data.py     (data/raw, data/interim are git-ignored)
docs/           specs, decisions, evidence, review sheet, video script
```

Tech stack: TypeScript, Preact, Vite, vite-plugin-pwa (Workbox), onnxruntime-web, Meyda, idb, WebCrypto · Python, PyTorch, timm, ONNX Runtime quantisation, rasterio · Kaggle kernels · Vitest, Playwright.

## 15. Status and roadmap

**Done:** data pipeline · 3 training runs with evidence · int8 phone model · detective + abstain rules · voice templates · SMS codec · encrypted store · Kirinyaga rain/soil grid with per-date history · Kiswahili pack + 37 audio clips · licensed pictures · offline proof · demo mode · problem evidence · video script.

**Before submission (deadline Sun 4 Oct 12:00 Dhaka):**
- [x] "Your leaves look healthy" result (with "send to a person anyway")
- [x] Kenyan WFP prices (nearest market, staleness flagged)
- [x] Deployed to Vercel; 14/14 browser tests pass against the live URL; health check passes
- [ ] Test on a real phone: camera + photo gate, GPS, microphone, Kiswahili audio, `sms:` link, home-screen install, airplane mode
- [ ] Record and upload the video
- [ ] Submit in HackOS

**Next (after the hackathon):**
- Native-speaker review of Kiswahili; a Gikuyu pack
- Kenyan phone photos from a partner cooperative (consented); retrain and re-test
- A 7th `other_damage` class and an out-of-distribution score, to catch the mites that still pass
- Agronomist review of every detective factor (replace `UNVERIFIED` values)
- Smaller runtime (custom minimal ONNX Runtime build, or WebNN) to cut the 13.6 MB one-time download; optionally enable multi-threaded WASM (needs COOP/COEP headers) for faster inference
- Make the saved voice templates load back on a farmer's next visit (stored compactly today, not yet re-used)
- Registry export into existing national/cooperative systems; aggregated "rust radar" early-warning map

## 16. Documentation map

| File | What |
|---|---|
| [`docs/tasks.md`](docs/tasks.md) | Step-by-step plan and live status |
| [`docs/decisions.md`](docs/decisions.md) | Decision log D-001…D-031 with reasons and rejected options |
| [`docs/evidence/README.md`](docs/evidence/README.md) | Measured results of every run |
| [`docs/problem-evidence.md`](docs/problem-evidence.md) | Verified problem facts + the problem statement |
| [`docs/contracts.md`](docs/contracts.md) | Locked interfaces between modules |
| [`docs/build-details.md`](docs/build-details.md) · [`docs/business-plan.md`](docs/business-plan.md) · [`docs/tech-stack.md`](docs/tech-stack.md) | Original design, business plan, stack (partly superseded — see banners) |
| [`docs/data-access.md`](docs/data-access.md) · [`docs/content-sources.md`](docs/content-sources.md) · [`docs/ATTRIBUTIONS.md`](docs/ATTRIBUTIONS.md) | Data access, advice sources, image credits |
| [`docs/video-script.md`](docs/video-script.md) · [`docs/review/`](docs/review/) · [`docs/mentors.md`](docs/mentors.md) | Video, native-review kit, mentors |
| [`app/qa/REPORT.md`](app/qa/REPORT.md) | Browser QA report and screenshots |

## 17. Credits and licences

- **Datasets:** JMuBEN/JMuBEN2, BRACOL and RoCoLe (all CC BY 4.0, Mendeley Data); PlantVillage; Cassava Leaf Disease (Kaggle); CHIRPS (UCSB Climate Hazards Center); NASA POWER; iSDAsoil; WFP via HDX; FAOSTAT.
- **Models:** MobileNetV2 ImageNet weights via `timm`; **Meta NLLB-200** and **Meta MMS-TTS** (both CC BY-NC 4.0: used for the hackathon prototype only; a commercial deployment needs native recordings and a different translation path).
- **Images:** antestia nymphs (Smartse) and coffee berry-borer damage (L. Shyamal), Wikimedia Commons, CC BY-SA 3.0; see [`docs/ATTRIBUTIONS.md`](docs/ATTRIBUTIONS.md). The leaf-photo guide is our own drawing.
- **Brief:** World Bank Digital & AI Vice Presidency, Youth Summit and Hack-Nation, *Small AI for Development* concept note (`docs/reference/agriculture.pdf`).
- **Built by:** a one-person team, with Claude Code (Anthropic) as a coding assistant.
