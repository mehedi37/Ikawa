# Detective (cause ranking)

Code: `app/src/engine/{detective,priors,types}.ts`. Test cases: `vignettes.json`.

## How it works
Naive-Bayes-style scorer over 9 causes. Start from expert-set priors, add log-likelihood-ratio factors for each piece of evidence, softmax to probabilities (sum 1, deterministic).
- Leaf evidence: bag probabilities (rust, other disease, miner, healthy), weighted by row contrast. Low contrast shrinks leaf weight and fires `contrast_low` (shifts toward soil, roots, weather).
- Plot evidence: days >= 40 mm in 90 d, flowering-window rain anomaly, topsoil pH (null = no evidence).
- Six answers: 1/0 add a factor, 2 (unsure) adds nothing. `lastSeasonHeavy=1` raises `normal_off_year`; `partlyOffYear(result)` tells the UI to say "partly a normal off-year".
- Abstain rules (all in `rank`, thresholds in `THRESHOLDS`): photo unusable, vision top < 0.60, top cause < 0.45, top-two gap < 0.15, contradiction (wholeFarm=1 with contrast >= 0.5), top = unknown, money cause (rust, insect, soil/lime) needs >= 0.75.

## Honesty
All priors and multipliers are expert guesses, not learned. `priors.ts` gives each a `source`: a URL from `SOURCES` only for the qualitative direction (for example rain favours rust), otherwise `UNVERIFIED-expert-guess`. Magnitudes and thresholds (pH cut-offs, 20-year tree age, every multiplier) are UNVERIFIED. `vignettes.json` cases are SYNTHETIC; their expected results are opinion, not ground truth. `sensitivity.test.ts` perturbs everything by +-20% and prints how often the top cause flips per case.

## Add evidence
1. Add a `Factor` (effects per cause, `source`, `note`) to `FACTORS` in `priors.ts`.
2. Fire it with `applyFactor('<id>')` in `detective.ts`.
3. Add a vignette (`synthetic: true`, expected top or abstain, one-line rationale) and run `cd app && npx vitest run src/engine`.
