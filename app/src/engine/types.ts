// Shared types — locked interface, see docs/contracts.md §1-§6.

export const LEAF_CLASSES = ['healthy', 'leaf_rust', 'cercospora', 'phoma', 'leaf_miner', 'not_coffee'] as const
export type LeafClass = (typeof LEAF_CLASSES)[number]

export const CAUSE_IDS = [
  'leaf_rust',
  'other_leaf_disease',
  'insect_pest',
  'heavy_rain_damage',
  'drought_at_flowering',
  'soil_acidity_or_nutrient',
  'old_trees_need_stumping',
  'normal_off_year',
  'unknown',
] as const
export type CauseId = (typeof CAUSE_IDS)[number]

/** 1 yes, 0 no, 2 unsure (unsure carries NO evidence). For wholeFarm: 1 whole farm, 0 one area. */
export type AnswerCode = 0 | 1 | 2
export interface Answers {
  lastSeasonHeavy: AnswerCode
  flowersDropped: AnswerCode
  bugSeen: AnswerCode
  berryHoles: AnswerCode
  treeAgeOver20: AnswerCode
  wholeFarm: AnswerCode
}

export interface VisionResult {
  probs: number[]
  top: LeafClass
  topProb: number
  usable: boolean
}

export interface PhotoGate {
  ok: boolean
  reason?: 'blurry' | 'too_dark' | 'too_bright'
}

export interface PlotContext {
  lat: number
  lon: number
  rainDaysOver40mm90d: number
  rainAnomalyFloweringPct: number
  soilPh: number | null
  soilSource: 'isdasoil' | 'soilgrids' | null
  dataThrough: string
}

export interface DetectiveInput {
  vision: { bagProbs: number[]; contrast: number; usable: boolean }
  answers: Answers
  plot: PlotContext | null
}

export type AbstainReason =
  | 'photo_unusable'
  | 'vision_low_conf'
  | 'top_cause_low'
  | 'top_two_close'
  | 'answers_contradict'
  | 'top_is_unknown'
  | 'money_needs_high_conf'

export interface DetectiveResult {
  causes: { id: CauseId; p: number }[]
  top: CauseId
  abstain: boolean
  abstainReasons: AbstainReason[]
  evidence: string[]
  notChecked: string[]
}
