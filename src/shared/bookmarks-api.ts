export function getBookmarkTree(): Promise<chrome.bookmarks.BookmarkTreeNode[]> {
  return new Promise((resolve, reject) => {
    chrome.bookmarks.getTree((tree) => {
      const error = chrome.runtime.lastError
      if (error) {
        reject(new Error(error.message))
        return
      }

      resolve(tree)
    })
  })
}

export function getBookmarkById(
  bookmarkId: string
): Promise<chrome.bookmarks.BookmarkTreeNode | null> {
  const normalizedBookmarkId = String(bookmarkId || '').trim()
  if (!normalizedBookmarkId) {
    return Promise.resolve(null)
  }

  return new Promise<chrome.bookmarks.BookmarkTreeNode | null>((resolve, reject) => {
    chrome.bookmarks.get(normalizedBookmarkId, (nodes) => {
      const error = chrome.runtime.lastError
      if (error) {
        reject(new Error(error.message))
        return
      }

      resolve(Array.isArray(nodes) ? nodes[0] || null : null)
    })
  }).catch(async (lookupError) => {
    try {
      const tree = await getBookmarkTree()
      return findBookmarkNodeById(tree, normalizedBookmarkId)
    } catch (treeError) {
      const lookupMessage = lookupError instanceof Error
        ? lookupError.message
        : '书签查询失败'
      const treeMessage = treeError instanceof Error
        ? treeError.message
        : '书签树查询失败'
      throw new Error(`无法确认书签是否存在：${lookupMessage}；${treeMessage}`)
    }
  })
}

function findBookmarkNodeById(
  roots: chrome.bookmarks.BookmarkTreeNode[],
  bookmarkId: string
): chrome.bookmarks.BookmarkTreeNode | null {
  const pending = [...roots]
  while (pending.length) {
    const node = pending.pop()
    if (!node) {
      continue
    }
    if (String(node.id) === bookmarkId) {
      return node
    }
    if (node.children?.length) {
      pending.push(...node.children)
    }
  }
  return null
}

export function moveBookmark(
  bookmarkId: string,
  parentId: string,
  index?: number
): Promise<chrome.bookmarks.BookmarkTreeNode> {
  return new Promise((resolve, reject) => {
    const destination: chrome.bookmarks.MoveDestination = { parentId }
    if (Number.isFinite(index)) {
      destination.index = index
    }

    chrome.bookmarks.move(bookmarkId, destination, (node) => {
      const error = chrome.runtime.lastError
      if (error) {
        reject(new Error(error.message))
        return
      }

      resolve(node)
    })
  })
}

export function updateBookmark(
  bookmarkId: string,
  changes: chrome.bookmarks.UpdateChanges
): Promise<chrome.bookmarks.BookmarkTreeNode> {
  return new Promise((resolve, reject) => {
    chrome.bookmarks.update(bookmarkId, changes, (node) => {
      const error = chrome.runtime.lastError
      if (error) {
        reject(new Error(error.message))
        return
      }

      resolve(node)
    })
  })
}

export function removeBookmark(bookmarkId: string): Promise<void> {
  return new Promise((resolve, reject) => {
    chrome.bookmarks.remove(bookmarkId, () => {
      const error = chrome.runtime.lastError
      if (error) {
        reject(new Error(error.message))
        return
      }

      resolve()
    })
  })
}

export function removeBookmarkTree(bookmarkId: string): Promise<void> {
  return new Promise((resolve, reject) => {
    chrome.bookmarks.removeTree(bookmarkId, () => {
      const error = chrome.runtime.lastError
      if (error) {
        reject(new Error(error.message))
        return
      }

      resolve()
    })
  })
}

interface CreateBookmarkPayload extends chrome.bookmarks.CreateDetails {
  recycleId?: string
}

export function createBookmark(
  payload: CreateBookmarkPayload
): Promise<chrome.bookmarks.BookmarkTreeNode> {
  return new Promise((resolve, reject) => {
    const { recycleId: _recycleId, ...rest } = payload || ({} as CreateBookmarkPayload)
    const normalizedPayload: chrome.bookmarks.CreateDetails = { ...rest }

    if (!Number.isFinite(normalizedPayload.index)) {
      delete normalizedPayload.index
    }

    chrome.bookmarks.create(normalizedPayload, (node) => {
      const error = chrome.runtime.lastError
      if (error) {
        reject(new Error(error.message))
        return
      }

      resolve(node)
    })
  })
}

export function createTab(properties: chrome.tabs.CreateProperties): Promise<chrome.tabs.Tab | undefined> {
  return new Promise((resolve, reject) => {
    chrome.tabs.create(properties, (tab) => {
      const error = chrome.runtime.lastError
      if (error) {
        reject(new Error(error.message))
        return
      }

      resolve(tab)
    })
  })
}
