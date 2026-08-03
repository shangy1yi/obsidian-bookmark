import {
  AI_PROVIDER_RESPONSE_MAX_BYTES,
  AiRuntimeError,
  buildAiProviderConnectivityRequestBody,
  buildAiFolderCandidates,
  compileStrictJsonSchema,
  normalizeAiFolderDecision,
  requestStructuredAiOutput,
  validateJsonSchema,
  validateKnownFolderId,
  type JsonSchema
} from './ai-runtime.js'
import {
  extractModelReasoningCapabilities,
  getModelReasoningProfile,
  getReasoningEffortOptions,
  resolveReasoningEffortForModel
} from './ai-reasoning.js'

const SAMPLE_SCHEMA: JsonSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['action', 'confidence', 'items'],
  properties: {
    action: { type: 'string', enum: ['keep', 'rename'] },
    confidence: { type: 'number', minimum: 0, maximum: 1 },
    items: {
      type: 'array',
      maxItems: 2,
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['id'],
        properties: {
          id: { type: 'string' }
        }
      }
    }
  }
}

const OPTIONAL_FOLDER_SCHEMA: JsonSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['items'],
  properties: {
    items: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['bookmark_id'],
        properties: {
          bookmark_id: { type: 'string' },
          folder_decision: {
            type: 'object',
            additionalProperties: false,
            required: ['kind', 'reason', 'confidence'],
            properties: {
              kind: { type: 'string', enum: ['existing', 'new', 'manual_review'] },
              folder_id: { type: 'string' },
              folder_path: { type: 'string' },
              reason: { type: 'string' },
              confidence: { type: 'number' }
            }
          }
        }
      }
    }
  }
}

async function run(): Promise<void> {
  testSchemaValidation()
  testStrictSchemaCompilation()
  testFolderCandidatesAndDecision()
  await testResponsesProviderEnvelope()
  await testResponsesReasoningBlocksIgnored()
  await testStrictOptionalNullRestoration()
  await testChatCompletionsEnvelope()
  await testParseRepairRetry()
  await testResponsesProviderErrorDoesNotFallback()
  await testProviderTextErrorBody()
  await testTimeoutErrorMessage()
  await testNoRetryForAbort()
  await testThinkTagAndProseExtraction()
  await testReasoningContentSalvage()
  await testChunkedReasoningResponseExtraction()
  await testTruncationDetection()
  await testResponsesInvalidSchemaFallback()
  await testResponseFormatFallback()
  await testResponseFormatFullFallback()
  await testRetryAfterBackoff()
  await testBodyReadTimeout()
  await testExternalAbortDuringBodyRead()
  await testOversizedResponseContentLength()
  await testOversizedStreamingResponse()
  await testProviderErrorRedaction()
  await testSharedRequestDeadline()
  testProviderConnectivityReasoningEffort()
  testOfficialProviderReasoningAdapters()
  await testReasoningEffortInjection()
  await testDirectAnthropicAdapter()
  await testReasoningEffortRejection()
  testModelReasoningProfiles()
}

function testProviderConnectivityReasoningEffort(): void {
  const genericChatBody = buildAiProviderConnectivityRequestBody({
    ...getSettings('chat_completions'),
    model: 'gpt-5.6-sol',
    reasoningEffort: 'max'
  }) as Record<string, any>
  assert(genericChatBody.model === 'gpt-5.6-sol', 'connectivity chat body should preserve the selected model')
  assert(Array.isArray(genericChatBody.messages), 'connectivity chat body should preserve its base prompt')
  assert(genericChatBody.reasoning_effort === 'max', 'generic connectivity chat should carry reasoning_effort')

  const responsesBody = buildAiProviderConnectivityRequestBody({
    ...getSettings('responses'),
    model: 'gpt-5.6-sol',
    reasoningEffort: 'max'
  }) as Record<string, any>
  assert(responsesBody.input === 'Reply with OK.', 'connectivity Responses body should preserve its base prompt')
  assert(responsesBody.reasoning?.effort === 'max', 'connectivity Responses should carry reasoning.effort')

  const genericChatOffBody = buildAiProviderConnectivityRequestBody({
    ...getSettings('chat_completions'),
    model: 'gpt-5.6-sol',
    reasoningEffort: 'none'
  }) as Record<string, any>
  assert(genericChatOffBody.reasoning_effort === 'none', 'GPT-5.6 Chat should send the real none effort')

  const responsesOffBody = buildAiProviderConnectivityRequestBody({
    ...getSettings('responses'),
    model: 'gpt-5.6-sol',
    reasoningEffort: 'none'
  }) as Record<string, any>
  assert(responsesOffBody.reasoning?.effort === 'none', 'GPT-5.6 Responses should send the real none effort')

  const openRouterBody = buildAiProviderConnectivityRequestBody({
    ...getSettings('chat_completions'),
    baseUrl: 'https://openrouter.ai/api/v1',
    model: 'gpt-5.6-sol',
    reasoningEffort: 'max'
  }) as Record<string, any>
  assert(openRouterBody.reasoning?.effort === 'max', 'OpenRouter connectivity chat should carry nested reasoning.effort')
  assert(!('reasoning_effort' in openRouterBody), 'OpenRouter connectivity chat should not receive reasoning_effort')

  const anthropicBody = buildAiProviderConnectivityRequestBody({
    ...getSettings('chat_completions'),
    baseUrl: 'https://api.anthropic.com/v1',
    model: 'claude-opus-4-6',
    reasoningEffort: 'max'
  }) as Record<string, any>
  assert(anthropicBody.model === 'claude-opus-4-6', 'Anthropic connectivity body should preserve the selected model')
  assert(anthropicBody.max_tokens === 16, 'Anthropic connectivity body should preserve max_tokens')
  assert(Array.isArray(anthropicBody.messages), 'Anthropic connectivity body should preserve its base prompt')
  assert(anthropicBody.output_config?.effort === 'max', 'direct Anthropic connectivity should carry output_config.effort')
  assert(anthropicBody.thinking?.type === 'adaptive', 'Claude 4.6 connectivity should enable adaptive thinking')

  const knownModelDefaultBody = buildAiProviderConnectivityRequestBody({
    ...getSettings('chat_completions'),
    model: 'gpt-5.6-sol',
    reasoningEffort: 'default'
  }) as Record<string, any>
  assert(
    knownModelDefaultBody.reasoning_effort === 'medium',
    'known-model default should materialize the same medium effort shown by the UI'
  )

  for (const model of ['gpt-5.2', 'gpt-5.4', 'gpt-5.4-mini', 'gpt-5.4-nano']) {
    const body = buildAiProviderConnectivityRequestBody({
      ...getSettings('chat_completions'),
      model,
      reasoningEffort: 'default'
    }) as Record<string, any>
    assert(body.reasoning_effort === 'none', `${model} default should materialize the documented none effort`)
  }
  const gpt55DefaultBody = buildAiProviderConnectivityRequestBody({
    ...getSettings('responses'),
    model: 'gpt-5.5',
    reasoningEffort: 'default'
  }) as Record<string, any>
  assert(gpt55DefaultBody.reasoning?.effort === 'medium', 'GPT-5.5 default should materialize medium')
  const gpt54ProDefaultBody = buildAiProviderConnectivityRequestBody({
    ...getSettings('responses'),
    model: 'gpt-5.4-pro',
    reasoningEffort: 'default'
  }) as Record<string, any>
  assert(gpt54ProDefaultBody.reasoning?.effort === 'medium', 'GPT-5.4 Pro default should materialize medium')
  const gpt55ProDefaultBody = buildAiProviderConnectivityRequestBody({
    ...getSettings('responses'),
    model: 'gpt-5.5-pro',
    reasoningEffort: 'default'
  }) as Record<string, any>
  assert(gpt55ProDefaultBody.reasoning?.effort === 'high', 'GPT-5.5 Pro default should materialize high')
  const directOpenAiProChatBody = buildAiProviderConnectivityRequestBody({
    ...getSettings('chat_completions'),
    baseUrl: 'https://api.openai.com/v1',
    model: 'gpt-5.4-pro',
    reasoningEffort: 'high'
  }) as Record<string, any>
  assert(
    !('reasoning_effort' in directOpenAiProChatBody) && !('reasoning' in directOpenAiProChatBody),
    'direct OpenAI GPT-5 Pro should fail closed on unsupported Chat Completions'
  )
  const directOpenAiProResponsesBody = buildAiProviderConnectivityRequestBody({
    ...getSettings('responses'),
    baseUrl: 'https://api.openai.com/v1',
    model: 'gpt-5.4-pro',
    reasoningEffort: 'high'
  }) as Record<string, any>
  assert(directOpenAiProResponsesBody.reasoning?.effort === 'high', 'direct OpenAI GPT-5 Pro Responses should send nested effort')
  for (const model of ['gpt-5.2-pro', 'gpt-5.2-codex', 'gpt-5.3', 'gpt-5.3-pro']) {
    const body = buildAiProviderConnectivityRequestBody({
      ...getSettings('responses'),
      model,
      reasoningEffort: 'default'
    }) as Record<string, any>
    assert(!('reasoning' in body), `${model} default should remain implicit when the official default is unknown`)
  }

  const unknownModelDefaultBody = buildAiProviderConnectivityRequestBody({
    ...getSettings('chat_completions'),
    model: 'vendor/unknown-model',
    reasoningEffort: 'default'
  }) as Record<string, any>
  assert(
    !('reasoning_effort' in unknownModelDefaultBody) && !('reasoning' in unknownModelDefaultBody),
    'unknown-model default should remain implicit for compatibility'
  )
}

