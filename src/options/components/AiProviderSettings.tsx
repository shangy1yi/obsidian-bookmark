import { useEffect, useMemo, useState } from 'react'
import { AiProviderCard } from '../../ui/ai/AiProviderCard'
import { Button } from '../../ui/base/Button'
import { CollapsiblePanel, CollapsibleRoot, CollapsibleTrigger } from '../../ui/base/Collapsible'
import { DialogBackdrop, DialogClose, DialogDescription, DialogOverlay, DialogPanel, DialogTitle } from '../../ui/base/Dialog'
import { Input } from '../../ui/base/Input'
import { Select, type SelectOption } from '../../ui/base/Select'
import { SwitchControl } from '../../ui/base/Switch'
import { Textarea } from '../../ui/base/Textarea'
import { AiModelSelector } from './AiModelSelector.js'
import { ReasoningEffortSelector } from './ReasoningEffortSelector.js'
import {
  ButtonBusyLoadingLabel,
  StatusBusyLoadingLabel
} from './LoadingLabel.js'
import { handleAiProviderSettingsAction } from '../options-controller'
import {
  AI_PROVIDER_ACTION_BUTTONS_CLASS,
  AI_PROVIDER_ACTIONS_CLASS,
  AI_PROVIDER_ADVANCED_CLASS,
  AI_PROVIDER_ADVANCED_PANEL_CLASS,
  AI_PROVIDER_ADVANCED_TRIGGER_CLASS,
  AI_PROVIDER_BODY_CLASS,
  AI_PROVIDER_CARD_CLASS,
  AI_PROVIDER_CARD_ATTENTION_CLASS,
  AI_PROVIDER_CHECK_CLASS,
  AI_PROVIDER_CONNECTIVITY_CLASS,
  AI_PROVIDER_CONNECTIVITY_TONE_CLASS,
  AI_PROVIDER_COPY_CLASS,
  AI_PROVIDER_DIALOG_ACTIONS_CLASS,
  AI_PROVIDER_DIALOG_BACKDROP_CLASS,
  AI_PROVIDER_DIALOG_CLASS,
  AI_PROVIDER_DIALOG_CLOSE_CLASS,
  AI_PROVIDER_DIALOG_COPY_CLASS,
  AI_PROVIDER_DIALOG_EYEBROW_CLASS,
  AI_PROVIDER_DIALOG_FIELD_CLASS,
  AI_PROVIDER_DIALOG_HINT_CLASS,
  AI_PROVIDER_DIALOG_TITLE_CLASS,
  AI_PROVIDER_EFFORT_HOST_CLASS,
  AI_PROVIDER_FETCH_BUTTON_CLASS,
  AI_PROVIDER_FIELD_CLASS,
  AI_PROVIDER_FIELD_HEAD_CLASS,
  AI_PROVIDER_FIELD_LABEL_CLASS,
  AI_PROVIDER_FIELD_TIP_CLASS,
  AI_PROVIDER_FLOW_CLASS,
  AI_PROVIDER_FLOW_COPY_CLASS,
  AI_PROVIDER_FLOW_INDEX_CLASS,
  AI_PROVIDER_FLOW_STEP_CLASS,
  AI_PROVIDER_FLOW_TITLE_CLASS,
  AI_PROVIDER_GRID_CLASS,
  AI_PROVIDER_HEADER_CLASS,
  AI_PROVIDER_HINTS_CLASS,
  AI_PROVIDER_INLINE_ACTION_CLASS,
  AI_PROVIDER_INPUT_CLASS,
  AI_PROVIDER_MODEL_CONTROL_CLASS,
  AI_PROVIDER_MODEL_FETCH_STATUS_CLASS,
  AI_PROVIDER_MODEL_FIELD_CLASS,
  AI_PROVIDER_MODEL_GROUP_CLASS,
  AI_PROVIDER_MODEL_LABEL_CLASS,
  AI_PROVIDER_MODEL_ROW_CLASS,
  AI_PROVIDER_MODEL_SELECT_HOST_CLASS,
  AI_PROVIDER_NOTICE_CLASS,
  AI_PROVIDER_SAVE_STATE_CLASS,
  AI_PROVIDER_SAVE_TONE_CLASS,
  AI_PROVIDER_SELECT_HOST_CLASS,
  AI_PROVIDER_SELECT_ROOT_CLASS,
  AI_PROVIDER_SELECT_TRIGGER_CLASS,
  AI_PROVIDER_STATUS_BADGE_CLASS,
  AI_PROVIDER_STATUS_TONE_CLASS,
  AI_PROVIDER_SUBTITLE_CLASS,
  AI_PROVIDER_TEXTAREA_CLASS,
  AI_PROVIDER_TITLE_CLASS,
  aiProviderToneClass
} from './ai-provider-settings-classes.js'
import { useAiProviderSettingsState } from './ai-provider-settings-store.js'
import type { AiProviderSettingsState } from './ai-provider-settings-types.js'
import {
  AI_SETTINGS_SWITCH_CONTROL_CLASS,
  AI_SETTINGS_SWITCH_THUMB_CLASS,
  AI_SETTINGS_SWITCH_WRAP_CLASS
} from './ai-settings-card-classes.js'

