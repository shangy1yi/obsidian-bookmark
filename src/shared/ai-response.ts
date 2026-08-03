export interface AiEndpointSettings {
  baseUrl?: unknown
  apiStyle?: unknown
}

type AiRefusalFormatter = (refusal: unknown) => string

export function getAiEndpoint(settings: AiEndpointSettings): string {
  const baseUrl = String(settings?.baseUrl || '').replace(/\/+$/, '')
  const suffix = settings?.apiStyle === 'chat_completions' ? 'chat/completions' : 'responses'
  return baseUrl.endsWith(`/${suffix}`) ? baseUrl : `${baseUrl}/${suffix}`
}

export function extractResponsesJsonText(
  payload: unknown,
  formatRefusal: AiRefusalFormatter = buildAiStructuredOutputRefusalError
): string {
  const responsePayload = payload as {
    output?: Array<{ content?: unknown[] }>
    output_text?: unknown
  } | null
  const outputItems = Array.isArray(responsePayload?.output) ? responsePayload.output : []
  const contentItems = outputItems
    .filter((entry: any) => {
      const type = String(entry?.type ?? '').trim().toLowerCase()
      return !type || type === 'message' || type === 'output_text'
    })
    .flatMap((entry) => Array.isArray(entry?.content) ? entry.content : [])
  const finalTextItems = contentItems.filter((item: any) => {
    const type = String(item?.type ?? '').trim().toLowerCase()
    return !type || type === 'text' || type === 'output_text'
  })
  const refusalNode = contentItems.find((item: any) => {
    return typeof item?.refusal === 'string' && item.refusal.trim()
  }) as { refusal?: string } | undefined

  if (refusalNode?.refusal) {
    throw new Error(formatRefusal(refusalNode.refusal))
  }

  if (typeof responsePayload?.output_text === 'string' && responsePayload.output_text.trim()) {
    return extractJsonPayloadText(responsePayload.output_text)
  }

  const joinedText = finalTextItems
    .map((item: any) => (typeof item?.text === 'string' ? item.text : ''))
    .filter((text) => text.trim())
    .join('')

  if (joinedText.trim()) {
    return extractJsonPayloadText(joinedText)
  }

  throw new Error('Responses API 返回中未找到可解析的 JSON 文本。')
}

export function extractChatCompletionsJsonText(
  payload: unknown,
  formatRefusal: AiRefusalFormatter = buildAiStructuredOutputRefusalError
): string {
  const chatPayload = payload as {
    choices?: Array<{
      message?: {
        refusal?: unknown
        content?: unknown
        reasoning_content?: unknown
        reasoning?: unknown
      }
    }>
  } | null
  const message = chatPayload?.choices?.[0]?.message

  if (typeof message?.refusal === 'string' && message.refusal.trim()) {
    throw new Error(formatRefusal(message.refusal))
  }

  const content = message?.content
  if (typeof content === 'string' && content.trim()) {
    return extractJsonPayloadText(content)
  }

  if (Array.isArray(content)) {
    const refusalNode = content.find((item: any) => {
      return typeof item?.refusal === 'string' && item.refusal.trim()
    }) as { refusal?: string } | undefined
    if (refusalNode?.refusal) {
      throw new Error(formatRefusal(refusalNode.refusal))
    }

    // Mistral 等推理端点会把 thinking/text 都放进 content 数组。优先只拼接
    // 最终文本块，避免思考块里的花括号被误判为业务 JSON。
    const finalTextItems = content.filter((item: any) => {
      const type = String(item?.type ?? '').trim().toLowerCase()
      return !type || type === 'text' || type === 'output_text'
    })
    const joinedText = (finalTextItems.length ? finalTextItems : content)
      .map((item: any) => (typeof item?.text === 'string' ? item.text : ''))
      .filter((text) => text.trim())
      .join('')
    if (joinedText.trim()) {
      return extractJsonPayloadText(joinedText)
    }
  }

  // 部分推理模型的兼容层会把全部输出塞进思考通道，正文为空；尽力从中打捞 JSON。
  const reasoningText = [message?.reasoning_content, message?.reasoning]
    .map((item) => (typeof item === 'string' ? item : ''))
    .find((item) => item.trim())
  if (reasoningText) {
    const salvaged = extractJsonPayloadText(reasoningText)
    if (looksLikeJsonPayload(salvaged)) {
      return salvaged
    }
    throw new Error('模型把输出写入了思考通道（reasoning）且未包含 JSON 正文，请关闭思考模式或换用支持结构化输出的模型。')
  }

  throw new Error('Chat Completions 返回中未找到可解析的 JSON 文本。')
}

