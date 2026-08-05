import assert from 'node:assert/strict'
import {
  normalizeAiNamingSettings,
  updateAiNamingSettingsField
} from './ai-settings.js'

function run(): void {
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
