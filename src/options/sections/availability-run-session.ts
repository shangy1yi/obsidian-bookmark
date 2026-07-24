export type AvailabilityRunKind = 'full' | 'retest'
export type AvailabilityRunPhase = 'authorizing' | 'running' | 'finalizing' | 'stopping'

export interface AvailabilityRunSession {
  id: string
  kind: AvailabilityRunKind
  phase: AvailabilityRunPhase
}

export interface AvailabilityRunSessionCoordinator {
  claim: (kind: AvailabilityRunKind) => AvailabilityRunSession | null
  getActive: () => AvailabilityRunSession | null
  isOwner: (sessionId: string) => boolean
  release: (sessionId: string) => boolean
  transition: (sessionId: string, phase: AvailabilityRunPhase) => boolean
}

interface AvailabilityRunSessionCoordinatorOptions {
  createId?: () => string
}

export function createAvailabilityRunSessionCoordinator({
  createId = createAvailabilityRunSessionId
}: AvailabilityRunSessionCoordinatorOptions = {}): AvailabilityRunSessionCoordinator {
  let activeSession: AvailabilityRunSession | null = null

  return {
    claim(kind) {
      if (activeSession) {
        return null
      }

      activeSession = {
        id: createId(),
        kind,
        phase: 'authorizing'
      }
      return { ...activeSession }
    },
    getActive() {
      return activeSession ? { ...activeSession } : null
    },
    isOwner(sessionId) {
      return Boolean(sessionId) && activeSession?.id === sessionId
    },
    release(sessionId) {
      if (!sessionId || activeSession?.id !== sessionId) {
        return false
      }

      activeSession = null
      return true
    },
    transition(sessionId, phase) {
      if (!sessionId || activeSession?.id !== sessionId) {
        return false
      }

      activeSession = {
        ...activeSession,
        phase
      }
      return true
    }
  }
}

let availabilityRunSessionSequence = 0

function createAvailabilityRunSessionId(): string {
  availabilityRunSessionSequence += 1
  return `availability-run-${Date.now()}-${availabilityRunSessionSequence}`
}
