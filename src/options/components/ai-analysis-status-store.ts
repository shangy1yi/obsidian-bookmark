import { createUiViewStoreSlice, useUiViewStoreSlice } from '../../shared/ui-view-store.js'
import type { AiNamingResultsState } from './AiAnalysisResultsTypes.js'

export interface AiAnalysisStatusState {
  badgeText: string
  badgeTone: string
  statusCopy: string
}

export interface AiAnalysisProgressState {
  busy: boolean
  progressCopy: string
  progressLabel: string
  progressMax: number
  progressValue: number
}

export interface AiAnalysisActionsState {
  actionDisabled: boolean
  actionLabel: string
  pauseDisabled: boolean
  pauseHidden: boolean
  pauseLabel: string
  stopDisabled: boolean
  stopHidden: boolean
  stopLabel: string
}

export interface AiAnalysisDurationState {
  durationLabel: string
}

export interface AiAnalysisDecisionMetricsState {
  eligible: string
  suggested: string
  manualReview: string
  unchanged: string
  failed: string
}

export interface AiAnalysisSelectionActionsState {
  applyDisabled: boolean
  clearDisabled: boolean
  countLabel: string
  hidden: boolean
  moveConfirm: boolean
  moveDisabled: boolean
  moveLabel: string
  moveTitle: string
  selectAllDisabled: boolean
  selectHighConfidenceDisabled: boolean
}

export interface AiAnalysisResultsHeaderState {
  resultCount: string
  subtitle: string
}

export interface AiAnalysisResultsFilterState {
  clearDisabled: boolean
  query: string
  status: string
}

export interface AiAnalysisScopePickerState {
  copy: string
  disabled: boolean
  label: string
}

export interface AiAnalysisResultsPaginationState {
  end: number
  label: string
  page: number
  start: number
  totalCount: number
  totalPages: number
  visible: boolean
}

const defaultState: AiAnalysisStatusState = {
  badgeText: '书签智能分析',
  badgeTone: 'muted',
  statusCopy: '配置 AI 渠道后，可批量生成标签和标题建议。'
}

const defaultProgressState: AiAnalysisProgressState = {
  busy: false,
  progressCopy: '先读取网页内容，再分批生成建议。',
  progressLabel: '未开始',
  progressMax: 1,
  progressValue: 0
}

const defaultActionsState: AiAnalysisActionsState = {
  actionDisabled: true,
  actionLabel: '开始分析并生成建议',
  pauseDisabled: true,
  pauseHidden: true,
  pauseLabel: '暂停生成',
  stopDisabled: true,
  stopHidden: true,
  stopLabel: '停止本次生成'
}

const defaultDurationState: AiAnalysisDurationState = {
  durationLabel: '未开始'
}

const defaultDecisionMetricsState: AiAnalysisDecisionMetricsState = {
  eligible: '0',
  suggested: '0',
  manualReview: '0',
  unchanged: '0',
  failed: '0'
}

const defaultSelectionActionsState: AiAnalysisSelectionActionsState = {
  applyDisabled: true,
  clearDisabled: true,
  countLabel: '0 条已选择',
  hidden: true,
  moveConfirm: false,
  moveDisabled: true,
  moveLabel: '移动至推荐文件夹',
  moveTitle: '所选结果没有可用的推荐文件夹',
  selectAllDisabled: true,
  selectHighConfidenceDisabled: true
}

const defaultResultsHeaderState: AiAnalysisResultsHeaderState = {
  resultCount: '0 条结果',
  subtitle: '展示标题建议、标签、置信度和原因。'
}

const defaultResultsFilterState: AiAnalysisResultsFilterState = {
  clearDisabled: true,
  query: '',
  status: 'all'
}

const defaultResultsState: AiNamingResultsState = {
  emptyMessage: '开始分析后，这里会显示结果。',
  results: []
}

const defaultScopePickerState: AiAnalysisScopePickerState = {
  copy: '当前范围：全部书签。可切换到文件夹。',
  disabled: false,
  label: '全部书签'
}

const defaultResultsPaginationState: AiAnalysisResultsPaginationState = {
  end: 0,
  label: 'AI 结果',
  page: 1,
  start: 0,
  totalCount: 0,
  totalPages: 1,
  visible: false
}

interface AiAnalysisStoreState {
  actions: AiAnalysisActionsState
  decisionMetrics: AiAnalysisDecisionMetricsState
  duration: AiAnalysisDurationState
  progress: AiAnalysisProgressState
  results: AiNamingResultsState
  resultsFilter: AiAnalysisResultsFilterState
  resultsHeader: AiAnalysisResultsHeaderState
  resultsPagination: AiAnalysisResultsPaginationState
  scopePicker: AiAnalysisScopePickerState
  selectionActions: AiAnalysisSelectionActionsState
  status: AiAnalysisStatusState
}

