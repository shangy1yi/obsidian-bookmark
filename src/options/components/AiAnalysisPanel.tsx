import { AiAnalysisActions } from './AiAnalysisActions.js'
import { AiAnalysisDecisionMetrics } from './AiAnalysisDecisionMetrics.js'
import { AiAnalysisProgressPanel } from './AiAnalysisProgressPanel.js'
import { AiAnalysisResults } from './AiAnalysisResults.js'
import { AiAnalysisResultsFilter } from './AiAnalysisResultsFilter.js'
import { AiAnalysisResultsHeader } from './AiAnalysisResultsHeader.js'
import { AiAnalysisResultsPagination } from './AiAnalysisResultsPagination.js'
import { AiAnalysisScopePickerButton } from './AiAnalysisScopePicker.js'
import { AiAnalysisSelectionActions } from './AiAnalysisSelectionActions.js'
import { AiAnalysisStatusCard } from './AiAnalysisStatusCard.js'
import { AiConfigLink } from './AiConfigLink.js'
import { AI_ANALYSIS_RESULTS_GROUP_CLASS } from './ai-analysis-classes.js'
import { useAiConfigLinkState } from './ai-config-link-store.js'
import { OptionEmptyState } from './OptionEmptyState.js'
import {
  OPTION_PANEL_CLASS,
  OPTION_RUN_ACTIONS_CLASS,
  OPTION_RUN_CELL_CLASS,
  OPTION_RUN_CELL_TEXT_CLASS,
  OPTION_RUN_CELL_TITLE_CLASS,
  OPTION_RUN_HEADER_CLASS
} from './option-layout-classes.js'
import { OptionPanelHeader } from './OptionPanelHeader.js'

const AI_ANALYSIS_TOOLBAR_ACTIONS_CLASS = OPTION_RUN_ACTIONS_CLASS
const AI_ANALYSIS_DECISION_HEADER_CLASS =
  'flex min-w-0 items-start justify-between gap-[14px] max-[760px]:flex-col'
const AI_ANALYSIS_DECISION_TITLE_CLASS =
  'font-[650] text-ds-text-primary [overflow-wrap:anywhere]'
const AI_ANALYSIS_DECISION_COPY_CLASS =
  'mt-[5px] mb-0 text-[13px] leading-[1.5] text-ds-text-muted'

interface OptionsPanelVisibilityProps {
  hidden: boolean
}

export function AiAnalysisPanel({ hidden }: OptionsPanelVisibilityProps) {
  const { configured } = useAiConfigLinkState()

  return (
    <section id="ai" className={OPTION_PANEL_CLASS} aria-labelledby="ai-title" hidden={hidden}>
      <OptionPanelHeader
        titleId="ai-title"
        title="书签智能分析"
        description="使用 AI 批量生成标题、标签和归档建议，再逐条确认并应用结果。"
      />

      {configured ? (
        <>
          <div className={OPTION_RUN_HEADER_CLASS}>
            <div className={OPTION_RUN_CELL_CLASS}>
              <strong className={OPTION_RUN_CELL_TITLE_CLASS}>分析范围</strong>
              <p className={OPTION_RUN_CELL_TEXT_CLASS}>为所选书签生成标题、标签和归档建议。</p>
              <div className="mt-3">
                <AiAnalysisScopePickerButton className="min-w-full" />
              </div>
            </div>
            <AiAnalysisStatusCard />
            <div className={AI_ANALYSIS_TOOLBAR_ACTIONS_CLASS}>
              <AiConfigLink />
              <AiAnalysisActions />
            </div>
          </div>

          <AiAnalysisProgressPanel>
            <div className={AI_ANALYSIS_DECISION_HEADER_CLASS}>
              <div>
                <strong className={AI_ANALYSIS_DECISION_TITLE_CLASS}>分析概览</strong>
                <p className={AI_ANALYSIS_DECISION_COPY_CLASS}>先处理建议，再检查待确认项。</p>
              </div>
            </div>
            <AiAnalysisDecisionMetrics />
          </AiAnalysisProgressPanel>

          <AiAnalysisSelectionActions />

          <div className={AI_ANALYSIS_RESULTS_GROUP_CLASS}>
            <AiAnalysisResultsHeader />
            <AiAnalysisResultsFilter />
            <AiAnalysisResults />
            <AiAnalysisResultsPagination />
          </div>
        </>
      ) : (
        <div className="mt-6">
          <OptionEmptyState
            title="先配置 AI 渠道"
            description="配置并测试连接后，这里会显示分析控制和结果。API Key 仅保存在本地。"
            actions={[{ action: 'configure-ai', label: '配置 API Key', variant: 'primary' }]}
          />
        </div>
      )}
    </section>
  )
}
