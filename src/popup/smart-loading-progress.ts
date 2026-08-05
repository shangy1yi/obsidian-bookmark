export const SMART_LOADING_STEP_COUNT = 3
export const SMART_LOADING_STAGE_STARTS = [0, 100 / 3, 200 / 3] as const
export const SMART_LOADING_PROGRESS_TARGETS = [100 / 3, 200 / 3, 100] as const
export const SMART_LOADING_PROGRESS_TICK_MS = 240
const SMART_LOADING_PROGRESS_CREEP_PER_TICK = 0.04
const SMART_LOADING_PROGRESS_TARGET_GAP = 0.2
const SMART_LOADING_PROGRESS_TRANSITION_MS = 320
const SMART_LOADING_PROGRESS_SETTLE_MS = 120
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

export function getNextSmartProgress(currentProgress: number, rawStep: number): number {
  const step = normalizeSmartLoadingStep(rawStep)
  const stageStart = getSmartStageStart(step)
  const targetProgress = getSmartProgressTarget(step)
  const current = Math.max(stageStart, Math.min(normalizeSmartProgressValue(currentProgress), targetProgress))
  const visualCeiling = Math.max(stageStart, targetProgress - SMART_LOADING_PROGRESS_TARGET_GAP)

  if (current >= visualCeiling) {
    return current
  }

  return Math.min(visualCeiling, current + SMART_LOADING_PROGRESS_CREEP_PER_TICK)
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
