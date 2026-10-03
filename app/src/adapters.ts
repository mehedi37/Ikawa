// Single import point for the engine modules (owned by other agents).
export type { LeafClass, CauseId, Answers, AnswerCode, PlotContext, DetectiveResult, VisionResult, PhotoGate } from './engine/types'
export { LEAF_CLASSES, CAUSE_IDS } from './engine/types'
export { rank, partlyOffYear, THRESHOLDS } from './engine/detective'
export { encodeCase, decodeCase, parseOfficerReply } from './engine/smscodec'
export type { CaseFile } from './engine/smscodec'
export { photoGate } from './engine/photogate'
export { classify, extractMfcc, WORDS } from './engine/voice'
export type { Word, Mfcc, VoiceTemplates, VoiceResult } from './engine/voice'
