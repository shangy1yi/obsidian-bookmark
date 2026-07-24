import { useEffect, useRef } from 'react'
import { AVAILABILITY_NAVIGATION_CONCURRENCY_LIMIT } from '../../shared/messages.js'
import { Button } from '../../ui/base/Button'
import { Input } from '../../ui/base/Input'
import { Popover } from '../../ui/base/Popover'
import { cx } from '../../ui/base/utils'
import { ButtonBusyLoadingLabel } from './LoadingLabel.js'
import { handleAvailabilityControlsAction } from '../options-controller'
import { useAvailabilityControls } from './availability-controls-store.js'
import {
  OPTION_RUN_ACTIONS_CLASS,
  OPTION_RUN_ACTION_BUTTON_CLASS,
  OPTION_RUN_CELL_CLASS
} from './option-layout-classes.js'

const AVAILABILITY_PERMISSION_CARD_CLASS =
  OPTION_RUN_CELL_CLASS
const AVAILABILITY_PERMISSION_META_CLASS =
  'flex flex-wrap items-center justify-between gap-3 max-[760px]:flex-col max-[760px]:items-start'
const AVAILABILITY_PERMISSION_TITLE_CLASS =
  'block text-[15px] font-[650] leading-normal tracking-[0] text-ds-text-primary'
const AVAILABILITY_PERMISSION_COPY_CLASS =
  'mt-2 mb-0 text-[13px] leading-[1.55] text-ds-text-secondary'
const AVAILABILITY_CONTROLS_ACTIONS_CLASS =
  OPTION_RUN_ACTIONS_CLASS
const AVAILABILITY_BADGE_BASE_CLASS =
  'inline-flex min-h-7 shrink-0 items-center justify-center whitespace-nowrap rounded-full border px-[11px] text-[11px] font-semibold leading-none tracking-[0]'
const AVAILABILITY_BADGE_TONE_CLASSES: Record<string, string> = {
  danger: 'border-ds-danger/35 bg-ds-danger-soft text-ds-danger-text',
  muted: 'border-ds-hover bg-ds-surface-2 text-ds-text-muted',
  success: 'border-ds-success/35 bg-ds-success-soft text-ds-success-text',
  warning: 'border-ds-warning/35 bg-ds-warning-soft text-ds-warning'
}
const AVAILABILITY_BUTTON_MOBILE_FULL_CLASS = OPTION_RUN_ACTION_BUTTON_CLASS
const SETTINGS_ANCHOR_CLASS = `relative shrink-0 ${AVAILABILITY_BUTTON_MOBILE_FULL_CLASS}`
const SETTINGS_POPOVER_CLASS =
  'w-[min(320px,calc(100vw_-_48px))]'
const SETTINGS_HEAD_CLASS = 'flex items-center justify-between gap-2.5'
const SETTINGS_TITLE_CLASS = 'text-sm font-bold text-ds-text-primary'
const SETTINGS_STATUS_BASE_CLASS =
  'min-w-11 text-right text-xs font-[650] leading-[1.4] text-ds-text-disabled max-[760px]:text-left'
const SETTINGS_STATUS_TONE_CLASSES: Record<string, string> = {
  danger: 'text-ds-danger-text',
  muted: 'text-ds-text-disabled',
  success: 'text-ds-success-text',
  warning: 'text-ds-warning'
}
const SETTINGS_FIELD_CLASS =
  'mt-3.5 grid grid-cols-[minmax(0,1fr)_96px] items-center gap-3 text-[13px] font-semibold text-ds-text-secondary max-[760px]:grid-cols-[minmax(0,1fr)]'
const SETTINGS_INPUT_CLASS =
  'w-full min-w-0 text-center font-semibold'
const SETTINGS_NOTE_CLASS = 'mb-0 mt-3 text-xs leading-[1.6] text-ds-text-muted'
const SETTINGS_ACTIONS_CLASS = 'mt-3.5 flex flex-wrap items-center justify-end gap-2.5'
const AVAILABILITY_ACTION_LABELS = [
  '开始检测全部书签',
  '开始检测当前范围',
  '重新检测全部书签',
  '重新检测当前范围',
  '正在准备检测…',
  '正在请求站点授权…',
  '正在重新测试…',
  '正在检测…',
  '正在保存检测结果…',
  '检测已暂停',
  '停止中…'
] as const
const AVAILABILITY_STOP_LABELS = ['停止本次检测', '停止中…'] as const

function BusyLabel({
  busy,
  label,
  reserveLabels
}: {
  busy: boolean
  label: string
  reserveLabels: readonly string[]
}) {
  return (
    <ButtonBusyLoadingLabel
      busy={busy}
      label={label}
      reserveLabels={reserveLabels}
      showLoader={false}
    />
  )
}

