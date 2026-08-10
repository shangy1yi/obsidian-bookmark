import { readFileSync } from 'node:fs'
import {
  getBookmarkPaneKeyboardIndex,
  getFolderPickerSelectSelector,
  getFolderPickerToggleSelector,
  getFolderPaneKeyboardIndex,
  getFolderPaneTreeRoot,
  getNextFolderPickerFocusIndex,
  isPopupContentNavigationKey,
  isBookmarkRowKeyboardActive,
  shouldBlurMainSearchForNavigation,
  shouldDelegatePopupDocumentNavigation
} from './popup-keyboard-navigation.js'

function run(): void {
  testReturningFromFoldersRestoresFirstBookmarkWhenSelectionWasCleared()
  testReturningFromFoldersPreservesPreviousBookmark()
  testReturningFromFoldersClampsToAvailableBookmarks()
  testReturningToEmptyBookmarkPaneKeepsNoSelection()
  testFolderPaneDoesNotKeepBookmarkRowActive()
  testFolderPaneStartsOnSelectedFolder()
  testFolderPaneUsesFullSidebarTreeAfterFolderFilter()
  testSearchResultsReclaimBookmarkKeyboardSelection()
  testDocumentNavigationDelegatesFocusedControls()
  testMainSearchKeepsCaretHorizontalKeysButAllowsResultNavigation()
  testFolderPickerKeyboardIndexes()
  testFolderPickerSelectors()
  testControllerDelegatesFocusedInteractiveTargets()
  testMainFolderTreeHasTreeItemSemantics()
  testContentRowsForwardEnterToKeyboardNavigation()
  testModalFolderPickerOwnsTreeNavigation()
  testContentHostReobservesActiveKeyboardRows()
}

function testReturningFromFoldersRestoresFirstBookmarkWhenSelectionWasCleared(): void {
  const nextIndex = getBookmarkPaneKeyboardIndex(-1, 4)

  assert(
    nextIndex === 0,
    `returning from the folder pane should restore a visible bookmark highlight, got ${nextIndex}`
  )
}

function testReturningFromFoldersPreservesPreviousBookmark(): void {
  const nextIndex = getBookmarkPaneKeyboardIndex(2, 4)

  assert(nextIndex === 2, `returning from the folder pane should preserve the previous bookmark index, got ${nextIndex}`)
}

function testReturningFromFoldersClampsToAvailableBookmarks(): void {
  const nextIndex = getBookmarkPaneKeyboardIndex(8, 3)

  assert(nextIndex === 2, `returning from the folder pane should clamp stale bookmark indexes, got ${nextIndex}`)
}

function testReturningToEmptyBookmarkPaneKeepsNoSelection(): void {
  const nextIndex = getBookmarkPaneKeyboardIndex(1, 0)

  assert(nextIndex === -1, `empty bookmark panes should not create a phantom highlight, got ${nextIndex}`)
}

function testFolderPaneDoesNotKeepBookmarkRowActive(): void {
  assert(
    !isBookmarkRowKeyboardActive('folders', 1, 1),
    'bookmark rows should not stay active while the keyboard highlight is in the folder pane'
  )
  assert(
    isBookmarkRowKeyboardActive('bookmarks', 1, 1),
    'bookmark rows should become active again when the keyboard highlight returns to the bookmark pane'
  )
}

function testFolderPaneStartsOnSelectedFolder(): void {
  const rows = [
    { folderId: 'bar', root: true },
    { folderId: 'design' },
    { folderId: 'tools' }
  ]

  assert(getFolderPaneKeyboardIndex(rows, null) === 0, 'folder pane should start on the root row when no filter is selected')
  assert(getFolderPaneKeyboardIndex(rows, 'tools') === 2, 'folder pane should start on the selected filter row')
}