function testOfficialProviderReasoningAdapters(): void {
  const build = (
    baseUrl: string,
    model: string,
    reasoningEffort: any,
    apiStyle: 'responses' | 'chat_completions' = 'chat_completions'
  ) => buildAiProviderConnectivityRequestBody({
    baseUrl,
    model,
    apiStyle,
    reasoningEffort
  }) as Record<string, any>

  const deepSeekMax = build('https://api.deepseek.com', 'deepseek-v4-pro', 'max')
  assert(deepSeekMax.thinking?.type === 'enabled', 'DeepSeek max should explicitly enable thinking')
  assert(deepSeekMax.reasoning_effort === 'max', 'DeepSeek max should use the real flat max effort')
  const deepSeekLegacyLow = build('https://api.deepseek.com', 'deepseek-v4-flash', 'low')
  assert(deepSeekLegacyLow.reasoning_effort === 'high', 'DeepSeek low alias should be canonicalized to real high')
  const deepSeekOff = build('https://api.deepseek.com', 'deepseek-v4-flash', 'none')
  assert(deepSeekOff.thinking?.type === 'disabled', 'DeepSeek off should explicitly disable thinking')
  assert(!('reasoning_effort' in deepSeekOff), 'DeepSeek off should not send a contradictory effort')
  const deepSeekReasonerHigh = build('https://api.deepseek.com', 'deepseek-reasoner', 'high')
  assert(
    deepSeekReasonerHigh.thinking?.type === 'enabled' && deepSeekReasonerHigh.reasoning_effort === 'high',
    'DeepSeek reasoner compatibility alias should send its real high effort'
  )
  const deepSeekReasonerMax = build('https://api.deepseek.com', 'deepseek-reasoner', 'max')
  assert(
    deepSeekReasonerMax.thinking?.type === 'enabled' && deepSeekReasonerMax.reasoning_effort === 'max',
    'DeepSeek reasoner compatibility alias should send its real max effort'
  )
  const deepSeekReasonerOff = build('https://api.deepseek.com', 'deepseek-reasoner', 'none')
  assert(
    deepSeekReasonerOff.thinking?.type === 'enabled' && deepSeekReasonerOff.reasoning_effort === 'high',
    'DeepSeek reasoner alias should canonicalize off to its mandatory high thinking mode'
  )

  const qwenResponses = build(
    'https://dashscope.aliyuncs.com/compatible-mode/v1',
    'qwen3.7-plus',
    'max',
    'responses'
  )
  assert(qwenResponses.reasoning?.effort === 'max', 'Qwen Responses should use nested reasoning.effort')
  assert(!('enable_thinking' in qwenResponses), 'Qwen Responses effort should not mix in deprecated enable_thinking')
  const qwenOpenResponses = build(
    'https://dashscope.aliyuncs.com/compatible-mode/v1',
    'qwen3.6-35b-a3b',
    'xhigh',
    'responses'
  )
  assert(qwenOpenResponses.reasoning?.effort === 'xhigh', 'official Qwen open model Responses should carry nested effort')
  const unsupportedQwenOpenResponses = build(
    'https://dashscope.aliyuncs.com/compatible-mode/v1',
    'qwen3-14b',
    'high',
    'responses'
  )
  assert(
    !('reasoning' in unsupportedQwenOpenResponses) && !('enable_thinking' in unsupportedQwenOpenResponses),
    'Qwen models outside the official Responses allow-list must fail closed'
  )
  const qwenBudget = build(
    'https://dashscope.aliyuncs.com/compatible-mode/v1',
    'qwen3.7-plus',
    'high'
  )
  assert(qwenBudget.enable_thinking === true, 'Qwen Chat budget should explicitly enable thinking')
  assert(qwenBudget.thinking_budget === 262144, 'Qwen 3.7 high should send its documented maximum budget')
  assert(!('reasoning_effort' in qwenBudget), 'budget-based Qwen should not receive a fake reasoning_effort')
  for (const qwenMaxModel of ['qwen3.7-max', 'qwen3.7-max-2026-05-20']) {
    const qwenMaxBudget = build(
      'https://dashscope.aliyuncs.com/compatible-mode/v1',
      qwenMaxModel,
      'high'
    )
    assert(
      qwenMaxBudget.enable_thinking === true && qwenMaxBudget.thinking_budget === 262144,
      `${qwenMaxModel} should use its documented 256K thinking budget`
    )
    assert(!('reasoning_effort' in qwenMaxBudget), `${qwenMaxModel} should not receive fake reasoning_effort`)
  }
  const qwen36MaxBudget = build(
    'https://dashscope.aliyuncs.com/compatible-mode/v1',
    'qwen3.6-max-preview',
    'high'
  )
  assert(
    qwen36MaxBudget.enable_thinking === true && qwen36MaxBudget.thinking_budget === 131072,
    'qwen3.6-max-preview should use its documented 128K thinking maximum'
  )
  const qwen36MaxResponses = build(
    'https://dashscope.aliyuncs.com/compatible-mode/v1',
    'qwen3.6-max-preview',
    'max',
    'responses'
  )
  assert(!('reasoning' in qwen36MaxResponses), 'qwen3.6-max-preview must fail closed on unsupported Responses')
  const qwenBudgetOff = build(
    'https://dashscope.aliyuncs.com/compatible-mode/v1',
    'qwen3.7-plus',
    'none'
  )
  assert(qwenBudgetOff.enable_thinking === false, 'Qwen Chat off should send enable_thinking=false')
  assert(!('thinking_budget' in qwenBudgetOff), 'Qwen Chat off should omit thinking_budget')
  const qwen38 = build(
    'https://dashscope.aliyuncs.com/compatible-mode/v1',
    'qwen3.8-max-preview',
    'max'
  )
  assert(qwen38.reasoning_effort === 'xhigh', 'Qwen 3.8 max alias should use its real xhigh effort')
  const qwqResponses = build(
    'https://dashscope.aliyuncs.com/compatible-mode/v1',
    'qwq-plus',
    'none',
    'responses'
  )
  assert(!('reasoning' in qwqResponses), 'fixed QwQ must not be routed through Qwen Responses effort')
  for (const qwenThinkingOnly of ['qwen3.7-max-preview', 'qwen3.7-max-2026-05-17']) {
    const qwenThinkingOnlyBody = build(
      'https://dashscope.aliyuncs.com/compatible-mode/v1',
      qwenThinkingOnly,
      'high'
    )
    assert(
      qwenThinkingOnlyBody.thinking_budget === 262144,
      `${qwenThinkingOnly} should send its documented 256K thinking budget`
    )
    assert(
      !('enable_thinking' in qwenThinkingOnlyBody) &&
        !('thinking' in qwenThinkingOnlyBody) &&
        !('reasoning_effort' in qwenThinkingOnlyBody),
      `${qwenThinkingOnly} should not receive a contradictory toggle or effort field`
    )
    const qwenThinkingOnlyResponses = build(
      'https://dashscope.aliyuncs.com/compatible-mode/v1',
      qwenThinkingOnly,
      'high',
      'responses'
    )
    assert(
      !('reasoning' in qwenThinkingOnlyResponses) && !('thinking_budget' in qwenThinkingOnlyResponses),
      `${qwenThinkingOnly} Responses should fail closed because it is not on the supported list`
    )
  }
  const qwenFlashBudget = build(
    'https://dashscope.aliyuncs.com/compatible-mode/v1',
    'qwen3.6-flash',
    'high'
  )
  assert(qwenFlashBudget.enable_thinking === true, 'Qwen Flash budget should explicitly enable thinking')
  assert(qwenFlashBudget.thinking_budget === 81920, 'Qwen Flash should receive its documented 80K budget')
  const qwenOpenBudget = build(
    'https://dashscope.aliyuncs.com/compatible-mode/v1',
    'qwen3-14b',
    'high'
  )
  assert(qwenOpenBudget.enable_thinking === true, 'Qwen3 open checkpoints should enable thinking')
  assert(qwenOpenBudget.thinking_budget === 38912, 'Qwen3 14B should receive its documented 38K budget')
  const qwenSmallBudget = build(
    'https://dashscope.aliyuncs.com/compatible-mode/v1',
    'qwen3-1.7b',
    'high'
  )
  assert(qwenSmallBudget.thinking_budget === 30720, 'Qwen3 1.7B should receive its documented 30K budget')
  const qwenLegacySnapshotBudget = build(
    'https://dashscope.aliyuncs.com/compatible-mode/v1',
    'qwen-plus-2025-07-28',
    'high'
  )
  assert(qwenLegacySnapshotBudget.thinking_budget === 81920, 'Qwen Plus dated thinking snapshots should receive their documented 80K budget')
  const qwenInstruct = build(
    'https://dashscope.aliyuncs.com/compatible-mode/v1',
    'qwen3-14b-instruct-2507',
    'high'
  )
  assert(
    !('enable_thinking' in qwenInstruct) && !('thinking_budget' in qwenInstruct) && !('reasoning_effort' in qwenInstruct),
    'Qwen3 instruct checkpoints must not receive thinking controls'
  )
  const qwenThinkingCheckpoint = build(
    'https://dashscope.aliyuncs.com/compatible-mode/v1',
    'qwen3-30b-a3b-thinking-2507',
    'high'
  )
  assert(qwenThinkingCheckpoint.thinking_budget === 81920, 'Qwen3 thinking checkpoints should receive their documented 80K budget')
  assert(!('enable_thinking' in qwenThinkingCheckpoint), 'Qwen3 thinking-only checkpoints must not receive a contradictory toggle')
  const qwenVlHybrid = build(
    'https://dashscope.aliyuncs.com/compatible-mode/v1',
    'qwen3-vl-plus',
    'high'
  )
  assert(qwenVlHybrid.enable_thinking === true, 'Qwen3-VL hybrid models should enable thinking explicitly')
  assert(qwenVlHybrid.thinking_budget === 81920, 'Qwen3-VL hybrid models should receive their documented budget')
  const qwenVlThinking = build(
    'https://dashscope.aliyuncs.com/compatible-mode/v1',
    'qwen3-vl-32b-thinking',
    'high'
  )
  assert(qwenVlThinking.thinking_budget === 81920, 'Qwen3-VL thinking-only models should receive their documented budget')
  assert(!('enable_thinking' in qwenVlThinking), 'Qwen3-VL thinking-only models must not receive a contradictory toggle')
  const qwenVlInstruct = build(
    'https://dashscope.aliyuncs.com/compatible-mode/v1',
    'qwen3-vl-235b-a22b-instruct',
    'high'
  )
  assert(!('enable_thinking' in qwenVlInstruct) && !('thinking_budget' in qwenVlInstruct), 'Qwen3-VL instruct models must not receive thinking controls')
  const qwqBudget = build(
    'https://dashscope.aliyuncs.com/compatible-mode/v1',
    'qwq-plus',
    'high'
  )
  assert(!('thinking_budget' in qwqBudget), 'QwQ Plus should remain fixed without an undocumented budget field')
  const qvqBudget = build(
    'https://dashscope.aliyuncs.com/compatible-mode/v1',
    'qvq-max',
    'high'
  )
  assert(!('thinking_budget' in qvqBudget), 'QVQ Max should remain fixed without an undocumented budget field')
  const qwenOmniOn = build(
    'https://dashscope.aliyuncs.com/compatible-mode/v1',
    'qwen3-omni-flash',
    'high'
  )
  assert(qwenOmniOn.enable_thinking === true, 'Qwen3 Omni Flash should use its documented thinking toggle')
  assert(!('thinking_budget' in qwenOmniOn), 'Qwen3 Omni Flash should not receive an undocumented budget')
  const qwenOmniOff = build(
    'https://dashscope.aliyuncs.com/compatible-mode/v1',
    'qwen3-omni-flash',
    'none'
  )
  assert(qwenOmniOff.enable_thinking === false, 'Qwen3 Omni Flash off should explicitly disable thinking')
  const qwenOmniResponses = build(
    'https://dashscope.aliyuncs.com/compatible-mode/v1',
    'qwen3-omni-flash',
    'high',
    'responses'
  )
  assert(!('reasoning' in qwenOmniResponses), 'Qwen3 Omni Flash must fail closed on unsupported Responses')
  for (const unsupportedQwen of [
    'qwen3-coder-plus',
    'qwen3-max-2025-09-23',
    'qwen-plus-2025-01-25',
    'qwen-long',
    'qwen2.5-72b-instruct'
  ]) {
    const body = build(
      'https://dashscope.aliyuncs.com/compatible-mode/v1',
      unsupportedQwen,
      'high'
    )
    assert(
      !('enable_thinking' in body) && !('thinking_budget' in body) && !('reasoning_effort' in body),
      `${unsupportedQwen} should not receive invented reasoning controls`
    )
  }
  const qwenCoderResponses = build(
    'https://dashscope.aliyuncs.com/compatible-mode/v1',
    'qwen3-coder-plus',
    'high',
    'responses'
  )
  assert(!('reasoning' in qwenCoderResponses), 'non-reasoning Qwen Responses models should omit effort')
  const dashscopeGlm = build(
    'https://dashscope.aliyuncs.com/compatible-mode/v1',
    'glm-5.2',
    'default'
  )
  assert(dashscopeGlm.enable_thinking === true, 'Bailian GLM effort should explicitly enable thinking')
  assert(dashscopeGlm.reasoning_effort === 'high', 'Bailian GLM default should use its documented high effort')
  const dashscopeGlmMinimal = build(
    'https://dashscope.aliyuncs.com/compatible-mode/v1',
    'glm-5.2',
    'minimal'
  )
  assert(dashscopeGlmMinimal.enable_thinking === true, 'Bailian GLM-5.2 minimal should keep thinking enabled')
  assert(dashscopeGlmMinimal.reasoning_effort === 'minimal', 'Bailian GLM-5.2 should preserve its real minimal effort')
  const dashscopeGlmMax = build(
    'https://dashscope.aliyuncs.com/compatible-mode/v1',
    'glm-5.2-fast-preview',
    'max'
  )
  assert(dashscopeGlmMax.reasoning_effort === 'max', 'Bailian GLM-5.2 variants should preserve the real max effort')
  for (const glmModel of ['glm-5.1', 'glm-5']) {
    const body = build(
      'https://dashscope.aliyuncs.com/compatible-mode/v1',
      glmModel,
      'max'
    )
    assert(body.reasoning_effort === 'xhigh', `${glmModel} should clamp max to its real highest xhigh effort`)
    assert(body.reasoning_effort !== 'max', `${glmModel} must not send the unsupported max effort`)
  }
  const dashscopeZhipuGlm52 = build(
    'https://dashscope.aliyuncs.com/compatible-mode/v1',
    'ZHIPU/GLM-5.2',
    'default'
  )
  assert(dashscopeZhipuGlm52.enable_thinking === true, 'Bailian ZHIPU/GLM-5.2 default should enable thinking')
  assert(dashscopeZhipuGlm52.reasoning_effort === 'max', 'Bailian ZHIPU/GLM-5.2 default should send its real max effort')
  const dashscopeZhipuGlm52Off = build(
    'https://dashscope.aliyuncs.com/compatible-mode/v1',
    'ZHIPU/GLM-5.2',
    'none'
  )
  assert(dashscopeZhipuGlm52Off.enable_thinking === false, 'Bailian ZHIPU/GLM-5.2 off should disable thinking')
  assert(!('reasoning_effort' in dashscopeZhipuGlm52Off), 'Bailian ZHIPU/GLM-5.2 off should omit effort')
  for (const glmModel of ['ZHIPU/GLM-5.1', 'ZHIPU/GLM-5']) {
    const body = build(
      'https://dashscope.aliyuncs.com/compatible-mode/v1',
      glmModel,
      'max'
    )
    assert(body.enable_thinking === true, `Bailian ${glmModel} should use enable_thinking`)
    assert(!('reasoning_effort' in body), `Bailian ${glmModel} must not receive reasoning_effort`)
  }
  const dashscopeGlmResponses = build(
    'https://dashscope.aliyuncs.com/compatible-mode/v1',
    'glm-5.2',
    'max',
    'responses'
  )
  assert(
    !('reasoning' in dashscopeGlmResponses) &&
      !('reasoning_effort' in dashscopeGlmResponses) &&
      !('enable_thinking' in dashscopeGlmResponses),
    'Bailian GLM must fail closed because it is not on the official Responses model list'
  )
  const dashscopeDeepSeekOff = build(
    'https://dashscope.aliyuncs.com/compatible-mode/v1',
    'deepseek-v4-flash',
    'none'
  )
  assert(dashscopeDeepSeekOff.enable_thinking === false, 'Bailian DeepSeek off should use enable_thinking=false')
  assert(!('reasoning_effort' in dashscopeDeepSeekOff), 'Bailian DeepSeek off should omit effort')
  const dashscopeDeepSeekResponses = build(
    'https://dashscope.aliyuncs.com/compatible-mode/v1',
    'deepseek-v4-flash',
    'high',
    'responses'
  )
  assert(
    !('reasoning' in dashscopeDeepSeekResponses) &&
      !('reasoning_effort' in dashscopeDeepSeekResponses) &&
      !('enable_thinking' in dashscopeDeepSeekResponses),
    'Bailian DeepSeek must fail closed because it is not on the official Responses model list'
  )
  const dashscopeKimiK3 = build(
    'https://dashscope.aliyuncs.com/compatible-mode/v1',
    'kimi/kimi-k3',
    'default'
  )
  assert(dashscopeKimiK3.reasoning_effort === 'max', 'Bailian Kimi K3 should explicitly send its only real max effort')
  const dashscopeKimiBudget = build(
    'https://dashscope.aliyuncs.com/compatible-mode/v1',
    'kimi-k2.5',
    'high'
  )
  assert(dashscopeKimiBudget.thinking_budget === 81920, 'Bailian-hosted Kimi K2.5 should send its real max budget')
  const dashscopeMoonshotKimi = build(
    'https://dashscope.aliyuncs.com/compatible-mode/v1',
    'kimi/kimi-k2.5',
    'high'
  )
  assert(dashscopeMoonshotKimi.enable_thinking === true, 'Moonshot-hosted Kimi on Bailian should use its toggle')
  assert(!('thinking_budget' in dashscopeMoonshotKimi), 'Moonshot-hosted Kimi on Bailian must not receive thinking_budget')
  const dashscopeMoonshotDefault = build(
    'https://dashscope.aliyuncs.com/compatible-mode/v1',
    'kimi/kimi-k2.5',
    'default'
  )
  assert(!('enable_thinking' in dashscopeMoonshotDefault), 'Moonshot-hosted Kimi default should preserve the provider default')
  const dashscopeMiniMaxFixed = build(
    'https://dashscope.aliyuncs.com/compatible-mode/v1',
    'MiniMax/MiniMax-M2.7',
    'high'
  )
  assert(!('reasoning_effort' in dashscopeMiniMaxFixed), 'Bailian MiniMax M2.x should omit fake effort')
  const dashscopeKimiResponses = build(
    'https://dashscope.aliyuncs.com/compatible-mode/v1',
    'kimi/kimi-k3',
    'max',
    'responses'
  )
  assert(
    !('reasoning' in dashscopeKimiResponses) && !('reasoning_effort' in dashscopeKimiResponses),
    'Bailian Kimi must fail closed because it is not on the official Responses model list'
  )
  const dashscopeMimoOn = build(
    'https://dashscope.aliyuncs.com/compatible-mode/v1',
    'xiaomi/mimo-v2.5-pro',
    'high'
  )
  assert(dashscopeMimoOn.enable_thinking === true, 'Bailian Xiaomi MiMo should use enable_thinking=true')
  assert(!('reasoning_effort' in dashscopeMimoOn), 'Bailian Xiaomi MiMo must not receive fake reasoning_effort')
  const dashscopeMimoOff = build(
    'https://dashscope.aliyuncs.com/compatible-mode/v1',
    'xiaomi/mimo-v2.5-pro',
    'none'
  )
  assert(dashscopeMimoOff.enable_thinking === false, 'Bailian Xiaomi MiMo off should use enable_thinking=false')
  const dashscopeUnknown = build(
    'https://dashscope.aliyuncs.com/compatible-mode/v1',
    'vendor/unknown-reasoning-model',
    'high'
  )
  assert(
    !('reasoning_effort' in dashscopeUnknown) && !('reasoning' in dashscopeUnknown) && !('enable_thinking' in dashscopeUnknown),
    'unknown Bailian Chat models must fail closed instead of receiving guessed reasoning fields'
  )

  const glmMax = build('https://open.bigmodel.cn/api/paas/v4', 'glm-5.2', 'default')
  assert(glmMax.thinking?.type === 'enabled', 'GLM-5.2 default should explicitly enable thinking')
  assert(glmMax.reasoning_effort === 'max', 'GLM-5.2 default should materialize the documented max effort')
  const glmOff = build('https://open.bigmodel.cn/api/paas/v4', 'glm-5.2', 'none')
  assert(glmOff.thinking?.type === 'disabled', 'GLM-5.2 off should explicitly disable thinking')
  assert(!('reasoning_effort' in glmOff), 'GLM-5.2 off should omit effort')
  const glmMinimal = build('https://open.bigmodel.cn/api/paas/v4', 'glm-5.2', 'minimal')
  assert(glmMinimal.thinking?.type === 'disabled', 'GLM-5.2 minimal legacy value should canonicalize to off')
  const glm47Off = build('https://open.bigmodel.cn/api/paas/v4', 'glm-4.7', 'none')
  assert(glm47Off.thinking?.type === 'disabled', 'GLM-4.7 should remain explicitly disableable')
  const glm5vOff = build('https://open.bigmodel.cn/api/paas/v4', 'glm-5v-turbo', 'none')
  assert(glm5vOff.thinking?.type === 'disabled', 'GLM-5V-Turbo should use the thinking toggle')
  for (const zhipuToggleModel of ['glm-5.1', 'glm-5']) {
    const body = build('https://open.bigmodel.cn/api/paas/v4', zhipuToggleModel, 'max')
    assert(body.thinking?.type === 'enabled', `direct Zhipu ${zhipuToggleModel} should use its thinking toggle`)
    assert(!('reasoning_effort' in body), `direct Zhipu ${zhipuToggleModel} must not receive reasoning_effort`)
  }

  const minimaxAdaptive = build('https://api.minimaxi.com/v1', 'MiniMax-M3', 'high')
  assert(minimaxAdaptive.thinking?.type === 'adaptive', 'MiniMax M3 on should send adaptive thinking')
  assert(!('reasoning_effort' in minimaxAdaptive), 'MiniMax M3 should never receive reasoning_effort')
  const minimaxDefault = build('https://api.minimaxi.com/v1', 'MiniMax-M3', 'default')
  assert(minimaxDefault.thinking?.type === 'adaptive', 'MiniMax M3 default should materialize adaptive thinking')
  const minimaxResponsesOn = build(
    'https://api.minimaxi.com/v1',
    'MiniMax-M3',
    'high',
    'responses'
  )
  assert(minimaxResponsesOn.reasoning?.effort === 'high', 'MiniMax M3 Responses should send nested effort to enable adaptive thinking')
  const minimaxResponsesDefault = build(
    'https://api.minimaxi.com/v1',
    'MiniMax-M3',
    'default',
    'responses'
  )
  assert(minimaxResponsesDefault.reasoning?.effort === 'none', 'MiniMax M3 Responses default should explicitly materialize its documented off state')
  const minimaxResponsesLegacyMax = build(
    'https://api.minimaxi.com/v1',
    'MiniMax-M3',
    'max',
    'responses'
  )
  assert(minimaxResponsesLegacyMax.reasoning?.effort === 'high', 'MiniMax M3 Responses should canonicalize legacy strengths to its adaptive on state')
  const minimaxFixed = build('https://api.minimaxi.com/v1', 'MiniMax-M2.7', 'high')
  assert(!('thinking' in minimaxFixed) && !('reasoning_effort' in minimaxFixed), 'MiniMax M2.x fixed thinking should omit fake controls')
  const minimaxFixedResponses = build(
    'https://api.minimaxi.com/v1',
    'MiniMax-M2.7',
    'none',
    'responses'
  )
  assert(!('reasoning' in minimaxFixedResponses), 'MiniMax M2.x Responses cannot disable fixed thinking and should omit fake controls')

  const siliconFlowV4 = build(
    'https://api.siliconflow.cn/v1',
    'deepseek-ai/DeepSeek-V4-Flash',
    'max'
  )
  assert(siliconFlowV4.reasoning_effort === 'max', 'SiliconFlow DeepSeek V4 Flash should use flat max effort')
  assert(!('enable_thinking' in siliconFlowV4), 'SiliconFlow DeepSeek V4 Flash should not receive the V3 toggle')
  const siliconFlowV4Com = build(
    'https://api.siliconflow.com/v1',
    'deepseek-ai/DeepSeek-V4-Flash',
    'max'
  )
  assert(!('reasoning_effort' in siliconFlowV4Com), 'SiliconFlow .com V4 Flash should fail closed without documented effort support')
  const siliconFlowV4ComMetadata = buildAiProviderConnectivityRequestBody({
    baseUrl: 'https://api.siliconflow.com/v1',
    model: 'deepseek-ai/DeepSeek-V4-Flash',
    apiStyle: 'chat_completions',
    reasoningEffort: 'max',
    reasoningCapabilities: {
      'deepseek-ai/deepseek-v4-flash': { levels: ['high', 'max'] }
    }
  }) as Record<string, any>
  assert(siliconFlowV4ComMetadata.reasoning_effort === 'max', 'explicit SiliconFlow .com metadata should enable V4 effort')
  const siliconFlowQwen = build(
    'https://api.siliconflow.com/v1',
    'Qwen/Qwen3-32B',
    'high'
  )
  assert(siliconFlowQwen.enable_thinking === true, 'SiliconFlow Qwen should use enable_thinking=true')
  assert(siliconFlowQwen.thinking_budget === 32768, 'SiliconFlow Qwen high should send the documented 32K budget')
  assert(!('reasoning_effort' in siliconFlowQwen), 'SiliconFlow Qwen must not receive fake reasoning_effort')
  const siliconFlowQwen235 = build('https://api.siliconflow.com/v1', 'Qwen/Qwen3-235B-A22B', 'high')
  assert(siliconFlowQwen235.enable_thinking === true && siliconFlowQwen235.thinking_budget === 32768, 'SiliconFlow .com Qwen3-235B should use the documented thinking controls')
  const siliconFlowChinaQwen235 = build('https://api.siliconflow.cn/v1', 'Qwen/Qwen3-235B-A22B', 'high')
  assert(!('enable_thinking' in siliconFlowChinaQwen235), 'SiliconFlow .cn must not copy the .com Qwen3-235B allowlist')
  const siliconFlowDeepSeekV32 = build(
    'https://api.siliconflow.cn/v1',
    'Pro/deepseek-ai/DeepSeek-V3.2',
    'medium'
  )
  assert(siliconFlowDeepSeekV32.enable_thinking === true, 'SiliconFlow DeepSeek V3.2 should use enable_thinking')
  assert(siliconFlowDeepSeekV32.thinking_budget === 8192, 'SiliconFlow DeepSeek V3.2 medium should use an 8K budget')
  const siliconFlowGlmOff = build(
    'https://api.siliconflow.cn/v1',
    'Pro/zai-org/GLM-4.7',
    'none'
  )
  assert(siliconFlowGlmOff.enable_thinking === false, 'SiliconFlow GLM off should use enable_thinking=false')
  assert(!('thinking_budget' in siliconFlowGlmOff), 'SiliconFlow GLM toggle should not invent a budget')
  const siliconFlowChinaGlm46 = build('https://api.siliconflow.cn/v1', 'zai-org/GLM-4.6', 'high')
  assert(siliconFlowChinaGlm46.enable_thinking === true, 'SiliconFlow .cn GLM-4.6 should use enable_thinking')
  const siliconFlowChinaGlm46v = build('https://api.siliconflow.cn/v1', 'zai-org/GLM-4.6V', 'high')
  assert(!('enable_thinking' in siliconFlowChinaGlm46v), 'SiliconFlow .cn must not copy the .com GLM-4.6V allowlist')
  const siliconFlowGlm5v = build('https://api.siliconflow.com/v1', 'zai-org/GLM-5V-Turbo', 'high')
  assert(siliconFlowGlm5v.enable_thinking === true, 'SiliconFlow .com GLM-5V-Turbo should use enable_thinking')
  const siliconFlowR1 = build('https://api.siliconflow.cn/v1', 'Pro/deepseek-ai/DeepSeek-R1', 'high')
  assert(siliconFlowR1.thinking_budget === 32768, 'SiliconFlow .cn DeepSeek-R1 should receive the selected thinking budget')
  assert(!('enable_thinking' in siliconFlowR1), 'SiliconFlow DeepSeek-R1 is fixed-thinking and must not receive a toggle')
  const siliconFlowR1International = build('https://api.siliconflow.com/v1', 'deepseek-ai/DeepSeek-R1', 'medium')
  assert(siliconFlowR1International.thinking_budget === 8192, 'SiliconFlow .com DeepSeek-R1 should receive the selected thinking budget')
  const siliconFlowResponses = build(
    'https://api.siliconflow.cn/v1',
    'Qwen/Qwen3-32B',
    'high',
    'responses'
  )
  assert(!('reasoning' in siliconFlowResponses) && !('enable_thinking' in siliconFlowResponses), 'SiliconFlow Responses should fail closed')
  const siliconFlowUnknown = build('https://api.siliconflow.cn/v1', 'vendor/future-model', 'high')
  assert(!('reasoning_effort' in siliconFlowUnknown) && !('enable_thinking' in siliconFlowUnknown), 'unknown SiliconFlow models should fail closed')
  const siliconFlowMetadata = buildAiProviderConnectivityRequestBody({
    baseUrl: 'https://api.siliconflow.cn/v1',
    model: 'vendor/future-model',
    apiStyle: 'chat_completions',
    reasoningEffort: 'high',
    reasoningCapabilities: {
      'vendor/future-model': { levels: ['low', 'medium', 'high'] }
    }
  }) as Record<string, any>
  assert(siliconFlowMetadata.reasoning_effort === 'high', 'explicit SiliconFlow model metadata should enable compatible flat effort')

  const doubaoChat = build(
    'https://ark.cn-beijing.volces.com/api/v3',
    'doubao-seed-2-1-pro-260628',
    'medium'
  )
  assert(doubaoChat.thinking?.type === 'enabled', 'Doubao Chat effort should explicitly enable thinking')
  assert(doubaoChat.reasoning_effort === 'medium', 'Doubao Chat should use flat reasoning_effort')
  const doubaoResponses = build(
    'https://ark.cn-beijing.volces.com/api/v3',
    'doubao-seed-2-1-turbo-260628',
    'high',
    'responses'
  )
  assert(doubaoResponses.thinking?.type === 'enabled', 'Doubao Responses should explicitly enable thinking')
  assert(doubaoResponses.reasoning?.effort === 'high', 'Doubao Responses should use nested reasoning.effort')
  const doubaoCharacter = build(
    'https://ark.cn-beijing.volces.com/api/v3',
    'doubao-seed-character-260628',
    'medium'
  )
  assert(doubaoCharacter.thinking?.type === 'enabled', 'Doubao Character should explicitly enable thinking')
  assert(doubaoCharacter.reasoning_effort === 'medium', 'Doubao Character should use the documented effort field')
  const doubaoMinimal = build(
    'https://ark.cn-beijing.volces.com/api/v3',
    'doubao-seed-2-1-pro-260628',
    'minimal'
  )
  assert(doubaoMinimal.thinking?.type === 'disabled', 'Doubao minimal legacy value should canonicalize to off')
  assert(!('reasoning_effort' in doubaoMinimal), 'Doubao off should not send a contradictory effort')
  const doubaoSwitchOnly = build(
    'https://ark.cn-beijing.volces.com/api/v3',
    'doubao-seed-1-6-vision-250815',
    'high'
  )
  assert(doubaoSwitchOnly.thinking?.type === 'enabled', 'switch-only Doubao should send thinking.enabled')
  assert(!('reasoning_effort' in doubaoSwitchOnly), 'switch-only Doubao must not receive reasoning_effort')
  const arkOpaqueEndpoint = build(
    'https://ark.cn-beijing.volces.com/api/v3',
    'ep-20260723-example',
    'high'
  )
  assert(!('thinking' in arkOpaqueEndpoint) && !('reasoning_effort' in arkOpaqueEndpoint), 'opaque Ark endpoint IDs should fail closed instead of guessing the bound model')

  const arkDeepSeekChat = build(
    'https://ark.cn-beijing.volces.com/api/v3',
    'deepseek-v4-pro-260425',
    'max'
  )
  assert(arkDeepSeekChat.thinking?.type === 'enabled', 'Ark DeepSeek V4 Chat should enable thinking')
  assert(arkDeepSeekChat.reasoning_effort === 'max', 'Ark DeepSeek V4 Chat should use flat max effort')
  const arkDeepSeekResponses = build(
    'https://ark.cn-beijing.volces.com/api/v3',
    'deepseek-v4-pro-260425',
    'high',
    'responses'
  )
  assert(arkDeepSeekResponses.thinking?.type === 'enabled', 'Ark DeepSeek V4 Responses should retain the thinking toggle')
  assert(!('reasoning' in arkDeepSeekResponses), 'Ark DeepSeek V4 Responses must not send unsupported reasoning.effort')
  const arkDeepSeekResponsesOff = build(
    'https://ark.cn-beijing.volces.com/api/v3',
    'deepseek-v4-flash-260425',
    'none',
    'responses'
  )
  assert(arkDeepSeekResponsesOff.thinking?.type === 'disabled', 'Ark DeepSeek V4 Responses off should disable thinking')

  const arkGlm47Off = build(
    'https://ark.cn-beijing.volces.com/api/v3',
    'glm-4-7-251222',
    'none'
  )
  assert(arkGlm47Off.thinking?.type === 'disabled', 'Ark GLM-4.7 should expose the thinking toggle')
  assert(!('reasoning_effort' in arkGlm47Off), 'Ark GLM-4.7 must not receive fake reasoning_effort')
  const arkDeepSeekV32Default = build(
    'https://ark.cn-beijing.volces.com/api/v3',
    'deepseek-v3-2-251201',
    'default'
  )
  assert(arkDeepSeekV32Default.thinking?.type === 'disabled', 'Ark DeepSeek V3.2 default should preserve documented disabled thinking')
  const arkDeepSeekV32High = build(
    'https://ark.cn-beijing.volces.com/api/v3',
    'deepseek-v3-2-251201',
    'high'
  )
  assert(arkDeepSeekV32High.thinking?.type === 'enabled', 'Ark DeepSeek V3.2 high should enable thinking')
  assert(!('reasoning_effort' in arkDeepSeekV32High), 'Ark DeepSeek V3.2 must not receive fake reasoning_effort')

  const kimiK3 = build('https://api.moonshot.cn/v1', 'kimi-k3', 'max')
  assert(kimiK3.reasoning_effort === 'max', 'Moonshot Kimi K3 should use flat max effort')
  const kimiK26Off = build('https://api.moonshot.cn/v1', 'kimi-k2.6', 'none')
  assert(kimiK26Off.thinking?.type === 'disabled', 'Moonshot Kimi K2.6 off should use thinking.type')
  assert(!('reasoning_effort' in kimiK26Off), 'Moonshot Kimi K2.6 should not receive effort')
  const moonshotResponses = build('https://api.moonshot.cn/v1', 'kimi-k3', 'max', 'responses')
  assert(!('reasoning' in moonshotResponses) && !('reasoning_effort' in moonshotResponses), 'Moonshot direct Responses should not pretend to support effort')
  const deepSeekResponses = build('https://api.deepseek.com', 'deepseek-v4-pro', 'max', 'responses')
  assert(!('reasoning' in deepSeekResponses) && !('reasoning_effort' in deepSeekResponses), 'DeepSeek direct Responses should not pretend to support effort')
  const deepSeekReasonerResponses = build('https://api.deepseek.com', 'deepseek-reasoner', 'max', 'responses')
  assert(!('reasoning' in deepSeekReasonerResponses), 'DeepSeek reasoner Responses should remain unsupported')

  const qianfanDeepSeek = build('https://qianfan.baidubce.com/v2', 'deepseek-v4-pro', 'max')
  assert(qianfanDeepSeek.reasoning_effort === 'max', 'Qianfan DeepSeek V4 should use its real flat max effort')
  const qianfanGptOss = build('https://qianfan.baidubce.com/v2', 'gpt-oss-120b', 'low')
  assert(qianfanGptOss.reasoning_effort === 'low', 'Qianfan GPT-OSS should send its documented flat effort')
  const qianfanGptOssResponses = build('https://qianfan.baidubce.com/v2', 'gpt-oss-20b', 'high', 'responses')
  assert(!('reasoning' in qianfanGptOssResponses), 'Qianfan GPT-OSS Responses should fail closed until officially supported')
  const qianfanDeepSeekOff = build('https://qianfan.baidubce.com/v2', 'deepseek-v4-flash', 'none')
  assert(qianfanDeepSeekOff.thinking?.type === 'disabled', 'Qianfan DeepSeek V4 Chat should be explicitly disableable')
  const qianfanDeepSeekResponses = build('https://qianfan.baidubce.com/v2', 'deepseek-v4-pro', 'high', 'responses')
  assert(qianfanDeepSeekResponses.thinking?.type === 'enabled', 'Qianfan DeepSeek Responses should use its documented thinking toggle')
  assert(!('reasoning_effort' in qianfanDeepSeekResponses), 'Qianfan DeepSeek Responses should not send undocumented effort')
  const qianfanV32 = build('https://qianfan.baidubce.com/v2', 'deepseek-v3.2', 'high')
  assert(qianfanV32.thinking?.type === 'enabled', 'Qianfan DeepSeek V3.2 Chat should use thinking.type=enabled')
  assert(!('thinking_budget' in qianfanV32), 'Qianfan DeepSeek V3.2 should not receive a budget absent from the official support list')
  const qianfanV32Off = build('https://qianfan.baidubce.com/v2', 'deepseek-v3.2', 'none')
  assert(qianfanV32Off.thinking?.type === 'disabled', 'Qianfan DeepSeek V3.2 Chat off should disable thinking')
  assert(!('thinking_budget' in qianfanV32Off), 'Qianfan DeepSeek V3.2 off should omit thinking_budget')
  const qianfanV32Responses = build('https://qianfan.baidubce.com/v2', 'deepseek-v3.2', 'high', 'responses')
  assert(qianfanV32Responses.thinking?.type === 'enabled', 'Qianfan DeepSeek V3.2 Responses should use thinking.type')
  assert(!('thinking_budget' in qianfanV32Responses), 'Qianfan Responses should not receive Chat-only thinking_budget')
  const qianfanV32Think = build('https://qianfan.baidubce.com/v2', 'deepseek-v3.2-think', 'high')
  assert(qianfanV32Think.thinking_budget === 32768, 'Qianfan DeepSeek V3.2 Think should send its documented 32K thinking budget')
  assert(!('thinking' in qianfanV32Think) && !('enable_thinking' in qianfanV32Think), 'Qianfan DeepSeek V3.2 Think should not receive a wrong toggle field')
  const qianfanV32ThinkResponses = build('https://qianfan.baidubce.com/v2', 'deepseek-v3.2-think', 'default', 'responses')
  assert(qianfanV32ThinkResponses.thinking?.type === 'enabled', 'Qianfan DeepSeek V3.2 Think default should enable thinking')
  const qianfanV31 = build('https://qianfan.baidubce.com/v2', 'deepseek-v3.1-250821', 'medium')
  assert(qianfanV31.thinking?.type === 'enabled', 'Qianfan DeepSeek V3.1 hybrid should enable thinking')
  assert(qianfanV31.thinking_budget === 16384, 'Qianfan DeepSeek V3.1 hybrid should send the selected real budget')
  const qianfanV31Think = build('https://qianfan.baidubce.com/v2', 'deepseek-v3.1-think-250821', 'high')
  assert(qianfanV31Think.thinking_budget === 32768, 'Qianfan DeepSeek V3.1 Think should send its documented 32K budget')
  assert(!('thinking' in qianfanV31Think), 'Qianfan DeepSeek V3.1 Think is fixed and should not receive a toggle')
  const qianfanR1 = build('https://qianfan.baidubce.com/v2', 'deepseek-r1-250528', 'high')
  assert(qianfanR1.thinking_budget === 32768, 'Qianfan DeepSeek R1 should send its documented 32K budget')
  assert(!('thinking' in qianfanR1), 'Qianfan DeepSeek R1 is fixed and should not receive a toggle')
  const qianfanR1Alias = build('https://qianfan.baidubce.com/v2', 'deepseek-r1', 'high')
  assert(!('thinking_budget' in qianfanR1Alias), 'Qianfan DeepSeek R1 alias should omit budget because only the dated ID is documented')
  const qianfanR1Responses = build('https://qianfan.baidubce.com/v2', 'deepseek-r1', 'high', 'responses')
  assert(!('thinking' in qianfanR1Responses) && !('thinking_budget' in qianfanR1Responses), 'Qianfan DeepSeek R1 Responses should fail closed')
  for (const qwenThinkingModel of [
    'qwen3-235b-a22b-thinking-2507',
    'qwen3-30b-a3b-thinking-2507'
  ]) {
    const qwenThinkingBody = build('https://qianfan.baidubce.com/v2', qwenThinkingModel, 'high')
    assert(qwenThinkingBody.thinking_budget === 32768, `Qianfan ${qwenThinkingModel} should send its documented 32K thinking budget`)
    assert(!('thinking' in qwenThinkingBody) && !('enable_thinking' in qwenThinkingBody), `Qianfan ${qwenThinkingModel} should not receive a toggle field`)
    const qwenThinkingResponses = build('https://qianfan.baidubce.com/v2', qwenThinkingModel, 'high', 'responses')
      assert(!('thinking' in qwenThinkingResponses) && !('reasoning' in qwenThinkingResponses), `Qianfan ${qwenThinkingModel} Responses should fail closed`)
  }
  const qianfanQwenNext = build('https://qianfan.baidubce.com/v2', 'qwen3-next-80b-a3b-thinking', 'high')
  assert(!('thinking_budget' in qianfanQwenNext), 'Qianfan Qwen3 Next should omit budget because it is absent from the official field support list')
  const qianfanQwenHybrid = build('https://qianfan.baidubce.com/v2', 'qwen3-14b', 'high')
  assert(qianfanQwenHybrid.enable_thinking === true, 'Qianfan Qwen3 hybrid should explicitly enable thinking')
  assert(qianfanQwenHybrid.thinking_budget === 16384, 'Qianfan Qwen3 hybrid should send its documented 16K thinking budget')
  const qianfanQwenHybridOff = build('https://qianfan.baidubce.com/v2', 'qwen3-14b', 'none')
  assert(qianfanQwenHybridOff.enable_thinking === false, 'Qianfan Qwen3 hybrid off should disable thinking')
  assert(!('thinking_budget' in qianfanQwenHybridOff), 'Qianfan Qwen3 hybrid off should omit thinking_budget')
  for (const qwenModel of ['qwen3-4b', 'qwen3-1.7b', 'qwen3-0.6b']) {
    const qwenBody = build('https://qianfan.baidubce.com/v2', qwenModel, 'high')
    assert(qwenBody.enable_thinking === true, `Qianfan ${qwenModel} should use enable_thinking=true`)
  }
  const qianfanGlm5 = build('https://qianfan.baidubce.com/v2', 'glm-5', 'high')
  assert(qianfanGlm5.thinking?.type === 'enabled', 'Qianfan GLM-5 Chat should use thinking.type')
  const qianfanGlm52 = build('https://qianfan.baidubce.com/v2', 'glm-5.2', 'high')
  assert(!('thinking' in qianfanGlm52) && !('reasoning_effort' in qianfanGlm52), 'Qianfan GLM-5.2 should not receive an undocumented control field')
  const qianfanGlm51Responses = build('https://qianfan.baidubce.com/v2', 'glm-5.1', 'none', 'responses')
  assert(qianfanGlm51Responses.thinking?.type === 'disabled', 'Qianfan GLM-5.1 Responses off should disable thinking')
  assert(!('reasoning_effort' in qianfanGlm51Responses), 'Qianfan GLM-5.1 should not receive fake reasoning_effort')
  const qianfanKimi = build('https://qianfan.baidubce.com/v2', 'kimi-k2.5', 'high')
  assert(qianfanKimi.thinking?.type === 'enabled', 'Qianfan Kimi K2.5 Chat should use thinking.type')
  const qianfanKimi26 = build('https://qianfan.baidubce.com/v2', 'kimi-k2.6', 'high')
  assert(!('thinking' in qianfanKimi26) && !('reasoning_effort' in qianfanKimi26), 'Qianfan Kimi K2.6 should not receive an undocumented control field')
  const qianfanQwen35 = build('https://qianfan.baidubce.com/v2', 'qwen3.5-397b-a17b', 'high')
  assert(!('enable_thinking' in qianfanQwen35) && !('thinking_budget' in qianfanQwen35), 'Qianfan Qwen3.5 should not receive undocumented controls')
  const ernieFixed = build('https://qianfan.baidubce.com/v2', 'ernie-x1.1', 'high')
  assert(!('reasoning_effort' in ernieFixed) && !('thinking' in ernieFixed), 'fixed ERNIE thinking should omit fake controls')
  const ernieAliasHost = build('https://qianfan.bj.baidubce.com/v2', 'ernie-x1.1', 'high')
  assert(!('reasoning_effort' in ernieAliasHost), 'Qianfan Beijing alias host should use the same fixed-ERNIE routing')
  const ernieResponses = build('https://qianfan.baidubce.com/v2', 'ernie-5.0-thinking-preview', 'high', 'responses')
  assert(!('thinking' in ernieResponses) && !('enable_thinking' in ernieResponses), 'unsupported Qianfan ERNIE Responses should omit invented controls')
  const ernieVlDefault = build('https://qianfan.baidubce.com/v2', 'ernie-4.5-turbo-vl', 'default')
  assert(ernieVlDefault.enable_thinking === false, 'Qianfan ERNIE 4.5 VL default should remain disabled')
  const qianfanQwenResponses = build('https://qianfan.baidubce.com/v2', 'qwen3-14b', 'none', 'responses')
  assert(qianfanQwenResponses.thinking?.type === 'disabled', 'Qianfan Qwen Responses off should use thinking.type=disabled')
  assert(!('enable_thinking' in qianfanQwenResponses), 'Qianfan Qwen Responses must not use enable_thinking')
  const qianfanQwenResponsesDefault = build('https://qianfan.baidubce.com/v2', 'qwen3-14b', 'default', 'responses')
  assert(qianfanQwenResponsesDefault.thinking?.type === 'enabled', 'Qianfan Qwen Responses default should materialize enabled')

  const hy3Default = build('https://tokenhub.tencentmaas.com/v1', 'hy3-preview', 'default')
  assert(!('reasoning_effort' in hy3Default) && !('thinking' in hy3Default), 'Hy3 default should preserve provider auto/disabled behavior')
  const hy3High = build('https://tokenhub.tencentmaas.com/v1', 'hy3-preview', 'high')
  assert(hy3High.thinking?.type === 'enabled', 'Hy3 explicit effort should enable thinking')
  assert(hy3High.reasoning_effort === 'high', 'Hy3 Chat should use flat reasoning_effort')
  const hy3ResponsesHigh = build('https://tokenhub.tencentmaas.cn/v1', 'hy3-preview', 'high', 'responses')
  assert(hy3ResponsesHigh.reasoning?.effort === 'high', 'Hy3 Responses should use nested reasoning.effort')
  assert(!('thinking' in hy3ResponsesHigh), 'Hy3 Responses should not mix in Chat thinking fields')
  const hy3ResponsesOff = build('https://tokenhub-intl.tencentmaas.com/v1', 'hy3', 'none', 'responses')
  assert(hy3ResponsesOff.reasoning?.effort === 'none', 'Hy3 Responses off should send nested none')
  const tokenHubKimiK3 = build('https://tokenhub.tencentmaas.com/v1', 'kimi-k3', 'max')
  assert(tokenHubKimiK3.reasoning_effort === 'max', 'TokenHub Kimi K3 should send its fixed top-level max effort')
  assert(!('thinking' in tokenHubKimiK3), 'TokenHub Kimi K3 must not mix in K2 thinking')
  const tokenHubKimiK3Responses = build('https://tokenhub.tencentmaas.com/v1', 'kimi-k3', 'max', 'responses')
  assert(!('reasoning' in tokenHubKimiK3Responses) && !('reasoning_effort' in tokenHubKimiK3Responses), 'TokenHub Kimi K3 Responses should fail closed until officially supported')
  const tokenHubIntlAlias = build('https://tokenhub-intl.tencentcloudmaas.com/v1', 'hy3', 'high')
  assert(tokenHubIntlAlias.thinking?.type === 'enabled' && tokenHubIntlAlias.reasoning_effort === 'high', 'TokenHub international Hy3 should use Chat effort plus thinking')
  const tokenHubIntlDeepSeek = build('https://tokenhub-intl.tencentcloudmaas.com/v1', 'deepseek-v4-pro', 'high')
  assert(tokenHubIntlDeepSeek.thinking?.type === 'enabled', 'TokenHub international DeepSeek should enable thinking')
  assert(tokenHubIntlDeepSeek.thinking?.reasoning_effort === 'high', 'TokenHub international DeepSeek should nest reasoning_effort inside thinking')
  assert(!('reasoning_effort' in tokenHubIntlDeepSeek), 'TokenHub international DeepSeek should not use a top-level effort')
  const tokenHubIntlDeepSeekOff = build('https://tokenhub-intl.tencentcloudmaas.com/v1', 'deepseek-v4-pro', 'none')
  assert(tokenHubIntlDeepSeekOff.thinking?.type === 'disabled', 'TokenHub international DeepSeek off should disable thinking')
  const tokenHubIntlDeepSeekResponses = build('https://tokenhub-intl.tencentcloudmaas.com/v1', 'deepseek-v4-pro', 'max', 'responses')
  assert(tokenHubIntlDeepSeekResponses.reasoning?.effort === 'max', 'TokenHub international DeepSeek Responses should use nested max effort')
  assert(!('thinking' in tokenHubIntlDeepSeekResponses), 'TokenHub international DeepSeek Responses should not use Chat thinking')
  const tokenHubIntlV32Default = build('https://tokenhub-intl.tencentcloudmaas.com/v1', 'deepseek-v3.2', 'default')
  assert(tokenHubIntlV32Default.thinking?.type === 'disabled', 'TokenHub international DeepSeek V3.2 default should preserve disabled thinking')
  const tokenHubIntlGlm = build('https://tokenhub-intl.tencentcloudmaas.com/v1', 'glm-5.2', 'max')
  assert(tokenHubIntlGlm.thinking?.type === 'enabled', 'TokenHub international GLM should enable thinking')
  assert(tokenHubIntlGlm.reasoning_effort === 'max', 'TokenHub international GLM should use top-level max effort')
  const tokenHubIntlGlmOff = build('https://tokenhub-intl.tencentcloudmaas.com/v1', 'glm-5.2', 'none')
  assert(tokenHubIntlGlmOff.thinking?.type === 'disabled', 'TokenHub international GLM off should disable thinking')
  assert(!('reasoning_effort' in tokenHubIntlGlmOff), 'TokenHub international GLM off should omit effort')
  const tokenHubGlmChat = build('https://tokenhub.tencentmaas.com/v1', 'glm-5.2', 'max')
  assert(tokenHubGlmChat.thinking?.type === 'enabled', 'TokenHub GLM-5.2 Chat should enable thinking')
  assert(tokenHubGlmChat.reasoning_effort === 'max', 'TokenHub GLM-5.2 Chat should send its real max effort')
  const tokenHubGlmResponses = build('https://tokenhub.tencentmaas.com/v1', 'glm-5.2', 'max', 'responses')
  assert(tokenHubGlmResponses.reasoning?.effort === 'max', 'TokenHub GLM-5.2 Responses should use nested max effort')
  assert(!('thinking' in tokenHubGlmResponses), 'TokenHub GLM-5.2 Responses should not mix Chat thinking fields')
  const tokenHubQwenOn = build('https://tokenhub.tencentmaas.com/v1', 'qwen3.5-plus', 'high')
  assert(tokenHubQwenOn.enable_thinking === true, 'TokenHub Qwen3.5 should use enable_thinking=true')
  assert(!('thinking' in tokenHubQwenOn), 'TokenHub Qwen3.5 must not use the generic thinking object')
  const tokenHubQwenOff = build('https://tokenhub.tencentmaas.com/v1', 'qwen3.5-flash', 'none')
  assert(tokenHubQwenOff.enable_thinking === false, 'TokenHub Qwen3.5 off should use enable_thinking=false')
  const unsupportedTokenHubResponses = build('https://tokenhub.tencentmaas.com/v1', 'kimi-k2.6', 'high', 'responses')
  assert(!('reasoning' in unsupportedTokenHubResponses) && !('thinking' in unsupportedTokenHubResponses), 'unsupported TokenHub Responses models should omit invented controls')
  const tokenHubV32Responses = build('https://tokenhub.tencentmaas.com/v1', 'deepseek-v3.2', 'high', 'responses')
  assert(!('reasoning' in tokenHubV32Responses), 'TokenHub DeepSeek V3.2 should not claim Responses effort support')

  const vanchinNamedAlias = build(
    'https://wanqing.streamlakeapi.com/api/gateway/v1/endpoints',
    'qwen3-30b-a3b',
    'high'
  )
  assert(
    !('enable_thinking' in vanchinNamedAlias) && !('reasoning_effort' in vanchinNamedAlias),
    'Vanchin must not infer reasoning controls from a model alias because the official model value is an opaque endpoint ID'
  )
  const vanchinOpaqueChat = build(
    'https://wanqing.streamlakeapi.com/api/gateway/v1/endpoints',
    'ep-b0cx22-example',
    'high'
  )
  assert(!('enable_thinking' in vanchinOpaqueChat) && !('reasoning_effort' in vanchinOpaqueChat), 'opaque Vanchin Chat endpoint IDs should fail closed')
  const vanchinResponses = build(
    'https://wanqing.streamlakeapi.com/api/gateway/v1/endpoints',
    'ep-b0cx22-example',
    'high',
    'responses'
  )
  assert(!('reasoning' in vanchinResponses) && !('enable_thinking' in vanchinResponses), 'opaque Vanchin Responses should fail closed without metadata')
  const vanchinResponsesMetadata = buildAiProviderConnectivityRequestBody({
    baseUrl: 'https://wanqing.streamlakeapi.com/api/gateway/v1/endpoints',
    model: 'ep-b0cx22-example',
    apiStyle: 'responses',
    reasoningEffort: 'high',
    reasoningCapabilities: {
      'ep-b0cx22-example': { levels: ['low', 'medium', 'high'] }
    }
  }) as Record<string, any>
  assert(vanchinResponsesMetadata.reasoning?.effort === 'high', 'explicit Vanchin endpoint metadata should enable nested effort')
  const vanchinNamedResponses = build(
    'https://wanqing.streamlakeapi.com/api/gateway/v1/endpoints',
    'qwen3-30b-a3b',
    'high',
    'responses'
  )
  assert(!('reasoning' in vanchinNamedResponses), 'Vanchin Responses should require explicit effort metadata even for a named model')
  const vanchinResponsesDefault = build(
    'https://wanqing.streamlakeapi.com/api/gateway/v1/endpoints',
    'ep-b0cx22-example',
    'default',
    'responses'
  )
  assert(!('reasoning' in vanchinResponsesDefault), 'Vanchin Responses default should preserve endpoint behavior')

  const stepDefault = build('https://api.stepfun.com/v1', 'step-3.7-flash', 'default')
  assert(!('reasoning_effort' in stepDefault), 'StepFun default should remain omitted because the default is undocumented')
  const stepHigh = build('https://api.stepfun.com/v1', 'step-3.7-flash', 'high')
  assert(stepHigh.reasoning_effort === 'high', 'StepFun explicit effort should be sent unchanged')
  const stepInternationalChat = build('https://api.stepfun.ai/v1', 'step-3.7-flash', 'medium')
  assert(stepInternationalChat.reasoning_effort === 'medium', 'StepFun .ai Chat should use flat reasoning_effort')
  const stepInternationalResponses = build('https://api.stepfun.ai/v1', 'step-3.7-flash', 'high', 'responses')
  assert(stepInternationalResponses.reasoning?.effort === 'high', 'StepFun .ai Responses should use nested reasoning.effort')
  const stepChinaResponses = build('https://api.stepfun.com/v1', 'step-3.7-flash', 'medium', 'responses')
  assert(stepChinaResponses.reasoning?.effort === 'medium', 'StepFun .com Responses should use nested reasoning.effort')
  const step35Chat = build('https://api.stepfun.com/v1', 'step-3.5-flash-2603', 'low')
  assert(step35Chat.reasoning_effort === 'low', 'StepFun 3.5 Flash 2603 Chat should use its documented low/high effort field')
  const metadataDrivenStep = buildAiProviderConnectivityRequestBody({
    baseUrl: 'https://api.stepfun.com/v1',
    model: 'step-future-reasoner',
    apiStyle: 'chat_completions',
    reasoningEffort: 'high',
    reasoningCapabilities: {
      'step-future-reasoner': { levels: ['low', 'medium', 'high'], defaultEffort: 'medium' }
    }
  }) as Record<string, any>
  assert(metadataDrivenStep.reasoning_effort === 'high', 'explicit future-model metadata should enable the compatible transport')
  const unsupportedStepResponsesWithMetadata = buildAiProviderConnectivityRequestBody({
    baseUrl: 'https://api.stepfun.com/v1',
    model: 'step-future-reasoner',
    apiStyle: 'responses',
    reasoningEffort: 'high',
    reasoningCapabilities: {
      'step-future-reasoner': { levels: ['low', 'medium', 'high'] }
    }
  }) as Record<string, any>
  assert(!('reasoning' in unsupportedStepResponsesWithMetadata), 'StepFun Responses must stay fail-closed for models outside its official allowlist')

  const geminiDefault = build(
    'https://generativelanguage.googleapis.com/v1beta/openai',
    'gemini-3.5-flash',
    'default'
  )
  assert(geminiDefault.reasoning_effort === 'medium', 'Gemini 3.5 Flash default should materialize medium')
  const geminiResponses = build(
    'https://generativelanguage.googleapis.com/v1beta/openai',
    'gemini-3.5-flash',
    'high',
    'responses'
  )
  assert(!('reasoning' in geminiResponses), 'Gemini direct should not claim unsupported Responses effort')
  const gemini31FlashLite = build(
    'https://generativelanguage.googleapis.com/v1beta/openai',
    'gemini-3.1-flash-lite',
    'minimal'
  )
  assert(
    gemini31FlashLite.reasoning_effort === 'minimal',
    'Gemini 3.1 Flash-Lite should send its documented minimal effort'
  )
  const gemini31FlashLiteHigh = build(
    'https://generativelanguage.googleapis.com/v1beta/openai',
    'gemini-3.1-flash-lite',
    'high'
  )
  assert(
    gemini31FlashLiteHigh.reasoning_effort === 'high',
    'Gemini 3.1 Flash-Lite should send its documented high effort'
  )
  const grokDefault = build('https://api.x.ai/v1', 'grok-4.5', 'default')
  assert(grokDefault.reasoning_effort === 'high', 'Grok 4.5 default should materialize high')
  const grokNonReasoning = build('https://api.x.ai/v1', 'grok-4.20-0309-non-reasoning', 'high')
  assert(!('reasoning_effort' in grokNonReasoning), 'xAI non-reasoning models should never receive effort')
  const grokFixedReasoning = build('https://api.x.ai/v1', 'grok-4.20-0309-reasoning', 'high')
  assert(!('reasoning_effort' in grokFixedReasoning), 'xAI Grok 4.20 reasoning models should remain fixed and omit effort')
  const grokMultiAgentDefault = build('https://api.x.ai/v1', 'grok-4.20-multi-agent', 'default', 'responses')
  assert(!('reasoning' in grokMultiAgentDefault), 'Grok multi-agent default should not silently force 16 agents')
  const grokMultiAgentFour = build('https://api.x.ai/v1', 'grok-4.20-multi-agent', 'medium', 'responses')
  assert(
    grokMultiAgentFour.reasoning?.effort === 'medium',
    'Grok multi-agent medium should select the documented 4-agent setup'
  )
  const grokMultiAgentSixteen = build('https://api.x.ai/v1', 'grok-4.20-multi-agent', 'xhigh', 'responses')
  assert(
    grokMultiAgentSixteen.reasoning?.effort === 'xhigh',
    'Grok multi-agent xhigh should select the documented 16-agent setup'
  )
  const mistralXHigh = build('https://api.mistral.ai/v1', 'mistral-small-latest', 'xhigh')
  assert(mistralXHigh.reasoning_effort === 'xhigh', 'Mistral should receive its documented xhigh value')
  const mistralVersioned = build('https://api.mistral.ai/v1', 'mistral-small-2603', 'xhigh')
  assert(mistralVersioned.reasoning_effort === 'xhigh', 'versioned Mistral Small should retain xhigh support')
  const mistralResponses = build('https://api.mistral.ai/v1', 'mistral-small-latest', 'high', 'responses')
  assert(!('reasoning' in mistralResponses), 'Mistral direct should not claim unsupported Responses effort')
  const step35Responses = build('https://api.stepfun.com/v1', 'step-3.5-flash-2603', 'high', 'responses')
  assert(!('reasoning' in step35Responses), 'StepFun 3.5 should not claim unsupported Responses effort')

  const legacyHunyuan = build('https://api.hunyuan.cloud.tencent.com/v1', 'hunyuan-t1-latest', 'high')
  assert(!('reasoning_effort' in legacyHunyuan), 'legacy Hunyuan should not receive undocumented effort')
}

