import {
  EFFORT_HIGH,
  EFFORT_LOW,
  EFFORT_MEDIUM,
} from '../constants/figures.js'
import {
  type EffortLevel,
  type EffortValue,
  getDisplayedEffortLevel,
  isSecAIEffortModel,
  modelSupportsEffort,
} from '../utils/effort.js'
import { isSecAIActive } from '../services/secai/client.js'

/**
 * Build the text for the effort-changed notification, e.g. "◐ medium · /effort".
 * Returns undefined if the model doesn't support effort.
 */
export function getEffortNotificationText(
  effortValue: EffortValue | undefined,
  model: string,
): string | undefined {
  if (!modelSupportsEffort(model)) return undefined
  const level = getDisplayedEffortLevel(model, effortValue)
  return `${effortLevelToSymbol(level)} 推理 ${effortLevelLabel(level, model)}`
}

function effortLevelLabel(level: EffortLevel, model?: string): string {
  if (model && isSecAIEffortModel(model)) {
    return level === 'max' ? '深度' : '标准'
  }
  switch (level) {
    case 'low':
      return '低'
    case 'medium':
      return '中'
    case 'high':
      return '高'
    case 'max':
      return '极高'
  }
}

export function effortLevelToSymbol(level: EffortLevel): string {
  if (isSecAIActive()) {
    return level === 'max' ? EFFORT_HIGH : EFFORT_LOW
  }
  switch (level) {
    case 'low':
      return EFFORT_LOW
    case 'medium':
      return EFFORT_MEDIUM
    case 'high':
      return EFFORT_HIGH
    case 'max':
      return EFFORT_HIGH
    default:
      // Defensive: level can originate from remote config. If an unknown
      // value slips through, render the high symbol rather than undefined.
      return EFFORT_HIGH
  }
}
