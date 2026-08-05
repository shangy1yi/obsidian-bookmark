import type { Ref } from 'react'
import { AiProviderSettings } from './AiProviderSettings.js'
import { ContentSnapshotControls } from './ContentSnapshotControls.js'
import { FeatureSettingsControls } from './FeatureSettingsControls.js'
import { OPTION_PANEL_CLASS } from './option-layout-classes.js'
import { OptionPanelHeader } from './OptionPanelHeader.js'
import { ShortcutControls } from './ShortcutControls.js'

interface OptionsPanelVisibilityProps {
  aiProviderAnchorRef?: Ref<HTMLDivElement>
  aiProviderAttentionRequestId?: number
  hidden: boolean
}

export function GeneralPanel({
  aiProviderAnchorRef,
  aiProviderAttentionRequestId = 0,
  hidden
}: OptionsPanelVisibilityProps) {
  return (
    <section id="general" className={OPTION_PANEL_CLASS} aria-labelledby="general-title" hidden={hidden}>
      <OptionPanelHeader
        titleId="general-title"
        title="通用设置"
        description="调整核心功能、网页内容索引、快捷键与 AI 服务连接。"
      />

      <FeatureSettingsControls />

      <ContentSnapshotControls />

      <ShortcutControls />

      <div ref={aiProviderAnchorRef}>
        <AiProviderSettings attentionRequestId={aiProviderAttentionRequestId} />
      </div>
    </section>
  )
}