function testStrictSchemaCompilation(): void {
  const strictSchema = compileStrictJsonSchema(OPTIONAL_FOLDER_SCHEMA)
  const itemSchema = strictSchema.properties?.items?.items
  const decisionSchema = itemSchema?.properties?.folder_decision
  const decisionTypes = Array.isArray(decisionSchema?.type)
    ? decisionSchema.type
    : [decisionSchema?.type]
  const folderIdTypes = Array.isArray(decisionSchema?.properties?.folder_id?.type)
    ? decisionSchema.properties.folder_id.type
    : [decisionSchema?.properties?.folder_id?.type]

  assert(itemSchema?.required?.includes('folder_decision'), 'strict item schema should require folder_decision')
  assert(decisionTypes.includes('object') && decisionTypes.includes('null'), 'optional object should become nullable')
  assert(
    ['kind', 'folder_id', 'folder_path', 'reason', 'confidence']
      .every((key) => decisionSchema?.required?.includes(key)),
    'strict nested object should require every property, including folder_id and folder_path'
  )
  assert(folderIdTypes.includes('string') && folderIdTypes.includes('null'), 'optional folder_id should become nullable')
  assert(
    !OPTIONAL_FOLDER_SCHEMA.properties?.items?.items?.required?.includes('folder_decision'),
    'strict compilation must not mutate the business schema'
  )
}

