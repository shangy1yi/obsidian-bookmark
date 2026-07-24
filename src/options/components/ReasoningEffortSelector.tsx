import { ChevronDownIcon, ChevronRightIcon, ZapIcon } from 'lucide-react'
import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState
} from 'react'
import { prefersReducedMotion } from '../../shared/motion'
import { Popover } from '../../ui/base/Popover'
import { cx } from '../../ui/base/utils'
import { OPTIONS_REDUCED_MOTION_SURFACE_CLASS } from './options-motion-classes.js'

/**
 * React adaptation of zanwei/chatgpt-model-selector (MIT). The interaction
 * model is preserved while tiers remain dynamic so each provider can expose
 * only the reasoning levels its current model actually supports.
 */

export interface ReasoningEffortLevel {
  id: string
  label: string
  hint?: string
}

export interface ReasoningEffortSelectorProps {
  levels: ReasoningEffortLevel[]
  value: string
  onChange: (id: string) => void
  disabled?: boolean
  direction?: 'up' | 'down'
  ariaLabel?: string
  modelName?: string
}

interface TrackMetrics {
  rect: DOMRect
  width: number
  span: number
}

type SelectorView = 'menu' | 'advanced'

const FALLBACK_LEVEL: ReasoningEffortLevel = { id: 'default', label: '—' }
const FALLBACK_LEVELS: ReasoningEffortLevel[] = [FALLBACK_LEVEL]
const KNOB_DIAMETER_PX = 34
const SPRING_STIFFNESS = 900
const SPRING_DAMPING = 42
const VELOCITY_WINDOW_MS = 90
const VELOCITY_MAX = 2.2

const PANEL_CLASS = cx(
  'reasoning-effort-popover !block !w-[var(--anchor-width)] !min-w-0 !max-w-[calc(100vw-24px)] !overflow-hidden !rounded-ds-lg !border-ds-border !bg-ds-surface-2 !p-0',
  '[filter:var(--ds-filter-popover)]',
  OPTIONS_REDUCED_MOTION_SURFACE_CLASS
)

const TRIGGER_CLASS = cx(
  'reasoning-effort-trigger group relative inline-flex min-h-[50px] w-full min-w-0 touch-manipulation select-none items-center rounded-ds-sm border border-ds-border bg-ds-surface-2 px-3.5 text-sm text-ds-text-primary outline-none',
  'transition-[background-color,border-color,transform] duration-ds-fast ease-ds-standard',
  'hover:not-disabled:border-ds-border-hover hover:not-disabled:bg-ds-surface-3 active:not-disabled:scale-[var(--ds-press-scale)]',
  'focus-visible:border-ds-focus focus-visible:bg-ds-surface-3 focus-visible:shadow-ds-focus',
  'disabled:cursor-not-allowed disabled:opacity-60 motion-reduce:transition-colors motion-reduce:duration-[80ms] motion-reduce:active:not-disabled:scale-100'
)

const VIEW_TRACK_CLASS = cx(
  'reasoning-selector-view-track grid min-w-0',
  'transition-[grid-template-rows,opacity,transform] duration-[260ms] ease-[var(--ease-smooth-out)]'
)

const MENU_ROW_CLASS =
  'reasoning-selector-menu-row grid min-h-9 min-w-0 grid-cols-[auto_minmax(0,1fr)] items-center gap-3 rounded-ds-sm px-3 text-sm'

const HEADER_LAYER_CLASS = cx(
  'absolute inset-0 flex items-center opacity-0 translate-y-[3px] pointer-events-none',
  'transition-[opacity,transform] duration-[200ms] ease-[var(--ease-smooth-out)]',
  'data-[active=true]:translate-y-0 data-[active=true]:opacity-100 data-[active=true]:pointer-events-auto'
)

const SLIDER_CLASS = cx(
  'reasoning-effort-slider relative h-[42px] touch-none select-none cursor-grab outline-none',
  'data-[dragging=true]:cursor-grabbing',
  'focus-visible:after:pointer-events-none focus-visible:after:absolute focus-visible:after:inset-[-4px] focus-visible:after:rounded-full focus-visible:after:border-2 focus-visible:after:border-ds-focus'
)

