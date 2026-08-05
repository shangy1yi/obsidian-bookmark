import { Button } from '../../ui/base/Button'
import { Icon } from '../../ui/icons/Icon'
import { handleAiAnalysisScopePickerOpen } from '../options-controller'
import { useAiAnalysisScopePicker } from './ai-analysis-status-store.js'
import {
  SCOPE_PICKER_LABEL_CLASS,
  SCOPE_PICKER_TRIGGER_CLASS
} from './option-layout-classes.js'
import { useOptionsFocusTargetRef } from './options-focus-target-store.js'

export function AiAnalysisScopePickerButton({ className = '' }: { className?: string }) {
  const state = useAiAnalysisScopePicker()
  const triggerRef = useOptionsFocusTargetRef<HTMLButtonElement>('ai-scope-trigger')

  return (
    <Button
      ref={triggerRef}
      className={[SCOPE_PICKER_TRIGGER_CLASS, className].filter(Boolean).join(' ')}
      type="button"
      aria-label="选择书签智能分析范围"
      title={state.label}
      disabled={state.disabled}
      focusableWhenDisabled={state.disabled}
      onClick={handleAiAnalysisScopePickerOpen}
      unstyled
    >
      <span className={SCOPE_PICKER_LABEL_CLASS}>{state.label}</span>
      <Icon className="ml-auto shrink-0 text-ds-text-secondary" name="ChevronDown" size={14} aria-hidden="true" />
    </Button>
  )
}
