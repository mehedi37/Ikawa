# Decision log — Ikawa

Every important decision is recorded here: what we chose, what we rejected, and why. **Append new decisions; don't rewrite old ones.** If a decision changes, mark it `Superseded by D-0xx`.

Status: `Accepted` · `Provisional` (needs a check before submission) · `Superseded`

| ID | Date | Decision | Status |
|---|---|---|---|
| D-001 | 2026-10-03 | Compete in **Agriculture** (Annex B) | Accepted |
| D-002 | 2026-10-03 | Answer **"why did my yield drop?"** (rank the causes), not "what disease is this leaf?" | Accepted |
| D-003 | 2026-10-03 | Set it in **Rwanda's western coffee highlands**, language **Kinyarwanda** | **Superseded by D-019** |
| D-004 | 2026-10-03 | Build our own offline **Choice Engine**; don't use the Jev API | Accepted |
| D-005 | 2026-10-03 | Drop **ElevenLabs**; pre-render all audio from a fixed list | Accepted |
| D-006 | 2026-10-03 | Voice answers by matching the farmer's **own voice samples** (MFCC + DTW), not speech recognition | Accepted |
| D-007 | 2026-10-03 | The detective is a **hand-built Bayesian scorer** | Accepted |
| D-008 | 2026-10-03 | **No AI for price.** Price card = WFP maize/beans + official coffee price | Accepted (stretch) |
| D-009 | 2026-10-03 | Platform: **offline installable web app (PWA)**, optional APK wrap | Accepted |
| D-010 | 2026-10-03 | **No server in the core flow.** Escalation by one SMS; sync by file share | Accepted |
| D-011 | 2026-10-03 | Train on **JMuBEN + BRACOL**, test on **RoCoLe**; split by original image | Accepted |
| D-012 | 2026-10-03 | Abstain thresholds chosen from the selective-accuracy curve + a "money rule" | Accepted |
| D-013 | 2026-10-03 | Smartphone held by **daughter or cooperative youth agent**; Noor uses her **basic phone** by SMS | Accepted |
| D-014 | 2026-10-03 | **Farmer registry as a by-product**, women registered in their own name | Accepted |
| D-015 | 2026-10-03 | **Scope rule:** core loop working end-to-end by the midpoint; everything else is a stretch | Accepted |
| D-016 | 2026-10-03 | Bean pack (iBean) as a **replicability demo** | Stretch |
| D-017 | 2026-10-03 | **Track hygiene:** follow only common sections + Annex B; label anything borrowed from other annexes | Accepted |
| D-018 | 2026-10-03 | Business model: **free for farmers**; cooperatives/exporters and public programmes pay | Accepted |
| D-019 | 2026-10-04 | Setting = **Kenya (Kirinyaga) + Kiswahili**; Gikuyu is the later "less-supported language" pack | **Accepted 2026-10-04** (user: use the language Noor speaks; add more languages later) |
| D-020 | 2026-10-04 | **Solo builder → hard MVP cut line.** Must-have vs stretch is fixed in `docs/tasks.md` | Accepted |
| D-021 | 2026-10-04 | BRACOL is a normal train/val/test source; **RoCoLe is the only external test**; per-source accuracy reported | Accepted |
| D-022 | 2026-10-04 | **Kaggle-first pipeline**: data prep and training run as Kaggle kernels; atomic checkpoints + auto-resume; local scripts identical | Accepted |
| D-023 | 2026-10-04 | **Duplicate-aware data**: group by byte hash + verified rotation/flip-invariant perceptual hash; split by group | Accepted |
| D-024 | 2026-10-04 | Rain evidence needs **CHIRPS** (5 km daily); NASA POWER (~50 km) is a fallback only | Accepted |
| D-025 | 2026-10-04 | **Honest size claim:** shareable payload ≤ 6 MB, **plus a one-time 13.6 MB runtime** (onnxruntime-web WASM) | Accepted |
| D-026 | 2026-10-04 | Detective priors are expert guesses; **sensitivity results are reported, not hidden** | Accepted |
| D-027 | 2026-10-04 | Leaf model architecture: **MobileNetV2-1.0** (not MobileNetV3-Small); EfficientNet-Lite0 as the alternative | Accepted (confirm on full data) |
| D-028 | 2026-10-04 | **JMuBEN is ~98% copies** (measured on the full Kaggle run); report it, and train on the ~7.8k independent images | Accepted |
| D-029 | 2026-10-04 | **Language packs**: every farmer-facing string/audio is a swappable pack (`packs/<lang>.json` + `audio/`); machine-drafted packs are labelled | Accepted |
| D-030 | 2026-10-04 | **Run 1 shortcut failure** (0% on field photos) → add field-photo coffee data by whole-cluster RoCoLe split + low-res augmentation | Accepted |
| D-031 | 2026-10-04 | `not_coffee` means **"cannot read this leaf"** (not coffee, or a condition outside the five); unknown-pest photos are trained into it | Accepted |
| D-032 | 2026-10-04 | EfficientNet-Lite0 vs MobileNetV2: **pre-registered** rule → **keep MobileNetV2** | Accepted (result 04:40) |

