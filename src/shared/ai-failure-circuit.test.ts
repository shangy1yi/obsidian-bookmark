import {
  createAiFailureCircuit,
  recordAiGenerationFailure,
  recordAiGenerationSuccess
} from './ai-failure-circuit.js'

function run(): void {
  testFatalProviderFailureStopsImmediately()
  testConsecutiveTerminalFailuresOpenCircuit()
  testSuccessResetsConsecutiveFailures()
}

function testFatalProviderFailureStopsImmediately(): void {
  const circuit = createAiFailureCircuit()
  const decision = recordAiGenerationFailure(circuit, {
    kind: 'provider',
    retryable: false,
    status: 401
  })

  assert(decision.immediate, 'non-retryable provider failures should be fatal')
  assert(decision.shouldStop, 'fatal provider failures should stop on the first terminal error')
  assert(decision.consecutiveFailures === 1, 'the first fatal failure should still be counted')
}

function testConsecutiveTerminalFailuresOpenCircuit(): void {
  const circuit = createAiFailureCircuit(2)
  const first = recordAiGenerationFailure(circuit, {
    kind: 'network',
    retryable: true
  })
  const second = recordAiGenerationFailure(circuit, {
    kind: 'network',
    retryable: true
  })

  assert(!first.shouldStop, 'one transient terminal failure should allow an isolation retry')
  assert(second.shouldStop, 'two consecutive terminal failures should open the circuit')
  assert(second.consecutiveFailures === 2, 'the circuit should expose the failure count')
}

function testSuccessResetsConsecutiveFailures(): void {
  const circuit = createAiFailureCircuit(2)
  recordAiGenerationFailure(circuit, { kind: 'parse' })
  recordAiGenerationSuccess(circuit)
  const next = recordAiGenerationFailure(circuit, { kind: 'parse' })

  assert(!next.shouldStop, 'a successful generation should reset the consecutive failure count')
  assert(next.consecutiveFailures === 1, 'the failure count should restart after a success')
}

function assert(value: unknown, message: string): void {
  if (!value) {
    throw new Error(message)
  }
}

run()
console.log('AI failure circuit tests passed.')