function testModelReasoningProfiles(): void {
  assert(getModelReasoningProfile('gpt-5').levels.includes('minimal'), 'gpt-5 should offer minimal')
  assert(!getModelReasoningProfile('gpt-5.5').levels.includes('minimal'), 'gpt-5.1+ should drop minimal')
  assert(
    getModelReasoningProfile('gpt-5.6-sol').levels.join(',') === 'none,low,medium,high,xhigh,max',
    'gpt-5.6 should expose off plus the five current strength levels'
  )
  assert(
    getModelReasoningProfile('gpt-5.5').levels.join(',') === 'none,low,medium,high,xhigh',
    'gpt-5.5 should expose off through xhigh but not max'
  )
  assert(getModelReasoningProfile('o4-mini').supported, 'o-series should support effort')
  assert(!getModelReasoningProfile('gpt-4o').supported, 'gpt-4o is not a reasoning model')
  assert(getModelReasoningProfile('deepseek-v4-flash').supported, 'deepseek v4 should support effort')
  assert(getModelReasoningProfile('qwen3-max').supported, 'unknown gateways should retain explicit compatible effort controls')
  assert(getModelReasoningProfile('grok-4.3').supported, 'grok 4.3 should support effort')
  assert(!getModelReasoningProfile('grok-4').supported, 'legacy grok-4 rejects reasoning_effort')
  assert(getModelReasoningProfile('claude-sonnet-5').supported, 'claude via openrouter maps effort')
  assert(
    getModelReasoningProfile('claude-sonnet-5').levels.includes('max'),
    'claude sonnet 5 should expose max'
  )
  assert(
    !getModelReasoningProfile('claude-sonnet-4-6').levels.includes('xhigh') &&
      getModelReasoningProfile('claude-sonnet-4-6').levels.includes('max'),
    'claude sonnet 4.6 should expose max without xhigh'
  )
  assert(getModelReasoningProfile('my-house-model').supported, 'unknown models fall back to standard levels')
  assert(getReasoningEffortOptions('gpt-5').length === 4, 'gpt-5 should expose four actual strength levels')
  assert(getReasoningEffortOptions('gpt-5.6-sol').length === 6, 'gpt-5.6 should expose off plus five strength levels')
  assert(resolveReasoningEffortForModel('gpt-4o', 'high') === 'default', 'unsupported model resolves to default')
  assert(resolveReasoningEffortForModel('gpt-5.6-sol', 'default') === 'medium', 'default should point at model default in the UI')
  assert(resolveReasoningEffortForModel('gpt-5', 'minimal') === 'minimal', 'supported level passes through')

  const deepSeekDirectContext = {
    baseUrl: 'https://api.deepseek.com',
    apiStyle: 'chat_completions'
  }
  assert(
    getModelReasoningProfile('deepseek-v4-flash', null, deepSeekDirectContext).levels.join(',') === 'none,high,max',
    'direct DeepSeek should only expose real off/high/max controls'
  )
  assert(
    resolveReasoningEffortForModel('deepseek-v4-flash', 'xhigh', null, deepSeekDirectContext) === 'max',
    'direct DeepSeek xhigh legacy value should canonicalize to max'
  )

  const qwenChatContext = {
    baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
    apiStyle: 'chat_completions'
  }
  const qwenBudgetOptions = getReasoningEffortOptions('qwen3.7-plus', null, qwenChatContext)
  assert(qwenBudgetOptions.map((item) => item.label).join(',') === '关闭,4K 预算,16K 预算,256K 预算', 'Qwen Chat should display real token budgets')
  const qwenResponsesProfile = getModelReasoningProfile('qwen3.7-plus', null, {
    ...qwenChatContext,
    apiStyle: 'responses'
  })
  assert(qwenResponsesProfile.levels.includes('max'), 'Qwen Responses in Beijing should expose max effort')

  const minimaxDirectContext = {
    baseUrl: 'https://api.minimaxi.com/v1',
    apiStyle: 'chat_completions'
  }
  assert(getModelReasoningProfile('MiniMax-M3', null, minimaxDirectContext).supported, 'MiniMax M3 should expose its real two-state control')
  assert(!getModelReasoningProfile('MiniMax-M2.7', null, minimaxDirectContext).supported, 'MiniMax M2.x fixed thinking should disable the slider')
  assert(
    getReasoningEffortOptions('MiniMax-M3', null, minimaxDirectContext)[1]?.label === '自适应',
    'MiniMax M3 should label its enabled state as adaptive, not high'
  )

  const stepProfile = getModelReasoningProfile('step-3.7-flash', null, {
    baseUrl: 'https://api.stepfun.com/v1',
    apiStyle: 'chat_completions'
  })
  assert(stepProfile.levels[0] === 'default', 'StepFun should preserve an undocumented provider default')
  const gemini25Profile = getModelReasoningProfile('gemini-2.5-flash', null, {
    baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai',
    apiStyle: 'chat_completions'
  })
  assert(!gemini25Profile.levels.includes('minimal'), 'Gemini 2.5 should not display duplicate minimal and low levels')
  const gemini31FlashLiteProfile = getModelReasoningProfile('gemini-3.1-flash-lite', null, {
    baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai',
    apiStyle: 'chat_completions'
  })
  assert(
    gemini31FlashLiteProfile.levels.join(',') === 'minimal,low,medium,high',
    'Gemini 3.1 Flash-Lite should expose all four documented levels'
  )

  const grokMultiAgentProfile = getModelReasoningProfile('grok-4.20-multi-agent', null, {
    baseUrl: 'https://api.x.ai/v1',
    apiStyle: 'responses'
  })
  assert(
    grokMultiAgentProfile.levels.join(',') === 'default,low,medium,high,xhigh',
    'Grok multi-agent should expose all four documented effort values plus default'
  )

  const futureStepCapability = {
    levels: ['low', 'medium', 'high'] as const,
    defaultEffort: 'medium' as const
  }
  const futureStepProfile = getModelReasoningProfile(
    'step-future-reasoner',
    futureStepCapability as any,
    { baseUrl: 'https://api.stepfun.com/v1', apiStyle: 'chat_completions' }
  )
  assert(futureStepProfile.source === 'metadata', 'explicit model metadata should override an official provider catch-all')

  const openRouterCapabilities = extractModelReasoningCapabilities({
    data: [{
      id: 'vendor/custom-reasoner',
      reasoning: {
        supported_efforts: ['max', 'high', 'medium', 'low'],
        default_effort: 'medium',
        mandatory: true
      }
    }]
  })
  const openRouterProfile = getModelReasoningProfile(
    'vendor/custom-reasoner',
    openRouterCapabilities['vendor/custom-reasoner']
  )
  assert(openRouterProfile.source === 'metadata', 'channel metadata should override model-id fallback')
  assert(openRouterProfile.levels.join(',') === 'low,medium,high,max', 'metadata levels should be normalized low-to-high')
  assert(openRouterProfile.mandatory, 'metadata mandatory flag should be retained')

  const openRouterOffCapabilities = extractModelReasoningCapabilities({
    data: [{
      id: 'vendor/default-off-reasoner',
      reasoning: {
        supported_efforts: ['high', 'medium', 'low'],
        default_enabled: false,
        mandatory: false
      }
    }, {
      id: 'vendor/explicit-off-reasoner',
      reasoning: {
        supported_efforts: ['high', 'none', 'low'],
        default_effort: 'low'
      }
    }]
  })
  const defaultOffCapability = openRouterOffCapabilities['vendor/default-off-reasoner']
  assert(
    defaultOffCapability?.levels.join(',') === 'none,low,medium,high',
    'OpenRouter default_enabled=false should add none before the declared effort levels'
  )
  assert(
    openRouterOffCapabilities['vendor/explicit-off-reasoner']?.levels.join(',') === 'none,low,high',
    'OpenRouter metadata should preserve an explicit none effort'
  )
  assert(
    defaultOffCapability?.defaultEffort === 'none',
    'OpenRouter default_enabled=false should normalize to default effort none'
  )
  const defaultOffBody = buildAiProviderConnectivityRequestBody({
    baseUrl: 'https://openrouter.ai/api/v1',
    model: 'vendor/default-off-reasoner',
    apiStyle: 'chat_completions',
    reasoningEffort: 'default',
    reasoningCapabilities: openRouterOffCapabilities
  }) as Record<string, any>
  assert(
    defaultOffBody.reasoning?.effort === 'none',
    'OpenRouter metadata default-off should send nested reasoning.effort=none instead of enabling low'
  )

  const openRouterUnknownDefaultCapabilities = extractModelReasoningCapabilities({
    data: [{
      id: 'vendor/unknown-default-reasoner',
      reasoning: {
        supported_efforts: ['high', 'medium', 'low']
      }
    }]
  })
  const unknownDefaultCapability = openRouterUnknownDefaultCapabilities['vendor/unknown-default-reasoner']
  const unknownDefaultProfile = getModelReasoningProfile(
    'vendor/unknown-default-reasoner',
    unknownDefaultCapability,
    { baseUrl: 'https://openrouter.ai/api/v1', apiStyle: 'chat_completions' }
  )
  assert(
    unknownDefaultProfile.levels.join(',') === 'default,low,medium,high',
    'metadata without a declared default should expose default before real effort levels'
  )
  const unknownDefaultBody = buildAiProviderConnectivityRequestBody({
    baseUrl: 'https://openrouter.ai/api/v1',
    model: 'vendor/unknown-default-reasoner',
    apiStyle: 'chat_completions',
    reasoningEffort: 'default',
    reasoningCapabilities: openRouterUnknownDefaultCapabilities
  }) as Record<string, any>
  assert(
    !('reasoning' in unknownDefaultBody),
    'metadata without a declared default must omit reasoning instead of materializing low'
  )

  const anthropicCapabilities = extractModelReasoningCapabilities({
    data: [{
      id: 'claude-opus-4-8',
      capabilities: {
        effort: {
          supported: true,
          low: { supported: true },
          medium: { supported: true },
          high: { supported: true },
          xhigh: { supported: true },
          max: { supported: true }
        }
      }
    }]
  })
  assert(
    anthropicCapabilities['claude-opus-4-8']?.levels.length === 5,
    'Anthropic Models API capability flags should be detected'
  )
}

