import assert from 'node:assert/strict'
import { buildBookmarkPathSegments, formatFolderPath } from './bookmark-path.js'

/**
 * bookmark-path 的父文件夹解析原本是 O(N²)：每找一层父级都要遍历整个
 * folderMap，并对每个候选跑一次正则归一化。popup 的侧边栏对每个文件夹递归
 * 调用它，于是每敲一个字符都要付一次全量代价。
 *
 * 这里锁两件事：
 *   1. 等价性——改写后的结果必须和朴素实现逐条一致（含同名路径的自排除）。
 *   2. 复杂度——规模翻倍时耗时不应该按平方增长。
 */

function normalizePathString(value) {
  return String(value || '')
    .replace(/\s*(?:\/|>|›|»|\\)\s*/g, ' / ')
    .replace(/\s+/g, ' ')
    .trim()
}

/** 朴素参考实现：直接照搬修改前的语义，作为对拍基准。 */
function referenceFindParent(folder, folderMap) {
  const childPath = normalizePathString(folder.path || folder.title)
  if (!childPath) return null
  let parent = null
  for (const candidate of folderMap.values()) {
    if (String(candidate.id || '') === String(folder.id || '')) continue
    const candidatePath = normalizePathString(candidate.path || candidate.title)
    if (!candidatePath || candidatePath.length >= childPath.length) continue
    if (
      childPath.startsWith(`${candidatePath} / `) &&
      (!parent || candidatePath.length > normalizePathString(parent.path || parent.title).length)
    ) {
      parent = candidate
    }
  }
  return parent
}

function referenceChain(folder, folderMap) {
  const chain = []
  const seen = new Set()
  let current = folder
  while (current && !seen.has(String(current.id || ''))) {
    chain.unshift(current)
    seen.add(String(current.id || ''))
    current = referenceFindParent(current, folderMap)
  }
  return chain
}

function referenceFormatFolderPath(folder, folderMap, separator = ' > ') {
  if (!folder) return ''
  const chain = referenceChain(folder, folderMap)
  if (chain.length > 1) {
    return chain.map((item) => String(item.title || item.path || '未命名文件夹')).join(separator)
  }
  // 单段时 buildBookmarkPathSegments 会退回按 path 字面切分，交给被测实现自己覆盖。
  return null
}

function buildTree({ breadth, depth, prefix = 'F' }) {
  const folderMap = new Map()
  let id = 0
  const walk = (parentPath, level) => {
    if (level > depth) return
    for (let i = 0; i < breadth; i += 1) {
      id += 1
      const title = `${prefix}${level}-${i}`
      const path = parentPath ? `${parentPath} / ${title}` : title
      folderMap.set(String(id), { id: String(id), title, path })
      walk(path, level + 1)
    }
  }
  walk('', 1)
  return folderMap
}

// --- 1. 等价性：多种树形下逐条对拍 ---
for (const shape of [
  { breadth: 2, depth: 4 },
  { breadth: 3, depth: 3 },
  { breadth: 5, depth: 2 }
]) {
  const folderMap = buildTree(shape)
  for (const folder of folderMap.values()) {
    const expected = referenceFormatFolderPath(folder, folderMap)
    if (expected === null) continue
    assert.equal(
      formatFolderPath(folder, folderMap),
      expected,
      `folder ${folder.path} must resolve to the same ancestor chain`
    )
  }
}

// --- 2. 不在 folderMap 里的文件夹（草稿态）也要能解析出父级 ---
{
  const folderMap = buildTree({ breadth: 2, depth: 3 })
  const parent = [...folderMap.values()].find((f) => f.path.split(' / ').length === 2)
  const draft = { id: 'draft-not-in-map', title: '新建文件夹', path: `${parent.path} / 新建文件夹` }
  assert.equal(
    formatFolderPath(draft, folderMap),
    referenceFormatFolderPath(draft, folderMap),
    'a folder outside folderMap must still resolve its ancestors'
  )
}

// --- 3. 同名路径时必须排除自身，选到另一条记录 ---
{
  const folderMap = new Map([
    ['1', { id: '1', title: '根', path: '根' }],
    ['2', { id: '2', title: '子', path: '根 / 子' }],
    ['3', { id: '3', title: '子', path: '根 / 子' }]
  ])
  const target = folderMap.get('3')
  assert.equal(
    formatFolderPath(target, folderMap),
    referenceFormatFolderPath(target, folderMap),
    'duplicate paths must exclude self and match reference ordering'
  )
}

// --- 4. 段结构正确 ---
{
  const folderMap = buildTree({ breadth: 2, depth: 3 })
  const deepest = [...folderMap.values()].find((f) => f.path.split(' / ').length === 3)
  const segments = buildBookmarkPathSegments(deepest, folderMap)
  assert.equal(segments.length, 3, 'deepest folder must expose three segments')
  assert.equal(segments.at(-1).current, true, 'last segment must be marked current')
  assert.equal(segments.at(-1).id, deepest.id, 'last segment must be the folder itself')
}

// --- 5. 复杂度：规模翻倍不应带来平方级增长 ---
function timeFullSidebarPass(folderMap) {
  const startedAt = process.hrtime.bigint()
  for (const folder of folderMap.values()) {
    formatFolderPath(folder, folderMap)
  }
  return Number(process.hrtime.bigint() - startedAt) / 1e6
}

{
  // 每棵树都用全新的 Map，避免被跨用例的缓存掩盖真实复杂度。
  const small = buildTree({ breadth: 2, depth: 7, prefix: 'S' }) // 254 个文件夹
  const large = buildTree({ breadth: 2, depth: 8, prefix: 'L' }) // 510 个文件夹

  timeFullSidebarPass(buildTree({ breadth: 2, depth: 5, prefix: 'W' })) // 预热 JIT
  const smallMs = timeFullSidebarPass(small)
  const largeMs = timeFullSidebarPass(large)

  const growth = largeMs / Math.max(smallMs, 0.01)
  assert.ok(
    growth < 3,
    `doubling the folder count must not scale quadratically (${small.size}→${large.size} folders: ` +
    `${smallMs.toFixed(1)}ms→${largeMs.toFixed(1)}ms, growth ${growth.toFixed(1)}x)`
  )
}

console.log('Bookmark path resolution tests passed.')
