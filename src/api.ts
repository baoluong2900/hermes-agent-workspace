import type { Assignee, Board, KanbanTask, TaskAction, TaskDetail } from './types'

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...init?.headers },
  })
  const data = (await response.json()) as T & { error?: string }
  if (!response.ok) throw new Error(data.error || `Request failed (${response.status})`)
  return data
}

export const api = {
  boards: () => request<Board[]>('/api/boards'),
  assignees: (board: string) => request<Assignee[]>(`/api/assignees?board=${encodeURIComponent(board)}`),
  tasks: (board: string, includeArchived = false) =>
    request<KanbanTask[]>(`/api/tasks?board=${encodeURIComponent(board)}&archived=${includeArchived}`),
  task: (board: string, id: string) =>
    request<TaskDetail>(`/api/tasks/${encodeURIComponent(id)}?board=${encodeURIComponent(board)}`),
  createTask: (input: {
    board: string
    title: string
    body?: string
    assignee?: string
    priority: number
    triage: boolean
    workspace?: string
    goal: boolean
  }) => request<unknown>('/api/tasks', { method: 'POST', body: JSON.stringify(input) }),
  createBoard: (input: { slug: string; name?: string; description?: string; color?: string }) =>
    request<unknown>('/api/boards', { method: 'POST', body: JSON.stringify(input) }),
  action: (board: string, id: string, action: TaskAction, reason?: string, assignee?: string) =>
    request<unknown>(`/api/tasks/${encodeURIComponent(id)}/action`, {
      method: 'POST',
      body: JSON.stringify({ board, action, reason, assignee }),
    }),
}
