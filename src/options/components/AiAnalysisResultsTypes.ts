export interface AiNamingResultCardViewModel {
  canMoveToSuggestedFolder: boolean
  confidenceLabel: string
  confidenceScorePercent: number | null
  currentTitle: string
  detailRows: string[]
  errorMessage: string
  expandedTags: boolean
  id: string
  interactionLocked: boolean
  isSelected: boolean
  moveLabel: string
  openLabel: string
  path: string
  pendingMove: boolean
  selectable: boolean
  selectionLabel: string
  statusLabel: string
  badgeTone: string
  suggestedFolder: string
  suggestedTitle: string
  tags: string[]
  url: string
  applyLabel: string
  rejectLabel: string
}

export interface AiNamingResultsState {
  emptyMessage: string
  results: AiNamingResultCardViewModel[]
}

export type AiAnalysisAction =
  | 'start'
  | 'pause-toggle'
  | 'stop'
  | 'select-all'
  | 'select-high-confidence'
  | 'clear-selection'
  | 'apply-selection'
  | 'move-selection-to-suggested'

export interface AiAnalysisActionDetail {
  action: AiAnalysisAction
}

export type AiAnalysisResultAction =
  | 'apply'
  | 'move-recommended'
  | 'reject'
  | 'select'
  | 'toggle-tags'

export interface AiAnalysisResultActionDetail {
  action: AiAnalysisResultAction
  checked?: boolean
  id: string
}

export type AiAnalysisResultsPaginationDirection = 'next' | 'prev'

export interface AiAnalysisResultsPaginationActionDetail {
  direction: AiAnalysisResultsPaginationDirection
}

export type AiAnalysisResultsFilterKey = 'query' | 'status'
export type AiAnalysisResultsFilterAction = 'change' | 'clear'

export interface AiAnalysisResultsFilterActionDetail {
  action: AiAnalysisResultsFilterAction
  key?: AiAnalysisResultsFilterKey
  value?: string
}
