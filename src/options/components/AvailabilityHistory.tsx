import type { ReactNode } from 'react'
import { displayUrl } from '../../shared/text.js'
import { Button } from '../../ui/base/Button'
import { cx } from '../../ui/base/utils'
import { handleHistoryControlAction } from '../options-controller'
import { formatDateTime } from '../shared-options/utils.js'
import { OPTION_VALUE_CLASS } from './option-layout-classes.js'
import { OptionEmptyState } from './OptionEmptyState.js'
import { useAvailabilityHistoryState } from './availability-history-store.js'
import type {
  AvailabilityHistoryControlsState,
  AvailabilityHistoryResultViewModel,
  AvailabilityHistoryRunViewModel
} from './availability-history-types.js'

const HISTORY_RESULTS_LIST_CLASS = 'mt-4 flex flex-col gap-3'
const HISTORY_HEADER_CLASS = 'flex flex-wrap items-center justify-between gap-3'
const HISTORY_HEADER_SPACED_CLASS = `${HISTORY_HEADER_CLASS} mt-[18px]`
const HISTORY_HEADER_COPY_CLASS = 'min-w-0'
const HISTORY_HEADER_TITLE_CLASS =
  'block text-[15px] font-semibold leading-normal tracking-[0] text-ds-text-primary'
const HISTORY_HEADER_SUBTITLE_CLASS =
  'mt-2 mb-0 text-[13px] leading-[1.55] text-ds-text-secondary'
const HISTORY_HEADER_ACTIONS_CLASS =
  'flex min-w-0 flex-wrap items-center justify-end gap-2.5 max-[760px]:items-start max-[760px]:justify-start'
const HISTORY_METRIC_GRID_CLASS =
  'mt-4 grid grid-cols-3 gap-x-5 gap-y-2 rounded-ds-sm border border-ds-border-subtle bg-ds-surface-1 px-4 py-2 max-[760px]:grid-cols-1'
const HISTORY_METRIC_ITEM_CLASS = 'flex items-baseline justify-between gap-3 border-b border-ds-border-subtle py-2 last:border-b-0'
const HISTORY_METRIC_LABEL_CLASS =
  'block text-xs font-medium leading-4 text-ds-text-secondary'
const HISTORY_METRIC_VALUE_CLASS =
  'text-sm font-semibold leading-none text-ds-text-primary tabular-nums'
const HISTORY_EMPTY_CLASS =
  'rounded-ds-sm border border-ds-border-subtle bg-ds-surface-1 p-[14px_16px] text-[13px] leading-[1.55] text-ds-text-secondary'
const HISTORY_CARD_CLASS =
  'rounded-ds-sm border border-ds-border-subtle bg-ds-surface-1 p-[13px_15px]'
const HISTORY_RUN_CARD_CLASS =
  'rounded-ds-sm border border-ds-border-subtle bg-ds-surface-1 p-[16px_16px_15px]'
const HISTORY_CARD_HEAD_CLASS =
  'flex min-w-0 items-start justify-between gap-3 max-[760px]:flex-col'
const HISTORY_CARD_HEAD_LEFT_CLASS =
  'flex min-w-0 flex-wrap items-center gap-2.5'
const HISTORY_CARD_COPY_CLASS = 'mt-3 min-w-0'
const HISTORY_CARD_TITLE_CLASS =
  'block min-w-0 text-[15px] font-semibold leading-[1.4] text-ds-text-primary [overflow-wrap:anywhere]'
const HISTORY_CARD_URL_CLASS =
  'mt-[7px] inline-block text-[13px] leading-[1.6] text-ds-text-secondary [overflow-wrap:anywhere] [word-break:break-word]'
const HISTORY_CARD_PATH_CLASS =
  'mt-[7px] mb-0 text-[13px] leading-[1.6] text-ds-text-disabled [overflow-wrap:anywhere] [word-break:break-word]'
const HISTORY_CARD_DETAIL_CLASS =
  'mt-[7px] text-[13px] leading-[1.6] text-ds-text-secondary [overflow-wrap:anywhere] [word-break:break-word]'
const HISTORY_RUN_TREND_CLASS = 'mb-3 grid gap-2.5'
const HISTORY_TREND_META_CLASS =
  'flex items-center justify-between gap-3 max-[760px]:flex-col max-[760px]:items-start'
const HISTORY_TREND_META_TITLE_CLASS =
  'text-sm font-semibold leading-normal text-ds-text-primary'