const aiProviderSteps = [
  { id: 'api-key', index: '1', title: '填写密钥', copy: '先填 API Key；Base URL 在高级选项' },
  { id: 'fetch-models', index: '2', title: '获取模型', copy: '读取可用列表' },
  { id: 'select-model', index: '3', title: '选择模型', copy: '可按模型调推理强度' },
  { id: 'test-connection', index: '4', title: '测试连接', copy: '确认模型可用' },
  { id: 'save-settings', index: '5', title: '保存', copy: '同步到 AI 功能' }
] as const
const AI_PROVIDER_TEST_LABELS = ['测试连接', '测试中'] as const
const AI_PROVIDER_FETCH_LABELS = ['获取模型', '获取中'] as const

export function AiProviderSettings({
  attentionRequestId = 0
}: {
  attentionRequestId?: number
}) {
  const state = useAiProviderSettingsState()
  const [attentionState, setAttentionState] = useState({ requestId: 0, visible: false })
  if (attentionRequestId > 0 && attentionRequestId !== attentionState.requestId) {
    setAttentionState({ requestId: attentionRequestId, visible: true })
  }
  const attention = attentionState.visible
  const [customModelsOpen, setCustomModelsOpen] = useState(false)
  const description = useMemo(() => (
    <>
      <p className={AI_PROVIDER_NOTICE_CLASS}>{state.noticeText}</p>
      <p className={AI_PROVIDER_SUBTITLE_CLASS}>API Key 仅保存在本地。</p>
    </>
  ), [state.noticeText])
  const status = useMemo(() => (
    <span
      className={`${AI_PROVIDER_STATUS_BADGE_CLASS} ${aiProviderToneClass(state.configTone, AI_PROVIDER_STATUS_TONE_CLASS)}`}
    >
      {state.configStatusText}
    </span>
  ), [state.configStatusText, state.configTone])
  const connectivityClassName = [
    AI_PROVIDER_CONNECTIVITY_CLASS,
    aiProviderToneClass(state.connectivityTone, AI_PROVIDER_CONNECTIVITY_TONE_CLASS)
  ].filter(Boolean).join(' ')
  const apiStyleOptions = state.apiStyleOptions.map((option): SelectOption => ({
    label: option.label,
    value: option.value
  }))

  useEffect(() => {
    if (!attentionState.visible) {
      return undefined
    }
    const timer = window.setTimeout(() => {
      setAttentionState((current) => current.requestId === attentionState.requestId
        ? { ...current, visible: false }
        : current)
    }, 1400)

    return () => {
      window.clearTimeout(timer)
    }
  }, [attentionState.requestId, attentionState.visible])

  const title = useMemo(() => <h2 className={AI_PROVIDER_TITLE_CLASS}>自定义 AI 渠道</h2>, [])

  return (
    <>
      <AiProviderCard
        id="ai-provider-settings"
        className={[
          AI_PROVIDER_CARD_CLASS,
          attention ? AI_PROVIDER_CARD_ATTENTION_CLASS : ''
        ].filter(Boolean).join(' ')}
        title={title}
        description={description}
        status={status}
        headerClassName={AI_PROVIDER_HEADER_CLASS}
        copyClassName={AI_PROVIDER_COPY_CLASS}
        iconName="Bot"
        bodyClassName={AI_PROVIDER_BODY_CLASS}
      >
        <ol className={AI_PROVIDER_FLOW_CLASS} aria-label="AI 渠道配置流程">
          {aiProviderSteps.map((step) => (
            <li className={AI_PROVIDER_FLOW_STEP_CLASS} key={step.id}>
              <span className={AI_PROVIDER_FLOW_INDEX_CLASS}>{step.index}</span>
              <strong className={AI_PROVIDER_FLOW_TITLE_CLASS}>{step.title}</strong>
              <p className={AI_PROVIDER_FLOW_COPY_CLASS}>{step.copy}</p>
            </li>
          ))}
        </ol>

        <div className={AI_PROVIDER_FIELD_CLASS}>
          <div className={AI_PROVIDER_FIELD_HEAD_CLASS}>
            <label className={AI_PROVIDER_FIELD_LABEL_CLASS} htmlFor="ai-api-key">API Key</label>
            <label className={AI_PROVIDER_CHECK_CLASS} htmlFor="ai-api-key-reveal">
              <span>显示密码</span>
              <span className={AI_SETTINGS_SWITCH_WRAP_CLASS}>
                <SwitchControl
                  id="ai-api-key-reveal"
                  aria-label="显示密码"
                  checked={state.revealApiKey}
                  className={AI_SETTINGS_SWITCH_CONTROL_CLASS}
                  disabled={state.fieldsDisabled}
                  thumbClassName={AI_SETTINGS_SWITCH_THUMB_CLASS}
                  onCheckedChange={(checked) => handleAiProviderSettingsAction({
                    action: 'toggle-api-key',
                    value: checked
                  })}
                  unstyled
                />
              </span>
            </label>
          </div>
          <Input
            id="ai-api-key"
            className={AI_PROVIDER_INPUT_CLASS}
            type={state.revealApiKey ? 'text' : 'password'}
            spellCheck={false}
            autoComplete="off"
            placeholder={state.apiKeyPlaceholder}
            value={state.apiKey}
            disabled={state.fieldsDisabled}
            onValueChange={(value) => handleAiProviderSettingsAction({
              action: 'change',
              field: 'apiKey',
              value
            })}
            unstyled
          />
        </div>

        <div className={AI_PROVIDER_MODEL_FIELD_CLASS}>
          <AiProviderModelToolsContent
            state={state}
            onOpenCustomModels={() => setCustomModelsOpen(true)}
          />
        </div>

        {state.connectivityVisible ? (
          <p className={connectivityClassName}>
            {state.connectivityBusy ? (
                <StatusBusyLoadingLabel label={state.connectivityCopy} />
            ) : (
              state.connectivityCopy
            )}
          </p>
        ) : null}

        <CollapsibleRoot id="ai-advanced-settings" className={AI_PROVIDER_ADVANCED_CLASS}>
          <CollapsibleTrigger className={AI_PROVIDER_ADVANCED_TRIGGER_CLASS}>Base URL 与接口选项</CollapsibleTrigger>
          <CollapsiblePanel className={AI_PROVIDER_ADVANCED_PANEL_CLASS}>
            <div className={AI_PROVIDER_GRID_CLASS}>
              <label className={AI_PROVIDER_FIELD_CLASS} htmlFor="ai-base-url">
                <span className={AI_PROVIDER_FIELD_LABEL_CLASS}>自定义 API 接口地址</span>
                <Input
                  id="ai-base-url"
                  className={AI_PROVIDER_INPUT_CLASS}
                  type="url"
                  spellCheck={false}
                  autoComplete="off"
                  placeholder="https://api.openai.com/v1"
                  value={state.baseUrl}
                  disabled={state.fieldsDisabled}
                  onValueChange={(value) => handleAiProviderSettingsAction({
                    action: 'change',
                    field: 'baseUrl',
                    value
                  })}
                  unstyled
                />
              </label>

              <div className={AI_PROVIDER_FIELD_CLASS}>
                <span className={AI_PROVIDER_FIELD_LABEL_CLASS}>接口类型</span>
                <div className={AI_PROVIDER_SELECT_HOST_CLASS}>
                  <Select
                    ariaLabel="接口类型"
                    className={AI_PROVIDER_SELECT_ROOT_CLASS}
                    disabled={state.modelToolsDisabled}
                    options={apiStyleOptions}
                    triggerClassName={AI_PROVIDER_SELECT_TRIGGER_CLASS}
                    value={state.apiStyle}
                    onValueChange={(value) => handleAiProviderSettingsAction({
                      action: 'api-style-change',
                      value: value || ''
                    })}
                  />
                </div>
              </div>

              <label className={AI_PROVIDER_FIELD_CLASS} htmlFor="ai-timeout-ms" hidden>
                <span className={AI_PROVIDER_FIELD_LABEL_CLASS}>请求超时 (ms)</span>
                <Input
                  id="ai-timeout-ms"
                  className={AI_PROVIDER_INPUT_CLASS}
                  type="number"
                  min="5000"
                  max="120000"
                  step="1000"
                  inputMode="numeric"
                  placeholder="30000"
                  value={state.timeoutMs}
                  disabled={state.fieldsDisabled}
                  onValueChange={(value) => handleAiProviderSettingsAction({
                    action: 'change',
                    field: 'timeoutMs',
                    value
                  })}
                  unstyled
                />
              </label>

              <label className={AI_PROVIDER_FIELD_CLASS} htmlFor="ai-batch-size">
                <span className={AI_PROVIDER_FIELD_LABEL_CLASS}>每批最大请求数</span>
                <Input
                  id="ai-batch-size"
                  className={AI_PROVIDER_INPUT_CLASS}
                  type="number"
                  min="1"
                  max="20"
                  step="1"
                  inputMode="numeric"
                  placeholder="6"
                  value={state.batchSize}
                  disabled={state.fieldsDisabled}
                  onValueChange={(value) => handleAiProviderSettingsAction({
                    action: 'change',
                    field: 'batchSize',
                    value
                  })}
                  unstyled
                />
              </label>
            </div>
          </CollapsiblePanel>
        </CollapsibleRoot>

        <div className={AI_PROVIDER_ACTIONS_CLASS}>
          <span
            className={`${AI_PROVIDER_SAVE_STATE_CLASS} ${aiProviderToneClass(state.configTone, AI_PROVIDER_SAVE_TONE_CLASS)}`}
          >
            {state.saveStatusText}
          </span>
          <div className={AI_PROVIDER_ACTION_BUTTONS_CLASS}>
            <Button
              variant={state.testButtonSecondary ? 'secondary' : 'primary'}
              type="button"
              aria-label="测试自定义 AI 渠道连接"
              disabled={state.testDisabled}
              focusableWhenDisabled={state.testingConnection}
              onClick={() => handleAiProviderSettingsAction({ action: 'test-connection' })}
            >
              <ButtonBusyLoadingLabel
                busy={state.testingConnection}
                label={state.testLabel}
                reserveLabels={AI_PROVIDER_TEST_LABELS}
                showLoader={false}
              />
            </Button>
            {state.showSaveSettingsButton ? (
              <Button
                variant="primary"
                type="button"
                aria-label="保存自定义 AI 渠道设置"
                disabled={state.saveDisabled}
                onClick={() => handleAiProviderSettingsAction({ action: 'save' })}
              >
                保存设置
              </Button>
            ) : null}
          </div>
        </div>
      </AiProviderCard>
      <AiCustomModelsDialog
        key={state.customModels.join('\n')}
        disabled={state.modelToolsDisabled}
        open={customModelsOpen}
        value={state.customModels.join('\n')}
        onOpenChange={setCustomModelsOpen}
      />
    </>
  )
}

