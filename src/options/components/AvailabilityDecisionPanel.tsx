import type { ReactNode } from 'react'
import { StatusBusyLoadingLabel } from './LoadingLabel.js'
import { useMotionEntrance } from '../../ui/motion/useMotionEntrance'
import { useAvailabilityProgress } from './availability-overview-store.js'
import { OPTION_VALUE_CLASS } from './option-layout-classes.js'

const AVAILABILITY_DECISION_PANEL_CLASS =
  'mt-5 overflow-hidden rounded-ds-md border border-ds-border-subtle bg-ds-surface-1 p-[20px_22px] shadow-none max-[760px]:p-4'
const AVAILABILITY_DECISION_HEADER_CLASS =
  'flex min-w-0 items-start justify-between gap-3.5 max-[760px]:flex-col'
const AVAILABILITY_DECISION_HEADER_COPY_CLASS = 'min-w-0'
const AVAILABILITY_DECISION_TITLE_CLASS =
  'block [overflow-wrap:anywhere] text-[15px] font-[650] leading-normal tracking-[0] text-ds-text-primary'
const AVAILABILITY_DECISION_SUBTITLE_CLASS =
  'mt-[5px] mb-0 text-[13px] leading-[1.5] text-ds-text-secondary'
const AVAILABILITY_LABEL_CLASS =
  'block text-xs font-medium leading-4 text-ds-text-secondary'
const AVAILABILITY_PROGRESS_TRACK_CLASS =
  'mt-[14px] h-[7px] overflow-hidden rounded-none border border-ds-border-subtle bg-black'
const AVAILABILITY_PROGRESS_BAR_CLASS =
  'block h-full origin-left rounded-none bg-ds-accent-hover transition-transform duration-ds-fast ease-ds-standard motion-reduce:transition-none'
const AVAILABILITY_PROGRESS_ROW_CLASS =
  'mt-3 grid grid-cols-[minmax(128px,0.32fr)_minmax(0,1fr)] items-center gap-[14px] border-t border-t-[rgba(255,255,255,0.07)] pt-[11px] max-[760px]:grid-cols-1 max-[760px]:gap-2'
const AVAILABILITY_PROGRESS_META_TITLE_CLASS =
  'mt-[5px] block text-[15px] font-[650] leading-[1.3] text-ds-text-primary'
const AVAILABILITY_PROGRESS_COPY_CLASS =
  'mt-[7px] mb-0 text-[13px] leading-[1.5] text-ds-text-secondary'

export function AvailabilityDecisionPanel({ children }: { children: ReactNode }) {
  const state = useAvailabilityProgress()
  const hasMeaningfulStatus = Boolean(
    state.statusCopy &&
    state.statusCopy !== '仅检测适合外部访问的 http/https 书签；敏感地址会自动跳过。'
  )
  const hasRunSignal =
    state.busy ||
    state.durationLabel !== '未开始' ||
    state.progressValue > 0 ||
    hasMeaningfulStatus
  const emptyEntered = useMotionEntrance(!hasRunSignal)

  return (
    <div
      className={AVAILABILITY_DECISION_PANEL_CLASS}
      aria-busy={state.busy}
      aria-label="可用性检测决策概览"
    >
      <div className={AVAILABILITY_DECISION_HEADER_CLASS}>
        <div className={AVAILABILITY_DECISION_HEADER_COPY_CLASS}>
          <strong className={AVAILABILITY_DECISION_TITLE_CLASS}>检测概览</strong>
          <p className={AVAILABILITY_DECISION_SUBTITLE_CLASS}>确认失效后再移动、删除或忽略。</p>
        </div>
        <span className={OPTION_VALUE_CLASS}>{state.durationLabel}</span>
      </div>
      {hasRunSignal ? (
        <>
          <div className={AVAILABILITY_PROGRESS_ROW_CLASS}>
            <div>
              <span className={AVAILABILITY_LABEL_CLASS}>检测进度</span>
              <strong className={AVAILABILITY_PROGRESS_META_TITLE_CLASS}>
                {state.busy ? (
                  <StatusBusyLoadingLabel label={state.progressLabel} />
                ) : (
                  state.progressLabel
                )}
              </strong>
            </div>
            <div>
              <div
                className={AVAILABILITY_PROGRESS_TRACK_CLASS}
                aria-label="可用性检测进度"
                aria-valuemax={100}
                aria-valuemin={0}
                aria-valuenow={Math.max(0, Math.min(state.progressValue, 100))}
                role="progressbar"
              >
                <span
                  aria-hidden="true"
                  className={AVAILABILITY_PROGRESS_BAR_CLASS}
                  style={{ transform: `scaleX(${Math.max(0, Math.min(state.progressValue, 100)) / 100})` }}
                />
              </div>
              <p
                className={AVAILABILITY_PROGRESS_COPY_CLASS}
                aria-atomic="true"
                aria-live="polite"
                role="status"
              >
                {state.statusCopy}
              </p>
            </div>
          </div>
          {children}
        </>
      ) : (
        <div className={['t-stagger mt-4 border-t border-ds-border-subtle pt-4', emptyEntered ? 'is-shown' : ''].filter(Boolean).join(' ')}>
          <strong className="t-stagger-line t-stagger-line--1 block text-sm font-semibold text-ds-text-primary">
            尚未开始检测
          </strong>
          <p className="t-stagger-line t-stagger-line--2 mt-2 mb-0 text-[13px] leading-[1.65] text-ds-text-secondary">
            启动检测后，指标和结果筛选会在这里展开。
          </p>
        </div>
      )}
    </div>
  )
}