const HISTORY_TREND_META_COPY_CLASS =
  'text-[13px] leading-[1.65] text-ds-text-secondary'
const HISTORY_TREND_BAR_TRACK_CLASS =
  'h-[9px] overflow-hidden rounded-full bg-ds-surface-2'
const HISTORY_TREND_BAR_CLASS =
  'block h-full rounded-[inherit] bg-ds-accent'
const HISTORY_RUN_COPY_CLASS =
  'text-[13px] leading-[1.65] text-ds-text-secondary'
const HISTORY_RUN_SECTION_CLASS = 'mt-3'
const HISTORY_RUN_SECTION_TITLE_CLASS =
  'block text-[13px] font-semibold leading-normal text-ds-text-primary'
const HISTORY_RUN_LIST_CLASS =
  'mt-2 mb-0 pl-[18px] text-[13px] leading-[1.65] text-ds-text-secondary [&_li+li]:mt-1'
const HISTORY_BADGE_BASE_CLASS =
  'inline-flex min-h-6 max-w-full items-center justify-center rounded-full border px-2.5 text-xs font-semibold leading-none tracking-[0] [overflow-wrap:anywhere]'
const HISTORY_BADGE_TONE_CLASSES: Record<'muted' | 'success' | 'warning', string> = {
  muted: 'border-ds-hover bg-ds-surface-2 text-ds-text-muted',
  success: 'border-ds-success/35 bg-ds-success-soft text-ds-success-text',
  warning: 'border-ds-warning/35 bg-ds-warning-soft text-ds-warning'
}

function HistoryBadge({
  children,
  tone = 'muted'
}: {
  children: ReactNode
  tone?: keyof typeof HISTORY_BADGE_TONE_CLASSES
}) {
  return (
    <span className={cx(HISTORY_BADGE_BASE_CLASS, HISTORY_BADGE_TONE_CLASSES[tone])}>
      {children}
    </span>
  )
}

export function AvailabilityHistory() {
  const state = useAvailabilityHistoryState()
  const showLogList = !state.log.collapsed || state.log.runs.length === 0
  const hasHistory = state.log.runs.length > 0
  const hasRecovered = state.recovered.results.length > 0

  return (
    <>
      <AvailabilityHistoryControls state={state.controls} />
      {showLogList ? (
        <div className={HISTORY_RESULTS_LIST_CLASS}>
          <AvailabilityHistoryLogList
            emptyCopy={state.log.emptyCopy}
            maxAbnormalCount={state.log.maxAbnormalCount}
            runs={state.log.runs}
          />
        </div>
      ) : null}
      {hasHistory || hasRecovered ? (
        <>
          <div className={HISTORY_HEADER_SPACED_CLASS}>
            <div className={HISTORY_HEADER_COPY_CLASS}>
              <strong className={HISTORY_HEADER_TITLE_CLASS}>最近一次已恢复</strong>
              <p className={HISTORY_HEADER_SUBTITLE_CLASS}>展示上一轮后恢复的书签。</p>
            </div>
          </div>
          <div className={HISTORY_RESULTS_LIST_CLASS}>
            <RecoveredHistoryList
              emptyCopy={state.recovered.emptyCopy}
              results={state.recovered.results}
            />
          </div>
        </>
      ) : null}
    </>
  )
}

