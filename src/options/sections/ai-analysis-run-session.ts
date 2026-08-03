export type AiAnalysisRunPhase =
  | 'authorizing'
  | 'validating'
  | 'running'
  | 'finalizing'
  | 'stopping'

export interface AiAnalysisRunSession {
  id: string
  phase: AiAnalysisRunPhase
}

export interface AiAnalysisRunSessionCoordinator {
  claim: () => AiAnalysisRunSession | null
  getActive: () => AiAnalysisRunSession | null
  isOwner: (sessionId: string) => boolean
  release: (sessionId: string) => boolean
  transition: (sessionId: string, phase: AiAnalysisRunPhase) => boolean
}

interface AiAnalysisRunSessionCoordinatorOptions {
  createId?: () => string
}

export function createAiAnalysisRunSessionCoordinator({
  createId = createAiAnalysisRunSessionId
}: AiAnalysisRunSessionCoordinatorOptions = {}): AiAnalysisRunSessionCoordinator {
  let activeSession: AiAnalysisRunSession | null = null

  return {
    claim() {
      if (activeSession) {
        return null
      }

      activeSession = {
        id: createId(),
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

let aiAnalysisRunSessionSequence = 0

function createAiAnalysisRunSessionId(): string {
  aiAnalysisRunSessionSequence += 1
  return `ai-analysis-run-${Date.now()}-${aiAnalysisRunSessionSequence}`
}
