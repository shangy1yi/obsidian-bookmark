import { SECTION_META } from './shared-options/constants.js'

export type OptionsSectionKey = keyof typeof SECTION_META
type OptionsSectionChangeListener = () => void

const optionsSectionChangeListeners = new Set<OptionsSectionChangeListener>()

export function normalizeOptionsSectionKey(key: string): OptionsSectionKey {
  if (key === 'ai-tag-data') {
    return 'backup'
  }

  return key in SECTION_META ? (key as OptionsSectionKey) : 'general'
}

function getOptionsSectionKeyFromHash(hash: string): OptionsSectionKey {
  const rawKey = hash.replace(/^#/, '').split(':')[0] || 'general'
  return normalizeOptionsSectionKey(rawKey)
}

export function readOptionsSectionKey(): OptionsSectionKey {
  return getOptionsSectionKeyFromHash(window.location.hash)
}

export function readOptionsSectionAnchor(): string {
  const [, anchor = ''] = window.location.hash.replace(/^#/, '').split(':')
  return anchor
}

export function getOptionsSectionNavigationFromLink(
  link: HTMLAnchorElement
): { hash: string; key: OptionsSectionKey } | null {
  const targetUrl = new URL(link.href, window.location.href)
  if (targetUrl.origin !== window.location.origin || targetUrl.pathname !== window.location.pathname) {
    return null
  }

  const hash = targetUrl.hash || ''
  const rawKey = hash.replace(/^#/, '').split(':')[0] || ''
  const key = normalizeOptionsSectionKey(rawKey)
  if (!rawKey || key !== rawKey) {
    return null
  }

  return { hash, key }
}

export function navigateToOptionsSectionHash(hash: string): void {
  if (window.location.hash !== hash) {
    window.history.pushState(null, '', hash)
  }
  notifyOptionsSectionChanged()
}

const OPTIONS_EMPTY_STATE_CTA_NAVIGATION: Record<string, string> = {
  'run-availability': '#availability',
  'open-auto-analyze': '#general',
  'configure-ai': '#general:ai-provider',
  'redirect-info': '#redirects',
  'availability-info': '#availability',
  'recycle-info': '#recycle'
}

export function navigateToOptionsEmptyStateAction(action: string): void {
  const targetHash = OPTIONS_EMPTY_STATE_CTA_NAVIGATION[action]
  if (!targetHash) {
    return
  }

  navigateToOptionsSectionHash(targetHash)
}

function notifyOptionsSectionChanged(): void {
  optionsSectionChangeListeners.forEach((listener) => listener())
}

export function subscribeToOptionsSectionChanges(listener: OptionsSectionChangeListener): () => void {
  optionsSectionChangeListeners.add(listener)
  return () => {
    optionsSectionChangeListeners.delete(listener)
  }
}