function AiProviderModelToolsContent({
  onOpenCustomModels,
  state
}: {
  onOpenCustomModels: () => void
  state: AiProviderSettingsState
}) {
  const modelTools = state.modelTools
  const fetchModelsStatusClassName = [
    AI_PROVIDER_MODEL_FETCH_STATUS_CLASS,
    aiProviderToneClass(modelTools.fetchModelsStatusTone, AI_PROVIDER_CONNECTIVITY_TONE_CLASS)
  ].filter(Boolean).join(' ')

  return (
    <>
      <div className={AI_PROVIDER_MODEL_ROW_CLASS}>
        <div className={AI_PROVIDER_MODEL_CONTROL_CLASS}>
          <span className={AI_PROVIDER_MODEL_LABEL_CLASS}>模型</span>
          <div className={AI_PROVIDER_MODEL_GROUP_CLASS}>
            <div className={AI_PROVIDER_MODEL_SELECT_HOST_CLASS}>
              <AiModelSelector
                state={modelTools.selector}
                onModelSelect={(model) => handleAiProviderSettingsAction({
                  action: 'model-change',
                  value: model
                })}
              />
            </div>
            <Button
              className={AI_PROVIDER_FETCH_BUTTON_CLASS}
              size="sm"
              type="button"
              variant="secondary"
              aria-label="从自定义 AI 渠道获取模型列表"
              disabled={modelTools.fetchDisabled}
              focusableWhenDisabled={modelTools.fetchingModels}
              onClick={() => handleAiProviderSettingsAction({ action: 'fetch-models' })}
            >
              <ButtonBusyLoadingLabel
                busy={modelTools.fetchingModels}
                label={modelTools.fetchLabel}
                reserveLabels={AI_PROVIDER_FETCH_LABELS}
                showLoader={false}
              />
            </Button>
          </div>
        </div>
        <div className={AI_PROVIDER_MODEL_CONTROL_CLASS}>
          <span className={AI_PROVIDER_MODEL_LABEL_CLASS}>推理强度</span>
          <div className={AI_PROVIDER_EFFORT_HOST_CLASS}>
            <ReasoningEffortSelector
              ariaLabel="推理强度"
              levels={state.reasoningEffortOptions}
              modelName={modelTools.selector.currentModel}
              value={state.reasoningEffort}
              disabled={state.modelToolsDisabled || !state.reasoningEffortSupported}
              direction="down"
              onChange={(id) => handleAiProviderSettingsAction({
                action: 'reasoning-effort-change',
                value: id
              })}
            />
          </div>
        </div>
      </div>
      <div className={AI_PROVIDER_HINTS_CLASS}>
        {modelTools.fetchModelsStatus ? (
          <p className={fetchModelsStatusClassName}>
            {modelTools.fetchModelsStatusBusy ? (
              <StatusBusyLoadingLabel label={modelTools.fetchModelsStatus} />
            ) : (
              modelTools.fetchModelsStatus
            )}
          </p>
        ) : null}
        {state.reasoningEffortNote ? (
          <p className={AI_PROVIDER_FIELD_TIP_CLASS}>{state.reasoningEffortNote}</p>
        ) : null}
        <p className={AI_PROVIDER_FIELD_TIP_CLASS}>
          可搜索模型；自定义 ID 可在{' '}
          <Button
            className={AI_PROVIDER_INLINE_ACTION_CLASS}
            type="button"
            aria-label="打开自定义模型列表设置"
            disabled={modelTools.manageDisabled}
            onClick={onOpenCustomModels}
            unstyled
          >
            设置更多模型
          </Button>
          {' '}里追加。
        </p>
      </div>
    </>
  )
}