function testSchemaValidation(): void {
  validateJsonSchema({
    action: 'keep',
    confidence: 0.8,
    items: [{ id: 'a' }]
  }, SAMPLE_SCHEMA, 'sample')

  assertThrowsKind(() => validateJsonSchema({
    action: 'delete',
    confidence: 0.8,
    items: [{ id: 'a' }]
  }, SAMPLE_SCHEMA, 'sample'), 'schema')

  assertThrowsKind(() => validateJsonSchema({
    action: 'keep',
    confidence: 2,
    items: [{ id: 'a' }]
  }, SAMPLE_SCHEMA, 'sample'), 'schema')

  assertThrowsKind(() => validateJsonSchema({
    action: 'keep',
    confidence: 0.2,
    items: [{ id: 'a', extra: true }]
  }, SAMPLE_SCHEMA, 'sample'), 'schema')
}

function testFolderCandidatesAndDecision(): void {
  const candidates = buildAiFolderCandidates([
    { id: '1', title: 'Dev', path: 'Bookmarks / Dev', depth: 2 },
    { id: '2', title: 'AI', path: 'Bookmarks / Dev / AI', depth: 3 }
  ], { currentFolderPath: 'Bookmarks / Dev / AI / Papers' })

  assert(candidates[0].folderId === '2', 'deeper current-path candidate should rank first')
  assert(validateKnownFolderId('2', candidates).folderPath === 'Bookmarks / Dev / AI', 'known folder id should resolve')
  assertThrowsKind(() => validateKnownFolderId('missing', candidates), 'schema')

  const existingDecision = normalizeAiFolderDecision({
    kind: 'existing',
    folder_id: '2',
    reason: 'matches topic',
    confidence: 0.9
  }, candidates)
  assert(existingDecision.kind === 'existing' && existingDecision.folderId === '2', 'existing decision should keep folder_id')

  const newDecision = normalizeAiFolderDecision({
    kind: 'new',
    folder_path: 'Bookmarks / Research',
    confidence: 0.6
  }, candidates)
  assert(newDecision.kind === 'new' && newDecision.folderPath === 'Bookmarks / Research', 'new decision should keep path')
}