const aiAnalysisStore = createUiViewStoreSlice<AiAnalysisStoreState>(
  'options',
  'ai-analysis',
  {
    actions: defaultActionsState,
    decisionMetrics: defaultDecisionMetricsState,
    duration: defaultDurationState,
    progress: defaultProgressState,
    results: defaultResultsState,
    resultsFilter: defaultResultsFilterState,
    resultsHeader: defaultResultsHeaderState,
    resultsPagination: defaultResultsPaginationState,
    scopePicker: defaultScopePickerState,
    selectionActions: defaultSelectionActionsState,
    status: defaultState
  }
)

export function publishAiAnalysisStatus(state: AiAnalysisStatusState): void {
  aiAnalysisStore.setState((current) => ({ ...current, status: state }))
}

export function publishAiAnalysisProgress(state: AiAnalysisProgressState): void {
  aiAnalysisStore.setState((current) => ({ ...current, progress: state }))
}

export function publishAiAnalysisActions(state: AiAnalysisActionsState): void {
  aiAnalysisStore.setState((current) => ({ ...current, actions: state }))
}

export function publishAiAnalysisDuration(state: AiAnalysisDurationState): void {
  aiAnalysisStore.setState((current) => ({ ...current, duration: state }))
}

export function publishAiAnalysisDecisionMetrics(state: AiAnalysisDecisionMetricsState): void {
  aiAnalysisStore.setState((current) => ({ ...current, decisionMetrics: state }))
}

export function publishAiAnalysisSelectionActions(state: AiAnalysisSelectionActionsState): void {
  aiAnalysisStore.setState((current) => ({ ...current, selectionActions: state }))
}

export function publishAiAnalysisResultsHeader(state: AiAnalysisResultsHeaderState): void {
  aiAnalysisStore.setState((current) => ({ ...current, resultsHeader: state }))
}

export function publishAiAnalysisResultsFilter(state: AiAnalysisResultsFilterState): void {
  aiAnalysisStore.setState((current) => ({ ...current, resultsFilter: state }))
}

export function publishAiAnalysisResults(state: AiNamingResultsState): void {
  aiAnalysisStore.setState((current) => ({ ...current, results: state }))
}

export function publishAiAnalysisScopePicker(state: AiAnalysisScopePickerState): void {
  aiAnalysisStore.setState((current) => ({ ...current, scopePicker: state }))
}

export function publishAiAnalysisResultsPagination(state: AiAnalysisResultsPaginationState): void {
  aiAnalysisStore.setState((current) => ({ ...current, resultsPagination: state }))
}

export function useAiAnalysisStatus(): AiAnalysisStatusState {
  return useUiViewStoreSlice(aiAnalysisStore, (state) => state.status)
}

export function useAiAnalysisProgress(): AiAnalysisProgressState {
  return useUiViewStoreSlice(aiAnalysisStore, (state) => state.progress)
}

export function useAiAnalysisActions(): AiAnalysisActionsState {
  return useUiViewStoreSlice(aiAnalysisStore, (state) => state.actions)
}

export function useAiAnalysisDuration(): AiAnalysisDurationState {
  return useUiViewStoreSlice(aiAnalysisStore, (state) => state.duration)
}

export function useAiAnalysisDecisionMetrics(): AiAnalysisDecisionMetricsState {
  return useUiViewStoreSlice(aiAnalysisStore, (state) => state.decisionMetrics)
}

export function useAiAnalysisSelectionActions(): AiAnalysisSelectionActionsState {
  return useUiViewStoreSlice(aiAnalysisStore, (state) => state.selectionActions)
}

export function useAiAnalysisResultsHeader(): AiAnalysisResultsHeaderState {
  return useUiViewStoreSlice(aiAnalysisStore, (state) => state.resultsHeader)
}

export function useAiAnalysisResultsFilter(): AiAnalysisResultsFilterState {
  return useUiViewStoreSlice(aiAnalysisStore, (state) => state.resultsFilter)
}

export function useAiAnalysisResults(): AiNamingResultsState {
  return useUiViewStoreSlice(aiAnalysisStore, (state) => state.results)
}

export function useAiAnalysisScopePicker(): AiAnalysisScopePickerState {
  return useUiViewStoreSlice(aiAnalysisStore, (state) => state.scopePicker)
}

export function useAiAnalysisResultsPagination(): AiAnalysisResultsPaginationState {
  return useUiViewStoreSlice(aiAnalysisStore, (state) => state.resultsPagination)
}
