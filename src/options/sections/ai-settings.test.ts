import assert from 'node:assert/strict'
import {
  normalizeAiNamingSettings,
  updateAiNamingSettingsField
} from './ai-settings.js'
import {
  AI_NAMING_CONTENT_FETCH_TIMEOUT_MS,
  AI_NAMING_DEFAULT_TIMEOUT_MS
} from '../shared-options/constants.js'

function run(): void {
  assert.equal(
    AI_NAMING_DEFAULT_TIMEOUT_MS,
    120000,
    'AI requests should have enough time for slower reasoning models and compatibility retries'
  )
  assert.equal(
    AI_NAMING_CONTENT_FETCH_TIMEOUT_MS,
    30000,
    'page extraction should keep an independent bounded timeout'
  )
  assert.equal(
    normalizeAiNamingSettings(undefined).timeoutMs,
    120000,
    'fresh settings should use the two-minute AI request budget'
  )
  assert.equal(
    normalizeAiNamingSettings({ timeoutMs: 30000 }).timeoutMs,
    120000,
    'the previous persisted default must migrate instead of keeping users on 30 seconds'
  )
  assert.equal(
    normalizeAiNamingSettings({ timeoutMs: 45000 }).timeoutMs,
    45000,
    'non-legacy explicit timeout choices must be preserved'
  )

  const current = normalizeAiNamingSettings({
    apiKey: 'sk-current',
    baseUrl: 'https://api.openai.com/v1',
    model: 'gpt-test',
    reasoningCapabilities: {
      'gpt-test': { levels: ['high'] }
    }
  })

  const withEditedApiKey = updateAiNamingSettingsField(current, 'apiKey', 'sk-edited')
  assert.equal(withEditedApiKey.apiKey, 'sk-edited', 'API Key edits must replace the previous value')
  assert.equal(withEditedApiKey.baseUrl, current.baseUrl, 'editing the key must preserve the provider URL')
  assert.deepEqual(
    withEditedApiKey.reasoningCapabilities,
    current.reasoningCapabilities,
    'editing the key must preserve model capabilities'
  )

  const withSameOriginPath = updateAiNamingSettingsField(
    current,
    'baseUrl',
    'https://api.openai.com/v1/chat/completions'
  )
  assert.equal(withSameOriginPath.apiKey, 'sk-current', 'changing a path on the same provider must retain the key')
  assert.deepEqual(
    withSameOriginPath.reasoningCapabilities,
    {},
    'changing the provider URL must invalidate fetched reasoning metadata'
  )

  const withDifferentOrigin = updateAiNamingSettingsField(
    current,
    'baseUrl',
    'https://openrouter.ai/api/v1'
  )
  assert.equal(withDifferentOrigin.apiKey, '', 'changing provider origin must clear the previous provider key')
}

run()
console.log('AI settings field update tests passed.')
