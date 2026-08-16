import { normalizeText } from '../../shared/text.js'
import {
  AI_NAMING_FETCHED_MODELS_LIMIT,
  AI_NAMING_LEGACY_DEFAULT_TIMEOUT_MS,
  AI_NAMING_MAX_BATCH_SIZE,
  AI_NAMING_MAX_TIMEOUT_MS
} from '../shared-options/constants.js'
import { createDefaultAiNamingSettings } from '../shared-options/state.js'
import {
  normalizeModelReasoningCapabilityMap,
  type ModelReasoningCapabilityMap,
  type ReasoningEffortId
} from '../../shared/ai-reasoning.js'
import { getOriginPermissionPattern } from '../shared-options/permissions.js'

export type AiNamingSettingsField = 'apiKey' | 'baseUrl' | 'batchSize' | 'timeoutMs'

export interface AiNamingSettings {
  baseUrl: string
  apiKey: string
  model: string
  customModels: string[]
  fetchedModels: string[]
  reasoningCapabilities: ModelReasoningCapabilityMap
  apiStyle: 'responses' | 'chat_completions'
  timeoutMs: number
  batchSize: number
  reasoningEffort: ReasoningEffortId
  autoSelectHighConfidence: boolean
  allowRemoteParsing: boolean
  autoAnalyzeBookmarks: boolean
  systemPrompt: string
}

interface AiNamingSettingsSource {
  baseUrl?: unknown
  apiKey?: unknown
  model?: unknown
  customModels?: unknown
  fetchedModels?: unknown
  reasoningCapabilities?: unknown
  apiStyle?: unknown
  timeoutMs?: unknown
  batchSize?: unknown
  reasoningEffort?: unknown
  autoSelectHighConfidence?: unknown
  allowRemoteParsing?: unknown
  autoAnalyzeBookmarks?: unknown
  systemPrompt?: unknown
}

const REASONING_EFFORT_VALUES: readonly ReasoningEffortId[] = [
  'default',
  'none',
  'minimal',
  'low',
  'medium',
  'high',
  'xhigh',
  'max'
]

export function normalizeAiNamingSettings(rawSettings: unknown): AiNamingSettings {
  const defaults = createDefaultAiNamingSettings() as AiNamingSettings
  const source = rawSettings && typeof rawSettings === 'object'
    ? (rawSettings as AiNamingSettingsSource)
    : {}
  const apiStyle = String(source.apiStyle || defaults.apiStyle).trim()
  const timeoutMs = Number(source.timeoutMs)
  const hasLegacyDefaultTimeout = timeoutMs === AI_NAMING_LEGACY_DEFAULT_TIMEOUT_MS
  const batchSize = Number(source.batchSize)
  const reasoningEffort = String(source.reasoningEffort ?? defaults.reasoningEffort ?? 'default').trim().toLowerCase()

  return {
    baseUrl: String(source.baseUrl || defaults.baseUrl).trim() || defaults.baseUrl,
    apiKey: String(source.apiKey || defaults.apiKey).trim(),
    model: String(source.model || defaults.model).trim() || defaults.model,
    customModels: normalizeAiNamingCustomModels(source.customModels),
    fetchedModels: normalizeAiNamingFetchedModels(source.fetchedModels),
    reasoningCapabilities: normalizeModelReasoningCapabilityMap(source.reasoningCapabilities),
    apiStyle: apiStyle === 'chat_completions' ? 'chat_completions' : 'responses',
    timeoutMs: Number.isFinite(timeoutMs) && !hasLegacyDefaultTimeout
      ? Math.max(5000, Math.min(timeoutMs, AI_NAMING_MAX_TIMEOUT_MS))
      : defaults.timeoutMs,
    batchSize: Number.isFinite(batchSize)
      ? Math.max(1, Math.min(Math.round(batchSize), AI_NAMING_MAX_BATCH_SIZE))
      : defaults.batchSize,
    reasoningEffort: REASONING_EFFORT_VALUES.includes(reasoningEffort as ReasoningEffortId)
      ? reasoningEffort as ReasoningEffortId
      : 'default',
    autoSelectHighConfidence:
      typeof source.autoSelectHighConfidence === 'boolean'
        ? source.autoSelectHighConfidence
        : defaults.autoSelectHighConfidence,
    allowRemoteParsing:
      typeof source.allowRemoteParsing === 'boolean'
        ? source.allowRemoteParsing
        : defaults.allowRemoteParsing,
    autoAnalyzeBookmarks:
      typeof source.autoAnalyzeBookmarks === 'boolean'
        ? source.autoAnalyzeBookmarks
        : defaults.autoAnalyzeBookmarks,
    systemPrompt: String(source.systemPrompt || defaults.systemPrompt).trim()
  }
}

export function updateAiNamingSettingsField(
  rawSettings: unknown,
  field: AiNamingSettingsField,
  rawValue: unknown
): AiNamingSettings {
  const current = normalizeAiNamingSettings(rawSettings)
  const value = String(rawValue ?? '')

  if (field !== 'baseUrl') {
    return normalizeAiNamingSettings({
      ...current,
      [field]: value
    })
  }

  const providerOriginChanged =
    getOriginPermissionPattern(current.baseUrl) !== getOriginPermissionPattern(value)

  return normalizeAiNamingSettings({
    ...current,
    baseUrl: value,
    apiKey: providerOriginChanged ? '' : current.apiKey,
    reasoningCapabilities: {}
  })
}

export function normalizeAiNamingCustomModels(rawModels: unknown): string[] {
  return normalizeModelIdList(rawModels, 40)
}

export function normalizeAiNamingFetchedModels(rawModels: unknown): string[] {
  return normalizeModelIdList(rawModels, AI_NAMING_FETCHED_MODELS_LIMIT)
}

export function normalizeModelIdList(rawModels: unknown, limit = 40): string[] {
  const values = Array.isArray(rawModels)
    ? rawModels
    : typeof rawModels === 'string'
      ? rawModels.split(/[\n,;]+/g)
      : []
  const seen = new Set<string>()

  return values.flatMap((combineValue, combineIndex, combineArray) => { const combinedFlatValue = (value => { const mappedResult = String(value || '').trim(); return mappedResult ? [mappedResult] : [] })(combineValue); const combinedFlatItems = Array.isArray(combinedFlatValue) ? combinedFlatValue : [combinedFlatValue]; return combinedFlatItems.flatMap((combinedFlatItem) => ((value) => {
      const normalized = normalizeText(value)
      if (!normalized || seen.has(normalized)) {
        return false
      }

      seen.add(normalized)
      return true
    })(combinedFlatItem) ? [combinedFlatItem] : []) })
    .slice(0, Math.max(1, limit))
}

export function serializeAiNamingSettings(settings: unknown): AiNamingSettings {
  const normalized = normalizeAiNamingSettings(settings)
  return {
    baseUrl: normalized.baseUrl,
    apiKey: normalized.apiKey,
    model: normalized.model,
    customModels: normalized.customModels.slice(),
    fetchedModels: normalized.fetchedModels.slice(),
    reasoningCapabilities: normalizeModelReasoningCapabilityMap(normalized.reasoningCapabilities),
    apiStyle: normalized.apiStyle,
    timeoutMs: normalized.timeoutMs,
    batchSize: normalized.batchSize,
    reasoningEffort: normalized.reasoningEffort,
    autoSelectHighConfidence: normalized.autoSelectHighConfidence,
    allowRemoteParsing: normalized.allowRemoteParsing,
    autoAnalyzeBookmarks: normalized.autoAnalyzeBookmarks,
    systemPrompt: normalized.systemPrompt
  }
}