function testFolderPaneUsesFullSidebarTreeAfterFolderFilter(): void {
  const bookmarksBar = { id: 'bar' }
  const selectedFolder = { id: 'tools' }

  assert(
    getFolderPaneTreeRoot(selectedFolder, bookmarksBar) === bookmarksBar,
    'folder keyboard navigation should keep using the full sidebar tree after selecting a folder'
  )
}

function testSearchResultsReclaimBookmarkKeyboardSelection(): void {
  const source = readFileSync('src/popup/popup-controller.ts', 'utf8')
  const syncSearchSelection = source.slice(
    source.indexOf('function syncActiveSearchResultIndex()'),
    source.indexOf('async function toggleNaturalLanguageSearch')
  )
  const searchResultRows = source.slice(
    source.indexOf('function getSearchResultRows()'),
    source.indexOf('const MATCH_REASON_TOKEN_PATTERNS')
  )
  const setActiveResult = source.slice(
    source.indexOf('function setActiveResultIndex('),
    source.indexOf('function activateResultKeyboardIndex(')
  )

  assert(
    syncSearchSelection.includes("state.keyboardPane = 'bookmarks'") &&
      syncSearchSelection.includes('state.activeFolderKeyboardIndex = -1'),
    'starting a search must clear a stale folder keyboard selection before rendering results'
  )
  assert(
    source.includes("if (String(value || '').trim() && state.keyboardPane === 'folders')") &&
      source.includes('clearQueuedKeyboardNavigation()') &&
      source.includes('state.activeResultIndex = -1'),
    'raw search input must reclaim the bookmark pane before the debounced results arrive'
  )
  assert(
    searchResultRows.includes('isBookmarkRowKeyboardActive(state.keyboardPane, index, state.activeResultIndex)'),
    'search result highlight state must follow the active keyboard pane'
  )
  assert(
    setActiveResult.includes("state.keyboardPane = 'bookmarks'") &&
      setActiveResult.includes('state.activeFolderKeyboardIndex = -1'),
    'keyboard result navigation must reclaim the bookmark pane even when the result index is unchanged'
  )
}

function testDocumentNavigationDelegatesFocusedControls(): void {
  assert(
    shouldDelegatePopupDocumentNavigation('Enter', {
      editable: false,
      interactive: true,
      mainSearchInput: false
    }),
    'document-level bookmark Enter should not hijack focused buttons or links'
  )
  assert(
    shouldDelegatePopupDocumentNavigation('ArrowDown', {
      editable: true,
      interactive: false,
      mainSearchInput: false
    }),
    'document-level navigation should not hijack non-search editable fields'
  )
}

function testMainSearchKeepsCaretHorizontalKeysButAllowsResultNavigation(): void {
  const mainSearchTarget = {
    editable: true,
    interactive: true,
    mainSearchInput: true
  }

  assert(
    shouldDelegatePopupDocumentNavigation('ArrowLeft', mainSearchTarget),
    'main search should keep left/right caret movement'
  )
  assert(
    !shouldDelegatePopupDocumentNavigation('ArrowDown', mainSearchTarget),
    'main search should still allow vertical result navigation'
  )
  assert(
    shouldBlurMainSearchForNavigation('ArrowDown', mainSearchTarget),
    'vertical navigation from main search should leave text-editing mode'
  )
}

function testFolderPickerKeyboardIndexes(): void {
  assert(getNextFolderPickerFocusIndex(-1, 3, 'ArrowDown') === 0, 'ArrowDown should enter the first folder option')
  assert(getNextFolderPickerFocusIndex(0, 3, 'ArrowUp') === 2, 'ArrowUp should wrap to the last folder option')
  assert(getNextFolderPickerFocusIndex(1, 3, 'Home') === 0, 'Home should focus the first folder option')
  assert(getNextFolderPickerFocusIndex(1, 3, 'End') === 2, 'End should focus the last folder option')
  assert(getNextFolderPickerFocusIndex(0, 0, 'ArrowDown') === -1, 'empty picker lists should not create a focus target')
}

