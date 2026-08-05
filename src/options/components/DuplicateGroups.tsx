import { displayUrl } from '../../shared/text.js'
import { Button } from '../../ui/base/Button'
import { Checkbox } from '../../ui/base/Checkbox'
import { TextSwap } from '../../ui/motion/TextSwap'
import { useMotionEntrance } from '../../ui/motion/useMotionEntrance'
import { handleDuplicateAction } from '../options-controller'
import { useDuplicateGroupsState } from './duplicate-groups-store.js'
import { OptionEmptyState } from './OptionEmptyState.js'
import type {
  DuplicateBookmarkViewModel,
  DuplicateGroupViewModel,
  DuplicateGroupsState,
  DuplicateSelectionStatsViewModel
} from './duplicate-groups-types.js'

type BadgeTone = 'danger' | 'muted' | 'success' | 'warning'

const DUPLICATE_DATE_FORMATTER = new Intl.DateTimeFormat('zh-CN', {
  year: 'numeric',
  month: '2-digit',
  day: '2-digit'
})

const RESULTS_CLASS = 'mt-4 flex flex-col gap-2'
const EMPTY_CLASS =
  'rounded-ds-sm border border-ds-border-subtle bg-ds-surface-1 p-[14px_16px] text-[13px] leading-[1.55] text-ds-text-secondary shadow-none transition-colors hover:border-ds-border hover:bg-ds-hover'
const DOCKED_SELECTION_CLASS =
  't-panel-slide sticky top-3 z-[5] grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3.5 rounded-ds-sm border border-ds-warning/35 bg-ds-surface-2 p-[12px_14px] [filter:var(--ds-filter-card)] [--panel-translate-y:12px] max-[760px]:static max-[760px]:grid-cols-1'
const DOCKED_COPY_CLASS = 'min-w-0'
const DOCKED_TITLE_CLASS = 'block text-sm font-bold text-ds-text-primary'
const DOCKED_TEXT_CLASS = 'mt-[5px] text-xs leading-[1.55] text-[rgba(245,245,247,0.58)]'
const DOCKED_WARNING_CLASS = `${DOCKED_TEXT_CLASS} font-semibold text-ds-danger-text`
const DOCKED_ACTIONS_CLASS =
  'flex flex-wrap items-center justify-end gap-2 max-[760px]:justify-start'
const DOCKED_ACTION_BUTTON_CLASS = 'max-[760px]:flex-1 max-[760px]:basis-[132px]'
const GROUP_CARD_CLASS =
  'rounded-ds-sm border border-ds-border-subtle bg-ds-surface-1 p-4 shadow-none transition-colors hover:border-ds-border hover:bg-ds-hover'
const GROUP_HEADER_CLASS =
  'flex min-w-0 flex-wrap items-start justify-between gap-2.5 max-[760px]:flex-col max-[760px]:items-stretch'
const GROUP_COPY_CLASS = 'min-w-0'
const GROUP_TITLE_ROW_CLASS = 'flex min-w-0 flex-wrap items-start gap-2.5'
const GROUP_TITLE_CLASS =
  'block min-w-0 max-w-full overflow-hidden text-ellipsis whitespace-nowrap text-[15px] font-semibold leading-normal text-ds-text-primary max-[760px]:whitespace-normal'
const GROUP_TAGS_CLASS = 'inline-flex flex-wrap items-center gap-1.5'
const GROUP_SUBTITLE_CLASS = 'mt-2 text-[13px] leading-[1.55] text-ds-text-secondary'
const RECOMMENDATION_CLASS =
  'mt-3.5 grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3.5 border-y border-[rgba(255,255,255,0.075)] py-3 max-[760px]:flex max-[760px]:flex-col max-[760px]:items-stretch'
const RECOMMENDATION_COPY_CLASS = 'min-w-0'
const RECOMMENDATION_TITLE_CLASS =
  'mt-2 block min-w-0 overflow-hidden text-ellipsis whitespace-nowrap text-[13px] font-semibold text-[rgba(245,245,247,0.88)] max-[760px]:whitespace-normal'
