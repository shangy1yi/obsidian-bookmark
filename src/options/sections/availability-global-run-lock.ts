interface LockManagerLike {
  request(
    name: string,
    options: {
      ifAvailable: boolean
      mode: 'exclusive'
    },
    callback: (lock: unknown | null) => Promise<void>
  ): Promise<unknown>
}

interface AvailabilityGlobalRunLockOptions {
  lockManager?: LockManagerLike | null
  lockName?: string
}

export function createAvailabilityGlobalRunLockCoordinator({
  lockManager = null,
  lockName = 'curator:availability-run'
}: AvailabilityGlobalRunLockOptions = {}) {
  const heldSessions = new Map<string, () => void>()

  async function acquire(sessionId: string): Promise<boolean> {
    const normalizedSessionId = String(sessionId || '').trim()
    if (!normalizedSessionId || !lockManager || heldSessions.has(normalizedSessionId)) {
      return heldSessions.has(normalizedSessionId)
    }

    let resolveAcquisition: (acquired: boolean) => void = () => {}
    const acquisition = new Promise<boolean>((resolve) => {
      resolveAcquisition = resolve
    })
    let acquisitionSettled = false
    const settleAcquisition = (acquired: boolean) => {
      if (!acquisitionSettled) {
        acquisitionSettled = true
        resolveAcquisition(acquired)
      }
    }

    try {
      void lockManager.request(
        lockName,
        {
          ifAvailable: true,
          mode: 'exclusive'
        },
        async (lock) => {
          if (!lock) {
            settleAcquisition(false)
            return
          }

          let releaseHold: () => void = () => {}
          const hold = new Promise<void>((resolve) => {
            releaseHold = resolve
          })
          heldSessions.set(normalizedSessionId, releaseHold)
          settleAcquisition(true)

          try {
            await hold
          } finally {
            heldSessions.delete(normalizedSessionId)
          }
        }
      ).catch(() => {
        settleAcquisition(false)
      })
    } catch {
      settleAcquisition(false)
    }

    return acquisition
  }

  function release(sessionId: string): boolean {
    const normalizedSessionId = String(sessionId || '').trim()
    const releaseHold = heldSessions.get(normalizedSessionId)
    if (!releaseHold) {
      return false
    }

    releaseHold()
    return true
  }

  function isOwner(sessionId: string): boolean {
    return heldSessions.has(String(sessionId || '').trim())
  }

  return {
    acquire,
    isOwner,
    release
  }
}
