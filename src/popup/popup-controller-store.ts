import {
  createUiViewStoreSlice,
  useUiViewStoreSlice
} from '../shared/ui-view-store.js'
import type { PopupToast } from './state'
import type {
  PopupContentViewModel,
  PopupFolderPickerState,
  PopupSmartClassifierViewModel
} from './components/PopupViewModels'

export interface PopupAutoAnalyzeStatusView {
  collapsed: boolean
  detail: string
  showHistory: boolean
  status: string | null
  title: string
}

export interface PopupAutoAnalyzeStatusActionDetail {
  action: string
}

export interface PopupSearchChipView {
  kind: string
  label: string
}

export interface PopupContentChangeDetail {
  preserveScroll: boolean
  state: PopupContentViewModel
}

export interface PopupContentActionDetail {
  action: string
  bookmarkId?: string
  emptyAction?: string
  folderId?: string
  index?: number
  menuAction?: string
  returnFocusElement?: HTMLElement | null
}

export interface PopupContentResultHoverDetail {
  index: number
}

export interface PopupSmartClassifierActionDetail {
  action: string
  currentPageAction?: string
  recommendationId?: string
  returnFocusElement?: HTMLElement | null
}

export interface PopupSmartClassifierTitleChangeDetail {
  title: string
}

export interface PopupFolderPickerActionDetail {
  action: 'select' | 'toggle'
  folderId: string
  mode: PopupFolderPickerState['mode']
}

export interface PopupChromeView {
  loadError: string
  search: {
    ariaLabel: string
    clearVisible: boolean
    fallback: boolean
    label: string
    notConfigured: boolean
    pending: boolean
    placeholder: string
    pressed: boolean
    query: string
    title: string
  }
  viewCaption: string
}

export interface PopupChromeActionDetail {
  action: string
  returnFocusElement?: HTMLElement | null
  value?: string
}

export interface PopupSearchFocusRequestDetail {
  select: boolean
}

export interface PopupModalsView {
  active: 'move' | 'smart-folder' | 'ai-provider' | 'edit' | 'delete' | null
  aiProvider: {
    open: boolean
  }
  delete: {
    cancelDisabled: boolean
    confirmDisabled: boolean
    confirmLabel: string
    open: boolean
    path: string
    title: string
  }
  edit: {
    cancelDisabled: boolean
    closeDisabled: boolean
    dirty: boolean
    folderPickerOpen: boolean
    folderQuery: string
    folderSearchDisabled: boolean
    open: boolean
    path: string
    pathChanged: boolean
    saveDisabled: boolean
    saveLabel: string
    title: string
    titleDisabled: boolean
    url: string
    urlDisabled: boolean
  }
  move: {
    open: boolean
    path: string
    query: string
    title: string
  }
  open: boolean
  smartFolder: {
    open: boolean
    query: string
    title: string
    urlLabel: string
  }
}

export interface PopupModalActionDetail {
  action: string
  value?: string
}

export interface PopupToastActionDetail {
  action: string
  toastId: string
}

export const EMPTY_POPUP_AUTO_ANALYZE_STATUS: PopupAutoAnalyzeStatusView = {
  collapsed: true,
  detail: '',
  showHistory: false,
  status: null,
  title: ''
}

export const EMPTY_POPUP_CHROME_VIEW: PopupChromeView = {
  loadError: '',
  search: {
    ariaLabel: '关键词搜索书签标题、网址、标签或高级语法',
    clearVisible: false,
    fallback: false,
    label: '语义',
    notConfigured: true,
    pending: false,
    placeholder: '关键词搜索',
    pressed: false,
    query: '',
    title: 'AI 语义搜索：需要先配置 AI 渠道'
  },
  viewCaption: '书签栏'
}

export const EMPTY_POPUP_CONTENT_CHANGE_DETAIL: PopupContentChangeDetail = {
  preserveScroll: false,
  state: {
    loading: true,
    rows: [],
    title: '书签栏'
  }
}

export const EMPTY_POPUP_MODALS_VIEW: PopupModalsView = {
  active: null,
  aiProvider: { open: false },
  delete: {
    cancelDisabled: false,
    confirmDisabled: false,
    confirmLabel: '删除',
    open: false,
    path: '',
    title: ''
  },
  edit: {
    cancelDisabled: false,
    closeDisabled: false,
    dirty: false,
    folderPickerOpen: false,
    folderQuery: '',
    folderSearchDisabled: false,
    open: false,
    path: '',
    pathChanged: false,
    saveDisabled: true,
    saveLabel: '未修改',
    title: '',
    titleDisabled: false,
    url: '',
    urlDisabled: false
  },
  move: {
    open: false,
    path: '',
    query: '',
    title: ''
  },
  open: false,
  smartFolder: {
    open: false,
    query: '',
    title: '',
    urlLabel: ''
  }
}

