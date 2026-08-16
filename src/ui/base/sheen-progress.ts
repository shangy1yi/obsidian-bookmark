import type { CSSProperties } from 'react'

/**
 * 流光进度条：popup 智能分类首创的样式，抽出来给可用性检测与批量智能分析复用。
 *
 * 两层分工：宽度（scaleX）说清真实进度，流光证明任务还在跑。
 * 流光只铺在已完成的那一截上，所以它永远不会替进度许下没发生的承诺。
 *
 * 注意：这里只提供“长什么样”。进度值怎么来是各自的事——
 * popup 面对不可知的 AI 耗时用指数缓动推算，可用性检测与批量分析有真实的
 * 已完成/总数，直接用真值，不要把缓动一起搬过去。
 */

export const SHEEN_PROGRESS_TRACK_CLASS = [
  'sheen-progress-track relative h-[6px] overflow-hidden rounded-full',
  'bg-ds-text-primary/[0.08] shadow-[inset_0_0_0_1px_rgba(255,255,255,0.03)]'
].join(' ')

export const SHEEN_PROGRESS_BAR_CLASS = [
  'sheen-progress-bar relative block h-full overflow-hidden rounded-[inherit]',
  'origin-left bg-[rgba(237,237,237,0.86)]',
  'shadow-[inset_0_1px_0_rgba(255,255,255,0.34)]',
  'transition-transform duration-[320ms] ease-linear will-change-transform motion-reduce:transition-none'
].join(' ')

export function normalizeSheenProgressPercent(value: number): number {
  const numericValue = Number(value)
  const percent = Number.isFinite(numericValue) ? numericValue : 0
  return Math.max(0, Math.min(percent, 100))
}

/** 轨道侧变量：流光的 clip-path 用它裁出「已完成」区间。 */
export function getSheenProgressTrackStyle(percent: number): CSSProperties {
  return {
    '--sheen-progress-fill': `${normalizeSheenProgressPercent(percent)}%`
  } as CSSProperties
}

/** 填充侧样式：用 scaleX 而不是 width，避免每帧触发布局。 */
export function getSheenProgressBarStyle(percent: number): CSSProperties {
  const scale = normalizeSheenProgressPercent(percent) / 100
  return {
    width: '100%',
    transform: `scaleX(${scale})`,
    transformOrigin: 'left center',
    '--sheen-progress-scale': scale
  } as CSSProperties
}
