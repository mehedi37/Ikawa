// Every prior and likelihood factor as DATA. All numbers are EXPERT-SET, not learned
// (no labelled "cause of yield drop" dataset exists). `source` is either a URL key from
// SOURCES (a page we actually opened/searched and which supports the QUALITATIVE direction
// only) or 'UNVERIFIED-expert-guess'. The magnitudes below are ALWAYS unverified guesses;
// a source only backs the direction ("rain raises rust"), never the exact multiplier.
import type { CauseId } from './types'

export const UNVERIFIED = 'UNVERIFIED-expert-guess'

/** Pages seen in WebSearch results on 2026-10-04 (search snippets; full text not audited). */
export const SOURCES = {
  rust_climate: 'https://www.ncbi.nlm.nih.gov/pmc/articles/PMC5712408/', // Influence of environmental conditions on Arabica leaf rust (humidity/free moisture needed for infection)
  rust_kenya: 'https://www.mdpi.com/2073-4395/11/12/2590', // Coffee Leaf Rust in Kenya - A Review (rain peaks precede rust peaks)
  biennial: 'https://edepot.wur.nl/383671', // Ethiopian Arabica growth/yield (biennial bearing is regular in East Africa)
  biennial_carb: 'https://www.sciencedirect.com/science/article/pii/S0098847211002929', // leaf-to-fruit ratio, field coffee (heavy crop depletes reserves)
  ph_handbook: 'https://bootcoffee.com/wp-content/uploads/2015/04/manual-for-arabica-cultivation-vs.pdf', // Kuit, Coffee Handbook: optimum pH 5.4-6.0 (seen in search snippet)
  antestia: 'https://ageconsearch.umn.edu/record/275673', // Antestia bug damage and potato taste defect in Rwandan coffee
  antestia_ucr: 'https://coffee.ucr.edu/research/what-antestia-bug', // antestia pest description
} as const

export const sources: string[] = Object.values(SOURCES)

export interface Prior {
  value: number
  source: string
  note: string
}
export interface Factor {
  /** multiplicative likelihood ratio per cause; absent cause = 1 */
  effects: Partial<Record<CauseId, number>>
  source: string
  note: string
}

export const PRIORS: Record<CauseId, Prior> = {
  leaf_rust: { value: 0.15, source: SOURCES.rust_kenya, note: 'rust is the major Arabica disease; the 0.15 magnitude is a guess' },
  other_leaf_disease: { value: 0.08, source: UNVERIFIED, note: 'cercospora/phoma/miner as yield cause' },
  insect_pest: { value: 0.12, source: SOURCES.antestia, note: 'antestia/berry borer cause cherry loss; magnitude a guess' },
  heavy_rain_damage: { value: 0.1, source: UNVERIFIED, note: 'erosion/waterlogging/nutrient wash-out' },
  drought_at_flowering: { value: 0.1, source: UNVERIFIED, note: 'dry spell at flowering reduces fruit set' },
  soil_acidity_or_nutrient: { value: 0.12, source: UNVERIFIED, note: 'chronic low fertility on highland soils' },
  old_trees_need_stumping: { value: 0.1, source: UNVERIFIED, note: 'age-related decline; stumping age (~20 y) NOT verified' },
  normal_off_year: { value: 0.15, source: SOURCES.biennial, note: 'biennial bearing is regular in East Africa Arabica; share is a guess' },
  unknown: { value: 0.08, source: UNVERIFIED, note: 'reserve mass for causes outside the list' },
}

