import {
  buildDuplicateKey,
  displayUrl,
  extractDomain,
  normalizeText,
  normalizeUrl
} from './text.js'
import { BOOKMARKS_BAR_ID, ROOT_ID } from './constants.js'

interface BookmarkRecord {
  id: string
  title: string
  url: string
  displayUrl: string
  normalizedTitle: string
  normalizedUrl: string
  duplicateKey: string
  domain: string
  path: string
  ancestorIds: string[]
  parentId: string
  index: number
  dateAdded: number
}

interface FolderRecord {
  id: string
  title: string
  path: string
  normalizedTitle: string
  normalizedPath: string
  depth: number
  folderCount: number
  bookmarkCount: number
}

interface ExtractedBookmarkData {
  bookmarks: BookmarkRecord[]
  folders: FolderRecord[]
  bookmarkMap: Map<string, BookmarkRecord>
  folderMap: Map<string, FolderRecord>
}

export function extractBookmarkData(
  rootNode: chrome.bookmarks.BookmarkTreeNode | null | undefined
): ExtractedBookmarkData {
  const bookmarks: BookmarkRecord[] = []
  const folders: FolderRecord[] = []
  const bookmarkMap = new Map<string, BookmarkRecord>()
  const folderMap = new Map<string, FolderRecord>()

  function walk(
    node: chrome.bookmarks.BookmarkTreeNode,
    ancestors: Array<{ id: string; title: string }> = []
  ): void {
    const isRoot = node.id === ROOT_ID
    const currentAncestors =
      isRoot || !node.title
        ? ancestors
        : [...ancestors, { id: String(node.id), title: node.title }]

    if (!node.url && !isRoot) {
      const folderPathSegments = currentAncestors
        .map((folder) => folder.title)
        .filter(Boolean)
      const folder: FolderRecord = {
        id: String(node.id),
        title: node.title || '未命名文件夹',
        path: folderPathSegments.join(' / '),
        normalizedTitle: normalizeText(node.title || ''),
        normalizedPath: normalizeText(folderPathSegments.join(' / ')),
        depth: currentAncestors.length,
        folderCount: (node.children || []).filter((child) => !child.url).length,
        bookmarkCount: (node.children || []).filter((child) => Boolean(child.url)).length
      }

      folders.push(folder)
      folderMap.set(folder.id, folder)
    }

    for (const child of node.children || []) {
      if (child.url) {
        const pathSegments = currentAncestors
          .map((folder) => folder.title)
          .filter(Boolean)
        const bookmark: BookmarkRecord = {
          id: String(child.id),
          title: child.title || '未命名书签',
          url: child.url,
          displayUrl: displayUrl(child.url),
          normalizedTitle: normalizeText(child.title || ''),
          normalizedUrl: normalizeUrl(child.url),
          duplicateKey: buildDuplicateKey(child.url),
          domain: extractDomain(child.url),
          path: pathSegments.join(' / '),
          ancestorIds: currentAncestors.map((folder) => String(folder.id)),
          parentId: String(child.parentId || currentAncestors.at(-1)?.id || ''),
          index: typeof child.index === 'number' ? child.index : 0,
          dateAdded: Number(child.dateAdded) || 0
        }

        bookmarks.push(bookmark)
        bookmarkMap.set(bookmark.id, bookmark)
      } else {
        walk(child, currentAncestors)
      }
    }
  }

  if (rootNode) {
    walk(rootNode)
  }

  return {
    bookmarks,
    folders,
    bookmarkMap,
    folderMap
  }
}

export function findBookmarksBar(
  rootNode: chrome.bookmarks.BookmarkTreeNode | null | undefined
): chrome.bookmarks.BookmarkTreeNode | null {
  const children = rootNode?.children || []
  return (
    children.find((child) => child.id === BOOKMARKS_BAR_ID) ||
    children.find((child) => !child.url) ||
    null
  )
}

export function findNodeById(
  node: chrome.bookmarks.BookmarkTreeNode | null | undefined,
  targetId: string
): chrome.bookmarks.BookmarkTreeNode | null {
  if (!node) {
    return null
  }

  if (node.id === targetId) {
    return node
  }

  for (const child of node.children || []) {
    const match = findNodeById(child, targetId)
    if (match) {
      return match
    }
  }

  return null
}
