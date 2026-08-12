import assert from 'node:assert/strict'
import test from 'node:test'
import { closeDialogById } from '../src/dialog.ts'

test('closes a dialog resolved after async submit without retaining React event target', () => {
  let closed = false
  const documentLike = {
    getElementById: (id: string) => id === 'new-board-dialog' ? { close: () => { closed = true } } : null,
  }
  assert.equal(closeDialogById(documentLike, 'new-board-dialog'), true)
  assert.equal(closed, true)
})

test('missing dialog is a safe no-op', () => {
  assert.equal(closeDialogById({ getElementById: () => null }, 'missing'), false)
})
