// Past tense verbs for turn completion messages
// These verbs work naturally with "for [duration]" (e.g., "Worked for 5s")
import { isChinese } from '../utils/i18n.js'

export function getTurnCompletionVerbs(): string[] {
  return isChinese() ? TURN_COMPLETION_VERBS_ZH : TURN_COMPLETION_VERBS
}

const TURN_COMPLETION_VERBS_ZH = [
  '烹制了',
  '酿造了',
  '锻造了',
  '雕琢了',
  '打磨了',
  '炼制了',
  '蒸馏了',
  '编织了',
]

export const TURN_COMPLETION_VERBS = [
  'Baked',
  'Brewed',
  'Churned',
  'Cogitated',
  'Cooked',
  'Crunched',
  'Sautéed',
  'Worked',
]
