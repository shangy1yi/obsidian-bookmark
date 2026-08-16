export const SMART_LOADING_STEP_COUNT = 3

// 三段轨道按"真实耗时"而不是"阶段个数"分配：抓取网页几秒、AI 请求最久、本地匹配几乎瞬时。
// 等分成三个 33.3% 会把最慢的 AI 阶段压进 1/3 轨道，观感上就是全程卡在一个数字上不动。
export const SMART_LOADING_STAGE_STARTS = [0, 20, 86] as const
export const SMART_LOADING_PROGRESS_TARGETS = [20, 86, 100] as const

// 每段的时间常数：进度在 tau 内走完本段可用空间的 63%，2·tau 走完 86%。
// 取值贴近该阶段的常见耗时，让"进度速度"在整条轨道上大致恒定。
const SMART_LOADING_STAGE_EASE_TAU_MS = [2600, 9000, 520] as const
// 每段末尾留出的余量：缓动永远逼近而不触达段尾，真实回调回来时才有可见的前跃。
const SMART_LOADING_STAGE_HEADROOM_RATIO = 0.08

export const SMART_LOADING_PROGRESS_TICK_MS = 200
const SMART_LOADING_PROGRESS_TRANSITION_MS = 320
const SMART_LOADING_PROGRESS_SETTLE_MS = 120
// 收尾时从当前值缓动到 100%，避免最后一步直接瞬移。
export const SMART_LOADING_PROGRESS_FINISH_MS = 340
// 补满之后让 100% 停留一拍，用户能真的"看见"完成，再切到结果卡片。
export const SMART_LOADING_PROGRESS_SETTLE_HOLD_MS = 140
export const SMART_LOADING_PROGRESS_COMPLETE_MS =
  SMART_LOADING_PROGRESS_TRANSITION_MS + SMART_LOADING_PROGRESS_SETTLE_MS

export type SmartLoadingOrbState = 'searching' | 'solving' | 'shaping'

export function getSmartLoadingOrbState(rawStep: number): SmartLoadingOrbState {
  const step = normalizeSmartLoadingStep(rawStep)
  if (step === 1) {
    return 'searching'
  }
  if (step === 2) {
    return 'solving'
  }
  return 'shaping'
}

export function normalizeSmartLoadingStep(rawStep: number): number {
  const numericStep = Number(rawStep)
  const step = Number.isFinite(numericStep) ? Math.trunc(numericStep) : 1
  return Math.max(1, Math.min(step || 1, SMART_LOADING_STEP_COUNT))
}

function getSmartStageStart(rawStep: number): number {
  const step = normalizeSmartLoadingStep(rawStep)
  return SMART_LOADING_STAGE_STARTS[step - 1] ?? 0
}

export function getSmartProgressTarget(rawStep: number): number {
  const step = normalizeSmartLoadingStep(rawStep)
  return SMART_LOADING_PROGRESS_TARGETS[step - 1] ?? SMART_LOADING_PROGRESS_TARGETS[0]
}

// 本段缓动的渐近线。真实进度只会落在它和段尾之间，所以段尾永远留给"真的完成了"。
export function getSmartStageCeiling(rawStep: number): number {
  const step = normalizeSmartLoadingStep(rawStep)
  const stageStart = getSmartStageStart(step)
  const targetProgress = getSmartProgressTarget(step)
  return targetProgress - (targetProgress - stageStart) * SMART_LOADING_STAGE_HEADROOM_RATIO
}

export function getSmartDisplayProgress(rawProgress: number, rawStep: number): number {
  const step = normalizeSmartLoadingStep(rawStep)
  const stageStart = getSmartStageStart(step)
  const targetProgress = getSmartProgressTarget(step)
  const progress = normalizeSmartProgressValue(rawProgress)
  return Math.max(stageStart, Math.min(progress, targetProgress))
}

export function getSmartCheckpointProgress(rawStep: number, rawCheckpoint: number): number {
  const step = normalizeSmartLoadingStep(rawStep)
  const stageStart = getSmartStageStart(step)
  const targetProgress = getSmartProgressTarget(step)
  const checkpoint = normalizeSmartCheckpoint(rawCheckpoint)
  return stageStart + (targetProgress - stageStart) * checkpoint
}

/**
 * 指数逼近缓动：从上一个"真实进度点"（base）出发，随时间趋近本段渐近线。
 * 刚进入一段时推进最快（像是真的在干活），随后平滑减速，任何时刻都仍在前进，
 * 既不会停成死数字，也不会替 AI 许下它没完成的进度。
 */
export function getSmartEasedProgress(
  rawStep: number,
  rawBase: number,
  rawElapsedMs: number
): number {
  const step = normalizeSmartLoadingStep(rawStep)
  const ceiling = getSmartStageCeiling(step)
  const base = Math.max(getSmartStageStart(step), normalizeSmartProgressValue(rawBase))
  if (base >= ceiling) {
    return base
  }

  const numericElapsed = Number(rawElapsedMs)
  const elapsedMs = Number.isFinite(numericElapsed) ? Math.max(0, numericElapsed) : 0
  const tau = SMART_LOADING_STAGE_EASE_TAU_MS[step - 1] ?? SMART_LOADING_STAGE_EASE_TAU_MS[1]
  return base + (ceiling - base) * (1 - Math.exp(-elapsedMs / tau))
}

/** 收尾缓动：ease-out 地补完最后一截，替代"啪一下 100%"。 */
export function getSmartFinishProgress(rawFrom: number, rawRatio: number): number {
  const from = normalizeSmartProgressValue(rawFrom)
  const ratio = normalizeSmartCheckpoint(rawRatio)
  const eased = 1 - (1 - ratio) ** 3
  return from + (100 - from) * eased
}

function normalizeSmartProgressValue(value: number): number {
  const numericValue = Number(value)
  const progress = Number.isFinite(numericValue) ? numericValue : 0
  return Math.max(0, Math.min(progress, 100))
}

function normalizeSmartCheckpoint(value: number): number {
  const numericValue = Number(value)
  const checkpoint = Number.isFinite(numericValue) ? numericValue : 0
  return Math.max(0, Math.min(checkpoint, 1))
}
