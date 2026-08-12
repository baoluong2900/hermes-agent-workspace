export type TaskStatus =
  | 'triage'
  | 'todo'
  | 'ready'
  | 'running'
  | 'review'
  | 'blocked'
  | 'scheduled'
  | 'done'
  | 'archived'

export type KanbanTask = {
  id: string
  title: string
  body: string | null
  assignee: string | null
  status: TaskStatus
  priority: number
  tenant: string | null
  workspace_kind: string
  workspace_path: string | null
  branch_name: string | null
  project_id: string | null
  created_by: string
  created_at: number
  started_at: number | null
  completed_at: number | null
  result: string | null
  skills: string[]
  max_retries: number | null
  model_override: string | null
  provider_override: string | null
}

export type Board = {
  slug: string
  name: string
  description: string
  icon: string
  color: string
  default_workdir: string | null
  archived: boolean
  is_current: boolean
  counts: Partial<Record<TaskStatus, number>>
  total: number
}

export type Assignee = {
  name: string
  on_disk: boolean
  counts: Partial<Record<TaskStatus, number>>
}

export type TaskDetail = {
  task: KanbanTask
  latest_summary: string | null
  parents: KanbanTask[]
  children: KanbanTask[]
  comments: Array<{ author?: string; body?: string; text?: string; created_at: number }>
  events: Array<{ kind: string; payload: unknown; created_at: number; run_id: string | null }>
  runs: Array<Record<string, unknown>>
}

export type TaskAction =
  | 'promote'
  | 'block'
  | 'unblock'
  | 'review'
  | 'complete'
  | 'archive'
  | 'comment'
  | 'assign'
  | 'schedule'

export type WorkspaceSession = { title: string; workspace: string | null; lastActive: string; id: string }
export type HermesProfile = { name: string; model: string; gateway: string; alias: string | null; distribution: string | null }
export type HermesSkill = { name: string; category: string; source: string; trust: string; status: string }
export type SystemStatus = { model: string; provider: string; python: string; gateway: string; project: string; activeSessions: number; scheduledJobs: number }
export type HermesProject = { slug: string; name: string; primaryPath: string | null; active: boolean }

export type WorkspaceOverview = {
  sessions: WorkspaceSession[]
  sessionStats: { sessions: number; messages: number; databaseSize: string }
  profiles: HermesProfile[]
  skills: HermesSkill[]
  skillCount: number
  system: SystemStatus
  cron: { count: number; empty: boolean }
  boards: Board[]
}