async function testResponsesProviderEnvelope(): Promise<void> {
  const calls: unknown[] = []
  const result = await requestStructuredAiOutput<Record<string, unknown>>({
    settings: getSettings('responses'),
    schema: SAMPLE_SCHEMA,
    schemaName: 'sample',
    systemPrompt: 'system',
    userPrompt: 'user',
    retry: false,
    fetchImpl: createFetchStub(calls, {
      output_text: JSON.stringify({
        action: 'rename',
        confidence: 0.7,
        items: [{ id: 'a' }]
      })
    })
  })

  assert(result.data.action === 'rename', 'Responses payload should parse')
  assert(result.metadata.apiStyle === 'responses', 'metadata should retain API style')
  assert(JSON.stringify(calls[0]).includes('"json_schema"'), 'Responses body should request json_schema')
  const responsesInput = (calls[0] as { input?: Array<{ content?: unknown }> })?.input || []
  assert(typeof responsesInput[0]?.content === 'string', 'Responses system content should use plain string input')
  assert(typeof responsesInput[1]?.content === 'string', 'Responses user content should use plain string input')
}

async function testResponsesReasoningBlocksIgnored(): Promise<void> {
  const calls: unknown[] = []
  const result = await requestStructuredAiOutput<Record<string, unknown>>({
    settings: getSettings('responses'),
    schema: SAMPLE_SCHEMA,
    schemaName: 'sample',
    systemPrompt: 'system',
    userPrompt: 'user',
    retry: false,
    fetchImpl: createFetchStub(calls, {
      output: [
        {
          type: 'reasoning',
          content: [{
            type: 'reasoning_text',
            text: '{"action":"rename","confidence":0.1,"items":[{"id":"thinking"}]}'
          }]
        },
        {
          type: 'message',
          content: [{
            type: 'output_text',
            text: '{"action":"keep","confidence":0.9,"items":[{"id":"final"}]}'
          }]
        }
      ]
    })
  })

  assert(result.data.action === 'keep', 'Responses parsing should ignore reasoning items and use final message text')
  assert((result.data.items as Array<{ id?: string }>)[0]?.id === 'final', 'Responses parsing should not mistake reasoning JSON for the final payload')
}

async function testStrictOptionalNullRestoration(): Promise<void> {
  const calls: Array<Record<string, any>> = []
  const result = await requestStructuredAiOutput<{ items: Array<Record<string, unknown>> }>({
    settings: getSettings('responses'),
    schema: OPTIONAL_FOLDER_SCHEMA,
    schemaName: 'bookmark_naming_batch',
    systemPrompt: 'system',
    userPrompt: 'user',
    retry: false,
    fetchImpl: createFetchStub(calls, {
      output_text: JSON.stringify({
        items: [{ bookmark_id: 'bookmark-1', folder_decision: null }]
      })
    })
  })

  const sentSchema = calls[0]?.text?.format?.schema as JsonSchema | undefined
  const sentDecisionSchema = sentSchema?.properties?.items?.items?.properties?.folder_decision
  assert(
    sentDecisionSchema?.required?.includes('folder_id') && sentDecisionSchema.required.includes('folder_path'),
    'request schema should satisfy OpenAI required-property rules at the failing folder_decision path'
  )
  assert(
    !('folder_decision' in (result.data.items[0] || {})),
    'nullable strict placeholder should be restored to the original optional-field shape'
  )
  assert(result.metadata.structuredOutputMode === 'json_schema', 'successful strict request should report json_schema mode')
}

async function testChatCompletionsEnvelope(): Promise<void> {
  const calls: unknown[] = []
  const result = await requestStructuredAiOutput<Record<string, unknown>>({
    settings: getSettings('chat_completions'),
    schema: SAMPLE_SCHEMA,
    schemaName: 'sample',
    systemPrompt: 'system',
    userPrompt: 'user',
    retry: false,
    fetchImpl: createFetchStub(calls, {
      choices: [{
        message: {
          content: '```json\n{"action":"keep","confidence":0.4,"items":[{"id":"b"}]}\n```'
        }
      }]
    })
  })

  assert(result.data.action === 'keep', 'Chat Completions payload should parse fenced JSON')
  assert(JSON.stringify(calls[0]).includes('"json_schema"'), 'Chat body should prefer strict json_schema')
  const responseFormat = (calls[0] as { response_format?: Record<string, any> })?.response_format
  assert(responseFormat?.json_schema?.strict === true, 'Chat json_schema should enable strict mode')
  const chatMessages = (calls[0] as { messages?: Array<{ content?: unknown }> })?.messages || []
  assert(
    String(chatMessages[0]?.content || '').includes('json') &&
      String(chatMessages[1]?.content || '').includes('json'),
    'Chat prompt should include lower-case json cues for strict JSON mode gateways'
  )
}

