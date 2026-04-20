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

export function moveBookmark(
  bookmarkId: string,
  parentId: string
): Promise<chrome.bookmarks.BookmarkTreeNode> {
  return new Promise((resolve, reject) => {
    chrome.bookmarks.move(bookmarkId, { parentId }, (node) => {
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
  changes: chrome.bookmarks.BookmarkChangesArg
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

interface CreateBookmarkPayload extends chrome.bookmarks.BookmarkCreateArg {
  recycleId?: string
}

export function createBookmark(
  payload: CreateBookmarkPayload
): Promise<chrome.bookmarks.BookmarkTreeNode> {
  return new Promise((resolve, reject) => {
    const { recycleId: _recycleId, ...rest } = payload || ({} as CreateBookmarkPayload)
    const normalizedPayload: chrome.bookmarks.BookmarkCreateArg = { ...rest }

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