export const EMPTY_POPUP_SMART_CLASSIFIER: PopupSmartClassifierViewModel = {
  error: '',
  loadingLabel: '',
  loadingProgress: 0,
  loadingStep: 1,
  loadingStepCount: 3,
  page: null,
  permissionOrigins: [],
  recommendations: [],
  saved: false,
  saving: false,
  status: 'idle',
  suggestedTitle: ''
}

export const EMPTY_POPUP_TOASTS: PopupToast[] = []

export function getEmptyPopupFolderPickerState(mode: PopupFolderPickerState['mode']): PopupFolderPickerState {
  return {
    empty: null,
    mode,
    query: '',
    treeOptions: []
  }
}

interface PopupSearchFocusRequestState extends PopupSearchFocusRequestDetail {
  id: number
}

interface PopupViewStoreSnapshot {
  autoAnalyzeStatus: PopupAutoAnalyzeStatusView
  chrome: PopupChromeView
  content: PopupContentChangeDetail
  folderPickers: Record<PopupFolderPickerState['mode'], PopupFolderPickerState>
  modals: PopupModalsView
  searchChips: PopupSearchChipView[]
  searchFocusRequest: PopupSearchFocusRequestState
  smartClassifier: PopupSmartClassifierViewModel
  toasts: PopupToast[]
}

interface PopupActionHandlers {
  autoAnalyzeStatus?: (detail: PopupAutoAnalyzeStatusActionDetail) => void
  chrome?: (detail: PopupChromeActionDetail) => void
  content?: (detail: PopupContentActionDetail) => void
  contentResultHover?: (detail: PopupContentResultHoverDetail) => void
  folderPicker?: (detail: PopupFolderPickerActionDetail) => void
  modal?: (detail: PopupModalActionDetail) => void
  smartClassifier?: (detail: PopupSmartClassifierActionDetail) => void
  smartClassifierTitleChange?: (detail: PopupSmartClassifierTitleChangeDetail) => void
  toast?: (detail: PopupToastActionDetail) => void
}

const popupContentChangeListeners = new Set<(detail: PopupContentChangeDetail) => void>()
let popupActionHandlers: PopupActionHandlers = {}

function createInitialPopupViewStoreSnapshot(): PopupViewStoreSnapshot {
  return {
    autoAnalyzeStatus: { ...EMPTY_POPUP_AUTO_ANALYZE_STATUS },
    chrome: {
      ...EMPTY_POPUP_CHROME_VIEW,
      search: { ...EMPTY_POPUP_CHROME_VIEW.search }
    },
    content: {
      preserveScroll: EMPTY_POPUP_CONTENT_CHANGE_DETAIL.preserveScroll,
      state: { ...EMPTY_POPUP_CONTENT_CHANGE_DETAIL.state }
    },
    folderPickers: {
      edit: getEmptyPopupFolderPickerState('edit'),
      move: getEmptyPopupFolderPickerState('move'),
      smart: getEmptyPopupFolderPickerState('smart')
    },
    modals: {
      ...EMPTY_POPUP_MODALS_VIEW,
      aiProvider: { ...EMPTY_POPUP_MODALS_VIEW.aiProvider },
      delete: { ...EMPTY_POPUP_MODALS_VIEW.delete },
      edit: { ...EMPTY_POPUP_MODALS_VIEW.edit },
      move: { ...EMPTY_POPUP_MODALS_VIEW.move },
      smartFolder: { ...EMPTY_POPUP_MODALS_VIEW.smartFolder }
    },
    searchChips: [],
    searchFocusRequest: { id: 0, select: false },
    smartClassifier: {
      ...EMPTY_POPUP_SMART_CLASSIFIER,
      permissionOrigins: [],
      recommendations: []
    },
    toasts: [...EMPTY_POPUP_TOASTS]
  }
}

const popupViewStore = createUiViewStoreSlice(
  'popup',
  'root',
  createInitialPopupViewStoreSnapshot()
)

function updatePopupViewStore(nextSnapshot: Partial<PopupViewStoreSnapshot>): void {
  popupViewStore.setState((snapshot) => ({
    ...snapshot,
    ...nextSnapshot
  }))
}

export function resetPopupViewStore(): void {
  const snapshot = createInitialPopupViewStoreSnapshot()
  popupViewStore.setState(snapshot)
  popupContentChangeListeners.forEach((listener) => listener(snapshot.content))
}

export function getPopupSmartClassifierSnapshot(): PopupSmartClassifierViewModel {
  return popupViewStore.getState().smartClassifier
}

export function subscribePopupContentChange(listener: (detail: PopupContentChangeDetail) => void): () => void {
  popupContentChangeListeners.add(listener)
  listener(popupViewStore.getState().content)
  return () => popupContentChangeListeners.delete(listener)
}

export function registerPopupActionHandlers(handlers: PopupActionHandlers): () => void {
  popupActionHandlers = { ...popupActionHandlers, ...handlers }
  return () => {
    for (const key of Object.keys(handlers) as Array<keyof PopupActionHandlers>) {
      if (popupActionHandlers[key] === handlers[key]) {
        delete popupActionHandlers[key]
      }
    }
  }
}

