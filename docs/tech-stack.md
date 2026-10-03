# Ikawa — Tech Stack

> ⚠️ **Partly superseded (2026-10-04).** This document was written before the build. Where it conflicts with `docs/decisions.md`, **the decision log wins**. Key changes: setting is now **Kenya (Kirinyaga) + Kiswahili** (D-019, D-029; the Rwanda/Kinyarwanda text below is historical); the vision model is **MobileNetV2** (D-027); **JMuBEN is 98% copies** (D-028); a field-photo shortcut failure was found and fixed (D-030, D-031); size claim is "≈ 14 MB one-time install, ≤ 6 MB model + data" (D-025). Measured results: `docs/evidence/README.md`. Verified problem facts: `docs/problem-evidence.md`.


Guiding rules (from the PDF §06 Rules): **runs on a device she already has · core works offline · model small enough to side-load · local language**. Plus our own: **no server in the core flow** (D-010) and **every AI output comes from a closed list** (D-004).

## 1. Overview

```
┌──────────── BUILD TIME (laptop / Colab / Kaggle GPU) ────────────┐
│ Python 3.11 · PyTorch · timm · albumentations                    │
│  → MobileNetV2 fine-tune → temperature scaling             │
│  → ONNX export → int8 quantization (onnxruntime)                 │
│ rasterio / rioxarray / GDAL /vsicurl/ → plot grid JSON           │
│ ffmpeg (Opus) → audio cards  ·  pandas → WFP price table         │
└──────────────────────────────────────────────────────────────────┘
                              │ static files
┌──────────── RUNTIME (Android Chrome, offline PWA) ───────────────┐
│ Vite + TypeScript + Preact · vite-plugin-pwa (Workbox)           │
│ onnxruntime-web (WASM, SIMD)  ·  Meyda (MFCC) + our DTW          │
│ Detective scorer (TS)  ·  IndexedDB (idb) + WebCrypto AES-GCM    │
│ sms: links (store-and-forward) · Web Share API (export)          │
└──────────────────────────────────────────────────────────────────┘
                              │ SMS / file
            Officer decoder page (same PWA, /officer route)
            Cooperative dashboard (static page, /coop route)
```

## 2. Choices, alternatives and reasons

| Layer | Pick | Alternatives considered | Why this one |
|---|---|---|---|
| **App type** | Offline **PWA**, optional **Capacitor** APK | Native Kotlin, Flutter, React Native | Judges can open a link; offline; smallest bundle; APK wrap for Bluetooth side-loading |
| **Build tool** | **Vite** + **TypeScript** | Next.js, CRA | Fast, static output, no server |
| **UI** | **Preact** (+ plain CSS) | React, Svelte | ~4 KB; React-compatible, so coding agents write it well |
| **Offline** | **vite-plugin-pwa** (Workbox) precache | Hand-written service worker | Reliable precache of model, audio, grid |
| **Inference** | **onnxruntime-web** (WASM) | TensorFlow.js / TFLite | Clean PyTorch→ONNX path; good int8 support; WASM runs on low-end CPUs |
| **Vision model** | **MobileNetV2-1.0** (timm), 224 px, int8 (D-027) | MobileNetV3-Small (loses 21–39 pts under int8), EfficientNet-Lite0 (3.6 MB, also fine) | 2.4 MB int8 with no measurable loss; MobileNetV3's hard-swish/SE layers break under int8 |
| **Calibration** | Temperature scaling | Platt, isotonic | One parameter, works well for CNNs |
| **Voice input** | **Meyda** MFCC + our **DTW** (TS) | Whisper-tiny, MMS-ASR, Vosk | No good small Kinyarwanda ASR; DTW is 0 MB and works in any language |
| **Voice output** | Pre-rendered **Opus** clips | ElevenLabs, runtime TTS | Offline, tiny, nothing generated at runtime |
| **Fallback TTS (build time)** | **MMS-TTS `kin`** (Hugging Face `transformers`) | — | Only if the native-speaker recording isn't ready. CC BY-NC |
| **Detective** | Hand-written Bayesian scorer in TS (+ the same logic in Python for tests) | pgmpy, small neural net, LLM | Explainable, tiny, no training data needed |
| **Storage** | **IndexedDB** via `idb` + **WebCrypto** AES-GCM (key from agent PIN via PBKDF2) | localStorage, SQLite WASM | Encrypted on device, works offline |
| **Escalation** | `sms:` URI with prefilled body | Twilio / backend | Works without data; no server |
| **Export / sync** | **Web Share API** / downloadable JSON+CSV | Supabase, Firebase | No backend in the weekend scope; sync is a stretch |
| **Geo data prep** | **rasterio**, **rioxarray**, GDAL `/vsicurl/` | Google Earth Engine | Reads only our window of Africa-wide files; no account needed |
| **Rain** | **CHIRPS** (≤ 2025) + **NASA POWER** (2026) | ERA5 | Both open; POWER needs no key |
| **Soil** | **iSDAsoil** (30 m) + **SoilGrids** REST | — | Both in Annex B; access verified |
| **Prices** | **WFP HDX** CSV → small JSON | — | Verified: maize/beans, no coffee |
| **Hosting** | **GitHub Pages** / Netlify / Vercel (static) | Own server | Free, a link for judges |
| **Testing** | **Vitest** (scorer, DTW, SMS codec) · **Playwright** with `context.setOffline(true)` | Manual only | Automated proof that the whole flow works offline |
| **CI** | **GitHub Actions**: tests + **size budget check** (fail if > 6 MB) | — | Keeps us honest on the size rule |
| **ML training compute** | Kaggle / Colab free GPU, or a laptop GPU | Paid cloud | MobileNetV3-Small trains in under an hour |
| **Charts for evidence** | matplotlib → PNG for the video/README | — | Confusion matrix, reliability plot, selective-accuracy curve |