const RECOMMENDATION_TEXT_CLASS =
  'mt-1.5 text-xs leading-[1.6] text-[rgba(245,245,247,0.52)]'
const RECOMMENDATION_SIGNALS_CLASS = 'mt-[9px] flex flex-wrap items-center gap-1.5'
const GROUP_ACTIONS_CLASS =
  'flex flex-wrap items-center justify-end gap-2.5 max-[760px]:justify-start'
const ACCEPT_ACTION_CLASS = 'min-w-[132px]'
const ITEM_LIST_CLASS = 'mt-3.5 flex flex-col gap-2.5'
const ITEM_ROW_CLASS =
  'grid grid-cols-[auto_minmax(0,1fr)] items-start gap-3 rounded-ds-sm border border-ds-border-subtle bg-ds-surface-1 p-[13px_14px] shadow-none transition-colors hover:border-ds-border hover:bg-ds-hover max-[760px]:grid-cols-1'
const ITEM_ROW_PENDING_CLASS = 'border-ds-danger/35 bg-ds-danger-soft'
const ITEM_ROW_RECOMMENDED_CLASS = 'border-ds-success/35'
const ITEM_CHECK_LABEL_CLASS =
  'inline-flex min-w-[78px] items-center gap-2 self-start pt-0.5 text-xs font-semibold text-ds-text-secondary max-[760px]:min-w-0'
const ITEM_COPY_CLASS = 'min-w-0'
const ITEM_META_CLASS =
  'flex min-w-0 flex-wrap items-center justify-between gap-2.5'
const ITEM_TITLE_CLASS =
  'min-w-0 overflow-hidden text-ellipsis whitespace-nowrap text-[15px] font-semibold text-ds-text-primary max-[760px]:whitespace-normal'
const ITEM_BADGES_CLASS = 'inline-flex flex-wrap items-center gap-1.5'
const ITEM_URL_CLASS =
  'mt-[7px] inline-block text-[13px] leading-[1.6] text-ds-text-secondary [overflow-wrap:anywhere] [word-break:break-word]'
const ITEM_DETAIL_CLASS =
  'mt-[7px] text-[13px] leading-[1.6] text-ds-text-secondary [overflow-wrap:anywhere] [word-break:break-word]'
const ITEM_PATH_CLASS =
  'mt-[7px] text-[13px] leading-[1.6] text-ds-text-disabled [overflow-wrap:anywhere] [word-break:break-word]'
const BADGE_CLASS =
  'inline-flex min-h-6 flex-none items-center justify-center whitespace-nowrap rounded-full border px-2.5 text-[11px] font-semibold leading-none tracking-[0]'
const BADGE_TONE_CLASS: Record<BadgeTone, string> = {
  danger: 'border-ds-danger/35 bg-ds-danger-soft text-ds-danger-text',
  muted: 'border-ds-hover bg-ds-surface-2 text-ds-text-muted',
  success: 'border-ds-success/35 bg-ds-success-soft text-ds-success-text',
  warning: 'border-ds-warning/35 bg-ds-warning-soft text-ds-warning'
}

export function DuplicateGroups() {
  const state = useDuplicateGroupsState()

  if (!state.catalogLoading && !state.groups.length) {
    return (
      <div className={RESULTS_CLASS}>
        <OptionEmptyState
          title="未发现重复书签"
          description="按 URL 聚合检测；发现重复后会给出推荐保留项，其余可移入回收站。"
        />
      </div>
    )
  }

  if (!state.groups.length) {
    return (
      <div className={RESULTS_CLASS}>
        <div className={EMPTY_CLASS}>正在分析重复书签。</div>
      </div>
    )
  }

  return (
    <div className={RESULTS_CLASS}>
      <DuplicateDockedSelection locked={state.locked} selectionStats={state.selectionStats} />
      {state.groups.map((group) => (
        <DuplicateGroupCard group={group} key={group.id} state={state} />
      ))}
    </div>
  )
}