export function AvailabilityControls() {
  const state = useAvailabilityControls()
  const concurrencyInputRef = useRef<HTMLInputElement | null>(null)
  const badgeClassName = cx(
    AVAILABILITY_BADGE_BASE_CLASS,
    AVAILABILITY_BADGE_TONE_CLASSES[state.badgeTone] || AVAILABILITY_BADGE_TONE_CLASSES.muted
  )
  const settingsStatusClassName = cx(
    SETTINGS_STATUS_BASE_CLASS,
    SETTINGS_STATUS_TONE_CLASSES[state.settingsStatusTone] || SETTINGS_STATUS_TONE_CLASSES.muted
  )

  useEffect(() => {
    if (!state.settingsOpen) {
      return
    }

    window.setTimeout(() => {
      concurrencyInputRef.current?.focus()
      concurrencyInputRef.current?.select()
    }, 0)
  }, [state.settingsOpen])

  const updateDraft = (draft: Partial<typeof state.settingsDraft>) => {
    handleAvailabilityControlsAction({
      action: 'settings-draft-change',
      draft: {
        ...state.settingsDraft,
        ...draft
      }
    })
  }

  return (
    <>
      <div className={AVAILABILITY_PERMISSION_CARD_CLASS}>
        <div className={AVAILABILITY_PERMISSION_META_CLASS}>
          <strong className={AVAILABILITY_PERMISSION_TITLE_CLASS}>检测方式</strong>
          <span className={badgeClassName}>
            {state.badgeText}
          </span>
        </div>
        <p className={AVAILABILITY_PERMISSION_COPY_CLASS}>
          {state.permissionCopy}
        </p>
      </div>

      <div className={AVAILABILITY_CONTROLS_ACTIONS_CLASS}>
        <div className={SETTINGS_ANCHOR_CLASS}>
          <Popover
            id="availability-settings-popover"
            align="end"
            collisionPadding={16}
            open={state.settingsOpen}
            onOpenChange={(open) => {
              handleAvailabilityControlsAction({ action: 'settings-open-change', open })
            }}
            popupClassName={SETTINGS_POPOVER_CLASS}
            side="bottom"
            sideOffset={10}
            trigger={
              <Button
                className={AVAILABILITY_BUTTON_MOBILE_FULL_CLASS}
                size="sm"
                type="button"
                variant="secondary"
                disabled={state.settingsDisabled}
                focusableWhenDisabled={state.settingsDisabled}
              >
                检测设置
              </Button>
            }
          >
            <div className={SETTINGS_HEAD_CLASS}>
              <strong className={SETTINGS_TITLE_CLASS}>检测设置</strong>
              <span
                className={settingsStatusClassName}
              >
                {state.settingsStatus}
              </span>
            </div>
            <label className={SETTINGS_FIELD_CLASS} htmlFor="availability-concurrency-input">
              <span>并发数</span>
              <Input
                id="availability-concurrency-input"
                ref={concurrencyInputRef}
                className={SETTINGS_INPUT_CLASS}
                size="sm"
                type="number"
                inputMode="numeric"
                min="1"
                max={AVAILABILITY_NAVIGATION_CONCURRENCY_LIMIT}
                step="1"
                disabled={state.settingsDisabled}
                value={state.settingsDraft.concurrency}
                onValueChange={(value) => {
                  updateDraft({ concurrency: value })
                }}
              />
            </label>
            <label className={SETTINGS_FIELD_CLASS} htmlFor="availability-timeout-input">
              <span>超时时长（秒）</span>
              <Input
                id="availability-timeout-input"
                className={SETTINGS_INPUT_CLASS}
                size="sm"
                type="number"
                inputMode="numeric"
                min="5"
                max="120"
                step="5"
                disabled={state.settingsDisabled}
                value={state.settingsDraft.navigationTimeoutSeconds}
                onValueChange={(value) => {
                  updateDraft({ navigationTimeoutSeconds: value })
                }}
              />
            </label>
            <p className={SETTINGS_NOTE_CLASS}>超时或 HTTP 429 时会自动降速。</p>
            <div className={SETTINGS_ACTIONS_CLASS}>
              <Button
                className={AVAILABILITY_BUTTON_MOBILE_FULL_CLASS}
                size="sm"
                type="button"
                variant="secondary"
                disabled={state.settingsDisabled}
                focusableWhenDisabled={state.settingsDisabled}
                onClick={() => handleAvailabilityControlsAction({ action: 'settings-reset' })}
              >
                恢复默认
              </Button>
              <Button
                className={AVAILABILITY_BUTTON_MOBILE_FULL_CLASS}
                size="sm"
                type="button"
                variant="primary"
                disabled={state.settingsDisabled}
                focusableWhenDisabled={state.settingsDisabled}
                onClick={() => handleAvailabilityControlsAction({ action: 'settings-save' })}
              >
                保存设置
              </Button>
            </div>
          </Popover>
        </div>
        <Button
          className={AVAILABILITY_BUTTON_MOBILE_FULL_CLASS}
          type="button"
          variant="primary"
          disabled={state.actionDisabled}
          focusableWhenDisabled={state.actionDisabled}
          onClick={() => handleAvailabilityControlsAction({ action: 'start' })}
        >
          <BusyLabel
            busy={state.actionBusy}
            label={state.actionLabel}
            reserveLabels={AVAILABILITY_ACTION_LABELS}
          />
        </Button>
        {state.pauseHidden ? null : (
          <Button
            className={AVAILABILITY_BUTTON_MOBILE_FULL_CLASS}
            size="sm"
            type="button"
            variant="secondary"
            disabled={state.pauseDisabled}
            focusableWhenDisabled={state.pauseDisabled}
            onClick={() => handleAvailabilityControlsAction({ action: 'pause-toggle' })}
          >
            {state.pauseLabel}
          </Button>
        )}
        {state.stopHidden ? null : (
          <Button
            className={AVAILABILITY_BUTTON_MOBILE_FULL_CLASS}
            size="sm"
            type="button"
            variant="secondary"
            disabled={state.stopDisabled}
            focusableWhenDisabled={state.stopDisabled}
            onClick={() => handleAvailabilityControlsAction({ action: 'stop' })}
          >
            <BusyLabel
              busy={state.stopBusy}
              label={state.stopLabel}
              reserveLabels={AVAILABILITY_STOP_LABELS}
            />
          </Button>
        )}
      </div>
    </>
  )
}
