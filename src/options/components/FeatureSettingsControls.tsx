import { AiProviderCard } from '../../ui/ai/AiProviderCard'
import { SwitchControl } from '../../ui/base/Switch'
import { Tooltip } from '../../ui/base/Tooltip'
import {
  AI_SETTINGS_BODY_CLASS,
  AI_SETTINGS_CARD_CLASS,
  AI_SETTINGS_COPY_CLASS,
  AI_SETTINGS_HEADER_CLASS,
  AI_SETTINGS_HELP_TOOLTIP_CLASS,
  AI_SETTINGS_HELP_TOOLTIP_POPUP_CLASS,
  AI_SETTINGS_INLINE_STATUS_CLASS,
  AI_SETTINGS_LOADING_BADGE_CLASS,
  AI_SETTINGS_LOADING_SWITCH_CLASS,
  AI_SETTINGS_READY_BODY_CLASS,
  AI_SETTINGS_ROW_CLASS,
  AI_SETTINGS_ROW_TITLE_CLASS,
  AI_SETTINGS_STATUS_TONE_CLASS,
  AI_SETTINGS_SWITCH_CONTROL_CLASS,
  AI_SETTINGS_SWITCH_THUMB_CLASS,
  AI_SETTINGS_SWITCH_WRAP_CLASS,
  AI_SETTINGS_TITLE_CLASS,
  AI_SETTINGS_TITLE_ROW_CLASS
} from './ai-settings-card-classes.js'
import { handleFeatureSettingsChange } from '../options-controller'
import { useFeatureSettingsControlsState } from './feature-settings-store.js'
import type { FeatureSettingKey, FeatureSwitchItemState } from './feature-settings-types.js'

const FEATURE_SETTINGS_LOADING_ROWS = [
  { key: 'autoAnalyzeBookmarks', label: '自动分析', status: true },
  { key: 'allowRemoteParsing', label: '开启 Jina Reader 远程解析 URL', status: true },
  { key: 'autoMoveToRecommendedFolder', label: '自动移动到推荐文件夹', status: true },
  { key: 'tagOnlyNoAutoMove', label: '只打标签，不自动移动', status: false }
] as const

export function FeatureSettingsControls() {
  const state = useFeatureSettingsControlsState()

  return (
    <AiProviderCard
      className={AI_SETTINGS_CARD_CLASS}
      title={<h2 className={AI_SETTINGS_TITLE_CLASS}>功能设置</h2>}
      headerClassName={AI_SETTINGS_HEADER_CLASS}
      iconName="Sparkles"
      bodyClassName={`${AI_SETTINGS_BODY_CLASS} ${state.loading ? '' : AI_SETTINGS_READY_BODY_CLASS}`}
      aria-busy={state.loading ? 'true' : undefined}
    >
      {state.loading
        ? FEATURE_SETTINGS_LOADING_ROWS.map((item) => (
            <FeatureSwitchLoadingRow item={item} key={item.key} />
          ))
        : state.switches.map((item) => (
            <FeatureSwitchRow item={item} key={item.key} />
          ))}
    </AiProviderCard>
  )
}

function FeatureSwitchLoadingRow({
  item
}: {
  item: (typeof FEATURE_SETTINGS_LOADING_ROWS)[number]
}) {
  return (
    <div className={AI_SETTINGS_ROW_CLASS} aria-hidden="true">
      <div className={AI_SETTINGS_COPY_CLASS}>
        <div className={AI_SETTINGS_TITLE_ROW_CLASS}>
          <strong className={AI_SETTINGS_ROW_TITLE_CLASS}>{item.label}</strong>
          {item.status ? <span className={AI_SETTINGS_LOADING_BADGE_CLASS} /> : null}
        </div>
      </div>
      <span className={AI_SETTINGS_SWITCH_WRAP_CLASS}>
        <span className={AI_SETTINGS_LOADING_SWITCH_CLASS} />
      </span>
    </div>
  )
}

function FeatureSwitchRow({ item }: { item: FeatureSwitchItemState }) {
  return (
    <div className={AI_SETTINGS_ROW_CLASS}>
      <div className={AI_SETTINGS_COPY_CLASS}>
        <div className={AI_SETTINGS_TITLE_ROW_CLASS}>
          <strong className={AI_SETTINGS_ROW_TITLE_CLASS}>
            {item.label} <HelpTooltip copy={item.help} />
          </strong>
          {item.status ? (
            <span
              className={`${AI_SETTINGS_INLINE_STATUS_CLASS} ${AI_SETTINGS_STATUS_TONE_CLASS[item.statusTone || 'muted']}`}
            >
              {item.status}
            </span>
          ) : null}
        </div>
      </div>
      <span className={AI_SETTINGS_SWITCH_WRAP_CLASS}>
        <SwitchControl
          aria-label={item.label}
          checked={item.checked}
          className={AI_SETTINGS_SWITCH_CONTROL_CLASS}
          disabled={item.disabled}
          thumbClassName={AI_SETTINGS_SWITCH_THUMB_CLASS}
          onCheckedChange={(checked) => handleFeatureSettingsChange({
            checked,
            key: item.key as FeatureSettingKey
          })}
          unstyled
        />
      </span>
    </div>
  )
}

function HelpTooltip({ copy }: { copy: string }) {
  return (
    <Tooltip
      content={copy}
      delay={180}
      popupClassName={AI_SETTINGS_HELP_TOOLTIP_POPUP_CLASS}
      sideOffset={10}
    >
      <button className={AI_SETTINGS_HELP_TOOLTIP_CLASS} type="button" aria-label={copy}>
        ?
      </button>
    </Tooltip>
  )
}