async function testParseRepairRetry(): Promise<void> {
  const calls: unknown[] = []
  const result = await requestStructuredAiOutput<Record<string, unknown>>({
    settings: getSettings('responses'),
    schema: SAMPLE_SCHEMA,
    schemaName: 'sample',
    systemPrompt: 'system',
    userPrompt: 'user',
    fetchImpl: createFetchStub(calls, [
      { output_text: 'not json' },
      { output_text: '{"action":"keep","confidence":0.6,"items":[{"id":"c"}]}' }
    ])
  })

  assert(result.metadata.attempts === 2, 'parse failure should retry once')
  assert(result.metadata.repaired, 'second attempt should be marked repaired')
  assert(JSON.stringify(calls[1]).includes('上一次 sample 输出未通过本地校验'), 'repair prompt should describe failure')
}

async function testResponsesProviderErrorDoesNotFallback(): Promise<void> {
  const calls: Array<{ url: string; body: any }> = []
  const error = await assertRejectsKind(async () => {
    await requestStructuredAiOutput<Record<string, unknown>>({
      settings: getSettings('responses'),
      schema: SAMPLE_SCHEMA,
      schemaName: 'sample',
      systemPrompt: 'system',
      userPrompt: 'user',
      retry: false,
      fetchImpl: (async (url: RequestInfo | URL, init?: RequestInit) => {
        calls.push({
          url: String(url),
          body: init?.body ? JSON.parse(String(init.body)) : null
        })
        return new Response(
          "failed to transform response: failed to unmarshal responses api response: invalid character 'e' looking for beginning of value",
          {
            status: 500,
            headers: { 'Content-Type': 'text/plain' }
          }
        )
      }) as typeof fetch
    })
  }, 'provider')

  assert(error.message.includes('failed to transform response'), 'Responses provider error should remain visible')
  assert(calls.length === 1, 'Responses provider error should not switch API style automatically')
  assert(calls[0].url.endsWith('/responses'), 'only call should use Responses endpoint')
}

async function testProviderTextErrorBody(): Promise<void> {
  const error = await assertRejectsKind(async () => {
    await requestStructuredAiOutput({
      settings: getSettings('responses'),
      schema: SAMPLE_SCHEMA,
      schemaName: 'sample',
      systemPrompt: 'system',
      userPrompt: 'user',
      retry: false,
      fetchImpl: (async () => new Response('upstream overloaded without json', {
        status: 500,
        headers: { 'Content-Type': 'text/plain' }
      })) as typeof fetch
    })
  }, 'provider')

  assert(error.status === 500, 'provider text error should keep HTTP status')
  assert(error.message.includes('upstream overloaded without json'), 'provider text error should preserve raw body excerpt')
}

async function testTimeoutErrorMessage(): Promise<void> {
  const error = await assertRejectsKind(async () => {
    await requestStructuredAiOutput({
      settings: getSettings('responses'),
      schema: SAMPLE_SCHEMA,
      schemaName: 'sample',
      systemPrompt: 'system',
      userPrompt: 'user',
      retry: false,
      timeoutMs: 1,
      fetchImpl: (async (_url: RequestInfo | URL, init?: RequestInit) => {
        return await new Promise<Response>((_resolve, reject) => {
          const signal = init?.signal
          if (signal?.aborted) {
            reject(new DOMException('The operation was aborted.', 'AbortError'))
            return
          }
          signal?.addEventListener('abort', () => {
            reject(new DOMException('The operation was aborted.', 'AbortError'))
          }, { once: true })
        })
      }) as typeof fetch
    })
  }, 'abort')

  assert(error.message.includes('AI 请求超时'), 'timeout should be reported as a timeout, not a generic abort')
  assert(error.message.includes('1 秒'), 'timeout message should include the effective timeout seconds')
}

async function testNoRetryForAbort(): Promise<void> {
  const controller = new AbortController()
  controller.abort()
  let attempts = 0

  await assertRejectsKind(async () => {
    await requestStructuredAiOutput({
      settings: getSettings('responses'),
      schema: SAMPLE_SCHEMA,
      schemaName: 'sample',
      systemPrompt: 'system',
      userPrompt: 'user',
      signal: controller.signal,
      fetchImpl: ((async () => {
        attempts += 1
        return new Response('{}')
      }) as typeof fetch)
    })
  }, 'abort')

  assert(attempts === 0, 'abort should not call provider')
}

async function testThinkTagAndProseExtraction(): Promise<void> {
  // DeepSeek-R1 / Qwen3 风格输出：<think> 思考段 + 说明文字包裹的裸 JSON。
  const result = await requestStructuredAiOutput<Record<string, unknown>>({
    settings: getSettings('chat_completions'),
    schema: SAMPLE_SCHEMA,
    schemaName: 'sample',
    systemPrompt: 'system',
    userPrompt: 'user',
    retry: false,
    fetchImpl: createFetchStub([], {
      choices: [{
        message: {
          content: '<think>需要先分析书签语义，再决定动作。</think>好的，结果如下：\n{"action":"keep","confidence":0.5,"items":[{"id":"d"}]}\n希望对你有帮助！'
        }
      }]
    })
  })

  assert(result.data.action === 'keep', 'think tag and surrounding prose should be stripped before parsing')
}

async function testReasoningContentSalvage(): Promise<void> {
  // 部分兼容层把全部输出塞进 reasoning_content，正文为空。
  const result = await requestStructuredAiOutput<Record<string, unknown>>({
    settings: getSettings('chat_completions'),
    schema: SAMPLE_SCHEMA,
    schemaName: 'sample',
    systemPrompt: 'system',
    userPrompt: 'user',
    retry: false,
    fetchImpl: createFetchStub([], {
      choices: [{
        message: {
          content: '',
          reasoning_content: '让我推理一下……最终答案：{"action":"rename","confidence":0.8,"items":[{"id":"e"}]}'
        }
      }]
    })
  })

  assert(result.data.action === 'rename', 'JSON inside reasoning_content should be salvaged')
}

async function testChunkedReasoningResponseExtraction(): Promise<void> {
  const result = await requestStructuredAiOutput<Record<string, unknown>>({
    settings: {
      ...getSettings('chat_completions'),
      baseUrl: 'https://api.mistral.ai/v1',
      model: 'mistral-small-latest',
      reasoningEffort: 'high'
    },
    schema: SAMPLE_SCHEMA,
    schemaName: 'sample',
    systemPrompt: 'system',
    userPrompt: 'user',
    retry: false,
    fetchImpl: createFetchStub([], {
      choices: [{
        message: {
          content: [
            { type: 'thinking', text: '先比较候选对象 {这不是最终 JSON}' },
            { type: 'text', text: '{"action":"keep","confidence":0.7,"items":[{"id":"mistral"}]}' }
          ]
        }
      }]
    })
  })

  assert(result.data.action === 'keep', 'chunked reasoning responses should parse only the final text block')
}

async function testTruncationDetection(): Promise<void> {
  let attempts = 0
  const error = await assertRejectsKind(async () => {
    await requestStructuredAiOutput({
      settings: getSettings('chat_completions'),
      schema: SAMPLE_SCHEMA,
      schemaName: 'sample',
      systemPrompt: 'system',
      userPrompt: 'user',
      fetchImpl: (async () => {
        attempts += 1
        return new Response(JSON.stringify({
          choices: [{
            finish_reason: 'length',
            message: { content: '{"action":"keep","confidence":0.5,' }
          }]
        }), { status: 200, headers: { 'Content-Type': 'application/json' } })
      }) as typeof fetch
    })
  }, 'provider')

  assert(error.message.includes('截断'), 'length finish_reason should surface a truncation error')
  assert(attempts === 1, 'truncated output should not waste retry attempts')
}

async function testResponseFormatFallback(): Promise<void> {
  const calls: Array<Record<string, unknown>> = []
  const result = await requestStructuredAiOutput<Record<string, unknown>>({
    settings: getSettings('chat_completions'),
    schema: SAMPLE_SCHEMA,
    schemaName: 'sample',
    systemPrompt: 'system',
    userPrompt: 'user',
    fetchImpl: (async (_url: RequestInfo | URL, init?: RequestInit) => {
      calls.push(init?.body ? JSON.parse(String(init.body)) : {})
      if (calls.length === 1) {
        return new Response(JSON.stringify({
          error: { message: "Unknown parameter: 'response_format'" }
        }), { status: 400, headers: { 'Content-Type': 'application/json' } })
      }
      return new Response(JSON.stringify({
        choices: [{
          message: { content: '{"action":"keep","confidence":0.4,"items":[{"id":"f"}]}' }
        }]
      }), { status: 200, headers: { 'Content-Type': 'application/json' } })
    }) as typeof fetch
  })

  assert(calls.length === 2, 'json_schema rejection should trigger a compatibility retry')
  assert((calls[0]?.response_format as any)?.type === 'json_schema', 'first attempt should request json_schema')
  assert((calls[1]?.response_format as any)?.type === 'json_object', 'first fallback should retain JSON mode')
  assert(result.data.action === 'keep', 'fallback attempt should succeed')
  assert(result.metadata.structuredOutputMode === 'json_object', 'metadata should expose the successful fallback mode')
}

async function testResponsesInvalidSchemaFallback(): Promise<void> {
  const calls: Array<Record<string, any>> = []
  const result = await requestStructuredAiOutput<Record<string, unknown>>({
    settings: getSettings('responses'),
    schema: SAMPLE_SCHEMA,
    schemaName: 'bookmark_naming_batch',
    systemPrompt: 'system',
    userPrompt: 'user',
    fetchImpl: (async (_url: RequestInfo | URL, init?: RequestInit) => {
      calls.push(init?.body ? JSON.parse(String(init.body)) : {})
      if (calls.length === 1) {
        return new Response(JSON.stringify({
          error: {
            message: "Invalid schema for response_format 'bookmark_naming_batch': In context=('properties', 'items', 'items', 'properties', 'folder_decision'), 'required' is required to be supplied and to be an array including every key in properties. Missing 'folder_id'.",
            type: 'invalid_request_error',
            param: 'text.format.schema',
            code: 'invalid_json_schema'
          }
        }), { status: 400, headers: { 'Content-Type': 'application/json' } })
      }
      return new Response(JSON.stringify({
        output_text: '{"action":"keep","confidence":0.4,"items":[{"id":"responses-fallback"}]}'
      }), { status: 200, headers: { 'Content-Type': 'application/json' } })
    }) as typeof fetch
  })

  assert(calls[0]?.text?.format?.type === 'json_schema', 'Responses should begin with strict json_schema')
  assert(calls[1]?.text?.format?.type === 'json_object', 'invalid strict schema errors should downgrade to JSON mode')
  assert(result.metadata.structuredOutputMode === 'json_object', 'Responses fallback should report JSON mode')
}

async function testResponseFormatFullFallback(): Promise<void> {
  const calls: Array<Record<string, unknown>> = []
  const result = await requestStructuredAiOutput<Record<string, unknown>>({
    settings: getSettings('chat_completions'),
    schema: SAMPLE_SCHEMA,
    schemaName: 'sample',
    systemPrompt: 'system',
    userPrompt: 'user',
    fetchImpl: (async (_url: RequestInfo | URL, init?: RequestInit) => {
      calls.push(init?.body ? JSON.parse(String(init.body)) : {})
      if (calls.length === 1) {
        return new Response(JSON.stringify({
          error: { message: "Invalid value 'json_schema' for response_format.type" }
        }), { status: 400, headers: { 'Content-Type': 'application/json' } })
      }
      if (calls.length === 2) {
        return new Response(JSON.stringify({
          error: { message: "Unknown parameter: 'response_format'" }
        }), { status: 400, headers: { 'Content-Type': 'application/json' } })
      }
      return new Response(JSON.stringify({
        choices: [{
          message: { content: '{"action":"keep","confidence":0.4,"items":[{"id":"fallback"}]}' }
        }]
      }), { status: 200, headers: { 'Content-Type': 'application/json' } })
    }) as typeof fetch
  })

  assert(calls.length === 3, 'unsupported formats should downgrade through both compatibility levels')
  assert((calls[0]?.response_format as any)?.type === 'json_schema', 'full fallback should begin with json_schema')
  assert((calls[1]?.response_format as any)?.type === 'json_object', 'full fallback should next try json_object')
  assert(!('response_format' in calls[2]), 'full fallback should finally use prompt-only JSON')
  assert(result.metadata.structuredOutputMode === 'prompt', 'metadata should report prompt-only fallback')
}

async function testRetryAfterBackoff(): Promise<void> {
  const calls: Array<Record<string, unknown>> = []
  const result = await requestStructuredAiOutput<Record<string, unknown>>({
    settings: getSettings('chat_completions'),
    schema: SAMPLE_SCHEMA,
    schemaName: 'sample',
    systemPrompt: 'system',
    userPrompt: 'user',
    fetchImpl: (async (_url: RequestInfo | URL, init?: RequestInit) => {
      calls.push(init?.body ? JSON.parse(String(init.body)) : {})
      if (calls.length === 1) {
        return new Response(JSON.stringify({ error: { message: 'rate limited' } }), {
          status: 429,
          headers: { 'Content-Type': 'application/json', 'Retry-After': '0' }
        })
      }
      return new Response(JSON.stringify({
        choices: [{
          message: { content: '{"action":"rename","confidence":0.9,"items":[{"id":"g"}]}' }
        }]
      }), { status: 200, headers: { 'Content-Type': 'application/json' } })
    }) as typeof fetch
  })

  assert(calls.length === 2, '429 should retry after honoring Retry-After')
  assert(result.metadata.attempts === 2, 'metadata should count the retry attempt')
}

async function testBodyReadTimeout(): Promise<void> {
  const error = await assertRejectsKind(async () => {
    await requestStructuredAiOutput({
      settings: getSettings('responses'),
      schema: SAMPLE_SCHEMA,
      schemaName: 'sample',
      systemPrompt: 'system',
      userPrompt: 'user',
      retry: false,
      timeoutMs: 1000,
      totalBudgetMs: 25,
      fetchImpl: (async (_url: RequestInfo | URL, init?: RequestInit) => {
        const signal = init?.signal
        // headers 立即返回，body 永久挂起：超时保护必须覆盖读体阶段。
        return {
          ok: true,
          status: 200,
          headers: { get: () => null },
          text: () => new Promise<string>((_resolve, reject) => {
            if (signal?.aborted) {
              reject(new DOMException('The operation was aborted.', 'AbortError'))
              return
            }
            signal?.addEventListener('abort', () => {
              reject(new DOMException('The operation was aborted.', 'AbortError'))
            }, { once: true })
          })
        } as unknown as Response
      }) as typeof fetch
    })
  }, 'abort')

  assert(error.message.includes('AI 请求超时'), 'hung response body should hit the timeout instead of hanging forever')
}

async function testExternalAbortDuringBodyRead(): Promise<void> {
  const controller = new AbortController()
  let calls = 0
  const pendingRequest = assertRejectsKind(async () => {
    await requestStructuredAiOutput({
      settings: getSettings('responses'),
      schema: SAMPLE_SCHEMA,
      schemaName: 'sample',
      systemPrompt: 'system',
      userPrompt: 'user',
      signal: controller.signal,
      retry: true,
      fetchImpl: (async () => {
        calls += 1
        return {
          ok: true,
          status: 200,
          headers: { get: () => null },
          text: () => new Promise<string>(() => {})
        } as unknown as Response
      }) as typeof fetch
    })
  }, 'abort')
  globalThis.setTimeout(() => controller.abort(), 10)
  const error = await pendingRequest

  assert(error.message.includes('已取消'), 'external aborts should remain distinguishable from timeouts')
  assert(calls === 1, 'external aborts during body reads must not trigger a retry')
}

