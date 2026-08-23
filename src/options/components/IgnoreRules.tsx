import { displayUrl } from '../../shared/text.js'
import { Button } from '../../ui/base/Button'
import { useListExit } from '../../ui/motion/useListExit'
import { handleIgnoreRuleAction } from '../options-controller'
import { useIgnoreRulesState } from './ignore-rules-store.js'
import { OPTION_REVEAL_ENTER_CLASS } from './option-layout-classes.js'
import { OptionEmptyState } from './OptionEmptyState.js'
import type {
  IgnoreRuleKind,
  IgnoreRuleViewModel,
  IgnoreRulesSummaryState
} from './ignore-rules-types.js'

const ignoreSummaryMetrics = [
  { key: 'bookmarkCount', label: '书签规则' },
  { key: 'domainCount', label: '域名规则' },
  { key: 'folderCount', label: '文件夹规则' }
] satisfies Array<{
  key: keyof IgnoreRulesSummaryState
  label: string
}>

const IGNORE_SUMMARY_GRID_CLASS =
  'mt-5 grid grid-cols-[minmax(150px,0.65fr)_minmax(0,2fr)] gap-4 rounded-ds-sm border border-ds-border-subtle bg-ds-surface-1 p-4 max-[760px]:grid-cols-1'
const IGNORE_SUMMARY_PRIMARY_CLASS = 'grid content-center gap-1 border-r border-ds-border-subtle pr-4 max-[760px]:border-r-0 max-[760px]:border-b max-[760px]:pb-3 max-[760px]:pr-0'
const IGNORE_SUMMARY_LIST_CLASS = 'grid grid-cols-3 gap-x-5 gap-y-2 max-[620px]:grid-cols-1'
const IGNORE_SUMMARY_ITEM_CLASS = 'flex items-baseline justify-between gap-3 border-b border-ds-border-subtle py-1.5'
const IGNORE_SUMMARY_LABEL_CLASS =
  'block text-xs font-semibold leading-[1.3] text-ds-text-muted'
const IGNORE_SUMMARY_VALUE_CLASS =
  'text-sm font-semibold leading-none text-ds-text-primary tabular-nums'
const IGNORE_SUMMARY_PRIMARY_VALUE_CLASS = 'text-[28px] font-[650] leading-none tracking-[-0.03em] text-ds-text-primary tabular-nums'
const IGNORE_RULE_GROUP_CLASS =
  `mt-5 rounded-ds-md border border-ds-border-subtle bg-ds-surface-1 p-[18px_20px_20px] shadow-none ${OPTION_REVEAL_ENTER_CLASS} max-[760px]:p-4`
const IGNORE_RULE_HEADER_CLASS =
  'flex min-w-0 flex-wrap items-center justify-between gap-3'
const IGNORE_RULE_HEADER_COPY_CLASS = 'min-w-0'
const IGNORE_RULE_TITLE_CLASS =
  'block text-[15px] font-semibold leading-[1.35] tracking-[0] text-ds-text-primary'
const IGNORE_RULE_SUBTITLE_CLASS =
  'mt-2 text-[13px] leading-[1.7] text-ds-text-secondary'
const IGNORE_RULE_CLEAR_BUTTON_CLASS =
  'justify-center whitespace-nowrap max-[760px]:w-full'
const IGNORE_RULE_LIST_CLASS = 'mt-4 flex flex-col [--list-exit-gap:0.75rem]'
const IGNORE_RULE_EMPTY_CLASS =
  'rounded-ds-sm border border-ds-border-subtle bg-ds-surface-1 px-4 py-[18px] text-[13px] leading-[1.7] text-ds-text-secondary'
const IGNORE_RULE_CARD_CLASS =
  'rounded-ds-sm border border-ds-border-subtle bg-ds-surface-1 p-[14px_16px]'
const IGNORE_RULE_CARD_HEAD_CLASS =
  'flex min-w-0 items-start justify-between gap-3'
const IGNORE_RULE_ACTIONS_CLASS =
  'flex min-w-0 flex-none flex-wrap items-center justify-end gap-2.5'
const IGNORE_RULE_DELETE_BUTTON_CLASS =
  'border-0 bg-transparent p-0 font-[inherit] text-xs font-semibold text-ds-text-disabled transition-colors hover:text-ds-text-secondary focus-visible:rounded focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ds-focus'