function AvailabilityHistoryControls({ state }: { state: AvailabilityHistoryControlsState }) {
  return (
    <>
      <div className={HISTORY_HEADER_CLASS}>
        <div className={HISTORY_HEADER_COPY_CLASS}>
          <strong className={HISTORY_HEADER_TITLE_CLASS}>检测历史</strong>
          <p className={HISTORY_HEADER_SUBTITLE_CLASS}>
            {state.subtitle}
          </p>
        </div>
        <div className={HISTORY_HEADER_ACTIONS_CLASS}>
          <span className={OPTION_VALUE_CLASS}>{state.timestamp}</span>
          {!state.clearDisabled ? (
            <Button
              size="sm"
              type="button"
              variant="secondary"
              aria-label="清空可用性检测历史日志"
              onClick={() => handleHistoryControlAction('clear-history')}
            >
              清空历史日志
            </Button>
          ) : null}
        </div>
      </div>
      <div className={HISTORY_METRIC_GRID_CLASS}>
        <div className={HISTORY_METRIC_ITEM_CLASS}>
          <span className={HISTORY_METRIC_LABEL_CLASS}>新增异常</span>
          <strong className={HISTORY_METRIC_VALUE_CLASS}>{state.metrics.newCount}</strong>
        </div>
        <div className={HISTORY_METRIC_ITEM_CLASS}>
          <span className={HISTORY_METRIC_LABEL_CLASS}>持续异常</span>
          <strong className={HISTORY_METRIC_VALUE_CLASS}>{state.metrics.persistentCount}</strong>
        </div>
        <div className={HISTORY_METRIC_ITEM_CLASS}>
          <span className={HISTORY_METRIC_LABEL_CLASS}>已恢复</span>
          <strong className={HISTORY_METRIC_VALUE_CLASS}>{state.metrics.recoveredCount}</strong>
        </div>
      </div>
      <div className={HISTORY_HEADER_SPACED_CLASS}>
        <div className={HISTORY_HEADER_COPY_CLASS}>
          <strong className={HISTORY_HEADER_TITLE_CLASS}>检测日志</strong>
          <p className={HISTORY_HEADER_SUBTITLE_CLASS}>查看异常变化、恢复结果和连续次数。</p>
        </div>
        <div className={HISTORY_HEADER_ACTIONS_CLASS}>
          <span className={OPTION_VALUE_CLASS}>{state.logCount} 次记录</span>
          {!state.logToggleDisabled ? (
            <Button
              size="sm"
              type="button"
              variant="secondary"
              onClick={() => handleHistoryControlAction('toggle-logs')}
            >
              {state.logToggleLabel}
            </Button>
          ) : null}
        </div>
      </div>
    </>
  )
}

function AvailabilityHistoryLogList({
  emptyCopy,
  maxAbnormalCount,
  runs
}: {
  emptyCopy: string
  maxAbnormalCount: number
  runs: AvailabilityHistoryRunViewModel[]
}) {
  if (!runs.length) {
    return (
      <OptionEmptyState
        title="还没有检测历史"
        description={`${emptyCopy} 完成一次检测后，这里会显示异常变化、恢复记录和趋势。`}
        actions={[{ action: 'run-availability', label: '去做可用性检测', variant: 'primary' }]}
      />
    )
  }

  return (
    <>
      {runs.map((run, index) => (
        <HistoryRunCard
          index={index}
          key={run.runId || String(run.completedAt)}
          maxAbnormalCount={maxAbnormalCount}
          run={run}
        />
      ))}
    </>
  )
}

function RecoveredHistoryList({
  emptyCopy,
  results
}: {
  emptyCopy: string
  results: AvailabilityHistoryResultViewModel[]
}) {
  if (!results.length) {
    return <div className={HISTORY_EMPTY_CLASS}>{emptyCopy}</div>
  }

  return (
    <>
      {results.map((result) => (
        <RecoveredResultCard key={result.id} result={result} />
      ))}
    </>
  )
}

function RecoveredResultCard({ result }: { result: AvailabilityHistoryResultViewModel }) {
  return (
    <article className={HISTORY_CARD_CLASS}>
      <div className={HISTORY_CARD_HEAD_CLASS}>
        <div className={HISTORY_CARD_HEAD_LEFT_CLASS}>
          <HistoryBadge tone="success">已恢复</HistoryBadge>
        </div>
      </div>
      <div className={HISTORY_CARD_COPY_CLASS}>
        <strong className={HISTORY_CARD_TITLE_CLASS}>{result.title || '未命名书签'}</strong>
        <div className={HISTORY_CARD_URL_CLASS}>{displayUrl(result.url)}</div>
        {result.streak ? (
          <div className={HISTORY_CARD_DETAIL_CLASS}>恢复前曾连续异常 {result.streak} 次</div>
        ) : null}
        <p className={HISTORY_CARD_PATH_CLASS} title={result.path || '未归档路径'}>
          {result.path || '未归档路径'}
        </p>
      </div>
    </article>
  )
}

