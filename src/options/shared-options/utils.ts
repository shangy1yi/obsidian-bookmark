// @ts-nocheck
import { availabilityState } from './state.js'

export function isInteractionLocked() {
  return (
    availabilityState.deleting ||
    availabilityState.retestingSelection ||
    availabilityState.stopRequested ||
    (availabilityState.running && !availabilityState.paused)
  )
}

export function compareByPathTitle(left, right) {
  return (
    String(left.path || '').localeCompare(String(right.path || ''), 'zh-CN') ||
    String(left.title || '').localeCompare(String(right.title || ''), 'zh-CN')
  )
}

export function syncSelectionSet(selectionSet, validIds) {
  for (const selectedId of [...selectionSet]) {
    if (!validIds.has(String(selectedId))) {
      selectionSet.delete(String(selectedId))
    }
  }
}

export function formatDateTime(timestamp) {
  return new Intl.DateTimeFormat('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  }).format(timestamp)
}

export function setModalHidden(backdrop, open) {
  if (!backdrop) {
    return
  }

  if (!open) {
    const active = document.activeElement
    if (active && active !== document.body && backdrop.contains(active)) {
      active.blur()
    }
  }

  backdrop.classList.toggle('hidden', !open)
  backdrop.setAttribute('aria-hidden', open ? 'false' : 'true')
}
