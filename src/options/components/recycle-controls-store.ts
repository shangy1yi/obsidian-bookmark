import { createUiViewStoreSlice, useUiViewStoreSlice } from '../../shared/ui-view-store.js'
import type { RecycleControlsState } from './recycle-controls-types.js'

const defaultRecycleControlsState: RecycleControlsState = {
  busy: false,
  entryCount: 0,
  locked: false,
  selectedCount: 0
}

const recycleControlsStore = createUiViewStoreSlice(
  'options',
  'recycle-controls',
  defaultRecycleControlsState
)

export function publishRecycleControls(state: RecycleControlsState): void {
  recycleControlsStore.setState(state)
}

export function useRecycleControlsState(): RecycleControlsState {
  return useUiViewStoreSlice(recycleControlsStore)
}
