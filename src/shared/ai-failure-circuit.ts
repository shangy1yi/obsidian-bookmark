export interface AiFailureCircuit {
  consecutiveFailures: number
  failureLimit: number
}

export interface AiFailureCircuitDecision {
  consecutiveFailures: number
  immediate: boolean
  shouldStop: boolean
}

interface AiFailureLike {
  kind?: unknown
  retryable?: unknown
}

export function createAiFailureCircuit(failureLimit = 2): AiFailureCircuit {
  return {
    consecutiveFailures: 0,
    failureLimit: Math.max(1, Math.round(Number(failureLimit) || 2))
  }
}

export function recordAiGenerationSuccess(circuit: AiFailureCircuit): void {
  circuit.consecutiveFailures = 0
}

export function recordAiGenerationFailure(
  circuit: AiFailureCircuit,
  error: unknown
): AiFailureCircuitDecision {
  circuit.consecutiveFailures += 1
  const immediate = isImmediateAiGenerationFailure(error)

  return {
    consecutiveFailures: circuit.consecutiveFailures,
    immediate,
    shouldStop: immediate || circuit.consecutiveFailures >= circuit.failureLimit
  }
}

export function isImmediateAiGenerationFailure(error: unknown): boolean {
  if (!error || typeof error !== 'object') {
    return false
  }

  const failure = error as AiFailureLike
  const kind = String(failure.kind || '')
  if (kind === 'configuration' || kind === 'permission') {
    return true
  }

  return kind === 'provider' && failure.retryable !== true
}