function DuplicateDockedSelection({
  locked,
  selectionStats
}: {
  locked: boolean
  selectionStats: DuplicateSelectionStatsViewModel
}) {
  const entered = useMotionEntrance(Boolean(selectionStats.deleteCount))

  if (!selectionStats.deleteCount) {
    return null
  }

  const unsafe = selectionStats.unsafeGroupCount > 0

  return (
    <section className={DOCKED_SELECTION_CLASS} data-open={entered ? 'true' : 'false'} aria-label="已选重复书签操作">
      <div className={DOCKED_COPY_CLASS}>
        <strong className={DOCKED_TITLE_CLASS}>
          <TextSwap
            animate={entered}
            text={`已选 ${selectionStats.deleteCount} 条待移入回收站`}
          />
        </strong>
        <p className={DOCKED_TEXT_CLASS}>
          保留 {selectionStats.keepCount} 条，涉及 {selectionStats.groupCount} 组。
        </p>
        {unsafe ? (
          <p className={DOCKED_WARNING_CLASS}>
            {selectionStats.unsafeGroupCount} 组已全选；每组至少保留 1 条后才能移入回收站。
          </p>
        ) : null}
      </div>
      <div className={DOCKED_ACTIONS_CLASS}>
        <Button
          className={DOCKED_ACTION_BUTTON_CLASS}
          size="sm"
          type="button"
          variant="secondary"
          disabled={locked}
          onClick={() => handleDuplicateAction({ action: 'clear-selection' })}
        >
          清空选择
        </Button>
        <Button
          className={DOCKED_ACTION_BUTTON_CLASS}
          size="sm"
          type="button"
          variant="danger"
          disabled={locked || unsafe}
          onClick={() => handleDuplicateAction({ action: 'delete-selection' })}
        >
          移入回收站
        </Button>
      </div>
    </section>
  )
}

function DuplicateGroupCard({
  group,
  state
}: {
  group: DuplicateGroupViewModel
  state: DuplicateGroupsState
}) {
  const selectedCount = getDuplicateGroupSelectedCount(group, state.selectedIds)
  const keepCount = Math.max(0, group.items.length - selectedCount)
  const recommendedItem = getDuplicateGroupItem(group, group.recommendedKeepId) || group.items[0]
  const recommendedDeleteCount = Math.max(0, group.items.length - 1)
  const currentSelectionCopy = selectedCount > 0
    ? `已选 ${selectedCount} 条，保留 ${keepCount} 条。`
    : `推荐选择 ${recommendedDeleteCount} 条，保留 1 条。`

  return (
    <article
      className={GROUP_CARD_CLASS}
    >
      <div className={GROUP_HEADER_CLASS}>
        <div className={GROUP_COPY_CLASS}>
          <div className={GROUP_TITLE_ROW_CLASS}>
            <strong className={GROUP_TITLE_CLASS} title={group.displayUrl}>{group.displayUrl}</strong>
            <div className={GROUP_TAGS_CLASS}>
              <DuplicateGroupChips group={group} />
            </div>
          </div>
          <p className={GROUP_SUBTITLE_CLASS}>
            {group.items.length} 条重复 · {group.folders.length} 个文件夹 · {currentSelectionCopy}
          </p>
        </div>
      </div>
      <div className={RECOMMENDATION_CLASS}>
        <div className={RECOMMENDATION_COPY_CLASS}>
          <DuplicateBadge label="推荐保留" tone="success" />
          <strong className={RECOMMENDATION_TITLE_CLASS}>{recommendedItem?.title || '未命名书签'}</strong>
          <p className={RECOMMENDATION_TEXT_CLASS}>
            {group.recommendation.reason} 可选择 {recommendedDeleteCount}
            {' '}条移入回收站。
          </p>
          <div className={RECOMMENDATION_SIGNALS_CLASS} aria-label="推荐依据">
            <DuplicateRecommendationSignals group={group} />
          </div>
        </div>
        <div className={GROUP_ACTIONS_CLASS}>
          <DuplicateStrategyButton
            disabled={state.locked}
            groupId={group.id}
            label="按推荐选择"
            strategy="recommended"
            className={ACCEPT_ACTION_CLASS}
          />
          <DuplicateStrategyButton
            disabled={state.locked}
            groupId={group.id}
            label="保留最新"
            strategy="newest"
          />
          <DuplicateStrategyButton
            disabled={state.locked}
            groupId={group.id}
            label="保留路径最短"
            strategy="shorter-path"
          />
        </div>
      </div>
      <div className={ITEM_LIST_CLASS}>
        {group.items.map((item) => (
          <DuplicateItemRow group={group} item={item} key={item.id} state={state} />
        ))}
      </div>
    </article>
  )
}

