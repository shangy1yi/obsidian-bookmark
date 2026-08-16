import {
  SMART_LOADING_PROGRESS_TARGETS,
  SMART_LOADING_STAGE_STARTS,
  getSmartCheckpointProgress,
  getSmartDisplayProgress,
  getSmartEasedProgress,
  getSmartFinishProgress,
  getSmartLoadingOrbState,
  getSmartProgressTarget,
  getSmartStageCeiling,
  normalizeSmartLoadingStep
} from './smart-loading-progress.js'

function run(): void {
  testDisplayProgressHonorsStageStart()
  testStagesAreWeightedByRealDuration()
  testCheckpointsMapWithinTheActiveStage()
  testAiStageMovesVisiblyInItsFirstSeconds()
  testEasingNeverLeavesTheActiveStage()
  testAiStageKeepsMovingForTheMaximumRequestTimeout()
  testFinishRampClosesTheLastGap()
  testLoadingStagesUseDistinctAiVisuals()
}

function testDisplayProgressHonorsStageStart(): void {
  assertClose(
    getSmartDisplayProgress(18, 2),
    SMART_LOADING_STAGE_STARTS[1],
    'step 2 display progress should start at the first divider'
  )
  assertClose(
    getSmartDisplayProgress(42, 3),
    SMART_LOADING_STAGE_STARTS[2],
    'step 3 display progress should start at the second divider'
  )
}

function testStagesAreWeightedByRealDuration(): void {
  const spans = SMART_LOADING_PROGRESS_TARGETS.map(
    (target, index) => target - SMART_LOADING_STAGE_STARTS[index]
  )
  assert(
    spans[1] > spans[0] + spans[2],
    'the AI request is the slowest stage and must own more than half the track'
  )
  assert(spans[0] > spans[2], 'fetching a page takes longer than matching folders locally')
  assertClose(SMART_LOADING_PROGRESS_TARGETS[2], 100, 'the last stage must end the track')
  assert(normalizeSmartLoadingStep(99) === 3, 'step should clamp to the last stage')
  assertClose(getSmartProgressTarget(2), SMART_LOADING_PROGRESS_TARGETS[1], 'step 2 target')
}

function testCheckpointsMapWithinTheActiveStage(): void {
  assertClose(
    getSmartCheckpointProgress(2, 0),
    SMART_LOADING_STAGE_STARTS[1],
    'step 2 should begin at its real stage boundary'
  )
  assertClose(getSmartCheckpointProgress(2, 1), SMART_LOADING_PROGRESS_TARGETS[1], 'step 2 target')
  assertClose(
    getSmartCheckpointProgress(2, 0.5),
    (SMART_LOADING_STAGE_STARTS[1] + SMART_LOADING_PROGRESS_TARGETS[1]) / 2,
    'step 2 midpoint'
  )
}

// 回归护栏：AI 阶段以前只靠固定步长爬行，前 5 秒几乎不动，观感就是"卡住了"。
function testAiStageMovesVisiblyInItsFirstSeconds(): void {
  const base = SMART_LOADING_STAGE_STARTS[1]
  const afterOneSecond = getSmartEasedProgress(2, base, 1000)
  const afterFiveSeconds = getSmartEasedProgress(2, base, 5000)
  assert(afterOneSecond - base >= 4, 'the AI stage must gain real ground in its first second')
  assert(afterFiveSeconds - base >= 20, 'the AI stage must be well underway after five seconds')
  assert(afterFiveSeconds > afterOneSecond, 'eased progress must be monotonic in elapsed time')
}

function testEasingNeverLeavesTheActiveStage(): void {
  for (let step = 1; step <= 3; step += 1) {
    const ceiling = getSmartStageCeiling(step)
    const target = getSmartProgressTarget(step)
    assert(ceiling < target, `step ${step} must keep headroom for the real completion`)
    assert(
      getSmartEasedProgress(step, SMART_LOADING_STAGE_STARTS[step - 1], 600000) <= ceiling + 0.001,
      `step ${step} easing must stay under its ceiling`
    )
  }
}

function testAiStageKeepsMovingForTheMaximumRequestTimeout(): void {
  const base = getSmartCheckpointProgress(2, 0.36)
  const atTwoMinutes = getSmartEasedProgress(2, base, 120000)
  const justAfter = getSmartEasedProgress(2, base, 121000)
  assert(justAfter > atTwoMinutes, 'AI progress should still be moving after a two-minute request')
  assert(justAfter < SMART_LOADING_PROGRESS_TARGETS[1], 'AI progress should not cross into the next stage')
}

// 回归护栏：结果就绪时以前直接把百分比写成 100，肉眼看到的是一次瞬移。
function testFinishRampClosesTheLastGap(): void {
  const from = 84
  assertClose(getSmartFinishProgress(from, 0), from, 'the finish ramp starts where the bar already is')
  assertClose(getSmartFinishProgress(from, 1), 100, 'the finish ramp must reach exactly 100')
  const midway = getSmartFinishProgress(from, 0.5)
  assert(midway > from && midway < 100, 'the finish ramp must pass through the gap instead of jumping it')
  assert(midway > (from + 100) / 2, 'the finish ramp should ease out, front-loading the remaining gap')
}

function testLoadingStagesUseDistinctAiVisuals(): void {
  assert(getSmartLoadingOrbState(1) === 'searching', 'content reading should use the searching orb')
  assert(getSmartLoadingOrbState(2) === 'solving', 'AI analysis should use the solving orb')
  assert(getSmartLoadingOrbState(3) === 'shaping', 'folder matching should use the shaping orb')
}

function assert(value: unknown, message: string): void {
  if (!value) {
    throw new Error(message)
  }
}

function assertClose(actual: number, expected: number, message: string): void {
  if (Math.abs(actual - expected) > 0.001) {
    throw new Error(`${message}: expected ${expected}, got ${actual}`)
  }
}

run()
console.log('Smart loading progress tests passed.')