export function extractAnthropicMessagesJsonText(
  payload: unknown,
  formatRefusal: AiRefusalFormatter = buildAiStructuredOutputRefusalError
): string {
  const messagePayload = payload as {
    content?: Array<{ type?: unknown; text?: unknown; refusal?: unknown }>
  } | null
  const content = Array.isArray(messagePayload?.content) ? messagePayload.content : []
  const refusal = content.find((item) => {
    return typeof item?.refusal === 'string' && item.refusal.trim()
  })?.refusal
  if (typeof refusal === 'string' && refusal.trim()) {
    throw new Error(formatRefusal(refusal))
  }
  const text = content
    .filter((item) => item?.type === 'text' || typeof item?.text === 'string')
    .map((item) => typeof item?.text === 'string' ? item.text : '')
    .filter((item) => item.trim())
    .join('')
  if (text.trim()) {
    return extractJsonPayloadText(text)
  }
  throw new Error('Claude Messages API 返回中未找到可解析的 JSON 文本。')
}

/**
 * 从任意模型的自由文本输出中萃取 JSON 载荷：
 * 1. 剥离推理模型的 <think>…</think> 思考段（含只有闭合标签的变体）
 * 2. 优先取 markdown 代码围栏内容（允许围栏前后有说明文字）
 * 3. 兜底做括号平衡扫描，截取首个完整的 JSON 对象/数组
 * 提取失败时原样返回修剪后的文本，让上层 JSON.parse 给出错误。
 */
export function extractJsonPayloadText(text: unknown): string {
  let value = String(text ?? '')
  if (!value.trim()) {
    return value.trim()
  }

  const closeThinkIndex = value.lastIndexOf('</think>')
  if (closeThinkIndex !== -1) {
    value = value.slice(closeThinkIndex + '</think>'.length)
  } else {
    value = value.replace(/<think>[\s\S]*?<\/think>/g, '')
  }

  const fencedMatch = value.match(/```(?:json[c5]?|javascript)?\s*\n?([\s\S]*?)```/i)
  if (fencedMatch && fencedMatch[1].trim()) {
    value = fencedMatch[1]
  }

  const trimmed = value.trim()
  if (looksLikeJsonPayload(trimmed)) {
    return trimmed
  }

  const balanced = extractBalancedJsonSlice(trimmed)
  return balanced ?? trimmed
}

function looksLikeJsonPayload(text: string): boolean {
  if (!text) {
    return false
  }
  const first = text[0]
  const last = text[text.length - 1]
  return (first === '{' && last === '}') || (first === '[' && last === ']')
}

function extractBalancedJsonSlice(text: string): string | null {
  const start = findJsonStart(text)
  if (start === -1) {
    return null
  }

  const openChar = text[start]
  const closeChar = openChar === '{' ? '}' : ']'
  let depth = 0
  let inString = false
  let escaped = false

  for (let index = start; index < text.length; index += 1) {
    const char = text[index]
    if (inString) {
      if (escaped) {
        escaped = false
      } else if (char === '\\') {
        escaped = true
      } else if (char === '"') {
        inString = false
      }
      continue
    }
    if (char === '"') {
      inString = true
      continue
    }
    if (char === openChar) {
      depth += 1
    } else if (char === closeChar) {
      depth -= 1
      if (depth === 0) {
        return text.slice(start, index + 1)
      }
    }
  }
  return null
}

function findJsonStart(text: string): number {
  const objectIndex = text.indexOf('{')
  const arrayIndex = text.indexOf('[')
  if (objectIndex === -1) {
    return arrayIndex
  }
  if (arrayIndex === -1) {
    return objectIndex
  }
  return Math.min(objectIndex, arrayIndex)
}

/**
 * 判断响应是否因输出上限被截断。截断时重试同一提示几乎必然再次截断，
 * 上层应直接报错并给出可操作的建议，而不是浪费重试请求。
 */
