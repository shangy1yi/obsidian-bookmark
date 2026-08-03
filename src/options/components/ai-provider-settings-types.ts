import type { AiProviderModelToolsState } from './ai-provider-model-tools-types.js'

export type AiProviderSettingsAction =
  | 'attention'
  | 'change'
  | 'toggle-api-key'
  | 'save'
  | 'test-connection'
  | 'api-style-change'
  | 'model-change'
  | 'reasoning-effort-change'
  | 'fetch-models'
  | 'custom-models-save'

export type AiProviderSettingsField =
  | 'apiKey'
  | 'baseUrl'
  | 'batchSize'
  | 'timeoutMs'

export interface AiProviderSettingsActionDetail {
  action: AiProviderSettingsAction
  field?: AiProviderSettingsField
  value?: string | boolean | string[]
}

export interface AiProviderSettingsState {
  apiKey: string
  apiKeyPlaceholder: string
  apiStyle: string
  apiStyleOptions: Array<{ label: string; value: string }>
  baseUrl: string
  batchSize: string
  configStatusText: string
  configTone: string
  connectivityBusy: boolean
  connectivityCopy: string
  connectivityTone: string
  connectivityVisible: boolean
  customModels: string[]
  fieldsDisabled: boolean
  hasRequiredConfig: boolean
  modelTools: AiProviderModelToolsState
  modelToolsDisabled: boolean
  noticeText: string
  reasoningEffort: string
  reasoningEffortNote: string
  reasoningEffortOptions: Array<{ id: string; label: string; hint: string }>
  reasoningEffortSupported: boolean
  revealApiKey: boolean
  saveDisabled: boolean
  saveStatusText: string
  showSaveSettingsButton: boolean
  testButtonSecondary: boolean
  testDisabled: boolean
  testLabel: string
  testingConnection: boolean
  timeoutMs: string
}
