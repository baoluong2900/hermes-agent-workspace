import assert from 'node:assert/strict'
import test from 'node:test'
import { agentIdentity } from '../src/agent-identity.ts'

test('assigns stable semantic families and distinct icons to Hermes profiles', () => {
  const profiles = ['default', 'planner', 'backend', 'frontend', 'researcher', 'reviewer', 'tester', 'devops']
  const identities = profiles.map(agentIdentity)
  assert.equal(new Set(identities.map((identity) => identity.icon)).size, profiles.length)
  assert.deepEqual(identities.map((identity) => identity.family), [
    'orchestration', 'orchestration', 'engineering', 'creation', 'knowledge', 'assurance', 'assurance', 'engineering',
  ])
})

test('unknown profiles receive a deterministic neutral identity', () => {
  assert.deepEqual(agentIdentity('custom-agent'), { family: 'neutral', icon: 'bot', role: 'Custom agent' })
})
