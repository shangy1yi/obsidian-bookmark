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

type FolderLike = Pick<FolderRecord, 'id' | 'title' | 'path'>

/**
 * 归一化路径 → 该路径下的文件夹（按插入顺序，同名路径保留全部）。
 *
 * folderMap 由 bookmark-tree 一次性构建后整体替换，构建完不再原地增删，
 * 所以按 Map 实例缓存是安全的：重建书签树会得到新的 Map，索引自然失效。
 */
const folderPathIndexCache = new WeakMap<
  Map<string, FolderLike>,
  Map<string, FolderLike[]>
>()

function getFolderPathIndex(
  folderMap: Map<string, FolderLike>
): Map<string, FolderLike[]> {
  const cached = folderPathIndexCache.get(folderMap)
  if (cached) {
    return cached
  }

  const byPath = new Map<string, FolderLike[]>()
  for (const candidate of folderMap.values()) {
    const candidatePath = normalizePathString(candidate.path || candidate.title)
    if (!candidatePath) {
      continue
    }
    const bucket = byPath.get(candidatePath)
    if (bucket) {
      bucket.push(candidate)
    } else {
      byPath.set(candidatePath, [candidate])
    }
  }

  folderPathIndexCache.set(folderMap, byPath)
  return byPath
}

function findParentFolder(
  folder: FolderLike,
  folderMap: Map<string, FolderLike>
): FolderLike | null {
  const childPath = normalizePathString(folder.path || folder.title)
  if (!childPath) {
    return null
  }

  // 父级的路径必然是子路径在 ' / ' 边界上的某个前缀，所以只需要沿着自己的
  // 路径由长到短试一遍，第一个命中的就是最近的父级。原先要为此扫描整个
  // folderMap 并对每个候选跑正则，规模一大就是平方级开销。
  const byPath = getFolderPathIndex(folderMap)
  const segments = childPath.split(' / ')
  const folderId = String(folder.id || '')

  for (let end = segments.length - 1; end >= 1; end -= 1) {
    const bucket = byPath.get(segments.slice(0, end).join(' / '))
    if (!bucket) {
      continue
    }
    // 同名路径下排除自身，保持与逐条扫描时「取第一个非自身」一致。
    const candidate = bucket.find((entry) => String(entry.id || '') !== folderId)
    if (candidate) {
      return candidate
    }
  }

  return null
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
