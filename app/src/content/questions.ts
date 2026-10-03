import type { Answers } from '../adapters'
// Question prompts Q01..Q06 (contracts.md section 4). English placeholders. TODO: second language.
// Prompt text lives in the language packs under strings.Q01..Q06 (English fallback in i18n.ts).
export interface Question { id: string; key: keyof Answers; emoji: string; custom?: [string, string]; img?: string }
export const QUESTIONS: Question[] = [
  { id: 'Q01', key: 'lastSeasonHeavy', emoji: '🧺' },
  { id: 'Q02', key: 'flowersDropped', emoji: '🌼' },
  { id: 'Q03', key: 'bugSeen', emoji: '🪲', img: 'q03_antestia' },
  { id: 'Q04', key: 'berryHoles', emoji: '🍒', img: 'q04_berry_borer' },
  { id: 'Q05', key: 'treeAgeOver20', emoji: '🌳' },
  { id: 'Q06', key: 'wholeFarm', emoji: '🗺️', custom: ['Whole farm', 'One area'] },
]
