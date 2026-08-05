import { Button } from '../../ui/base/Button'
import { TextSwap } from '../../ui/motion/TextSwap'
import { useMotionEntrance } from '../../ui/motion/useMotionEntrance'
import { handleRecycleAction } from '../options-controller'
import { useRecycleControlsState } from './recycle-controls-store.js'

const RECYCLE_HEADER_CLASS = 'flex flex-wrap items-center justify-between gap-3'
const RECYCLE_HEADER_COPY_CLASS = 'min-w-0'
const RECYCLE_HEADER_TITLE_CLASS =
  'block text-[15px] font-semibold leading-normal tracking-[0] text-ds-text-primary'
const RECYCLE_HEADER_SUBTITLE_CLASS =
  'mt-2 mb-0 text-[13px] leading-[1.55] text-ds-text-secondary'
const RECYCLE_HEADER_ACTIONS_CLASS =
  'flex min-w-0 flex-wrap items-center justify-end gap-2.5 max-[760px]:items-start max-[760px]:justify-start'
const RECYCLE_SELECTION_GROUP_CLASS =
  't-panel-slide mb-[18px] rounded-ds-sm border border-ds-border-subtle bg-ds-surface-1 p-[16px] [--panel-translate-y:12px]'

export function RecycleControls() {
  const state = useRecycleControlsState()
  const hasEntries = state.entryCount > 0
  const hasSelection = state.selectedCount > 0
  const selectionEntered = useMotionEntrance(hasSelection)

  return (
    <>
      {hasSelection ? (
        <div className={RECYCLE_SELECTION_GROUP_CLASS} data-open={selectionEntered ? 'true' : 'false'}>
          <div className={RECYCLE_HEADER_CLASS}>
            <div className={RECYCLE_HEADER_COPY_CLASS}>
              <strong className={RECYCLE_HEADER_TITLE_CLASS}>
                <TextSwap animate={selectionEntered} text={`${state.selectedCount} 条已选择`} />
              </strong>
              <p className={RECYCLE_HEADER_SUBTITLE_CLASS}>可批量恢复或清除记录。</p>
            </div>
            <div className={RECYCLE_HEADER_ACTIONS_CLASS}>
              <Button
                size="sm"
                type="button"
                variant="secondary"
                aria-label="清空回收站已选书签"
                disabled={state.locked}
                focusableWhenDisabled={state.locked}
                onClick={() => handleRecycleAction('clear-selection')}
              >
                清空选择
              </Button>
              <Button
                size="sm"
                type="button"
                aria-label="批量恢复回收站已选书签"
                disabled={state.locked || !hasSelection}
                focusableWhenDisabled={state.locked}
                onClick={() => handleRecycleAction('restore-selected')}
              >
                恢复所选
              </Button>
              <Button
                size="sm"
                type="button"
                variant="danger"
                aria-label="清除回收站已选记录"
                disabled={state.locked || !hasSelection}
                focusableWhenDisabled={state.locked}
                onClick={() => handleRecycleAction('clear-selected')}
              >
                清除所选
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      <div className={RECYCLE_HEADER_CLASS}>
        <div className={RECYCLE_HEADER_COPY_CLASS}>
          <strong className={RECYCLE_HEADER_TITLE_CLASS}>回收站条目</strong>
          <p className={RECYCLE_HEADER_SUBTITLE_CLASS}>
            恢复时优先放回原文件夹。
          </p>
        </div>
        {hasEntries ? (
          <div className={RECYCLE_HEADER_ACTIONS_CLASS}>
            <Button
              size="sm"
              type="button"
              variant="secondary"
              aria-label="全选回收站条目"
              disabled={state.locked}
              focusableWhenDisabled={state.locked}
              onClick={() => handleRecycleAction('select-all')}
            >
              全选本区
            </Button>
            <Button
              size="sm"
              type="button"
              variant="danger"
              aria-label="清空全部回收站记录"
              disabled={state.locked}
              focusableWhenDisabled={state.locked}
              onClick={() => handleRecycleAction('clear-all')}
            >
              清空回收站
            </Button>
          </div>
        ) : null}
      </div>
    </>
  )
}
