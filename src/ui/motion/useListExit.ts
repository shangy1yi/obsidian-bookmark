import { useEffect, useRef, useState } from 'react'
import { getMotionDurationMs, prefersReducedMotion } from '../../shared/motion'

const FALLBACK_EXIT_MS = 220

export interface ListExitEntry<T> {
  exiting: boolean
  item: T
  key: string
}

interface TrackedItem<T> {
  index: number
  item: T
}

/**
 * 让被移除的列表项先演完退出动画再真正卸载。
 *
 * 删除一行时数据源立刻少一条，React 会当帧卸载 DOM——行是「消失」而不是
 * 「离开」，后面的行瞬移上来。这个 hook 把移除的项按它最后所在的下标继续挂在
 * 列表里并标上 exiting，等 --list-exit-dur 走完再撤掉，塌陷因此发生在原位。
 *
 * 记下标而不是追加到末尾：删中间一行时它必须在原地收起来，
 * 而不是先跳到列表底部再消失。
 *
 * reduced-motion 下不滞留，直接透传当前项——用户要的就是「立刻没了」。
 */
export function useListExit<T>(
  items: readonly T[],
  getKey: (item: T) => string
): Array<ListExitEntry<T>> {
  const [exiting, setExiting] = useState<Map<string, TrackedItem<T>>>(() => new Map())
  const previousRef = useRef<Map<string, TrackedItem<T>>>(new Map())
  const timersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map())

  const current = new Map<string, TrackedItem<T>>()
  items.forEach((item, index) => {
    current.set(getKey(item), { index, item })
  })

  useEffect(() => {
    const timers = timersRef.current
    const previous = previousRef.current
    previousRef.current = current

    if (prefersReducedMotion()) {
      return
    }

    const removedKeys: string[] = []
    for (const key of previous.keys()) {
      if (!current.has(key)) {
        removedKeys.push(key)
      }
    }

    // 项被加回来时取消它没走完的退出，否则它会卡在半透明的中间帧。
    const revivedKeys: string[] = []
    for (const key of timers.keys()) {
      if (current.has(key)) {
        revivedKeys.push(key)
      }
    }

    if (!removedKeys.length && !revivedKeys.length) {
      return
    }

    for (const key of revivedKeys) {
      const timer = timers.get(key)
      if (timer) {
        clearTimeout(timer)
      }
      timers.delete(key)
    }

    setExiting((currentExiting) => {
      const next = new Map(currentExiting)
      for (const key of revivedKeys) {
        next.delete(key)
      }
      for (const key of removedKeys) {
        const tracked = previous.get(key)
        if (tracked) {
          next.set(key, tracked)
        }
      }
      return next
    })

    const durationMs = getMotionDurationMs('--list-exit-dur', FALLBACK_EXIT_MS)

    for (const key of removedKeys) {
      const existing = timers.get(key)
      if (existing) {
        clearTimeout(existing)
      }
      timers.set(
        key,
        setTimeout(() => {
          timers.delete(key)
          setExiting((currentExiting) => {
            if (!currentExiting.has(key)) {
              return currentExiting
            }
            const next = new Map(currentExiting)
            next.delete(key)
            return next
          })
        }, durationMs)
      )
    }
  })

  useEffect(() => {
    const timers = timersRef.current
    return () => {
      for (const timer of timers.values()) {
        clearTimeout(timer)
      }
      timers.clear()
    }
  }, [])

  const entries: Array<ListExitEntry<T>> = items.map((item) => ({
    exiting: false,
    item,
    key: getKey(item)
  }))

  if (!exiting.size) {
    return entries
  }

  // 只有仍然不在数据源里的才算退出中；下标大的先插回，
  // 免得前面的插入把后面记录的位置顶偏。
  const lingering = [...exiting.entries()]
    .filter(([key]) => !current.has(key))
    .sort((left, right) => right[1].index - left[1].index)

  for (const [key, tracked] of lingering) {
    const index = Math.max(0, Math.min(entries.length, tracked.index))
    entries.splice(index, 0, { exiting: true, item: tracked.item, key })
  }

  return entries
}
