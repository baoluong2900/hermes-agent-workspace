import assert from 'node:assert/strict'
import test from 'node:test'
import { dropActionForStatus } from '../src/kanban-transitions.ts'

test('dropping an actionable task on ready promotes it', () => {
  assert.deepEqual(dropActionForStatus('triage', 'ready'), { action: 'promote', reason: 'Moved to Ready by drag and drop' })
})

test('dropping blocked or scheduled task on ready unblocks it', () => {
  assert.deepEqual(dropActionForStatus('blocked', 'ready'), { action: 'unblock', reason: 'Moved to Ready by drag and drop' })
  assert.deepEqual(dropActionForStatus('scheduled', 'ready'), { action: 'unblock', reason: 'Moved to Ready by drag and drop' })
})

test('drop maps review, blocked, scheduled and done to Hermes lifecycle actions', () => {
  assert.equal(dropActionForStatus('running', 'review')?.action, 'review')
  assert.equal(dropActionForStatus('ready', 'blocked')?.action, 'block')
  assert.equal(dropActionForStatus('ready', 'scheduled')?.action, 'schedule')
  assert.equal(dropActionForStatus('ready', 'done')?.action, 'complete')
})

test('system-owned and invalid transitions are rejected', () => {
  assert.equal(dropActionForStatus('ready', 'running'), null)
  assert.equal(dropActionForStatus('done', 'ready'), null)
  assert.equal(dropActionForStatus('ready', 'triage'), null)
  assert.equal(dropActionForStatus('ready', 'todo'), null)
  assert.equal(dropActionForStatus('ready', 'ready'), null)
})
