import assert from 'node:assert/strict'
import test from 'node:test'
import { filterVisibleProviders } from '../server/model-visibility.ts'

const providers = [
  { slug: 'alpha', label: 'Alpha', models: ['a', 'b', 'c'], featuredModels: [] },
  { slug: 'beta', label: 'Beta', models: ['x', 'y'], featuredModels: [] },
  { slug: 'gamma', label: 'Gamma', models: ['m', 'n'], featuredModels: ['n'] },
]

test('honors Hermes Desktop visible model selections and hide-all sentinels', () => {
  const visible = new Set(['alpha::b', 'beta::'])
  assert.deepEqual(filterVisibleProviders(providers, visible), [
    { slug: 'alpha', label: 'Alpha', models: ['b'], featuredModels: [] },
    { slug: 'gamma', label: 'Gamma', models: ['n'], featuredModels: ['n'] },
  ])
})

test('uses the desktop default for providers not customized by the user', () => {
  assert.deepEqual(filterVisibleProviders(providers, null).map((provider) => provider.models), [
    ['a', 'b', 'c'], ['x', 'y'], ['n'],
  ])
})
