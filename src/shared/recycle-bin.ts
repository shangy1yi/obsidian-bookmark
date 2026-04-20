import { RECYCLE_BIN_LIMIT, STORAGE_KEYS } from './constants.js'
import { getLocalStorage, setLocalStorage } from './storage.js'

interface RecycleEntry {
  recycleId: string
  deletedAt: number
  title?: string
  url?: string
  parentId?: string
  index?: number
  path?: string
  [key: string]: unknown
}

export async function appendRecycleEntry(entry: RecycleEntry): Promise<void> {
  const stored = await getLocalStorage<Record<string, unknown>>([STORAGE_KEYS.recycleBin])
  const currentEntries = Array.isArray(stored[STORAGE_KEYS.recycleBin])
    ? (stored[STORAGE_KEYS.recycleBin] as RecycleEntry[])
    : []

  const nextEntries = [entry, ...currentEntries]
    .sort((left, right) => (Number(right.deletedAt) || 0) - (Number(left.deletedAt) || 0))
    .slice(0, RECYCLE_BIN_LIMIT)

  await setLocalStorage({
    [STORAGE_KEYS.recycleBin]: nextEntries
  })
}

export async function removeRecycleEntry(recycleId: string): Promise<void> {
  const stored = await getLocalStorage<Record<string, unknown>>([STORAGE_KEYS.recycleBin])
  const currentEntries = Array.isArray(stored[STORAGE_KEYS.recycleBin])
    ? (stored[STORAGE_KEYS.recycleBin] as RecycleEntry[])
    : []

  await setLocalStorage({
    [STORAGE_KEYS.recycleBin]: currentEntries.filter((entry) => {
      return String(entry?.recycleId || '') !== String(recycleId || '')
    })
  })
}