function DuplicateStrategyButton({
  className = '',
  disabled,
  groupId,
  label,
  strategy
}: {
  className?: string
  disabled: boolean
  groupId: string
  label: string
  strategy: string
}) {
  return (
    <Button
      className={className}
      size="sm"
      type="button"
      variant="secondary"
      disabled={disabled}
      onClick={() => handleDuplicateAction({
        action: 'group-strategy',
        groupId,
        strategy
      })}
    >
      {label}
    </Button>
  )
}

function DuplicateGroupChips({ group }: { group: DuplicateGroupViewModel }) {
  const chips: Array<[BadgeTone, string]> = [
    group.isCrossFolder ? ['warning', '跨文件夹'] : ['muted', '同文件夹'],
    group.hasTitleVariants ? ['warning', '标题不同'] : ['muted', '标题一致'],
    group.risk === 'high' ? ['danger', '高风险'] : ['success', '低风险']
  ]

  return (
    <>
      {chips.map(([tone, label]) => (
        <DuplicateBadge key={label} label={label} tone={tone} />
      ))}
    </>
  )
}

function DuplicateRecommendationSignals({ group }: { group: DuplicateGroupViewModel }) {
  const signals: Array<[string, unknown]> = [
    ['最新', group.latestItemId],
    ['最早', group.oldestItemId],
    ['路径最短', group.shorterPathItemId],
    ['有标签/摘要', group.taggedItemId],
    ['新标签页来源', group.newTabSourceItemId],
    ['最近访问', group.recentItemId]
  ]

  return (
    <>
      {signals.flatMap((combineValue, combineIndex, combineArray) => { if (!(([, bookmarkId]) => Boolean(bookmarkId))(combineValue)) return []; const combinedResult = (([label, bookmarkId]) => {
          const active = String(bookmarkId) === String(group.recommendedKeepId)
          return (
            <DuplicateBadge key={label} label={label} tone={active ? 'success' : 'muted'} />
          )
        })(combineValue); return [combinedResult] })}
    </>
  )
}

function DuplicateItemRow({
  group,
  item,
  state
}: {
  group: DuplicateGroupViewModel
  item: DuplicateBookmarkViewModel
  state: DuplicateGroupsState
}) {
  const itemId = String(item.id)
  const selected = state.selectedIds.has(itemId)
  const recommended = itemId === String(group.recommendedKeepId)
  const selectionLabel = getDuplicateItemSelectionLabel(item)

  return (
    <div
      className={[
        ITEM_ROW_CLASS,
        selected ? ITEM_ROW_PENDING_CLASS : '',
        recommended && !selected ? ITEM_ROW_RECOMMENDED_CLASS : ''
      ].filter(Boolean).join(' ')}
    >
      <Checkbox
        aria-label={selectionLabel}
        checked={selected}
        disabled={state.locked}
        label="移入回收站"
        labelClassName={ITEM_CHECK_LABEL_CLASS}
        onCheckedChange={(checked) => handleDuplicateAction({
          action: 'toggle-item',
          bookmarkId: item.id,
          checked
        })}
      />
      <div className={ITEM_COPY_CLASS}>
        <div className={ITEM_META_CLASS}>
          <strong className={ITEM_TITLE_CLASS} title={item.title || '未命名书签'}>{item.title || '未命名书签'}</strong>
          <div className={ITEM_BADGES_CLASS}>
            <DuplicateItemBadges group={group} item={item} state={state} />
          </div>
        </div>
        <div className={ITEM_URL_CLASS}>{displayUrl(item.url)}</div>
        <div className={ITEM_DETAIL_CLASS}>添加于 {formatDuplicateDate(item.dateAdded)}</div>
        <div className={ITEM_PATH_CLASS} title={item.path || '未归档路径'}>
          {item.path || '未归档路径'}
        </div>
      </div>
    </div>
  )
}