const IGNORE_RULE_COPY_CLASS = 'min-w-0'
const IGNORE_RULE_COPY_TITLE_CLASS =
  'block min-w-0 overflow-hidden text-ellipsis whitespace-nowrap text-[15px] font-semibold leading-[1.35] text-ds-text-primary max-[760px]:whitespace-normal'
const IGNORE_RULE_DETAIL_CLASS =
  'mt-1 min-w-0 overflow-hidden text-ellipsis whitespace-nowrap text-[13px] leading-[1.55] text-ds-text-secondary max-[760px]:whitespace-normal'

export function IgnoreRules() {
  const state = useIgnoreRulesState()
  const summaryState: IgnoreRulesSummaryState = {
    bookmarkCount: state.bookmarks.length,
    domainCount: state.domains.length,
    folderCount: state.folders.length
  }
  const totalRules = summaryState.bookmarkCount + summaryState.domainCount + summaryState.folderCount
  const groups = [
    {
      clearLabel: '清空按书签忽略规则',
      detail: '仅压制指定书签本身的异常提示。',
      kind: 'bookmark',
      rules: state.bookmarks,
      title: '按书签忽略'
    },
    {
      clearLabel: '清空按域名忽略规则',
      detail: '同一域名下的异常提示会被压制。',
      kind: 'domain',
      rules: state.domains,
      title: '按域名忽略'
    },
    {
      clearLabel: '清空按文件夹忽略规则',
      detail: '命中该文件夹及其子层级的异常提示会被压制。',
      kind: 'folder',
      rules: state.folders,
      title: '按文件夹忽略'
    }
  ] satisfies Array<{
    clearLabel: string
    detail: string
    kind: IgnoreRuleKind
    rules: IgnoreRuleViewModel[]
    title: string
  }>

  return (
    <>
      <IgnoreRulesSummary state={summaryState} />
      {totalRules === 0 ? (
        <div className="mt-5">
          <OptionEmptyState
            title="当前没有忽略规则"
            description="忽略规则只能从可用性检测结果里添加。完成检测后，可在异常结果中按书签、域名或文件夹压制误报。"
            actions={[{ action: 'run-availability', label: '去做可用性检测', variant: 'primary' }]}
          />
        </div>
      ) : null}
      {groups.flatMap((combineValue, combineIndex, combineArray) => { if (!((group) => group.rules.length > 0)(combineValue)) return []; const combinedResult = ((group) => (
        <div className={IGNORE_RULE_GROUP_CLASS} key={group.kind}>
          <div className={IGNORE_RULE_HEADER_CLASS}>
            <div className={IGNORE_RULE_HEADER_COPY_CLASS}>
              <strong className={IGNORE_RULE_TITLE_CLASS}>{group.title}</strong>
              <p className={IGNORE_RULE_SUBTITLE_CLASS}>{group.detail}</p>
            </div>
            <Button
              className={IGNORE_RULE_CLEAR_BUTTON_CLASS}
              size="sm"
              type="button"
              variant="secondary"
              aria-label={group.clearLabel}
              onClick={() => handleIgnoreRuleAction({ action: 'clear', kind: group.kind })}
            >
              清空本类
            </Button>
          </div>
          <div className={IGNORE_RULE_LIST_CLASS}>
            <IgnoreRuleList kind={group.kind} rules={group.rules} />
          </div>
        </div>
      ))(combineValue); return [combinedResult] })}
    </>
  )
}

function IgnoreRulesSummary({ state }: { state: IgnoreRulesSummaryState }) {
  const total = state.bookmarkCount + state.domainCount + state.folderCount
  return (
    <div className={IGNORE_SUMMARY_GRID_CLASS}>
      <div className={IGNORE_SUMMARY_PRIMARY_CLASS}>
        <span className={IGNORE_SUMMARY_LABEL_CLASS}>规则总数</span>
        <strong className={IGNORE_SUMMARY_PRIMARY_VALUE_CLASS}>{total}</strong>
      </div>
      <dl className={IGNORE_SUMMARY_LIST_CLASS}>
        {ignoreSummaryMetrics.map((metric) => (
          <div className={IGNORE_SUMMARY_ITEM_CLASS} key={metric.key}>
            <dt className={IGNORE_SUMMARY_LABEL_CLASS}>{metric.label}</dt>
            <dd className={IGNORE_SUMMARY_VALUE_CLASS}>{state[metric.key]}</dd>
          </div>
        ))}
      </dl>
    </div>
  )
}

