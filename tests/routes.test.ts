import assert from 'node:assert/strict'
import test from 'node:test'
import { pathForView, routeFromPath } from '../src/routes.ts'

test('workspace views have canonical URLs', () => {
  assert.equal(pathForView('overview'), '/dashboard')
  assert.equal(pathForView('kanban'), '/kanban')
  assert.equal(pathForView('sessions'), '/sessions')
  assert.equal(pathForView('agents'), '/agents')
  assert.equal(pathForView('automations'), '/automations')
  assert.equal(pathForView('skills'), '/skills')
  assert.equal(pathForView('system'), '/system')
})

test('root and legacy kaban route resolve safely', () => {
  assert.deepEqual(routeFromPath('/'), { view: 'overview' })
  assert.deepEqual(routeFromPath('/kaban'), { view: 'kanban' })
  assert.deepEqual(routeFromPath('/dashboard'), { view: 'overview' })
})

test('skill slug becomes a skill detail route', () => {
  assert.deepEqual(routeFromPath('/concurrent-agent-shared-checkout'), {
    view: 'skill',
    skill: 'concurrent-agent-shared-checkout',
  })
})

test('nested and unknown paths fall back to dashboard', () => {
  assert.deepEqual(routeFromPath('/skills/concurrent-agent-shared-checkout'), {
    view: 'skill',
    skill: 'concurrent-agent-shared-checkout',
  })
  assert.deepEqual(routeFromPath('/does/not/exist'), { view: 'overview' })
})
