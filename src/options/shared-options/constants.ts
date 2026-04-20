export const SECTION_META = {
  availability: {
    label: 'Availability',
    title: '书签可用性检测'
  },
  history: {
    label: 'History',
    title: '检测历史'
  },
  ai: {
    label: 'AI Naming',
    title: 'AI 智能命名'
  },
  redirects: {
    label: 'Redirects',
    title: '重定向更新'
  },
  duplicates: {
    label: 'Duplicates',
    title: '重复书签'
  },
  ignore: {
    label: 'Ignore Rules',
    title: '忽略规则 / 白名单'
  },
  recycle: {
    label: 'Recycle Bin',
    title: '回收站'
  }
} as const

export const HISTORY_LOG_LIMIT = 12
export const NAVIGATION_TIMEOUT_MS = 30000
export const NAVIGATION_RETRY_TIMEOUT_MS = 45000
export const AVAILABILITY_CONCURRENCY = 2
export const AI_NAMING_DEFAULT_BASE_URL = 'https://api.openai.com/v1'
export const AI_NAMING_DEFAULT_MODEL = 'gpt-5-mini'
export const AI_NAMING_DEFAULT_TIMEOUT_MS = 30000
export const AI_NAMING_DEFAULT_BATCH_SIZE = 6
export const AI_NAMING_MAX_BATCH_SIZE = 20
export const AI_NAMING_MAX_TEXT_LENGTH = 80
export const AI_NAMING_MANAGE_MODELS_VALUE = '__manage_custom_models__'
export const AI_NAMING_PRESET_MODELS = [
  'gpt-5.2',
  'gpt-5.2-pro',
  'gpt-5',
  'gpt-5-mini',
  'gpt-5-nano',
  'gpt-4.1',
  'gpt-4.1-mini',
  'gpt-4.1-nano'
]
export const AI_NAMING_RESPONSE_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['items'],
  properties: {
    items: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['bookmark_id', 'action', 'suggested_title', 'confidence', 'reason'],
        properties: {
          bookmark_id: {
            type: 'string'
          },
          action: {
            type: 'string',
            enum: ['rename', 'keep', 'manual_review']
          },
          suggested_title: {
            type: 'string'
          },
          confidence: {
            type: 'string',
            enum: ['high', 'medium', 'low']
          },
          reason: {
            type: 'string'
          }
        }
      }
    }
  }
} as const
