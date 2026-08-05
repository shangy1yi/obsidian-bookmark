import { Button } from '../../ui/base/Button'
import { navigateToOptionsEmptyStateAction } from '../options-section-store.js'
import type { BookmarkAddHistoryEntry } from '../sections/bookmark-add-history.js'
import { BookmarkAddHistoryCard } from './BookmarkAddHistoryCard.js'

const EMPTY_STATE_CLASS =
  'grid gap-2 rounded-ds-sm border border-ds-border-subtle bg-ds-surface-1 p-[18px_20px] text-left text-[13px] leading-[1.55] text-ds-text-secondary'
const EMPTY_TITLE_CLASS =
  'm-0 text-sm font-bold leading-[1.4] text-ds-text-primary'
const EMPTY_DETAIL_CLASS =
  'm-0 text-xs leading-[1.5] text-ds-text-secondary'
const EMPTY_ACTIONS_CLASS = 'mt-1 flex flex-wrap gap-2'

export function BookmarkAddHistoryList({ entries }: { entries: BookmarkAddHistoryEntry[] }) {
  if (!entries.length) {
    return (
      <div className={EMPTY_STATE_CLASS}>
        <p className={EMPTY_TITLE_CLASS}>还没有 AI 整理记录</p>
        <p className={EMPTY_DETAIL_CLASS}>
          AI 自动整理完成后会记录新增书签的保存位置。
        </p>
        <div className={EMPTY_ACTIONS_CLASS}>
          <Button
            size="sm"
            type="button"
            variant="primary"
            onClick={() => navigateToOptionsEmptyStateAction('open-auto-analyze')}
          >
            开启自动分析
          </Button>
          <Button
            size="sm"
            type="button"
            variant="secondary"
            onClick={() => navigateToOptionsEmptyStateAction('configure-ai')}
          >
            配置 AI 渠道
          </Button>
        </div>
      </div>
    )
  }

  return (
    <>
      {entries.map((entry) => (
        <BookmarkAddHistoryCard entry={entry} key={entry.id} />
      ))}
    </>
  )
}
