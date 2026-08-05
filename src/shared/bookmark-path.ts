import type { FolderRecord } from './types.js'

export interface BookmarkPathSegment {
  id: string
  label: string
  path: string
  current: boolean
}

export function splitBookmarkPath(value: unknown): string[] {
  return String(value || '')
    .split(/\s*(?:\/|>|›|»|\\)\s*/g).flatMap(segment => { const mappedResult = segment.replace(/\s+/g, ' ').trim(); return mappedResult ? [mappedResult] : [] })
}

function joinBookmarkPathSegments(segments: unknown[], separator = ' > '): string {
  return segments.flatMap(segment => { const mappedResult = String(segment || '').replace(/\s+/g, ' ').trim(); return mappedResult ? [mappedResult] : [] })
    .join(separator)
}

export function formatBookmarkPath(value: unknown, separator = ' > '): string {
  return joinBookmarkPathSegments(splitBookmarkPath(value), separator)
}

export function buildBookmarkPathSegments(
  folder: Pick<FolderRecord, 'id' | 'title' | 'path'> | null | undefined,
  folderMap: Map<string, Pick<FolderRecord, 'id' | 'title' | 'path'>> = new Map()
): BookmarkPathSegment[] {
  if (!folder) {
    return []
  }

  const folderChain = buildFolderChain(folder, folderMap)
  if (folderChain.length > 1) {
    return folderChain.map((item, index) => {
      const labels = folderChain.slice(0, index + 1).map((segment) => segment.title || segment.path || '未命名文件夹')
      return {
        id: String(item.id || ''),
        label: String(item.title || item.path || '未命名文件夹'),
        path: joinBookmarkPathSegments(labels),
        current: index === folderChain.length - 1
      }
    })
  }

  const pathSegments = splitBookmarkPath(folder.path || folder.title)
  const fallbackLabel = String(folder.title || '').trim()
  const labels = pathSegments.length
    ? pathSegments
    : fallbackLabel
      ? [fallbackLabel]
      : []

  const segments = labels.map((label, index) => {
    const path = joinBookmarkPathSegments(labels.slice(0, index + 1))
    const matchedFolder = findFolderByPath(path, folderMap)
    const isCurrent = index === labels.length - 1

    return {
      id: String((isCurrent ? folder.id : matchedFolder?.id) || ''),
      label,
      path,
      current: isCurrent
    }
  })

  const lastSegment = segments.at(-1)
  if (lastSegment) {
    lastSegment.id = String(folder.id || lastSegment.id || '')
  }

  return segments
}

export function formatFolderPath(
  folder: Pick<FolderRecord, 'id' | 'title' | 'path'> | null | undefined,
  folderMap: Map<string, Pick<FolderRecord, 'id' | 'title' | 'path'>> = new Map(),
  separator = ' > '
): string {
  const segments = buildBookmarkPathSegments(folder, folderMap)
  return segments.length
    ? segments.map((segment) => segment.label).join(separator)
    : formatBookmarkPath(folder?.path || folder?.title, separator)
}

function findFolderByPath(
  path: unknown,
  folderMap: Map<string, Pick<FolderRecord, 'id' | 'title' | 'path'>>
): Pick<FolderRecord, 'id' | 'title' | 'path'> | null {
  const normalizedTarget = normalizePathKey(path)
  if (!normalizedTarget) {
    return null
  }

  for (const folder of folderMap.values()) {
    const normalizedPath = normalizePathKey(folder.path || folder.title)
    if (normalizedPath === normalizedTarget) {
      return folder
    }
  }

  return null
}

function buildFolderChain(
  folder: Pick<FolderRecord, 'id' | 'title' | 'path'>,
  folderMap: Map<string, Pick<FolderRecord, 'id' | 'title' | 'path'>>
): Array<Pick<FolderRecord, 'id' | 'title' | 'path'>> {
  const chain: Array<Pick<FolderRecord, 'id' | 'title' | 'path'>> = []
  const seenIds = new Set<string>()
  let current: Pick<FolderRecord, 'id' | 'title' | 'path'> | null = folder

  while (current && !seenIds.has(String(current.id || ''))) {
    chain.unshift(current)
    seenIds.add(String(current.id || ''))
    current = findParentFolder(current, folderMap)
  }

  return chain
}

function findParentFolder(
  folder: Pick<FolderRecord, 'id' | 'title' | 'path'>,
  folderMap: Map<string, Pick<FolderRecord, 'id' | 'title' | 'path'>>
): Pick<FolderRecord, 'id' | 'title' | 'path'> | null {
  const childPath = normalizePathString(folder.path || folder.title)
  if (!childPath) {
    return null
  }

  let parent: Pick<FolderRecord, 'id' | 'title' | 'path'> | null = null
  for (const candidate of folderMap.values()) {
    if (String(candidate.id || '') === String(folder.id || '')) {
      continue
    }

    const candidatePath = normalizePathString(candidate.path || candidate.title)
    if (!candidatePath || candidatePath.length >= childPath.length) {
      continue
    }

    if (childPath.startsWith(`${candidatePath} / `) && (!parent || candidatePath.length > normalizePathString(parent.path || parent.title).length)) {
      parent = candidate
    }
  }

  return parent
}

function normalizePathString(value: unknown): string {
  return String(value || '')
    .replace(/\s*(?:\/|>|›|»|\\)\s*/g, ' / ')
    .replace(/\s+/g, ' ')
    .trim()
}

function normalizePathKey(value: unknown): string {
  return splitBookmarkPath(value).join('\u0000').toLowerCase()
}
