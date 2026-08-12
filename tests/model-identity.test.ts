import assert from 'node:assert/strict'
import test from 'node:test'
import { modelIdentity } from '../src/model-identity.ts'

test('maps common Hermes model families to recognizable identities', () => {
  assert.equal(modelIdentity('anthropic/claude-opus-5').family, 'claude')
  assert.equal(modelIdentity('gpt-5.6-sol').family, 'openai')
  assert.equal(modelIdentity('google/gemini-3.6-flash').family, 'gemini')
  assert.equal(modelIdentity('qwen/qwen3.8-max').family, 'qwen')
  assert.equal(modelIdentity('deepseek/deepseek-v4-pro').family, 'deepseek')
  assert.equal(modelIdentity('sakana/fugu-ultra').family, 'sakana')
})

test('unknown models use a deterministic generic identity', () => {
  assert.deepEqual(modelIdentity('vendor/new-model'), { family: 'generic', mark: 'AI', label: 'AI model' })
})
