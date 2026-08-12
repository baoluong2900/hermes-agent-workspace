import type { TaskAction, TaskStatus } from './types'

export type DropAction = { action: TaskAction; reason: string }

export function dropActionForStatus(from: TaskStatus, to: TaskStatus): DropAction | null {
  if (from === to || from === 'done' || from === 'archived') return null
  if (to === 'ready') {
    if (from === 'blocked' || from === 'scheduled') return { action: 'unblock', reason: 'Moved to Ready by drag and drop' }
    if (from === 'triage' || from === 'todo') return { action: 'promote', reason: 'Moved to Ready by drag and drop' }
  }
  if (to === 'review' && from === 'running') return { action: 'review', reason: 'Moved to Review by drag and drop' }
  if (to === 'blocked' && !['blocked', 'done', 'archived'].includes(from)) return { action: 'block', reason: 'Moved to Blocked by drag and drop' }
  if (to === 'scheduled' && !['scheduled', 'done', 'archived'].includes(from)) return { action: 'schedule', reason: 'Moved to Scheduled by drag and drop' }
  if (to === 'done') return { action: 'complete', reason: 'Completed by drag and drop' }
  return null
}
