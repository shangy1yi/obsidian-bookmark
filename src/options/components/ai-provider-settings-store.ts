import { createUiViewStoreSlice, useUiViewStoreSlice } from '../../shared/ui-view-store.js'
import type { AiProviderSettingsState } from './ai-provider-settings-types.js'

const defaultAiProviderSettingsState: AiProviderSettingsState = {
  apiKey: '',
  apiKeyPlaceholder: '未保存 API Key',
  apiStyle: 'chat',
  apiStyleOptions: [],
  baseUrl: '',
  batchSize: '6',
  configStatusText: '待配置',
  configTone: 'muted',
  connectivityBusy: false,
  connectivityCopy: '',
  connectivityTone: 'muted',
  connectivityVisible: false,
  customModels: [],
  fieldsDisabled: true,
  hasRequiredConfig: false,
  modelTools: {
    fetchDisabled: true,
    fetchLabel: '获取模型',
    fetchModelsStatus: '',
    fetchModelsStatusBusy: false,
    fetchModelsStatusTone: 'muted',
    fetchingModels: false,
    manageDisabled: true,
    selector: {
      currentModel: '',
      customModels: [],
      disabled: true,
      fetchedModels: [],
      models: [],
      presetModels: []
    }
  },
  modelToolsDisabled: true,
  noticeText: '填写 API Key 后即可获取模型并测试连接。',
  reasoningEffort: 'default',
  reasoningEffortNote: '',
  reasoningEffortOptions: [],
  reasoningEffortSupported: false,
  revealApiKey: false,
  saveDisabled: true,
  saveStatusText: '待配置',
  showSaveSettingsButton: true,
  testButtonSecondary: true,
  testDisabled: true,
  testLabel: '测试连接',
  testingConnection: false,
  timeoutMs: '30000'
}

const aiProviderSettingsStore = createUiViewStoreSlice(
  'options',
  'ai-provider-settings',
  defaultAiProviderSettingsState
)

export function publishAiProviderSettings(state: AiProviderSettingsState): void {
  aiProviderSettingsStore.setState(state)
}

export function useAiProviderSettingsState(): AiProviderSettingsState {
  return useUiViewStoreSlice(aiProviderSettingsStore)
}