function HistoryRunCard({
  index,
  maxAbnormalCount,
  run
}: {
  index: number
  maxAbnormalCount: number
  run: AvailabilityHistoryRunViewModel
}) {
  const newResults = Array.isArray(run.newResults) ? run.newResults : []
  const recoveredResults = Array.isArray(run.recoveredResults) ? run.recoveredResults : []
  const newResultIds = new Set(newResults.map((result) => String(result?.id || '')))
  const persistentResults = (Array.isArray(run.results) ? run.results : []).filter((result) => {
    return !newResultIds.has(String(result?.id || ''))
  })
  const topStreak = (run.results || []).length === 0
    ? 0
    : Math.max(...run.results.map((result) => Number(result.streak) || 1), 1)
  const runLabel = index === 0 ? '最近一次' : `第 ${index + 1} 次记录`
  const abnormalCount = Number(run.summary?.totalAbnormal) || 0
  const width = abnormalCount <= 0 ? 0 : Math.max(8, Math.round((abnormalCount / maxAbnormalCount) * 100))
  const scopeLabel = run.scope?.label || '全部书签'
  const newCount = Number(run.summary?.newCount) || 0
  const persistentCount = Number(run.summary?.persistentCount) || 0
  const recoveredCount = Number(run.summary?.recoveredCount) || 0
  const reviewCount = Number(run.summary?.reviewCount) || 0
  const failedCount = Number(run.summary?.failedCount) || 0

  return (
    <article className={HISTORY_RUN_CARD_CLASS}>
      <div className={HISTORY_CARD_HEAD_CLASS}>
        <div className={HISTORY_CARD_HEAD_LEFT_CLASS}>
          <HistoryBadge>{runLabel}</HistoryBadge>
          <HistoryBadge>{scopeLabel}</HistoryBadge>
          <HistoryBadge tone="warning">新增 {newCount}</HistoryBadge>
          <HistoryBadge>持续 {persistentCount}</HistoryBadge>
          <HistoryBadge tone="success">恢复 {recoveredCount}</HistoryBadge>
        </div>
        <span className={OPTION_VALUE_CLASS}>{formatDateTime(run.completedAt)}</span>
      </div>
      <div className={HISTORY_CARD_COPY_CLASS}>
        <div className={HISTORY_RUN_TREND_CLASS}>
          <div className={HISTORY_TREND_META_CLASS}>
            <strong className={HISTORY_TREND_META_TITLE_CLASS}>异常 {abnormalCount} 条</strong>
            <span className={HISTORY_TREND_META_COPY_CLASS}>低置信 {reviewCount} · 高置信 {failedCount}</span>
          </div>
          <div className={HISTORY_TREND_BAR_TRACK_CLASS} aria-hidden="true">
            <span className={HISTORY_TREND_BAR_CLASS} style={{ width: `${width}%` }} />
          </div>
          <div className={HISTORY_RUN_COPY_CLASS}>
            新增 {newCount} · 持续 {persistentCount} · 恢复 {recoveredCount}
          </div>
        </div>
        <div className={HISTORY_RUN_COPY_CLASS}>
          {topStreak > 0
            ? `最高连续 ${topStreak} 次 · ${scopeLabel}`
            : `本次无异常 · ${scopeLabel}`}
        </div>
        <HistoryRunResultSection
          emptyCopy="本次没有新增异常。"
          limit={6}
          moreCopy="条新增异常未展开。"
          results={newResults}
          showStreak
          title="本次新增异常"
        />
        <HistoryRunResultSection
          emptyCopy="本次没有持续异常。"
          limit={6}
          moreCopy="条持续异常未展开。"
          results={persistentResults}
          showStreak
          title="本次持续异常"
        />
        <HistoryRunResultSection
          emptyCopy="本次没有已恢复结果。"
          limit={4}
          moreCopy="条已恢复结果未展开。"
          results={recoveredResults}
          title="本次已恢复"
        />
      </div>
    </article>
  )
}

function HistoryRunResultSection({
  emptyCopy,
  limit,
  moreCopy,
  results,
  showStreak = false,
  title
}: {
  emptyCopy: string
  limit: number
  moreCopy: string
  results: AvailabilityHistoryResultViewModel[]
  showStreak?: boolean
  title: string
}) {
  const visibleResults = results.slice(0, limit)
  const hiddenCount = Math.max(0, results.length - visibleResults.length)

  return (
    <div className={HISTORY_RUN_SECTION_CLASS}>
      <strong className={HISTORY_RUN_SECTION_TITLE_CLASS}>{title}</strong>
      {visibleResults.length ? (
        <>
          <ul className={HISTORY_RUN_LIST_CLASS}>
            {visibleResults.map((result) => (
              <li key={result.id}>
                {result.title || '未命名书签'} · {displayUrl(result.url)}
                {showStreak ? ` · 连续异常 ${result.streak || 1} 次` : ''}
              </li>
            ))}
          </ul>
          {hiddenCount ? <p className={HISTORY_RUN_COPY_CLASS}>还有 {hiddenCount} {moreCopy}</p> : null}
        </>
      ) : (
        <p className={HISTORY_RUN_COPY_CLASS}>{emptyCopy}</p>
      )}
    </div>
  )
}