function DuplicateItemBadges({
  group,
  item,
  state
}: {
  group: DuplicateGroupViewModel
  item: DuplicateBookmarkViewModel
  state: DuplicateGroupsState
}) {
  const itemId = String(item.id)
  const badges: Array<[BadgeTone, string]> = []

  if (state.selectedIds.has(itemId)) {
    badges.push(['danger', '待移入回收站'])
  } else if (itemId === String(group.recommendedKeepId)) {
    badges.push(['success', '推荐保留'])
  }

  if (itemId === String(group.latestItemId)) {
    badges.push(['muted', '最新'])
  }
  if (itemId === String(group.oldestItemId)) {
    badges.push(['muted', '最早'])
  }
  if (itemId === String(group.shorterPathItemId)) {
    badges.push(['muted', '路径更短'])
  }
  if (itemId === String(group.fullerTitleItemId) && group.hasTitleVariants) {
    badges.push(['muted', '标题更完整'])
  }
  if (itemId === String(group.taggedItemId)) {
    badges.push(['muted', state.tagBadgeLabels[itemId] || '有整理信息'])
  }
  if (itemId === String(group.newTabSourceItemId)) {
    badges.push(['muted', '新标签页来源'])
  }
  if (itemId === String(group.recentItemId)) {
    badges.push(['muted', '最近访问'])
  }
  if (isBookmarkInCurrentDuplicateScope(item, state.currentScopeFolderId)) {
    badges.push(['muted', '当前范围'])
  }

  const seen = new Set<string>()
  return (
    <>
      {badges.flatMap((combineValue, combineIndex, combineArray) => { if (!(([, label]) => {
          if (seen.has(label)) {
            return false
          }
          seen.add(label)
          return true
        })(combineValue)) return []; const combinedResult = (([tone, label]) => (
          <DuplicateBadge key={label} label={label} tone={tone} />
        ))(combineValue); return [combinedResult] })}
    </>
  )
}

function DuplicateBadge({ label, tone }: { label: string; tone: BadgeTone }) {
  return (
    <span className={`${BADGE_CLASS} ${BADGE_TONE_CLASS[tone]}`}>
      {label}
    </span>
  )
}

function getDuplicateGroupSelectedCount(group: DuplicateGroupViewModel, selectedIds: Set<unknown>): number {
  return group.items.filter((item) => selectedIds.has(String(item.id))).length
}

function getDuplicateGroupItem(group: DuplicateGroupViewModel, bookmarkId: unknown): DuplicateBookmarkViewModel | null {
  const normalizedId = String(bookmarkId || '')
  return group.items.find((item) => String(item.id) === normalizedId) || null
}

function getDuplicateItemSelectionLabel(item: DuplicateBookmarkViewModel): string {
  const title = String(item?.title || displayUrl(item?.url) || '未命名书签')
    .replace(/\s+/g, ' ')
    .trim()
  const safeTitle = title.length > 48 ? `${title.slice(0, 47).trim()}...` : title
  const path = String(item?.path || '').replace(/\s+/g, ' ').trim()

  return path
    ? `移入回收站：${safeTitle || '未命名书签'}，位置：${path}`
    : `移入回收站：${safeTitle || '未命名书签'}`
}

function isBookmarkInCurrentDuplicateScope(item: DuplicateBookmarkViewModel, scopeFolderId: string): boolean {
  const normalizedScopeFolderId = String(scopeFolderId || '').trim()
  if (!normalizedScopeFolderId) {
    return false
  }

  const ancestorIds = Array.isArray(item.ancestorIds) ? item.ancestorIds.map((id) => String(id)) : []
  return String(item.parentId || '') === normalizedScopeFolderId || ancestorIds.includes(normalizedScopeFolderId)
}

function formatDuplicateDate(timestamp: unknown): string {
  const value = Number(timestamp)
  if (!Number.isFinite(value) || value <= 0) {
    return '未知时间'
  }

  return DUPLICATE_DATE_FORMATTER.format(value)
}