export function getAiTruncationIssue(payload: unknown, apiStyle: unknown): string {
  if (!payload || typeof payload !== 'object') {
    return ''
  }

  const anthropicStopReason = (payload as { stop_reason?: unknown }).stop_reason
  if (anthropicStopReason === 'max_tokens') {
    return 'AI 输出因达到模型输出上限被截断（stop_reason=max_tokens）。请减小批量大小或缩短提示后重试。'
  }

  if (apiStyle === 'chat_completions') {
    const finishReason = (payload as { choices?: Array<{ finish_reason?: unknown }> }).choices?.[0]?.finish_reason
    if (finishReason === 'length') {
      return 'AI 输出因达到模型输出上限被截断（finish_reason=length）。请减小批量大小、缩短提示或调大模型输出上限后重试。'
    }
    return ''
  }

  const responsePayload = payload as { status?: unknown; incomplete_details?: { reason?: unknown } }
  if (responsePayload.status === 'incomplete') {
    const reason = String(responsePayload.incomplete_details?.reason || 'incomplete')
    return `AI 输出未完成（${reason}）。请减小批量大小、缩短提示或调大模型输出上限后重试。`
  }
  return ''
}

const AI_ERROR_MESSAGE_DETAIL_LIMIT = 240

/**
 * 供应商错误可能原样回显 Authorization、API Key 或请求 URL。展示前统一压平、
 * 脱敏和限长，避免错误提示与通知成为凭据泄漏通道。
 */
export function sanitizeAiErrorText(
  value: unknown,
  maxLength = AI_ERROR_MESSAGE_DETAIL_LIMIT
): string {
  const normalized = String(value || '')
    .replace(/\s+/g, ' ')
    .trim()
  const redacted = normalized
    .replace(/\b(Bearer|Basic|Token)\s+[A-Za-z0-9._~+/=-]+/gi, '$1 [REDACTED]')
    .replace(
      /(\bapi\s+key\b\s*[:=]?\s*["']?)([^"',;\s}&]+)/gi,
      '$1[REDACTED]'
    )
    .replace(
      /(["']?(?:api[_-]?key|apikey|authorization|x-api-key|access[_-]?token|refresh[_-]?token|client[_-]?secret|password)["']?\s*[:=]\s*["']?)([^"',;\s}&]+)/gi,
      '$1[REDACTED]'
    )
    .replace(
      /([?&](?:api[_-]?key|apikey|access[_-]?token|refresh[_-]?token|client[_-]?secret|password)=)([^&#\s]+)/gi,
      '$1[REDACTED]'
    )
    .replace(/\b(?:sk|rk|pk)-[A-Za-z0-9_-]{8,}\b/g, '[REDACTED]')
    .replace(/\bAIza[A-Za-z0-9_-]{12,}\b/g, '[REDACTED]')
  return truncateText(redacted, maxLength)
}

export function extractAiErrorMessage(payload: unknown, statusCode: unknown, rawBody: unknown = ''): string {
  const responsePayload = payload && typeof payload === 'object'
    ? payload as {
      error?: { message?: unknown } | string
      message?: unknown
      detail?: unknown
      error_description?: unknown
    }
    : null
  const errorValue = responsePayload?.error
  const message = [
    errorValue && typeof errorValue === 'object' ? errorValue.message : '',
    typeof errorValue === 'string' ? errorValue : '',
    responsePayload?.message,
    responsePayload?.detail,
    responsePayload?.error_description,
    typeof payload === 'string' ? payload : ''
  ]
    .map((item) => sanitizeAiErrorText(item))
    .find(Boolean)
  const rawExcerpt = message
    ? ''
    : sanitizeAiErrorText(rawBody)

  return message
    ? `AI 请求失败（${statusCode}）：${message}`
    : rawExcerpt
      ? `AI 请求失败（${statusCode}）：${rawExcerpt}`
      : `AI 请求失败（${statusCode}）。`
}

function buildAiStructuredOutputRefusalError(refusal: unknown): string {
  const normalizedRefusal = truncateText(
    String(refusal || '').replace(/\s+/g, ' ').trim(),
    120
  )

  return normalizedRefusal
    ? `模型拒绝生成结构化结果：${normalizedRefusal}`
    : '模型拒绝生成结构化结果。'
}

function truncateText(value: string, maxLength: number): string {
  const safeText = String(value || '').trim()
  const limit = Math.max(1, Number(maxLength) || 1)
  if (safeText.length <= limit) {
    return safeText
  }

  return `${safeText.slice(0, Math.max(limit - 1, 1)).trim()}…`
}
