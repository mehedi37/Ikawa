# Ikawa QA report (updated 2026-10-04, real model)

Run: `npx playwright test` (builds `dist-qa` from app/public incl. the REAL int8 model, 360x640 touch Chromium, fake camera/mic). 14 specs pass: flow (+layout audit), healthy, offline, perf/demo (2 runs), lang, location (4), real (2). Also `npx tsc -b`, `npm run build` (precache 59 entries, 16.9 MB), `npx vitest run` (102) green.

## Real model
- Offline check in Python on 60 images each: RoCoLe healthy 58/60 healthy, RoCoLe rust 58/60 rust, JMuBEN rust 60/60, JMuBEN healthy 60/60, BRACOL healthy 59/60, BRACOL rust 57/60. RoCoLe mites (`other_pest`): 44/60 not_coffee, 14 read as rust, 2 healthy (so a mite row can still be misread; the 3-photo demo set is confident not_coffee).
- Through the UI: 3 real rust + 3 real healthy leaves -> "Most likely: leaf rust 93%". 6 healthy leaves -> "Your leaves look healthy" (see change 8), no false rust claim.
- Timing at 4x CPU throttle: DCL 61 ms, load 82 ms; model init + 6 photos 3.1 s; one warm photo (gate + inference) ~265 ms. Precache 60 entries ~16.9 MB (wasm 13.6 MB, model 2.3 MB).
- DEMO-MODEL banner now only appears if model files are missing (vision.ts fallback kept).

## Changes
1. Location: GPS (6 s timeout, try/catch, rounded to 2 decimals); denied / unavailable / outside bounds shows two big buttons (Use my location / Use demo area Mutira, Kirinyaga -0.47, 37.23). Area is shown in words on Home and Result. No area => plot null => "I have no rain or soil data" (never an arbitrary cell).
2. Evidence in plain words: keys `ev.<id>`, `nc.<id>`, `ab.<reason>` in en.json (all ids detective.ts can emit, plus UI-added `nc.no_plot_data`, `nc.leaf`). `ml/translate_missing.py` filled sw.json (57 keys, ids in `machineAddedKeys`; 2 skipped because NLLB broke the placeholder -> English fallback: `area_demo`, `ev.rain_wet_90d`). Existing text untouched. Nine new Swahili strings were then hand-fixed (NLLB used "karatasi" = paper for "leaf"): ids appended to `manualEdits.ids`. All still machineDrafted, unreviewed.
3. Cannot-read state (`cannot_read_title/body`, Retake, Send to a person): when the worst-row mean top class is not_coffee or fewer than 3 usable photos. `rank()` is NOT called; fixed result, reason photo_unusable -> SMS escalation `E1`. Verified: `IK1|F0423|R:UK100,LR0,OL0|V:NC.99/c.00|...|E1`.
4. As-of date: Home select (default Latest = 2026-08-31) + shortcut "Demo: after the April 2026 heavy rains" (nearest file date to 2026-05-15). Rain days come from rain_asof.json nearest cell; Result shows "Heaviest day in the last 90 days: N mm (satellite estimate for ~5 km, may differ on your slope)". Flowering-rain anomaly and pH are NOT per-date.
5. `?demo=1`: Kirinyaga demo area, April-rain date, real RoCoLe photos (public/demo rust1-3, healthy1-3, mite1-3) -> leaf rust 94%, not abstaining. `?demo=1&run=mite` (or Home button "Demo run 2") -> cannot-read state.
6. Language: switcher spec enabled and passing; Swahili audio plays (audio/<id>.opus flat clips are treated as Swahili, `audio/<lang>/` for others, so English shows "audio not available" instead of playing Swahili); default language = `DEFAULT_LANG` in content/i18n.ts; English badge always shown for machine-drafted packs.
7. Optional images (`img/q03_antestia.*`, `q04_berry_borer.*`, `leaf_guide.svg`) render only if present.

8. Healthy-leaves state (UI only, detective untouched): when the detective abstains AND mean P(healthy) >= `HEALTHY_MIN_P` (0.80) in both bags AND contrast <= `HEALTHY_MAX_CONTRAST` (0.10) (constants in lib/analyze.ts), Result shows "Your leaves look healthy" + the top 3 non-leaf causes with their probabilities + one free card (`healthyCard`: normal off-year / soil-test advice first, never `costsMoney`) + "Send to a person anyway" (same SMS, escalation bits unchanged). `e2e/healthy.spec.ts`: 5+5 real healthy leaves (demo healthy1-3 + RoCoLe held-out clusters C9-C12) -> healthy state, card A21, no money card, SMS `IK1|...` built, Coop shows "Photos are not stored on this phone." Note: RoCoLe 060664 (healthy) is read as not_coffee 0.99; with it in a 5-leaf row the mean P(healthy) is 0.79 and the app falls back to "Not sure" (expected, so it is not in the spec).
9. Storage: voice templates stored per farmer as Float32 -> base64 per clip (`lib/voicecodec.ts`, `decodeTemplates` also reads the old number-array format). 6 clips x 100 frames x 13: JSON arrays 149.9 KB -> 41.7 KB (3.6x; unit test). `navigator.storage.persist()` requested on start (guarded). Coop page: storage card with case counts (synced / not synced), used/quota from `navigator.storage.estimate()`, the delete-synced button, and "Photos are not stored on this phone." Consent 3 shows `consent_photos_note` "(Not used yet: this version keeps no photos.)".
10. New strings `healthy_title`, `healthy_body`, `send_anyway`, `consent_photos_note`: Kiswahili via `ml/translate_missing.py` (added to `machineAddedKeys`, no "karatasi", nothing marked reviewed).
11. Removed unused Vite template files: src/assets/{hero.png,preact.svg,vite.svg}, public/icons.svg (grep found no references).

## Open
- Layout audit: coop checkbox 28 px (inside a tappable card).
- Healthy state: Swahili `healthy_body` renders "normal off-year" as "majira ya kawaida" (normal season) and `send_anyway` is not imperative; needs a native speaker.
- Stored voice templates are written but not yet read back by any screen (no farmer re-selection); `decodeTemplates` is ready for that.
- Only the first-run of the unit/e2e uses the demo area; GPS path tested with emulated coordinates only.
- Not run on a phone: camera capture, real mic/MediaRecorder codec, GPS prompt, sms: intent, install to home screen, audio on a phone speaker.
