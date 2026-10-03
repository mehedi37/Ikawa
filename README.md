# Ikawa — Small AI for Development (Agriculture track)

Offline coffee-farm **yield detective**: from leaf photos, the plot's rain and soil, and six simple questions it ranks the likely causes of a falling yield, tells the farmer one action by audio in her own language, and says **"I cannot read this / not sure — a person will help"** (one SMS to the extension officer) whenever the evidence is thin. A person always makes the final call.

*Hack-Nation × World Bank Youth Summit, 3–4 Oct 2026. Setting: Kirinyaga county, Kenya. Language: Kiswahili (machine-drafted, not yet native-reviewed; more languages = more packs).*

## Results, measured (details and limits: `docs/evidence/README.md`)
- Phone model: **2.4 MB** int8 MobileNetV2; same accuracy as the full-size model (test 98.7%).
- On **held-out field-photo clusters**: **96.6% correct when it answers**; it declines ~8% of real leaves and **50% of unseen mite photos** (a condition it never learned).
- We found and fixed a **shortcut failure** (0% on field photos in run 1) — kept as evidence.
- The popular coffee dataset is **98% copies** (58,550 files → ~1,082 independent images); we split by image group.
- Works **offline** (Playwright test `app/e2e/offline.spec.ts`).

## Layout
```
app/        PWA (Vite + Preact + TS): UI, engine (detective, voice, SMS, photo gate), unit + e2e tests
ml/         prepare_data.py, train.py (crash-safe checkpoints), export.py (ONNX int8), kaggle/ kernel configs
geo/        plot grid (CHIRPS + iSDAsoil), per-date rain, WFP price builder
detective/  synthetic vignettes + notes     audio/  text-to-speech render script
data/       raw/ (git-ignored) + scripts/   docs/   all specs, decisions, evidence
```

## Read in this order
1. `docs/problem-evidence.md` — the verified problem and the one-sentence statement
2. `docs/evidence/README.md` — what we measured (3 runs)
3. `docs/decisions.md` — every decision with reasons (D-001…D-031)
4. `docs/build-details.md` · `docs/contracts.md` · `docs/tech-stack.md` — design (partly superseded, see banners)
5. `docs/data-access.md` · `docs/content-sources.md` · `docs/ATTRIBUTIONS.md` — data, content sources, image credits
6. `docs/tasks.md` · `docs/video-script.md` · `docs/mentors.md`

## Run
```bash
cd app && npm install && npm run dev            # the app
cd app && npx vitest run && npx playwright test # 93 unit tests + e2e incl. offline
uv run python data/scripts/fetch_open_data.py   # open data (idempotent)
ml/kaggle/push.sh data-prep && ml/kaggle/push.sh train     # Kaggle pipeline; ml/export.py makes the phone model
```
Secrets live in `.env` (git-ignored): `KAGGLE_API_TOKEN`.

## Honest limits
No Kenyan phone photos in training · five leaf conditions only (mites are only half-caught) · the detective's multipliers are expert guesses · rain is a ~5 km satellite estimate · Kiswahili and its audio are machine-drafted (non-commercial TTS licence) · see `docs/evidence/README.md`.