---

## D-001 — Track: Agriculture
- **Context:** One winner per sector. We compared Agriculture and Tourism.
- **Decision:** Agriculture.
- **Why:** The scoring rewards measurable AI (data grounding 15%, evidence 15%, AI value 15%). The coffee leaf datasets give real numbers. The Tourism annex itself says a listing or booking page works "without any AI", which weakens the AI case there.
- **Accepted risk:** Agriculture will be the most crowded track (many leaf classifiers). We mitigate that with D-002.

## D-002 — Problem framing: the yield detective
- **Decision:** Rank the possible causes of the yield drop (disease, pest, rain damage, drought at flowering, soil, old trees, normal off-year, unknown).
- **Why:** That's Noor's actual question in Annex B ("she cannot say why"). It also lets us say "it's partly normal, don't spend money", which no leaf classifier can.
- **Rejected:** a plain leaf classifier (the crowded default).

## D-003 — Setting: Rwanda / Kinyarwanda (PROVISIONAL)
- **Why:** Highland Arabica cooperatives match Noor. Kinyarwanda has large open voice data (Common Voice) and Meta MMS-TTS. Real institutions to plug into. Open soil/rain data confirmed at a Nyamasheke point.
- **Check before final:** Do we have a **native Kinyarwanda speaker** to verify every string and recording? If not, consider moving the setting to a country where a team member is a native speaker. The brief asks "what localizing AI means **for you**", so authenticity matters.
- **Known weakness:** Rwanda has relatively good mobile coverage, so judges may ask "why offline?". Answer with OpenCelliD valleys + data-bundle cost + the phone being at the house.

## D-004 — Choice Engine instead of Jev
- **Context:** Jev (TypeSafe AI) returns typed decisions with probabilities. It's a proprietary cloud API, and we know of no open version.
- **Decision:** Reproduce the *idea* offline: every AI output is a choice from a closed list, with a calibrated probability, and abstains below a threshold.
- **Why:** The core must work offline (§06 Rules). A closed list matches the glossary's "Fixed list of answers" and makes hallucination impossible.

## D-005 — No ElevenLabs
- **Decision:** All ~40 audio clips are pre-rendered once (native speaker preferred; MMS-TTS `kin` as fallback) and shipped as Opus (~400 KB).
- **Why:** Cloud-only, Kinyarwanda support uncertain, and runtime text-to-speech isn't needed when the answer list is fixed.
- **Licence note:** MMS-TTS is CC BY-NC → hackathon only; re-record for production.

## D-006 — Voice answers via the farmer's own templates
- **Decision:** MFCC features + Dynamic Time Warping against the farmer's own recorded answer words. Tap fallback on every question.
- **Why:** No small offline Kinyarwanda speech recogniser exists. This approach is 0 MB and **works in any language**, which answers the "less-supported language" question.
- **Accepted risk:** it depends on the speaker and on noise. We measure both and show the numbers.