function IgnoreRuleList({
  kind,
  rules
}: {
  kind: IgnoreRuleKind
  rules: IgnoreRuleViewModel[]
}) {
  const sortedRules = rules
    .slice()
    .sort((left, right) => (Number(right.createdAt) || 0) - (Number(left.createdAt) || 0))
  const entries = useListExit(sortedRules, (rule) => `${kind}:${getIgnoreRuleId(rule, kind)}`)

  if (!rules.length && !entries.length) {
    return <div className={IGNORE_RULE_EMPTY_CLASS}>当前没有这类忽略规则。</div>
  }

  return (
    <>
      {entries.map((entry) => (
        <div className="t-list-exit" data-exiting={entry.exiting ? 'true' : 'false'} key={entry.key}>
          <div className="t-list-exit-inner">
            <IgnoreRuleCard kind={kind} rule={entry.item} />
          </div>
        </div>
      ))}
    </>
  )
}

function IgnoreRuleCard({
  kind,
  rule
}: {
  kind: IgnoreRuleKind
  rule: IgnoreRuleViewModel
}) {
  const title = getIgnoreRuleTitle(rule, kind)
  const detail = getIgnoreRuleDetail(rule, kind)
  const ruleId = getIgnoreRuleId(rule, kind)
  const deleteLabel = getIgnoreRuleActionLabel('删除忽略规则', rule, kind)

  return (
    <article className={IGNORE_RULE_CARD_CLASS}>
      <div className={IGNORE_RULE_CARD_HEAD_CLASS}>
        <div className={IGNORE_RULE_COPY_CLASS}>
          <strong className={IGNORE_RULE_COPY_TITLE_CLASS}>{title || '未命名规则'}</strong>
          {detail ? <div className={IGNORE_RULE_DETAIL_CLASS}>{detail}</div> : null}
        </div>
        <div className={IGNORE_RULE_ACTIONS_CLASS}>
          <Button
            className={IGNORE_RULE_DELETE_BUTTON_CLASS}
            type="button"
            aria-label={deleteLabel}
            onClick={() => handleIgnoreRuleAction({ action: 'remove', kind, ruleId })}
            unstyled
          >
            删除规则
          </Button>
        </div>
      </div>
    </article>
  )
}

function getIgnoreRuleTitle(rule: IgnoreRuleViewModel, kind: IgnoreRuleKind): string {
  if (kind === 'bookmark' && 'title' in rule) {
    return rule.title
  }
  if (kind === 'folder' && 'title' in rule) {
    return rule.title
  }
  if (kind === 'domain' && 'domain' in rule) {
    return rule.domain
  }
  return ''
}

function getIgnoreRuleDetail(rule: IgnoreRuleViewModel, kind: IgnoreRuleKind): string {
  if (kind === 'bookmark' && 'url' in rule) {
    return displayUrl(rule.url)
  }
  if (kind === 'folder' && 'path' in rule && 'title' in rule) {
    return rule.path || rule.title
  }
  return ''
}

function getIgnoreRuleId(rule: IgnoreRuleViewModel, kind: IgnoreRuleKind): string {
  if (kind === 'bookmark' && 'bookmarkId' in rule) {
    return rule.bookmarkId
  }
  if (kind === 'folder' && 'folderId' in rule) {
    return rule.folderId
  }
  if (kind === 'domain' && 'domain' in rule) {
    return rule.domain
  }
  return ''
}

function getIgnoreRuleActionLabel(
  action: string,
  rule: IgnoreRuleViewModel,
  kind: IgnoreRuleKind
): string {
  const title = kind === 'bookmark'
    ? getIgnoreRuleTitle(rule, kind) || getIgnoreRuleDetail(rule, kind)
    : kind === 'folder'
      ? getIgnoreRuleDetail(rule, kind) || getIgnoreRuleTitle(rule, kind)
      : getIgnoreRuleTitle(rule, kind)
  const normalizedTitle = String(title || '未命名规则')
    .replace(/\s+/g, ' ')
    .trim()
  const safeTitle = normalizedTitle.length > 48
    ? `${normalizedTitle.slice(0, 47).trim()}...`
    : normalizedTitle

  return `${action}：${safeTitle || '未命名规则'}`
}