const KNOB_CLASS = cx(
  'reasoning-effort-knob absolute left-0 top-1/2 z-20 size-[34px] -translate-y-1/2 rounded-full border border-[rgba(255,255,255,0.18)] bg-ds-text-primary',
  'shadow-[0_1px_2px_rgba(6,9,14,0.35),0_2px_6px_rgba(6,9,14,0.24)]',
  'before:absolute before:inset-0 before:rounded-full before:shadow-[0_2px_3px_rgba(6,9,14,0.28),0_4px_10px_rgba(6,9,14,0.3)] before:opacity-0 before:transition-opacity before:duration-ds-fast',
  'data-[dragging=true]:[scale:1.04] data-[dragging=true]:before:opacity-100',
  'transition-[scale] duration-ds-fast ease-ds-standard motion-reduce:transition-none'
)

export function ReasoningEffortSelector({
  levels,
  value,
  onChange,
  disabled = false,
  direction = 'down',
  ariaLabel = '推理强度',
  modelName = '当前模型'
}: ReasoningEffortSelectorProps) {
  const panelId = useId()
  const sliderDescriptionId = useId()
  const resolvedLevels = levels.length ? levels : FALLBACK_LEVELS
  const maxIndex = Math.max(0, resolvedLevels.length - 1)
  const valueIndex = Math.max(0, resolvedLevels.findIndex((level) => level.id === value))
  const [open, setOpen] = useState(false)
  const [view, setView] = useState<SelectorView>('menu')
  const [previewIndex, setPreviewIndex] = useState(valueIndex)
  const [dragging, setDragging] = useState(false)
  const [hoveringSlider, setHoveringSlider] = useState(false)

  const advancedButtonRef = useRef<HTMLButtonElement | null>(null)
  const tierLabelRef = useRef<HTMLSpanElement | null>(null)
  const sliderRef = useRef<HTMLDivElement | null>(null)
  const trackRef = useRef<HTMLDivElement | null>(null)
  const fillRef = useRef<HTMLDivElement | null>(null)
  const knobRef = useRef<HTMLDivElement | null>(null)
  const previewIndexRef = useRef(valueIndex)
  const positionRef = useRef(maxIndex > 0 ? valueIndex / maxIndex : 0)
  const draggingRef = useRef(false)
  const activePointerRef = useRef<number | null>(null)
  const trackMetricsRef = useRef<TrackMetrics | null>(null)
  const samplesRef = useRef<Array<{ time: number; value: number }>>([])
  const springFrameRef = useRef(0)
  const previousAnimatedIndexRef = useRef(valueIndex)

  const safePreviewIndex = Math.min(maxIndex, Math.max(0, previewIndex))
  const currentLevel = resolvedLevels[safePreviewIndex] ?? resolvedLevels[0]
  const isHighestLevel = maxIndex > 0 && safePreviewIndex === maxIndex
  const widestLabel = useMemo(
    () => resolvedLevels.reduce(
      (widest, level) => (level.label.length > widest.length ? level.label : widest),
      ''
    ),
    [resolvedLevels]
  )
  const speedLabel = getSpeedLabel(currentLevel?.id, safePreviewIndex, maxIndex)

  const readTrackMetrics = useCallback((): TrackMetrics | null => {
    const track = trackRef.current
    if (!track) {
      return null
    }
    const rect = track.getBoundingClientRect()
    const width = track.clientWidth
    return {
      rect,
      width,
      span: Math.max(0, width - KNOB_DIAMETER_PX)
    }
  }, [])

  const updatePreviewIndex = useCallback((index: number) => {
    const nextIndex = Math.min(maxIndex, Math.max(0, index))
    if (previewIndexRef.current === nextIndex) {
      return
    }
    previewIndexRef.current = nextIndex
    setPreviewIndex(nextIndex)
  }, [maxIndex])

  const updateVisualProgress = useCallback((nextProgress: number, updatePreview = true) => {
    const progress = Math.min(1, Math.max(0, nextProgress))
    positionRef.current = progress
    const metrics = trackMetricsRef.current ?? readTrackMetrics()
    if (metrics) {
      trackMetricsRef.current = metrics
      const knobOffset = progress * metrics.span
      const fillWidth = KNOB_DIAMETER_PX + progress * metrics.span
      if (knobRef.current) {
        knobRef.current.style.transform = `translate3d(${knobOffset}px, 0, 0)`
      }
      if (fillRef.current) {
        const clippedRight = Math.max(0, metrics.width - fillWidth)
        fillRef.current.style.clipPath = `inset(0 ${clippedRight}px 0 0 round 9999px)`
      }
    }
    sliderRef.current?.style.setProperty('--reasoning-progress', String(progress))
    if (updatePreview) {
      updatePreviewIndex(maxIndex > 0 ? Math.round(progress * maxIndex) : 0)
    }
  }, [maxIndex, readTrackMetrics, updatePreviewIndex])

  const cancelSpring = useCallback(() => {
    window.cancelAnimationFrame(springFrameRef.current)
    springFrameRef.current = 0
  }, [])

  const commitLevel = useCallback((index: number) => {
    const level = resolvedLevels[Math.min(maxIndex, Math.max(0, index))]
    if (level && level.id !== value) {
      onChange(level.id)
    }
  }, [maxIndex, onChange, resolvedLevels, value])

  const startSpring = useCallback((targetIndex: number, initialVelocity: number) => {
    cancelSpring()
    const targetProgress = maxIndex > 0 ? targetIndex / maxIndex : 0
    const settle = () => {
      updateVisualProgress(targetProgress)
      springFrameRef.current = 0
    }
    if (prefersReducedMotion() || Math.abs(positionRef.current - targetProgress) < 0.001) {
      settle()
      return
    }

    let springPosition = positionRef.current
    let velocity = Math.max(-VELOCITY_MAX, Math.min(VELOCITY_MAX, initialVelocity))
    let previousTime = performance.now()
    const step = (time: number) => {
      const delta = Math.min((time - previousTime) / 1000, 0.032)
      previousTime = time
      const acceleration = -SPRING_STIFFNESS * (springPosition - targetProgress) - SPRING_DAMPING * velocity
      velocity += acceleration * delta
      springPosition = Math.min(1, Math.max(0, springPosition + velocity * delta))
      updateVisualProgress(springPosition)
      if (Math.abs(springPosition - targetProgress) < 0.001 && Math.abs(velocity) < 0.01) {
        settle()
        return
      }
      springFrameRef.current = window.requestAnimationFrame(step)
    }
    springFrameRef.current = window.requestAnimationFrame(step)
  }, [cancelSpring, maxIndex, updateVisualProgress])

  const progressFromPointer = useCallback((clientX: number) => {
    const metrics = trackMetricsRef.current ?? readTrackMetrics()
    if (!metrics || metrics.width <= KNOB_DIAMETER_PX) {
      return positionRef.current
    }
    trackMetricsRef.current = metrics
    const fraction = (clientX - metrics.rect.left) / metrics.rect.width
    return Math.min(1, Math.max(0, (fraction * metrics.width - KNOB_DIAMETER_PX / 2) / metrics.span))
  }, [readTrackMetrics])

  const handlePointerDown = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    if (disabled || event.button !== 0 || activePointerRef.current !== null) {
      return
    }
    event.preventDefault()
    cancelSpring()
    activePointerRef.current = event.pointerId
    draggingRef.current = true
    setDragging(true)
    samplesRef.current = []
    trackMetricsRef.current = readTrackMetrics()
    event.currentTarget.setPointerCapture(event.pointerId)
    event.currentTarget.focus({ preventScroll: true })
    const progress = progressFromPointer(event.clientX)
    samplesRef.current.push({ time: performance.now(), value: progress })
    updateVisualProgress(progress)
  }, [cancelSpring, disabled, progressFromPointer, readTrackMetrics, updateVisualProgress])

  const handlePointerMove = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    if (!draggingRef.current || activePointerRef.current !== event.pointerId) {
      return
    }
    const progress = progressFromPointer(event.clientX)
    const now = performance.now()
    samplesRef.current.push({ time: now, value: progress })
    samplesRef.current = samplesRef.current
      .filter((sample) => now - sample.time <= VELOCITY_WINDOW_MS)
      .slice(-5)
    updateVisualProgress(progress)
  }, [progressFromPointer, updateVisualProgress])

  const handlePointerRelease = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    if (!draggingRef.current || activePointerRef.current !== event.pointerId) {
      return
    }
    draggingRef.current = false
    activePointerRef.current = null
    setDragging(false)
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }
    const samples = samplesRef.current
    let velocity = 0
    if (samples.length >= 2) {
      const first = samples[0]
      const last = samples[samples.length - 1]
      const elapsed = (last.time - first.time) / 1000
      if (elapsed > 0) {
        velocity = (last.value - first.value) / elapsed
      }
    }
    const targetIndex = maxIndex > 0 ? Math.round(positionRef.current * maxIndex) : 0
    // 语义状态在指针释放时立即提交；弹簧只负责随后跟手的视觉收尾。
    // 这样用户马上点击“保存/测试连接”时，请求不会仍读取上一个强度。
    commitLevel(targetIndex)
    startSpring(targetIndex, velocity)
  }, [commitLevel, maxIndex, startSpring])

  const handleSliderKeyDown = useCallback((event: React.KeyboardEvent<HTMLDivElement>) => {
    if (disabled) {
      return
    }
    const currentIndex = previewIndexRef.current
    const nextIndexByKey: Record<string, number> = {
      ArrowRight: currentIndex + 1,
      ArrowUp: currentIndex + 1,
      PageUp: currentIndex + 1,
      ArrowLeft: currentIndex - 1,
      ArrowDown: currentIndex - 1,
      PageDown: currentIndex - 1,
      Home: 0,
      End: maxIndex
    }
    const nextIndex = nextIndexByKey[event.key]
    if (nextIndex === undefined) {
      return
    }
    event.preventDefault()
    cancelSpring()
    const clampedIndex = Math.min(maxIndex, Math.max(0, nextIndex))
    updateVisualProgress(maxIndex > 0 ? clampedIndex / maxIndex : 0)
    commitLevel(clampedIndex)
  }, [cancelSpring, commitLevel, disabled, maxIndex, updateVisualProgress])

  useLayoutEffect(() => {
    trackMetricsRef.current = readTrackMetrics()
    updateVisualProgress(positionRef.current)
  }, [open, readTrackMetrics, updateVisualProgress, view])

  useEffect(() => {
    if (draggingRef.current || springFrameRef.current) {
      return
    }
    const nextIndex = Math.min(maxIndex, Math.max(0, valueIndex))
    previewIndexRef.current = nextIndex
    setPreviewIndex(nextIndex)
    updateVisualProgress(maxIndex > 0 ? nextIndex / maxIndex : 0, false)
  }, [maxIndex, updateVisualProgress, valueIndex])

  useLayoutEffect(() => {
    if (previousAnimatedIndexRef.current === safePreviewIndex) {
      return
    }
    previousAnimatedIndexRef.current = safePreviewIndex
    const label = tierLabelRef.current
    if (!label || prefersReducedMotion() || !label.animate) {
      return
    }
    label.getAnimations().forEach((animation) => animation.cancel())
    label.animate(
      [
        { opacity: 0, transform: 'translateY(3px)' },
        { opacity: 1, transform: 'translateY(0)' }
      ],
      { duration: 130, easing: 'cubic-bezier(0.22, 1, 0.36, 1)' }
    )
  }, [safePreviewIndex])

  useEffect(() => {
    if (!open) {
      return undefined
    }
    const focusFrame = window.requestAnimationFrame(() => {
      if (view === 'advanced') {
        sliderRef.current?.focus({ preventScroll: true })
      } else {
        advancedButtonRef.current?.focus({ preventScroll: true })
      }
    })
    return () => window.cancelAnimationFrame(focusFrame)
  }, [open, view])

  useEffect(() => {
    const track = trackRef.current
    if (!track || typeof ResizeObserver === 'undefined') {
      return undefined
    }
    const observer = new ResizeObserver(() => {
      trackMetricsRef.current = readTrackMetrics()
      updateVisualProgress(positionRef.current, false)
    })
    observer.observe(track)
    return () => observer.disconnect()
  }, [readTrackMetrics, updateVisualProgress])

  useEffect(() => () => {
    cancelSpring()
  }, [cancelSpring])

  const handleOpenChange = (nextOpen: boolean) => {
    if (disabled && nextOpen) {
      return
    }
    if (nextOpen) {
      setView('menu')
      setHoveringSlider(false)
    } else {
      draggingRef.current = false
      activePointerRef.current = null
      setDragging(false)
    }
    setOpen(nextOpen)
  }

  const showHoverLabels = !isHighestLevel && (hoveringSlider || dragging)
  const showDefaultHeader = !isHighestLevel && !showHoverLabels

  const trigger = (
    <button
      type="button"
      className={TRIGGER_CLASS}
      aria-label={`${ariaLabel}：${currentLevel?.label ?? '—'}；模型：${modelName}`}
      disabled={disabled}
    >
      <ZapIcon className="mr-2 size-3.5 flex-none fill-current text-ds-text-primary" aria-hidden="true" />
      <span className="min-w-0 flex-1 truncate text-left font-semibold">{modelName}</span>
      <span className="ml-2 inline-grid flex-none font-normal text-ds-text-secondary">
        <span className="invisible col-start-1 row-start-1 whitespace-nowrap" aria-hidden="true">{widestLabel}</span>
        <span
          className={cx(
            'col-start-1 row-start-1 whitespace-nowrap text-right',
            isHighestLevel ? 'text-[#c472fb]' : ''
          )}
          ref={tierLabelRef}
        >
          {currentLevel?.label ?? '—'}
        </span>
      </span>
      <ChevronDownIcon
        className="ml-2 size-3.5 flex-none text-ds-text-muted transition-transform duration-ds-standard ease-ds-standard group-aria-expanded:rotate-180 motion-reduce:transition-none"
        aria-hidden="true"
      />
    </button>
  )

  return (
    <Popover
      id={panelId}
      align="start"
      side={direction === 'up' ? 'top' : 'bottom'}
      sideOffset={8}
      showArrow={false}
      collisionPadding={12}
      open={open}
      onOpenChange={handleOpenChange}
      popupClassName={PANEL_CLASS}
      trigger={trigger}
      triggerNativeButton
    >
      <div className="min-w-0" data-selector-view={view}>
        <div
          className={VIEW_TRACK_CLASS}
          style={{
            gridTemplateRows: view === 'menu' ? '1fr' : '0fr',
            opacity: view === 'menu' ? 1 : 0,
            pointerEvents: view === 'menu' ? 'auto' : 'none',
            transform: `translate3d(${view === 'menu' ? 0 : -10}px, 0, 0)`
          }}
          aria-hidden={view !== 'menu'}
          inert={view !== 'menu'}
        >
          <div className="min-h-0 overflow-hidden">
            <div
              className="reasoning-selector-menu p-[8px_8px_6px]"
              data-stagger={open && view === 'menu'}
            >
              <div className={MENU_ROW_CLASS}>
                <span className="font-semibold text-ds-text-primary">模型</span>
                <span className="min-w-0 truncate text-right text-ds-text-secondary">{modelName}</span>
              </div>
              <div className={MENU_ROW_CLASS}>
                <span className="font-semibold text-ds-text-primary">推理强度</span>
                <span className={cx('text-right text-ds-text-secondary', isHighestLevel ? 'text-[#c472fb]' : '')}>
                  {currentLevel?.label ?? '—'}
                </span>
              </div>
              <div className={MENU_ROW_CLASS}>
                <span className="font-semibold text-ds-text-primary">响应速度</span>
                <span className="text-right text-ds-text-secondary">{speedLabel}</span>
              </div>
              <hr className="mx-1 my-[5px] h-px border-0 bg-ds-border-subtle" />
              <div className="reasoning-selector-menu-action-wrap">
                <button
                  ref={advancedButtonRef}
                  type="button"
                  className="inline-flex min-h-8 items-center gap-1 rounded-ds-sm px-3 text-sm text-ds-text-secondary outline-none transition-colors duration-ds-fast hover:bg-ds-hover hover:text-ds-text-primary focus-visible:bg-ds-hover focus-visible:text-ds-text-primary focus-visible:shadow-ds-focus motion-reduce:transition-none"
                  onClick={() => setView('advanced')}
                >
                  高级设置
                  <ChevronDownIcon className="size-3" aria-hidden="true" />
                </button>
              </div>
            </div>
          </div>
        </div>

        <div
          className={VIEW_TRACK_CLASS}
          style={{
            gridTemplateRows: view === 'advanced' ? '1fr' : '0fr',
            opacity: view === 'advanced' ? 1 : 0,
            pointerEvents: view === 'advanced' ? 'auto' : 'none',
            transform: `translate3d(${view === 'advanced' ? 0 : 10}px, 0, 0)`
          }}
          aria-hidden={view !== 'advanced'}
          inert={view !== 'advanced'}
        >
          <div className="min-h-0 overflow-hidden">
            <div className="px-4 pb-[15px] pt-[13px]">
              <div className="relative mb-[13px] h-8">
                <div
                  className={cx(HEADER_LAYER_CLASS, 'justify-between')}
                  data-active={showDefaultHeader}
                  aria-hidden={!showDefaultHeader}
                  inert={!showDefaultHeader}
                >
                  <button
                    type="button"
                    className="-ml-2 inline-flex min-h-8 items-center gap-1 rounded-ds-sm px-2 text-sm text-ds-text-secondary outline-none transition-colors duration-ds-fast hover:bg-ds-hover hover:text-ds-text-primary focus-visible:bg-ds-hover focus-visible:text-ds-text-primary focus-visible:shadow-ds-focus motion-reduce:transition-none"
                    onClick={() => setView('menu')}
                  >
                    高级设置
                    <ChevronRightIcon className="size-3 text-ds-text-muted" aria-hidden="true" />
                  </button>
                  <ZapIcon className="size-4 fill-current text-[#47a8ff]" aria-hidden="true" />
                </div>
                <div
                  className={cx(HEADER_LAYER_CLASS, 'justify-between')}
                  data-active={showHoverLabels}
                  aria-hidden={!showHoverLabels}
                  inert={!showHoverLabels}
                >
                  <span className="text-sm text-ds-text-secondary">更快</span>
                  <span className="text-sm text-ds-text-secondary">更深入</span>
                </div>
                <div
                  className={cx(HEADER_LAYER_CLASS, 'justify-center')}
                  data-active={isHighestLevel}
                  aria-hidden={!isHighestLevel}
                  inert={!isHighestLevel}
                >
                  <span className="text-sm font-semibold text-[#c472fb]">消耗更多用量</span>
                </div>
              </div>

              <div
                className={SLIDER_CLASS}
                ref={sliderRef}
                role="slider"
                tabIndex={disabled ? -1 : 0}
                aria-label={ariaLabel}
                aria-describedby={sliderDescriptionId}
                aria-valuemin={0}
                aria-valuemax={maxIndex}
                aria-valuenow={safePreviewIndex}
                aria-valuetext={currentLevel?.hint
                  ? `${currentLevel.label} — ${currentLevel.hint}`
                  : currentLevel?.label ?? '—'}
                aria-orientation="horizontal"
                data-dragging={dragging}
                data-highest={isHighestLevel}
                onPointerEnter={() => setHoveringSlider(true)}
                onPointerLeave={() => setHoveringSlider(false)}
                onPointerDown={handlePointerDown}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerRelease}
                onPointerCancel={handlePointerRelease}
                onKeyDown={handleSliderKeyDown}
              >
                <span className="sr-only" id={sliderDescriptionId}>
                  向左获得更快响应，向右获得更深入推理。
                </span>
                <div
                  className="reasoning-effort-track absolute inset-x-0 top-1/2 h-7 -translate-y-1/2 overflow-hidden rounded-full bg-ds-surface-3 shadow-[inset_0_1px_1px_rgba(6,9,14,0.22)]"
                  ref={trackRef}
                  aria-hidden="true"
                >
                  <div className="absolute inset-0 z-0">
                    {resolvedLevels.map((level, index) => (
                      <span
                        key={level.id}
                        className="absolute top-1/2 size-[5px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-ds-text-muted"
                        style={{
                          left: getTickPosition(index, maxIndex)
                        }}
                      />
                    ))}
                  </div>
                  <div
                    ref={fillRef}
                    className="absolute inset-0 z-10 overflow-hidden rounded-full bg-[#006efe] after:pointer-events-none after:absolute after:inset-0 after:z-0 after:bg-[linear-gradient(90deg,#006efe_0%,#9440d5_68%,#c472fb_100%)] after:opacity-0 after:transition-opacity after:duration-[300ms] after:ease-[var(--ease-smooth-out)] data-[highest=true]:after:opacity-100 motion-reduce:after:transition-none"
                    data-highest={isHighestLevel}
                  />
                </div>
                <div
                  className={KNOB_CLASS}
                  ref={knobRef}
                  data-dragging={dragging}
                  aria-hidden="true"
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </Popover>
  )
}

function getSpeedLabel(id: string | undefined, index: number, maxIndex: number): string {
  if (id === 'medium' || id === 'default') {
    return '均衡'
  }
  if (id === 'none' || id === 'minimal' || id === 'low') {
    return '快'
  }
  if (id === 'high') {
    return '较慢'
  }
  if (id === 'xhigh' || id === 'max') {
    return '最慢'
  }
  if (maxIndex <= 0) {
    return '由模型决定'
  }
  const progress = index / maxIndex
  if (progress <= 0.25) {
    return '快'
  }
  if (progress <= 0.5) {
    return '均衡'
  }
  if (progress <= 0.75) {
    return '较慢'
  }
  return '最慢'
}

function getTickPosition(index: number, maxIndex: number): string {
  const progress = maxIndex > 0 ? index / maxIndex : 0
  const percentage = progress * 100
  const pixelOffset = KNOB_DIAMETER_PX / 2 - KNOB_DIAMETER_PX * progress
  return `calc(${percentage}% + ${pixelOffset}px)`
}
