import assert from 'node:assert/strict'
import test from 'node:test'
import { parseProjects } from '../server/project-parser.ts'

test('parses Hermes project list and project show output', () => {
  const list = '* pool                     pool  [1 folder(s)]\n  hermes-agent-workspace   Hermes Agent Workspace  [1 folder(s)]'
  const shows = new Map([
    ['pool', 'pool  [p_bbdf3baf]\n  name:    pool\n  primary: /Users/example/pool-api-ai\n  folders:\n    * /Users/example/pool-api-ai'],
    ['hermes-agent-workspace', 'Hermes Agent Workspace  [p_workspace]\n  name:    Hermes Agent Workspace\n  primary: /Users/example/hermes-agent-workspace\n  folders:\n    * /Users/example/hermes-agent-workspace'],
  ])
  assert.deepEqual(parseProjects(list, shows), [
    { slug: 'pool', name: 'pool', primaryPath: '/Users/example/pool-api-ai', active: true },
    { slug: 'hermes-agent-workspace', name: 'Hermes Agent Workspace', primaryPath: '/Users/example/hermes-agent-workspace', active: false },
  ])
})

test('keeps a project visible when primary path is unavailable', () => {
  assert.deepEqual(parseProjects('  remote  Remote Project  [0 folder(s)]', new Map([['remote', 'Remote Project [p_remote]\n  name: Remote Project']])), [
    { slug: 'remote', name: 'Remote Project', primaryPath: null, active: false },
  ])
})