async function testOversizedResponseContentLength(): Promise<void> {
  let bodyCanceled = false
  let textCalled = false
  const error = await assertRejectsKind(async () => {
    await requestStructuredAiOutput({
      settings: getSettings('responses'),
      schema: SAMPLE_SCHEMA,
      schemaName: 'sample',
      systemPrompt: 'system',
      userPrompt: 'user',
      retry: true,
      fetchImpl: (async () => ({
        ok: true,
        status: 200,
        headers: {
          get: (name: string) => name.toLowerCase() === 'content-length'
            ? String(AI_PROVIDER_RESPONSE_MAX_BYTES + 1)
            : null
        },
        body: {
          cancel: async () => {
            bodyCanceled = true
          }
        },
        text: async () => {
          textCalled = true
          return '{}'
        }
      } as unknown as Response)) as typeof fetch
    })
  }, 'provider')

  assert(!error.retryable, 'oversized responses should fail without retrying')
  assert(error.message.includes('安全上限'), 'oversized responses should return an actionable diagnostic')
  assert(bodyCanceled, 'Content-Length preflight should cancel the unread response body')
  assert(!textCalled, 'Content-Length preflight should reject before reading the response body')
}

async function testOversizedStreamingResponse(): Promise<void> {
  let streamCanceled = false
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(new Uint8Array(AI_PROVIDER_RESPONSE_MAX_BYTES))
      controller.enqueue(new Uint8Array([1]))
    },
    cancel() {
      streamCanceled = true
    }
  })
  const error = await assertRejectsKind(async () => {
    await requestStructuredAiOutput({
      settings: getSettings('responses'),
      schema: SAMPLE_SCHEMA,
      schemaName: 'sample',
      systemPrompt: 'system',
      userPrompt: 'user',
      retry: true,
      fetchImpl: (async () => new Response(stream, {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      })) as typeof fetch
    })
  }, 'provider')

  assert(!error.retryable, 'stream byte overflow should be terminal')
  assert(streamCanceled, 'stream byte overflow should cancel the active reader')
  const details = error.details as { maxBytes?: unknown; receivedBytes?: unknown }
  assert(
    details.maxBytes === AI_PROVIDER_RESPONSE_MAX_BYTES,
    'oversize diagnostics should expose the configured byte limit'
  )
  assert(
    Number(details.receivedBytes) > AI_PROVIDER_RESPONSE_MAX_BYTES,
    'oversize diagnostics should expose the observed byte count without retaining the body'
  )
}

async function testProviderErrorRedaction(): Promise<void> {
  const bearerSecret = 'top-secret-bearer-token'
  const apiSecret = 'sk-super-secret-provider-key'
  const error = await assertRejectsKind(async () => {
    await requestStructuredAiOutput({
      settings: getSettings('responses'),
      schema: SAMPLE_SCHEMA,
      schemaName: 'sample',
      systemPrompt: 'system',
      userPrompt: 'user',
      retry: false,
      fetchImpl: (async () => new Response(JSON.stringify({
        error: {
          message: `Authorization: Bearer ${bearerSecret}; api_key=${apiSecret}; ${'x'.repeat(800)}`
        },
        echoed_request: { api_key: apiSecret }
      }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      })) as typeof fetch
    })
  }, 'provider')

  assert(error.message.includes('[REDACTED]'), 'provider errors should mark removed credentials')
  assert(!error.message.includes(bearerSecret), 'provider errors must redact Bearer credentials')
  assert(!error.message.includes(apiSecret), 'provider errors must redact API keys')
  assert(error.message.length <= 280, 'provider error messages should have a uniform display bound')
  const serializedDetails = JSON.stringify(error.details)
  assert(!serializedDetails.includes(bearerSecret), 'error details must not retain the provider payload')
  assert(!serializedDetails.includes(apiSecret), 'error details must not retain echoed API keys')
  assert(!serializedDetails.includes('echoed_request'), 'error details must contain metadata instead of raw payloads')
}

async function testSharedRequestDeadline(): Promise<void> {
  let calls = 0
  const startedAtMs = Date.now()
  const error = await assertRejectsKind(async () => {
    await requestStructuredAiOutput({
      settings: getSettings('responses'),
      schema: SAMPLE_SCHEMA,
      schemaName: 'sample',
      systemPrompt: 'system',
      userPrompt: 'user',
      timeoutMs: 1000,
      totalBudgetMs: 40,
      fetchImpl: (async (_url: RequestInfo | URL, init?: RequestInit) => {
        calls += 1
        if (calls === 1) {
          return new Response(JSON.stringify({ error: { message: 'temporarily unavailable' } }), {
            status: 429,
            headers: {
              'Content-Type': 'application/json',
              'Retry-After': '0'
            }
          })
        }
        return {
          ok: true,
          status: 200,
          headers: { get: () => null },
          text: () => new Promise<string>((_resolve, reject) => {
            init?.signal?.addEventListener('abort', () => {
              reject(new DOMException('The operation was aborted.', 'AbortError'))
            }, { once: true })
          })
        } as unknown as Response
      }) as typeof fetch
    })
  }, 'abort')

  assert(calls === 2, 'a transient provider failure should retry within the remaining shared budget')
  assert(error.message.includes('总时限'), 'shared-budget exhaustion should be distinguishable from one attempt timeout')
  assert(Date.now() - startedAtMs < 500, 'retry attempts must not each reset the full request timeout')

  let expiredDeadlineCalls = 0
  const expiredError = await assertRejectsKind(async () => {
    await requestStructuredAiOutput({
      settings: getSettings('responses'),
      schema: SAMPLE_SCHEMA,
      schemaName: 'sample',
      systemPrompt: 'system',
      userPrompt: 'user',
      deadlineAtMs: Date.now() - 1,
      fetchImpl: (async () => {
        expiredDeadlineCalls += 1
        return new Response('{}')
      }) as typeof fetch
    })
  }, 'abort')

  assert(expiredDeadlineCalls === 0, 'an expired absolute deadline should stop before contacting the provider')
  assert(expiredError.message.includes('总时限'), 'absolute deadline exhaustion should use the total-budget diagnostic')
}

async function testReasoningEffortInjection(): Promise<void> {
  const chatCalls: Array<Record<string, any>> = []
  await requestStructuredAiOutput<Record<string, unknown>>({
    settings: { ...getSettings('chat_completions'), reasoningEffort: 'low' },
    schema: SAMPLE_SCHEMA,
    schemaName: 'sample',
    systemPrompt: 'system',
    userPrompt: 'user',
    retry: false,
    fetchImpl: createFetchStub(chatCalls, {
      choices: [{ message: { content: '{"action":"keep","confidence":0.4,"items":[{"id":"h"}]}' } }]
    })
  })
  assert(chatCalls[0]?.reasoning_effort === 'low', 'chat body should carry reasoning_effort')

  const responsesCalls: Array<Record<string, any>> = []
  await requestStructuredAiOutput<Record<string, unknown>>({
    settings: { ...getSettings('responses'), reasoningEffort: 'high' },
    schema: SAMPLE_SCHEMA,
    schemaName: 'sample',
    systemPrompt: 'system',
    userPrompt: 'user',
    retry: false,
    fetchImpl: createFetchStub(responsesCalls, {
      output_text: '{"action":"keep","confidence":0.4,"items":[{"id":"i"}]}'
    })
  })
  assert(responsesCalls[0]?.reasoning?.effort === 'high', 'responses body should carry reasoning.effort')

  const openRouterCalls: Array<Record<string, any>> = []
  await requestStructuredAiOutput<Record<string, unknown>>({
    settings: {
      ...getSettings('chat_completions'),
      baseUrl: 'https://openrouter.ai/api/v1',
      model: 'gpt-5.6-sol',
      reasoningEffort: 'max'
    },
    schema: SAMPLE_SCHEMA,
    schemaName: 'sample',
    systemPrompt: 'system',
    userPrompt: 'user',
    retry: false,
    fetchImpl: createFetchStub(openRouterCalls, {
      choices: [{ message: { content: '{"action":"keep","confidence":0.4,"items":[{"id":"or"}]}' } }]
    })
  })
  assert(openRouterCalls[0]?.reasoning?.effort === 'max', 'OpenRouter chat should carry reasoning.effort')
  assert(!('reasoning_effort' in (openRouterCalls[0] ?? {})), 'OpenRouter should not receive reasoning_effort')

  const defaultCalls: Array<Record<string, any>> = []
  await requestStructuredAiOutput<Record<string, unknown>>({
    settings: { ...getSettings('chat_completions'), reasoningEffort: 'default' },
    schema: SAMPLE_SCHEMA,
    schemaName: 'sample',
    systemPrompt: 'system',
    userPrompt: 'user',
    retry: false,
    fetchImpl: createFetchStub(defaultCalls, {
      choices: [{ message: { content: '{"action":"keep","confidence":0.4,"items":[{"id":"j"}]}' } }]
    })
  })
  assert(!('reasoning_effort' in (defaultCalls[0] ?? {})), 'default should not send reasoning_effort')
}

async function testReasoningEffortRejection(): Promise<void> {
  const calls: Array<Record<string, any>> = []
  const error = await assertRejectsKind(async () => {
    await requestStructuredAiOutput<Record<string, unknown>>({
      settings: { ...getSettings('chat_completions'), reasoningEffort: 'medium' },
      schema: SAMPLE_SCHEMA,
      schemaName: 'sample',
      systemPrompt: 'system',
      userPrompt: 'user',
      fetchImpl: (async (_url: RequestInfo | URL, init?: RequestInit) => {
        calls.push(init?.body ? JSON.parse(String(init.body)) : {})
        return new Response(JSON.stringify({
          error: { message: 'Unrecognized parameter: reasoning_effort' }
        }), { status: 400, headers: { 'Content-Type': 'application/json' } })
      }) as typeof fetch
    })
  }, 'provider')

  assert(calls.length === 1, 'reasoning_effort rejection should fail closed without a compatibility retry')
  assert('reasoning_effort' in calls[0], 'first attempt should send reasoning_effort')
  assert(
    !calls.some((body) => !('reasoning_effort' in body)),
    'runtime must never retry after silently dropping the requested effort'
  )
  assert(error.message.includes('Unrecognized parameter'), 'provider rejection should remain visible to the caller')

  const toggleCalls: Array<Record<string, any>> = []
  const toggleError = await assertRejectsKind(async () => {
    await requestStructuredAiOutput<Record<string, unknown>>({
      settings: {
        ...getSettings('chat_completions'),
        baseUrl: 'https://api.siliconflow.cn/v1',
        model: 'Qwen/Qwen3-32B',
        reasoningEffort: 'high'
      },
      schema: SAMPLE_SCHEMA,
      schemaName: 'sample',
      systemPrompt: 'system',
      userPrompt: 'user',
      fetchImpl: (async (_url: RequestInfo | URL, init?: RequestInit) => {
        toggleCalls.push(init?.body ? JSON.parse(String(init.body)) : {})
        return new Response(JSON.stringify({
          error: { message: 'Unknown parameter: enable_thinking' }
        }), { status: 400, headers: { 'Content-Type': 'application/json' } })
      }) as typeof fetch
    })
  }, 'provider')

  assert(toggleCalls.length === 1, 'enable_thinking rejection should fail closed without format retries')
  assert(toggleCalls[0]?.enable_thinking === true, 'toggle request should carry the selected reasoning control')
  assert(toggleError.message.includes('enable_thinking'), 'toggle rejection should remain visible to the caller')
}

async function testDirectAnthropicAdapter(): Promise<void> {
  let calledUrl = ''
  let calledHeaders = new Headers()
  let calledBody: Record<string, any> = {}
  const result = await requestStructuredAiOutput<Record<string, unknown>>({
    settings: {
      ...getSettings('chat_completions'),
      baseUrl: 'https://api.anthropic.com/v1',
      apiKey: 'anthropic-test-key',
      model: 'claude-opus-4-8',
      reasoningEffort: 'xhigh'
    },
    schema: SAMPLE_SCHEMA,
    schemaName: 'sample',
    systemPrompt: 'system',
    userPrompt: 'user',
    retry: false,
    fetchImpl: (async (url: RequestInfo | URL, init?: RequestInit) => {
      calledUrl = String(url)
      calledHeaders = new Headers(init?.headers)
      calledBody = init?.body ? JSON.parse(String(init.body)) : {}
      return new Response(JSON.stringify({
        content: [{
          type: 'text',
          text: '{"action":"keep","confidence":0.9,"items":[{"id":"claude"}]}'
        }],
        stop_reason: 'end_turn'
      }), { status: 200, headers: { 'Content-Type': 'application/json' } })
    }) as typeof fetch
  })

  assert(calledUrl === 'https://api.anthropic.com/v1/messages', 'direct Anthropic should use Messages API')
  assert(calledHeaders.get('x-api-key') === 'anthropic-test-key', 'direct Anthropic should use x-api-key')
  assert(calledHeaders.get('anthropic-version') === '2023-06-01', 'direct Anthropic should send API version')
  assert(!calledHeaders.has('authorization'), 'direct Anthropic should not send Bearer authorization')
  assert(calledBody.output_config?.effort === 'xhigh', 'direct Anthropic should use output_config.effort')
  assert(calledBody.output_config?.format?.type === 'json_schema', 'direct Anthropic should use native structured output')
  assert(result.data.action === 'keep', 'direct Anthropic response should be parsed')
}

function getSettings(apiStyle: 'responses' | 'chat_completions') {
  return {
    baseUrl: 'https://api.example.test/v1',
    apiKey: 'test-key',
    model: 'test-model',
    apiStyle,
    timeoutMs: 1000
  }
}

function createFetchStub(calls: unknown[], payloads: unknown | unknown[]): typeof fetch {
  const queue = Array.isArray(payloads) ? payloads.slice() : [payloads]
  return (async (_url: RequestInfo | URL, init?: RequestInit) => {
    calls.push(init?.body ? JSON.parse(String(init.body)) : null)
    const payload = queue.shift() ?? queue[queue.length - 1]
    return new Response(JSON.stringify(payload), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    })
  }) as typeof fetch
}

function assert(value: unknown, message: string): void {
  if (!value) {
    throw new Error(message)
  }
}

function assertThrowsKind(callback: () => void, kind: string): void {
  try {
    callback()
  } catch (error) {
    assert(error instanceof AiRuntimeError, 'expected AiRuntimeError')
    assert(error.kind === kind, `expected ${kind}, got ${error.kind}`)
    return
  }
  throw new Error(`expected ${kind} error`)
}

async function assertRejectsKind(callback: () => Promise<void>, kind: string): Promise<AiRuntimeError> {
  try {
    await callback()
  } catch (error) {
    assert(error instanceof AiRuntimeError, 'expected AiRuntimeError')
    assert(error.kind === kind, `expected ${kind}, got ${error.kind}`)
    return error
  }
  throw new Error(`expected ${kind} rejection`)
}

await run()
console.log('AI runtime tests passed.')