function testFolderPickerSelectors(): void {
  assert(getFolderPickerSelectSelector('move') === '[data-select-folder]', 'move picker should use move select targets')
  assert(getFolderPickerSelectSelector('smart') === '[data-smart-select-folder]', 'smart picker should use smart select targets')
  assert(getFolderPickerSelectSelector('edit') === '[data-select-edit-folder]', 'edit picker should use edit select targets')
  assert(getFolderPickerToggleSelector('move') === '[data-toggle-move-folder]', 'move picker should use move toggle targets')
  assert(getFolderPickerToggleSelector('smart') === '[data-toggle-smart-folder]', 'smart picker should use smart toggle targets')
  assert(getFolderPickerToggleSelector('edit') === '[data-toggle-edit-folder]', 'edit picker should use edit toggle targets')
}

function testControllerDelegatesFocusedInteractiveTargets(): void {
  const source = readFileSync('src/popup/popup-controller.ts', 'utf8')

  assert(
    source.includes('shouldDelegatePopupDocumentNavigation(event.key, targetInfo)'),
    'document-level popup navigation should delegate focused buttons, links, and editable fields'
  )
  assert(
    source.includes('shouldBlurMainSearchForNavigation(event.key, targetInfo)'),
    'vertical navigation from the main search input should explicitly leave text-editing mode'
  )
}

function testMainFolderTreeHasTreeItemSemantics(): void {
  const source = readFileSync('src/popup/components/PopupContent.tsx', 'utf8')

  assert(source.includes('role="treeitem"'), 'main popup folder rows should expose treeitem semantics')
  assert(source.includes('aria-level={row.depth + 1}'), 'main popup folder rows should expose their tree depth')
  assert(source.includes('aria-selected={row.keyboardActive ?'), 'main popup folder rows should expose keyboard selection state')
}

function testContentRowsForwardEnterToKeyboardNavigation(): void {
  const source = readFileSync('src/popup/components/PopupContent.tsx', 'utf8')

  assert(isPopupContentNavigationKey('Enter'), 'focused content rows should forward Enter to the highlighted item')
  assert(isPopupContentNavigationKey('ArrowDown'), 'focused content rows should keep forwarding vertical navigation')
  assert(!isPopupContentNavigationKey(' '), 'content row navigation should preserve native Space activation')
  assert(
    source.includes('isPopupContentNavigationKey(event.key)') && source.includes('handlers?.onKeyboardNavigate?.(event.key)'),
    'PopupContent should route Enter through the controller instead of activating the stale focused row'
  )
}

function testModalFolderPickerOwnsTreeNavigation(): void {
  const hostSource = readFileSync('src/popup/components/PopupFolderPickerHost.tsx', 'utf8')
  const modalSource = readFileSync('src/popup/components/PopupModalsHost.tsx', 'utf8')

  assert(
    hostSource.includes('onKeyDown={(event) => handleFolderPickerTreeKeyDown(event, mode)}'),
    'modal folder picker lists should own arrow-key tree navigation'
  )
  assert(
    modalSource.includes('focusFolderPickerEdge(list, mode, edge)'),
    'modal folder search inputs should let ArrowUp/ArrowDown enter the folder option list'
  )
}

function testContentHostReobservesActiveKeyboardRows(): void {
  const source = readFileSync('src/popup/components/PopupContentHost.tsx', 'utf8')

  assert(
    source.includes('activeResultObserverKey'),
    'active result indicator ResizeObserver should be keyed to the current active bookmark row'
  )
  assert(
    source.includes('activeFolderObserverKey'),
    'active result indicator ResizeObserver should be keyed to the current active folder row'
  )
  assert(
    source.includes('[activeFolderObserverKey, activeResultObserverKey, remeasureIndicator, state.keyboardPane]'),
    'active result indicator ResizeObserver should reattach when keyboard highlight moves to another row'
  )
}

function assert(value: unknown, message: string): void {
  if (!value) {
    throw new Error(message)
  }
}

run()
console.log('Popup keyboard navigation tests passed.')
