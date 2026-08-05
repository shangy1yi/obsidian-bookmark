import { useCallback } from 'react'

const focusTargets = new Map<string, HTMLElement>()

export function getOptionsFocusTarget(id: string | undefined): HTMLElement | null {
  if (!id) {
    return null
  }

  const target = focusTargets.get(id)
  if (!target?.isConnected) {
    focusTargets.delete(id)
    return null
  }

  return target
}

function registerOptionsFocusTarget(id: string, target: HTMLElement | null): void {
  if (target) {
    focusTargets.set(id, target)
    return
  }

  focusTargets.delete(id)
}

export function useOptionsFocusTargetRef<T extends HTMLElement>(id: string): (target: T | null) => void {
  return useCallback((target: T | null) => {
    registerOptionsFocusTarget(id, target)
  }, [id])
}