function AiCustomModelsDialog({
  disabled,
  onOpenChange,
  open,
  value
}: {
  disabled: boolean
  onOpenChange: (open: boolean) => void
  open: boolean
  value: string
}) {
  const [draft, setDraft] = useState(() => value)

  const handleOpenChange = (nextOpen: boolean) => {
    if (disabled && nextOpen) {
      return
    }
    setDraft(value)
    onOpenChange(nextOpen)
  }

  return (
    <DialogOverlay
      open={open}
      onOpenChange={handleOpenChange}
      keepMounted={false}
    >
      <DialogBackdrop className={AI_PROVIDER_DIALOG_BACKDROP_CLASS} />
      <DialogPanel
        className={AI_PROVIDER_DIALOG_CLASS}
        aria-describedby="ai-model-modal-copy"
        initialFocus={false}
        finalFocus={false}
      >
        <p className={AI_PROVIDER_DIALOG_EYEBROW_CLASS}>AI 模型</p>
        <DialogTitle className={AI_PROVIDER_DIALOG_TITLE_CLASS}>自定义模型列表</DialogTitle>
        <DialogDescription id="ai-model-modal-copy" className={AI_PROVIDER_DIALOG_COPY_CLASS}>
          每行一个模型 ID，保存后加入选择器。
        </DialogDescription>
        <label className={AI_PROVIDER_DIALOG_FIELD_CLASS} htmlFor="ai-custom-models-input">
          <span className={AI_PROVIDER_FIELD_LABEL_CLASS}>模型 ID</span>
          <Textarea
            id="ai-custom-models-input"
            className={AI_PROVIDER_TEXTAREA_CLASS}
            value={draft}
            onChange={(event) => setDraft(event.currentTarget.value)}
            placeholder={'gpt-4o\nclaude-3-5-sonnet-latest\nmy-custom-model'}
          />
        </label>
        <p className={AI_PROVIDER_DIALOG_HINT_CLASS}>重复项会自动合并，空行会被忽略。</p>
        <div className={AI_PROVIDER_DIALOG_ACTIONS_CLASS}>
          <DialogClose
            className={AI_PROVIDER_DIALOG_CLOSE_CLASS}
            type="button"
            aria-label="取消自定义模型设置"
          >
            取消
          </DialogClose>
          <Button
            variant="primary"
            type="button"
            aria-label="保存自定义模型列表"
            onClick={() => {
              handleAiProviderSettingsAction({
                action: 'custom-models-save',
                value: draft.split(/\r?\n/)
              })
              onOpenChange(false)
            }}
          >
            保存模型
          </Button>
        </div>
      </DialogPanel>
    </DialogOverlay>
  )
}
