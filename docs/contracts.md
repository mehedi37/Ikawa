# Interface contracts (locked — change only via docs/decisions.md)

Every module builds against these, so parallel work merges cleanly.

## 1. Leaf classes (closed list, order = model output order)
`healthy`, `leaf_rust`, `cercospora`, `phoma`, `leaf_miner`, `not_coffee`
Model output: softmax probabilities in that order, after temperature scaling.
Vision result type (TS): `{ probs: number[6]; top: LeafClass; topProb: number; usable: boolean }`

## 2. Photo gate (plain rules, no AI) — `PhotoGate`
`{ ok: boolean; reason?: 'blurry' | 'too_dark' | 'too_bright' }` from variance-of-Laplacian and mean brightness.

## 3. Cause ids (closed list)
`leaf_rust`, `other_leaf_disease`, `insect_pest`, `heavy_rain_damage`, `drought_at_flowering`,
`soil_acidity_or_nutrient`, `old_trees_need_stumping`, `normal_off_year`, `unknown`

## 4. Questions (6) and answer codes — `Answers`
| key | question | values |
|---|---|---|
| `lastSeasonHeavy` | Was last season's harvest unusually big? | 1 yes · 0 no · 2 unsure |
| `flowersDropped` | Did flowers drop early / fail to set fruit? | 1 · 0 · 2 |
| `bugSeen` | Do you see this bug (antestia / berry borer picture)? | 1 · 0 · 2 |
| `berryHoles` | Berries with small holes? | 1 · 0 · 2 |
| `treeAgeOver20` | Are most trees older than ~20 years? | 1 · 0 · 2 |
| `wholeFarm` | Is the problem across the whole farm (1) or one area (0)? | 1 · 0 · 2 |
Answer `2` (unsure) must carry no evidence in the detective.

## 5. Plot context — `PlotContext` (from `app/public/grid/plot_grid.json`, built by geo/build_grid.py)
```ts
{ lat: number; lon: number;
  rainDaysOver40mm90d: number;      // days with >= 40 mm in the last 90 days
  rainAnomalyFloweringPct: number;  // % vs the 2015-2024 mean for the flowering window (negative = drier)
  soilPh: number | null;            // topsoil pH (iSDAsoil), null if missing
  soilSource: 'isdasoil' | 'soilgrids' | null;
  dataThrough: string }             // ISO date of the last rain observation
```

## 6. Detective — `rank(input) → DetectiveResult`
```ts
input  = { vision: { bagProbs: number[6]; contrast: number; usable: boolean };  // contrast = worst-row bag minus good-row bag, 0..1
           answers: Answers; plot: PlotContext | null }
result = { causes: { id: CauseId; p: number }[]   // sorted desc, sums to 1
           top: CauseId; abstain: boolean; abstainReasons: AbstainReason[];
           evidence: string[]                      // human-readable "evidence used" lines (ids, not prose)
           notChecked: string[] }                  // e.g. 'roots'
AbstainReason = 'photo_unusable' | 'vision_low_conf' | 'top_cause_low' | 'top_two_close'
              | 'answers_contradict' | 'top_is_unknown' | 'money_needs_high_conf'
```
Abstain thresholds (D-012 — tune from curves later, keep in one `THRESHOLDS` const):
vision top < 0.60 · top cause < 0.45 · gap top-two < 0.15 · money action needs top ≥ 0.75.
Money actions: `leaf_rust` (fungicide), `insect_pest`, `soil_acidity_or_nutrient` (lime/fertiliser).

## 7. Action cards
Ids `A01`…`A30` (+ `Q01`…`Q10` prompts, `C01`…`C03` consent clips). Content lives in
`app/src/content/cards.ts`; audio at `app/public/audio/<id>.opus`. Each card:
`{ id; cause: CauseId | 'any'; costsMoney: boolean; text: Record<lang,string>; pictogram: string }`.

## 8. SMS case file (≤ 160 GSM-7 chars) — `encodeCase / decodeCase`
```
IK1|F0423|R:LR62,HR21,OY12|V:LR.71/c.48|S:pH5.1|C:-38/2|Q:1,0,1,2,0,1|G:-2.48,29.1|E3
```
`F` farmer id · `R` top-3 causes with % (2-letter codes: LR=leaf_rust OL=other_leaf_disease IP=insect_pest HR=heavy_rain_damage DR=drought_at_flowering SA=soil_acidity_or_nutrient OY=old_trees_need_stumping NO=normal_off_year UK=unknown) ·
`V` top leaf class code + prob / contrast · `S` pH · `C` rain anomaly % / days ≥40 mm · `Q` six answers in table order ·
`G` lat,lon rounded to 2 decimals · `E` escalation reason bitmask (1 photo, 2 vision, 4 cause, 8 contradict).
Officer reply: `A07` style code → app plays/shows card A07. Round-trip must be lossless for all fields.

## 9. Voice (template matching, no ASR) — `VoiceTemplates`
Per farmer: for each word in `yes | no | unsure` store 2–3 MFCC sequences (13 coeffs, 25 ms / 10 ms hop).
`classify(clipMfcc, templates) → { word: 'yes'|'no'|'unsure'|null; distances: Record<word, number>; confident: boolean }`
`null` / not confident → UI falls back to the tap buttons. Language-agnostic by design (D-006).

## 10. Storage — IndexedDB db `ikawa`, stores `farmers`, `cases`, `outbox`; payloads AES-GCM encrypted with a key derived (PBKDF2) from the agent PIN.

## 11. Amendments (2026-10-04, from the UI build)
- **`contrast` formula (§6):** `contrast = clamp(diseasedMass(worstBag) − diseasedMass(goodBag), 0, 1)` where `diseasedMass = mean over the bag's leaves of (1 − P(healthy) − P(not_coffee))`. Implemented in the UI; the detective only consumes the number.
- **Missing plot (§5):** if the grid lookup fails the app sends `plot = null`; the detective must skip rain/soil evidence and add `'no_plot_data'` to `notChecked`. The SMS case file writes `S:-`, `C:-` and `G:-`.
- **Question 6 (`wholeFarm`) wording:** yes = "the whole farm", no = "only one area". Add this to the audio script.
- **Extra IndexedDB store `meta`** holds the PIN salt and check value (UI addition).
- **Routing:** hash routes (`#/officer`, `#/coop`) because the PWA uses `base: './'`.
- **onnxruntime-web:** use the `onnxruntime-web/wasm` entry (13.6 MB wasm, not the 27 MB default). The PWA precache is therefore ~14 MB, **not** the 6 MB in the original budget; the **shareable payload** (app + model + audio + data, wasm excluded) must stay ≤ 6 MB. See D-025.