export function usePopupAutoAnalyzeStatusView(): PopupAutoAnalyzeStatusView {
  return useUiViewStoreSlice(popupViewStore, (snapshot) => snapshot.autoAnalyzeStatus)
}

export function usePopupChromeView(): PopupChromeView {
  return useUiViewStoreSlice(popupViewStore, (snapshot) => snapshot.chrome)
}

export function usePopupFolderPickerState(mode: PopupFolderPickerState['mode']): PopupFolderPickerState {
  return useUiViewStoreSlice(popupViewStore, (snapshot) => snapshot.folderPickers[mode])
}

export function usePopupModalsView(): PopupModalsView {
  return useUiViewStoreSlice(popupViewStore, (snapshot) => snapshot.modals)
}

export function usePopupSearchChips(): PopupSearchChipView[] {
  return useUiViewStoreSlice(popupViewStore, (snapshot) => snapshot.searchChips)
}

export function usePopupSearchFocusRequest(): PopupSearchFocusRequestState {
  return useUiViewStoreSlice(popupViewStore, (snapshot) => snapshot.searchFocusRequest)
}

export function usePopupSmartClassifierView(): PopupSmartClassifierViewModel {
  return useUiViewStoreSlice(popupViewStore, (snapshot) => snapshot.smartClassifier)
}

export function usePopupToasts(): PopupToast[] {
  return useUiViewStoreSlice(popupViewStore, (snapshot) => snapshot.toasts)
}

export function dispatchPopupAutoAnalyzeStatusChange(state: PopupAutoAnalyzeStatusView): void {
  updatePopupViewStore({ autoAnalyzeStatus: { ...state } })
}

export function dispatchPopupAutoAnalyzeStatusAction(action: string): void {
  popupActionHandlers.autoAnalyzeStatus?.({ action })
}

export function dispatchPopupSearchChipsChange(chips: PopupSearchChipView[]): void {
  updatePopupViewStore({ searchChips: chips.map((chip) => ({ ...chip })) })
}

export function dispatchPopupContentChange(
  state: PopupContentViewModel,
  options: { preserveScroll?: boolean } = {}
): void {
  const detail: PopupContentChangeDetail = {
    preserveScroll: Boolean(options.preserveScroll),
    state: { ...state }
  }
  updatePopupViewStore({ content: detail })
  popupContentChangeListeners.forEach((listener) => listener(detail))
}

export function dispatchPopupContentAction(detail: PopupContentActionDetail): void {
  popupActionHandlers.content?.({ ...detail })
}

export function dispatchPopupContentResultHover(index: number): void {
  popupActionHandlers.contentResultHover?.({ index })
}

export function dispatchPopupSmartClassifierChange(state: PopupSmartClassifierViewModel): void {
  updatePopupViewStore({ smartClassifier: { ...state } })
}

export function dispatchPopupSmartClassifierAction(detail: PopupSmartClassifierActionDetail): void {
  popupActionHandlers.smartClassifier?.({ ...detail })
}

export function dispatchPopupSmartClassifierTitleChange(title: string): void {
  popupActionHandlers.smartClassifierTitleChange?.({ title })
}

export function dispatchPopupFolderPickerChange(
  mode: PopupFolderPickerState['mode'],
  state: PopupFolderPickerState
): void {
  updatePopupViewStore({
    folderPickers: {
      ...popupViewStore.getState().folderPickers,
      [mode]: { ...state }
    }
  })
}

export function dispatchPopupFolderPickerAction(detail: PopupFolderPickerActionDetail): void {
  popupActionHandlers.folderPicker?.({ ...detail })
}

export function dispatchPopupChromeChange(state: PopupChromeView): void {
  updatePopupViewStore({ chrome: { ...state, search: { ...state.search } } })
}

export function dispatchPopupChromeAction(
  action: string,
  value?: string,
  returnFocusElement?: HTMLElement | null
): void {
  popupActionHandlers.chrome?.({ action, value, returnFocusElement })
}

export function dispatchPopupSearchFocusRequest(select = false): void {
  const currentRequest = popupViewStore.getState().searchFocusRequest
  updatePopupViewStore({
    searchFocusRequest: {
      id: currentRequest.id + 1,
      select
    }
  })
}

export function dispatchPopupModalsChange(state: PopupModalsView): void {
  updatePopupViewStore({ modals: { ...state } })
}

export function dispatchPopupModalAction(action: string, value?: string): void {
  popupActionHandlers.modal?.({ action, value })
}

export function dispatchPopupToastsChange(toasts: PopupToast[]): void {
  updatePopupViewStore({ toasts: toasts.map((toast) => ({ ...toast })) })
}

export function dispatchPopupToastAction(toastId: string, action: string): void {
  popupActionHandlers.toast?.({ action, toastId })
}