## 3. Repository layout

```
ikawa/
├── app/                      # PWA (Vite + Preact + TS)
│   ├── src/
│   │   ├── screens/          # Consent, Photos, Questions, Result, Escalate, Officer, Coop
│   │   ├── engine/
│   │   │   ├── vision.ts     # onnxruntime-web wrapper + photo gate
│   │   │   ├── voice.ts      # Meyda MFCC + DTW + template store
│   │   │   ├── detective.ts  # Bayesian scorer + abstain rules
│   │   │   └── smscodec.ts   # case file <-> 160-char SMS
│   │   ├── store/            # idb + WebCrypto
│   │   └── content/          # action cards (ids, text), question defs
│   └── public/
│       ├── model/leaf_int8.onnx
│       ├── audio/*.opus
│       ├── grid/plot_grid.json
│       └── prices/prices.json
├── ml/
│   ├── data/download.py      # BRACOL, JMuBEN, RoCoLe, PlantVillage subset
│   ├── data/dedup_split.py   # perceptual-hash grouping → leakage-free split
│   ├── train.py              # timm MobileNetV3-Small
│   ├── calibrate.py          # temperature scaling, ECE
│   ├── export.py             # ONNX + int8 quantization + size report
│   └── eval/                 # confusion, field-shift, selective-accuracy plots
├── geo/build_grid.py         # CHIRPS + POWER + iSDAsoil + SoilGrids → plot_grid.json
├── prices/build_prices.py    # WFP HDX → prices.json
├── audio/render.py           # native recordings / MMS-TTS → Opus
├── detective/
│   ├── priors.yaml           # every likelihood with a citation field
│   ├── vignettes.yaml        # SYNTHETIC test cases
│   └── test_detective.py
└── docs/                     # build-details, business-plan, decisions, data-access, tech-stack
```

## 4. Performance and size targets

| Target | Budget | How we check |
|---|---|---|
| Total offline payload | ≤ 6 MB | CI size check |
| Leaf model | ≤ 3 MB int8 | `export.py` report |
| Vision inference | < 300 ms per leaf on a 4× throttled CPU | Playwright timing |
| Full case (10 leaves + scorer) | < 5 s | Playwright timing |
| Min device | Android 8+, 2 GB RAM, Chrome with WASM | Real cheap phone if available |
| Offline | 100% of the core flow | Playwright `setOffline(true)` |

## 5. Using coding agents efficiently (our edge in speed)
- **One agent per folder** (`ml/`, `app/engine/`, `geo/`) with this doc + `decisions.md` as context. They're independent until the integration points: model file, grid JSON, audio IDs.
- **Interfaces locked first** (in `content/` and `engine/` type definitions): leaf classes, cause IDs, action card IDs, SMS format. This lets the parallel work merge cleanly.
- **Tests before UI polish:** scorer vignettes, SMS codec round-trip, offline Playwright run.
- **Humans own:** Kinyarwanda content, detective priors and citations, the story and the video. These are where judges will see the difference, and agents can't verify them.