## D-007 — Hand-built Bayesian scorer
- **Why:** No labelled "cause of yield drop" dataset exists. A small Bayesian model is explainable line by line and tiny.
- **Rule:** every likelihood is traced to a cited source. Test cases are labelled **SYNTHETIC**. We run a sensitivity analysis (does the top cause flip if we shift the priors by ±20%?).

## D-008 — No AI for price
- **Finding:** WFP/HDX Rwanda has **no coffee** (checked 2026-10-03), but has maize and beans (Noor's lower-slope crops).
- **Decision:** A price card with WFP maize/beans + the official seasonal coffee reference price **[verify source]**. Plain lookup, no AI.
- **Why:** The judges' rule: "If SMS, a spreadsheet, or a Google search could do the same job, AI may not be the best tool."

## D-009 — PWA
- **Why:** Runs in Chrome on the Android phones people already have, works offline after the first load, judges can open a link, and it can be wrapped as an APK for Bluetooth side-loading.
- **Rejected:** native Kotlin (slower to build, no link to try), Flutter (larger binary).

## D-010 — No server in the core flow
- **Decision:** Escalation = one SMS under 160 characters (store-and-forward). The cooperative gets data through a file share (Web Share API / export file). An optional cloud sync is out of the weekend scope.
- **Why:** No server to fail during the demo, no hosting cost, and it's honest about connectivity.

## D-011 — Datasets and splits
- **Decision:** Train on JMuBEN/JMuBEN2 (Kenya, field) + BRACOL (Brazil). Hold out RoCoLe (Ecuador, smartphone) as the field-shift test. Add a `not_a_coffee_leaf` class from PlantVillage non-coffee images.
- **Rule:** JMuBEN is augmented → **split by original-image group** (perceptual hash).

## D-012 — Abstain thresholds
- **Decision:** Thresholds are picked from the selective-accuracy curve (accuracy vs % abstained). **Money rule:** any action that costs money needs confidence ≥ 0.75 or a human.

## D-013 — Who holds which phone
- **Decision:** The AI runs on the daughter's smartphone (weekends) or the cooperative youth agent's phone. Noor gets results on her basic phone by SMS and starts cases by SMS.
- **Why:** Annex B / §05 persona: her phone stays at the house; the smartphone is home only at weekends.

## D-014 — Registry as a by-product
- **Why:** Annex B: "the binding constraint is the absence of a working farmer registry". Each consented case creates or updates a record. Women are registered in their own name.
- **Business link:** geolocated plot records also help cooperatives with export traceability (see business-plan.md, EUDR **[verify dates]**).

## D-015 — Scope rule
- **Core loop:** photo → leaf model → questions → detective → result + audio card → escalate by SMS, all in airplane mode.
- **Stretch, in order:** price card → Rust Radar map → bean pack → APK wrap.

## D-016 — Bean pack (stretch)
- **Why:** Noor grows beans too, and iBean is in Annex B. Retraining the same pipeline on beans in about an hour proves "Could another setting reuse this?" (Scalability, 10%).

## D-017 — Track hygiene
- **Decision:** Requirements come only from the common sections and Annex B. The "phone lost or shared" question comes from the **Health** annex. We keep it as voluntary good practice and label it as such.

## D-018 — Business model
- **Decision:** Free for farmers. Paid by cooperatives/exporters (registry + traceability + early warning) and public extension programmes / development projects (cost per farmer reached). See business-plan.md.

## D-019 — PROPOSED: Kenya (Kirinyaga) + Kiswahili instead of Rwanda + Kinyarwanda
- **Trigger:** you have no native speaker and none of the 12 mentors lists any African language (`docs/mentors.md`).
- **Why it is better:**
  1. **Data fits the place.** JMuBEN, our main training set, was photographed in Mutira, Kirinyaga county, Kenya (Arabica, real field conditions). In Kenya the training data is *from the user's own region*; in Rwanda it is not.
  2. **Reviewable language.** Kiswahili has far more speakers and far better tool support (Common Voice, MMS, FLEURS, NLLB), so finding a 30-minute native reviewer is realistic and machine drafts start from a decent baseline.
  3. **Still answers "less-supported language".** Gikuyu (the local language of Kirinyaga) becomes the stress test for the voice-template layer, which needs no language data (D-006).
- **Cost:** rebuild the plot grid for Kirinyaga (box constants in `data/scripts/fetch_open_data.py` and `geo/build_grid.py`), re-fetch rain/soil (about 15 min), swap the institutions named in the docs (Rwanda → Kenya: **[verify]** the extension service and coffee cooperative structure before naming any), update the story text.
- **Alternative:** keep Rwanda and recruit a Kinyarwanda reviewer. Riskier on a solo timeline.
- **Status:** proposed. **D-003 stays in force until you decide.** The app is language-configurable (one constant), so the decision does not block coding, only content and the grid.

## D-020 — Solo builder: MVP cut line
- **Must-have (ship even if everything else fails):** photo → leaf model → 6 questions (tap) → detective → result + 1 audio card → abstain message → escalation SMS; working in airplane mode; video; README with data tables.
- **Should-have:** voice answers (DTW), officer decoder page, encrypted storage + PIN, price card.
- **Stretch (only after the video is recorded):** Coop page, Rust Radar, bean pack, APK wrap.
- **Rule:** the video is recorded from the must-have flow *first*; additions after that are bonuses, not dependencies.

## D-021 — Splits and external test
- **Why:** the first design held BRACOL out as an external test, but then the shipped model would never see whole-leaf phone-style photos. Now BRACOL trains normally (own held-out split) and **RoCoLe** (different species, country, camera) is the single never-trained external test, which is the honest "field shift" number.
- **Country-shift ablation:** `train.py --train-sources jmuben,plantvillage,cassava` then read the per-source accuracy on BRACOL.
- **Unknown-class test:** RoCoLe's red-spider-mite images are not in our class list; the right behaviour is to abstain. We report `other_pest_share_below_0.6`.

## D-022 — Kaggle-first pipeline with crash-safe checkpoints
- **Kernels:** `ikawa-data-prep` (CPU, internet) → `ikawa-train` (GPU, internet for pretrained weights). Datasets used on Kaggle: our private `ikawa-bracol`, RoCoLe, PlantVillage, Cassava (competition), JMuBEN (Mendeley, SHA-256 verified inside the kernel).
- **Checkpoints:** `last.pt` atomically after every epoch and on SIGTERM; `best.pt`; last 3 `epoch_NNN.pt`; auto-resume; `--max-minutes` clean stop; epoch-seeded sampling so resumed runs match uninterrupted ones.
- **Moving a checkpoint between sessions:** download the kernel output (`kaggle kernels output`), upload `ckpt/` as the private dataset `ikawa-ckpt`, attach it to the next run; `--resume auto` finds `/kaggle/input/ikawa-ckpt/ckpt/last.pt`.
- **Local fallback:** the same script runs on the RTX 3050 Ti (4 GB) with `--batch-size 32`.
- **Prerequisite:** Kaggle internet access needs a phone-verified account. If it is blocked, attach the pretrained weights as a dataset and use the Kaggle JMuBEN copy instead of Mendeley.

## D-023 — Duplicate-aware data (a measured finding)
- **Finding:** JMuBEN "leaf rust" has 8,192 files but only **1,024 are unique by bytes**, and about **458 groups** after grouping rotated/flipped copies. So the headline "58,555 images" overstates the independent data by roughly an order of magnitude. A random split would put copies in both train and test and inflate accuracy.
- **False-match fix:** plain perceptual hashing wrongly merged different BRACOL leaves (8–20% "duplicates"). Candidates must also pass a thumbnail-correlation check (≥ 0.95); after that BRACOL shows ≤ 4% duplicates, which is plausible.
- **Rule:** split by group; drop label-conflict groups; report duplicate ratios in the evidence.

## D-024 — Rain data resolution (a measured finding)
- **Finding:** NASA POWER is ~0.5° (≈ 50 km). Over our 49-cell study box every cell got the **same** series: anomaly −20.8% and **zero** days ≥ 40 mm everywhere. That would make the "40 mm overnight" demo meaningless.
- **Decision:** use CHIRPS (0.05°, 5 km, daily) for heavy-rain days; POWER only for the long-term anomaly baseline and the current year. Rebuild the grid when the CHIRPS file lands (`uv run python geo/build_grid.py`).
- **Still true even with CHIRPS:** 5 km cannot see one slope. We say so in the data-gaps slide.

## D-025 — Honest size claim
- **Finding:** `onnxruntime-web` needs a 13.6 MB WASM runtime (the default bundle is 27 MB). Our earlier "whole app ≤ 6 MB" was wrong.
- **Decision:** two numbers, both stated: (a) **one-time install ≈ 14 MB** (runtime + app), (b) **what is shared and updated ≈ ≤ 6 MB** (model ≤ 3 MB + audio + data + app code). The Rules in the PDF are about the *model files*, so (b) is the relevant figure, but we do not hide (a).
- **Later option:** a custom minimal ONNX Runtime build (if time permits) or a tiny hand-written MobileNet inference.

## D-026 — Detective is honest about being guesswork
- **Finding (from the build):** every multiplier, leaf slope, pH cut-off (5.0 / 6.5), stumping age (~20 years) and the drought bands are `UNVERIFIED-expert-guess`. Only *directions* are backed by sources (rust & rain, Arabica biennial bearing, Arabica pH optimum 5.4–6.0, antestia bug). Under ±20% prior shifts the top cause flips in **10.5%** of trials on average, **0%** on the clear cases and **40–62%** on ambiguous ones.
- **Decision:** show this in the video as a feature: "stable where evidence is clear, and it abstains where it is not." Replace guesses with agronomist-reviewed numbers before any real deployment.

## D-027 — Architecture: MobileNetV2, because it survives int8
- **Measured** (local, 6 epochs, same small data, 150 validation images per recipe, so treat it as a strong hint and not a final ranking):

| Architecture | fp32 ONNX | int8 ONNX | Val accuracy drop after int8 |
|---|---|---|---|
| MobileNetV3-Small (original plan) | 6.1 MB | 1.7 MB | **21–39 points** under every recipe tried |
| MobileNetV3-Small minimal (no SE / hard-swish) | 4.2 MB | 1.1–1.2 MB | 5–39 points |
| **MobileNetV2-1.0** | 8.9 MB | **2.4 MB** | **−0.7 to +1.3 points** |
| EfficientNet-Lite0 | 13.5 MB | 3.6 MB | 0.0 to 1.0 points |

- **Why:** hard-swish and squeeze-excite layers (MobileNetV3) are known to break under int8; ReLU6-based nets (V2, Lite) do not. The phone model must be int8 to meet the ≤ 3 MB side-load target.
- **Decision:** MobileNetV2-1.0 is the default (`ml/train.py --arch`). `ml/export.py` tries three quantisation recipes, measures the accuracy drop on real validation images, and ships fp32 instead (and says so in `meta.json`) if int8 is not within 2 points.
- **Revisit** after the full Kaggle run: if EfficientNet-Lite0 is clearly more accurate and 3.6 MB is acceptable, switch (it is a one-flag change).
- **Corrects** `docs/tech-stack.md` (which said MobileNetV3-Small).

## D-028 — JMuBEN is ~98% copies (measured, full run on Kaggle, 2026-10-04)
- **Numbers** (`ikawa-data-prep`, 65,427 files read, SHA-256 of all 5 Mendeley zips verified):

| JMuBEN class | files | independent groups | duplicates |
|---|---|---|---|
| healthy | 18,984 | **13** (only **63** byte-unique files) | 99.9% |
| leaf_miner | 16,978 | 350 | 97.9% |
| leaf_rust | 8,336 | 458 | 94.5% |
| cercospora | 7,681 | 79 | 99.0% |
| phoma | 6,571 | 182 | 97.2% |
| **total** | **58,550** | **1,082** | **98.2%** |

  BRACOL: 0–4% duplicates. RoCoLe: ~4%. PlantVillage: ~2%. Cassava: 0%.
- **What it means:** the published "58,555 images" are mostly byte-identical or flipped/rotated copies. A normal random split would put copies on both sides of the test and report fake accuracy. We split by group.
- **Consequence for training:** after grouping, training data is train 6,286 (healthy only **137**, mostly BRACOL; cercospora 290; phoma 740; rust 1,025; miner 1,359; not_coffee 2,735). The healthy class is small, so: class-balanced sampling, strong augmentation, and we **report per-class counts and the small-n uncertainty** (healthy test n = 35).
- **Use in the video:** this is a concrete "what our data does NOT cover" point and shows we checked.
- **Rejected:** merging RoCoLe halves into training to fatten healthy: it would destroy the only clean species/country/camera shift test (D-021).

## D-029 — Language packs (language-agnostic by construction)
- **Decision:** primary language = **Kiswahili** (national/lingua-franca language in Kenya); Gikuyu (local language of Kirinyaga) and others are added later as packs.
- **Pack = one JSON + an audio folder:** `app/src/content/packs/<lang>.json` (`cards`, `strings`, `machineDrafted`, `engine`) and `app/public/audio/<lang>/…`. Adding a language = translate the English pack (`ml/translate_content.py`, Meta NLLB-200 running locally; Gikuyu is `kik_Latn`), render audio (Meta MMS-TTS has `swh`, `kin`, `kik`), add one entry to the language switcher. No code change.
- **Honesty rule:** every machine-drafted pack carries `machineDrafted:true`; the app shows "Machine-drafted translation — not checked by a native speaker" and the same line appears in the video. Back-translation QA scores are kept in `packs/sw_qa.json`.
- **Voice input** (farmer's own templates, D-006) is language-independent, so it already works for any added language.

## D-030 — Run 1 failed on field photos (shortcut learning); the fix (measured)
- **Run 1** (`ikawa-train` v2, 25 epochs, MobileNetV2): in-distribution **test accuracy 98.96%**, macro-F1 0.982, ECE 0.016, healthy recall 100% (n=35). But on RoCoLe (Robusta, smartphone, field) **0 of 1,477 images were classified correctly: 100% were labelled `not_coffee` with ~97% confidence**, including the red-spider-mite images (mean confidence 0.97, none below 0.6).
- **Cause:** the training data had no coffee leaf photographed in a field, but ~2,000 field photos (Cassava) as the negative class, so the network learned "field background → not coffee". The in-distribution score hid this because every training source differs from the others by style.
- **Fix (run 2):** (1) RoCoLe split by **whole field cluster**: C1–7 train, C8 val, **C9–12 held out** (238 healthy, 170 rust) + **all 155 mite images held out** as an unknown-class abstention test; healthy training images rise 137 → 586; (2) random low-resolution augmentation (JMuBEN's 128 px crops vs sharper sources is another shortcut); (3) class-balanced sampling unchanged.
- **Consequence for the claims:** RoCoLe is no longer a cross-*species* test (Robusta clusters are in training). The cross-country/species evidence is now: Run 1 zero-shot failure (kept in `docs/evidence/run1_zero_shot/`), plus the BRACOL-from-JMuBEN ablation if time allows. We report both honestly.
- **Open risk:** confident errors on unknown pests (mites). If run 2 still labels mites as rust/healthy with high confidence, the abstain story needs a real out-of-distribution guard (a seventh `other_damage` class or an energy/margin threshold).

## D-031 — `not_coffee` = "cannot read this leaf"; unknown-pest handling (measured, run 3)
- **Problem (run 2):** unseen red-spider-mite photos were labelled healthy/rust with ~95% mean confidence; only 2.6% fell below the 0.6 abstain line. A confidence threshold cannot catch confident errors.
- **Change (run 3):** mite photos from training clusters (107 images, oversampled ×8 inside the class) are labelled `not_coffee`, which the app already treats as "I cannot read this, ask a person". No interface change: the class keeps its id, only its meaning widens. Held-out: clusters 9–12, **46 unseen mite photos**.
- **Result (held-out field clusters, 454 images; 408 healthy/rust + 46 mites):**

| Measure | Run 2 | Run 3 |
|---|---|---|
| Unseen mites flagged ("cannot read" or conf < 0.6) | 2.6% | **50% (23/46)**; 25 still read as rust, 2 as healthy |
| Accuracy over all 408 real leaves | 96.6% | 89.2% (healthy recall 95.0%, rust recall 81.2%) |
| Real leaves declined ("cannot read") | 0% | 7.6% (31/408: 26 rust, 5 healthy) |
| **Accuracy when it does answer** | 96.6% | **96.6% (364/377)** |
| Confident wrong answers on real leaves | 3.4% | 3.2% (13/408) |

- **Reading:** same accuracy when it answers, but it now hands about half of the unknown-pest photos and 7.6% of uncertain real leaves to a person instead of guessing. Mites look like rust (both cause yellow spotting), which is why half still pass; the detective's other safeguards apply downstream (rust is a *money* cause, so it needs ≥ 0.75 confidence or an officer; the bug question; "what I could not check").
- **Not done, on purpose:** no threshold was tuned on the 46 held-out mite photos (that would contaminate the only test). A 7th `other_damage` class would be the principled next step (needs contract changes; post-hackathon).
- **Phone model (run 3, int8, 2.42 MB, shipped in `app/public/model/`):** test 98.67% = 98.67% fp32 (99.5% identical predictions); field clusters 88.7% vs 89.2% fp32; recipe `all_ops_percentile`, 100 calibration images (300 need ~13 GB RAM).
- **Evidence kept:** `docs/evidence/run1_zero_shot/` (0% on field photos), `run2_cluster_split/`, `run3_mites_as_unreadable/`.

## D-032 — Architecture comparison, pre-registered (written 2026-10-04 ~04:00 Dhaka, BEFORE the run finished)
- **Run:** Kaggle kernel `ikawa-train-lite0` = `ml/train.py` unchanged except `--arch efficientnet_lite0`; same data, splits, seed, epochs (25).
- **Rule (fixed now):** switch the shipped model from MobileNetV2 to EfficientNet-Lite0 **only if** (1) validation macro-F1 is ≥ 0.5 points higher, **and** (2) its int8 export loses ≤ 2 points (export.py's own check), **and** (3) the int8 file is ≤ 4 MB. Otherwise keep MobileNetV2.
- **The held-out sets (test, RoCoLe C9–12, unseen mites) are read only after the choice**, and reported for both models either way.
- **Result (04:40):** validation macro-F1 MobileNetV2 0.9540 vs Lite0 0.9544 (**+0.04 points < +0.50 required → rule fails → keep MobileNetV2**). Held-out, read only after the decision: test 98.51% vs 98.81%; field clusters 89.2% vs 89.7%; **unseen mites flagged 50.0% vs 34.8%**. Lite0 is marginally better on known classes but worse on the safety-critical unknown-pest test, and 50% larger (3.6 MB int8). Evidence: `docs/evidence/run4_lite0_comparison/`.

---

## Open questions (decide before submission)
1. ~~Setting and language~~ → decided: D-019 (Kenya + Kiswahili), D-029 (packs). D-003 superseded.
2. Official Rwandan coffee reference price source and current value → D-008.
3. Exact Arabica soil pH threshold and stumping age from extension guidance → D-007.
4. Hack-Nation submission deadline (exact time and timezone).
5. ~~Team roles~~ — solo builder (D-020).
6. ~~Submission deadline~~ — **Sun 4 Oct 2026, 12:00 Dhaka time (UTC+6)**: 24 h from the 12:00 start on 3 Oct. Plan to submit by 11:00 (60 min buffer). *(from the user; confirm the exact cut-off in HackOS.)*
7. Is the Kaggle account phone-verified (internet in kernels)? → D-022.