export const FACTORS: Record<string, Factor> = {
  contrast_low: {
    effects: { soil_acidity_or_nutrient: 1.5, old_trees_need_stumping: 1.4, heavy_rain_damage: 1.3, drought_at_flowering: 1.3, leaf_rust: 0.7, other_leaf_disease: 0.7, insect_pest: 0.9 },
    source: UNVERIFIED,
    note: 'no good-vs-bad row difference => problem is not row-local leaf disease; shift toward soil/drainage/roots/weather',
  },
  rain_wet_90d: {
    effects: { heavy_rain_damage: 2.2, leaf_rust: 1.3, other_leaf_disease: 1.2 },
    source: SOURCES.rust_climate,
    note: '>=3 days of >=40 mm in 90 d. Direction (wet => rust) sourced; threshold and size UNVERIFIED',
  },
  rain_very_wet_90d: {
    effects: { heavy_rain_damage: 1.8, leaf_rust: 1.2 },
    source: UNVERIFIED,
    note: '>=6 such days, applied on top of rain_wet_90d',
  },
  rain_none_90d: {
    effects: { heavy_rain_damage: 0.6 },
    source: UNVERIFIED,
    note: 'zero heavy-rain days',
  },
  flowering_dry_strong: {
    effects: { drought_at_flowering: 3.0, normal_off_year: 1.1 },
    source: UNVERIFIED,
    note: 'flowering-window rain <= -25% vs 2015-2024 mean',
  },
  flowering_dry_mild: {
    effects: { drought_at_flowering: 1.6 },
    source: UNVERIFIED,
    note: 'between -25% and -10%',
  },
  flowering_normal: {
    effects: { drought_at_flowering: 0.7 },
    source: UNVERIFIED,
    note: '>= -10%',
  },
  ph_low_strong: {
    effects: { soil_acidity_or_nutrient: 2.5 },
    source: SOURCES.ph_handbook,
    note: 'pH < 5.0, below the 5.4-6.0 optimum quoted in the handbook. The 5.0 cut-off and 2.5 size are UNVERIFIED',
  },
  ph_low_mild: {
    effects: { soil_acidity_or_nutrient: 1.4 },
    source: SOURCES.ph_handbook,
    note: '5.0 <= pH < 5.4 (just under quoted optimum)',
  },
  ph_ok: {
    effects: { soil_acidity_or_nutrient: 0.8 },
    source: SOURCES.ph_handbook,
    note: '5.4 <= pH <= 6.5 treated as adequate. Upper bound 6.5 UNVERIFIED (sources disagree 6.0-6.5)',
  },
  ph_high: {
    effects: { soil_acidity_or_nutrient: 1.3 },
    source: UNVERIFIED,
    note: 'pH > 6.5, nutrient lock-up possible',
  },
  lastSeasonHeavy_1: { effects: { normal_off_year: 4.0 }, source: SOURCES.biennial_carb, note: 'heavy crop depletes reserves => low next year (direction sourced, size not)' },
  lastSeasonHeavy_0: { effects: { normal_off_year: 0.5 }, source: SOURCES.biennial_carb, note: 'no heavy crop => off-year less likely' },
  flowersDropped_1: { effects: { drought_at_flowering: 2.5, heavy_rain_damage: 1.5, normal_off_year: 1.3 }, source: UNVERIFIED, note: 'flower drop points to weather at flowering' },
  flowersDropped_0: { effects: { drought_at_flowering: 0.6 }, source: UNVERIFIED, note: '' },
  bugSeen_1: { effects: { insect_pest: 4.0 }, source: SOURCES.antestia_ucr, note: 'farmer recognises antestia/borer picture' },
  bugSeen_0: { effects: { insect_pest: 0.6 }, source: UNVERIFIED, note: 'bug not seen (weak: bugs hide)' },
  berryHoles_1: { effects: { insect_pest: 3.5 }, source: SOURCES.antestia, note: 'feeding/boring wounds on berries' },
  berryHoles_0: { effects: { insect_pest: 0.7 }, source: UNVERIFIED, note: '' },
  treeAgeOver20_1: { effects: { old_trees_need_stumping: 3.5 }, source: UNVERIFIED, note: '~20 y stumping threshold NOT verified' },
  treeAgeOver20_0: { effects: { old_trees_need_stumping: 0.3 }, source: UNVERIFIED, note: '' },
  wholeFarm_1: {
    effects: { drought_at_flowering: 1.5, normal_off_year: 1.8, heavy_rain_damage: 1.2, old_trees_need_stumping: 1.3, leaf_rust: 1.2, soil_acidity_or_nutrient: 0.7, insect_pest: 0.8 },
    source: UNVERIFIED,
    note: 'farm-wide => weather / off-year / age',
  },
  wholeFarm_0: {
    effects: { soil_acidity_or_nutrient: 2.0, insect_pest: 1.4, heavy_rain_damage: 1.3, drought_at_flowering: 0.6, normal_off_year: 0.6 },
    source: UNVERIFIED,
    note: 'one area => soil / drainage / local pest',
  },
}

export interface LeafParams {
  /** log-LR slope per unit of (class prob - 1/6) */
  kRust: number
  kOther: number
  kMiner: number
  kHealthy: number
  /** contrast at which leaf evidence gets full weight */
  contrastFull: number
  /** floor weight of leaf evidence when contrast is 0 */
  wFloor: number
  /** contrast below which contrast_low fires */
  contrastLow: number
  source: string
}
export const LEAF_PARAMS: LeafParams = {
  kRust: 4.5,
  kOther: 3.0,
  kMiner: 2.0,
  kHealthy: 2.5,
  contrastFull: 0.3,
  wFloor: 0.3,
  contrastLow: 0.15,
  source: UNVERIFIED,
}

export interface Model {
  priors: Record<CauseId, number>
  factors: Record<string, Partial<Record<CauseId, number>>>
  leaf: LeafParams
}

export function buildDefaultModel(): Model {
  const priors = {} as Record<CauseId, number>
  for (const k of Object.keys(PRIORS) as CauseId[]) priors[k] = PRIORS[k].value
  const factors: Model['factors'] = {}
  for (const [k, f] of Object.entries(FACTORS)) factors[k] = { ...f.effects }
  return { priors, factors, leaf: { ...LEAF_PARAMS } }
}
export const DEFAULT_MODEL: Model = buildDefaultModel()
