import {
  Activity,
  Archive,
  ArrowRight,
  Ban,
  Bot,
  Check,
  CheckCircle2,
  ChevronDown,
  CircleDot,
  Clock3,
  Columns3,
  Cpu,
  Database,
  History,
  Inbox,
  LayoutDashboard,
  Library,
  LoaderCircle,
  MessageSquare,
  Network,
  Plus,
  RefreshCw,
  Search,
  Send,
  Settings,
  ShieldCheck,
  Sparkles,
  UserRound,
  X,
} from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { api } from './api'
import { dropActionForStatus } from './kanban-transitions'
import { pathForView, routeFromPath, type WorkspaceRoute, type WorkspaceView } from './routes'
import type { Assignee, Board, KanbanTask, TaskAction, TaskDetail, TaskStatus, WorkspaceOverview } from './types'

import './App.css'
import './workspace.css'

const columns: Array<{ status: TaskStatus; label: string; description: string; icon: typeof Inbox }> = [
  { status: 'triage', label: 'Triage', description: 'Needs a concrete spec', icon: Inbox },
  { status: 'todo', label: 'Todo', description: 'Waiting on dependencies', icon: CircleDot },
  { status: 'ready', label: 'Ready', description: 'Available to dispatch', icon: Sparkles },
  { status: 'running', label: 'Running', description: 'Agent is working', icon: LoaderCircle },
  { status: 'review', label: 'Review', description: 'Awaiting verification', icon: ShieldCheck },
  { status: 'blocked', label: 'Blocked', description: 'Needs intervention', icon: Ban },
  { status: 'scheduled', label: 'Scheduled', description: 'Parked until later', icon: Clock3 },
  { status: 'done', label: 'Done', description: 'Completed work', icon: CheckCircle2 },
]

const actionLabels: Record<TaskAction, string> = {
  promote: 'Promote to ready',
  block: 'Block task',
  unblock: 'Unblock task',
  review: 'Request review',
  complete: 'Mark complete',
  archive: 'Archive task',
  comment: 'Add comment',
  assign: 'Assign agent',
  schedule: 'Schedule task',
}

function App() {
  const [route, setRoute] = useState<WorkspaceRoute>(() => routeFromPath(window.location.pathname))
  const activeView: WorkspaceView = route.view === 'skill' ? 'skills' : route.view
  const [boards, setBoards] = useState<Board[]>([])
  const [board, setBoard] = useState('default')
  const [tasks, setTasks] = useState<KanbanTask[]>([])
  const [assignees, setAssignees] = useState<Assignee[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [detail, setDetail] = useState<TaskDetail | null>(null)
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [createOpen, setCreateOpen] = useState(false)
  const [boardOpen, setBoardOpen] = useState(false)
  const [actionBusy, setActionBusy] = useState(false)
  const [draggedTask, setDraggedTask] = useState<KanbanTask | null>(null)
  const [dragOverStatus, setDragOverStatus] = useState<TaskStatus | null>(null)

  const navigate = useCallback((next: WorkspaceRoute, replace = false) => {
    const path = next.view === 'skill' ? `/skills/${next.skill}` : pathForView(next.view)
    window.history[replace ? 'replaceState' : 'pushState']({}, '', path)
    setRoute(next)
  }, [])

  useEffect(() => {
    const onPopState = () => setRoute(routeFromPath(window.location.pathname))
    window.addEventListener('popstate', onPopState)
    const canonical = route.view === 'skill' ? `/skills/${route.skill}` : pathForView(route.view)
    if (window.location.pathname !== canonical) window.history.replaceState({}, '', canonical)
    return () => window.removeEventListener('popstate', onPopState)
  }, [route])

  const loadBoards = useCallback(async () => {
    const nextBoards = await api.boards()
    setBoards(nextBoards.filter((item) => !item.archived))
    if (!nextBoards.some((item) => item.slug === board && !item.archived)) {
      setBoard(nextBoards.find((item) => !item.archived)?.slug || 'default')
    }
  }, [board])

  const refresh = useCallback(async (quiet = false) => {
    if (!quiet) setSyncing(true)
    try {
      const [nextTasks, nextAssignees] = await Promise.all([api.tasks(board), api.assignees(board)])
      setTasks(nextTasks)
      setAssignees(nextAssignees)
      setError(null)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause))
    } finally {
      setLoading(false)
      setSyncing(false)
    }
  }, [board])

  useEffect(() => {
    void loadBoards().catch((cause) => setError(cause instanceof Error ? cause.message : String(cause)))
  }, [loadBoards])

  useEffect(() => {
    setLoading(true)
    setSelectedId(null)
    setDetail(null)
    void refresh()
    const timer = window.setInterval(() => void refresh(true), 8_000)
    return () => window.clearInterval(timer)
  }, [board, refresh])

  useEffect(() => {
    if (!selectedId) return
    let active = true
    void api.task(board, selectedId).then((data) => active && setDetail(data)).catch((cause) => {
      if (active) setError(cause instanceof Error ? cause.message : String(cause))
    })
    return () => { active = false }
  }, [board, selectedId, tasks])

  const currentBoard = boards.find((item) => item.slug === board)
  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase()
    if (!needle) return tasks
    return tasks.filter((task) => [task.title, task.body, task.assignee, task.id, task.status]
      .filter(Boolean).join(' ').toLowerCase().includes(needle))
  }, [query, tasks])
  const activeCount = tasks.filter((task) => task.status === 'running').length
  const readyCount = tasks.filter((task) => task.status === 'ready').length
  const attentionCount = tasks.filter((task) => task.status === 'blocked' || task.status === 'review').length

  async function runAction(id: string, action: TaskAction, reason?: string, assignee?: string) {
    setActionBusy(true)
    setNotice(null)
    try {
      await api.action(board, id, action, reason, assignee)
      setNotice(actionLabels[action])
      await refresh()
      if (action === 'archive') {
        setSelectedId(null)
        setDetail(null)
      } else {
        setDetail(await api.task(board, id))
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause))
    } finally {
      setActionBusy(false)
    }
  }

  async function dropTask(status: TaskStatus) {
    if (!draggedTask) return
    const task = draggedTask
    const transition = dropActionForStatus(task.status, status)
    setDragOverStatus(null)
    setDraggedTask(null)
    if (!transition) {
      setNotice(status === 'running' ? 'Running is controlled by the Hermes dispatcher.' : `Hermes does not support moving ${task.status} directly to ${status}.`)
      return
    }
    await runAction(task.id, transition.action, transition.reason)
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand-mark"><Bot size={20} /><span>Hermes Workspace</span></div>
        <nav aria-label="Workspace navigation">
          <button className={activeView === 'overview' ? 'active' : ''} onClick={() => navigate({ view: 'overview' })}><LayoutDashboard size={17} /><span>Workspace</span></button>
          <button className={activeView === 'kanban' ? 'active' : ''} onClick={() => navigate({ view: 'kanban' })}><Columns3 size={17} /><span>Kanban</span></button>
          <button className={activeView === 'sessions' ? 'active' : ''} onClick={() => navigate({ view: 'sessions' })}><History size={17} /><span>Sessions</span></button>
          <button className={activeView === 'agents' ? 'active' : ''} onClick={() => navigate({ view: 'agents' })}><Bot size={17} /><span>Agents</span></button>
          <button className={activeView === 'automations' ? 'active' : ''} onClick={() => navigate({ view: 'automations' })}><Activity size={17} /><span>Automations</span></button>
          <button className={activeView === 'skills' ? 'active' : ''} onClick={() => navigate({ view: 'skills' })}><Library size={17} /><span>Skills</span></button>
          <button className={activeView === 'system' ? 'active' : ''} onClick={() => navigate({ view: 'system' })}><Settings size={17} /><span>System</span></button>
        </nav>
        <div className="sidebar-foot">
          <span className="connection-dot" />
          <div><strong>Local Hermes</strong><small>CLI bridge connected</small></div>
        </div>
      </aside>

      {activeView === 'kanban' ? <main>
        <header className="topbar">
          <div className="board-picker-wrap">
            <button className="board-picker" onClick={() => setBoardOpen((value) => !value)}>
              <span className="board-color" style={{ background: currentBoard?.color || '#7c5cff' }} />
              <span><small>Board</small><strong>{currentBoard?.name || board}</strong></span>
              <ChevronDown size={15} />
            </button>
            {boardOpen && (
              <div className="board-menu">
                {boards.map((item) => (
                  <button key={item.slug} className={item.slug === board ? 'selected' : ''} onClick={() => { setBoard(item.slug); setBoardOpen(false) }}>
                    <span className="board-color" style={{ background: item.color || '#7c5cff' }} />
                    <span><strong>{item.name}</strong><small>{item.total} task{item.total === 1 ? '' : 's'}</small></span>
                    {item.slug === board && <Check size={14} />}
                  </button>
                ))}
                <button className="new-board-link" onClick={() => {
                  setBoardOpen(false)
                  setCreateOpen(false)
                  const dialog = document.getElementById('new-board-dialog')
                  if (dialog instanceof HTMLDialogElement) dialog.showModal()
                }}>
                  <Plus size={14} /> New board
                </button>
              </div>
            )}
          </div>
          <label className="search-box">
            <Search size={16} />
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search tasks, agents, IDs..." />
            {query && <button onClick={() => setQuery('')} aria-label="Clear search"><X size={14} /></button>}
          </label>
          <button className="icon-button" onClick={() => void refresh()} aria-label="Refresh board" title="Refresh board">
            <RefreshCw className={syncing ? 'spin' : ''} size={17} />
          </button>
          <button className="primary-button" onClick={() => setCreateOpen(true)}><Plus size={16} /> New task</button>
        </header>

        <section className="workspace-head">
          <div><p>Multi-agent work queue</p><h1>{currentBoard?.name || 'Kanban workspace'}</h1></div>
          <div className="metrics">
            <article><span className="metric-icon purple"><Sparkles size={16} /></span><div><strong>{readyCount}</strong><small>Ready</small></div></article>
            <article><span className="metric-icon blue"><LoaderCircle size={16} /></span><div><strong>{activeCount}</strong><small>Running</small></div></article>
            <article><span className="metric-icon amber"><ShieldCheck size={16} /></span><div><strong>{attentionCount}</strong><small>Attention</small></div></article>
            <article><span className="metric-icon green"><CheckCircle2 size={16} /></span><div><strong>{tasks.filter((task) => task.status === 'done').length}</strong><small>Done</small></div></article>
          </div>
        </section>

        {error && <div className="banner error"><Ban size={16} /><span>{error}</span><button onClick={() => setError(null)}><X size={14} /></button></div>}
        {notice && <div className="banner success"><CheckCircle2 size={16} /><span>{notice}</span><button onClick={() => setNotice(null)}><X size={14} /></button></div>}

        <div className="board-scroller">
          <section className="kanban-board" aria-label="Hermes Kanban board">
            {columns.map((column) => {
              const columnTasks = filtered.filter((task) => task.status === column.status)
              const Icon = column.icon
              return (
                <div
                  className={`kanban-column status-${column.status} ${dragOverStatus === column.status ? 'drag-over' : ''}`}
                  key={column.status}
                  data-status={column.status}
                  onDragOver={(event) => { if (draggedTask) { event.preventDefault(); event.dataTransfer.dropEffect = 'move'; setDragOverStatus(column.status) } }}
                  onDragLeave={(event) => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setDragOverStatus(null) }}
                  onDrop={(event) => { event.preventDefault(); void dropTask(column.status) }}
                >
                  <header>
                    <div><span className="column-icon"><Icon size={15} /></span><span><strong>{column.label}</strong><small>{column.description}</small></span></div>
                    <em>{columnTasks.length}</em>
                  </header>
                  <div className="card-stack">
                    {columnTasks.map((task) => (
                      <TaskCard key={task.id} task={task} selected={task.id === selectedId} dragging={task.id === draggedTask?.id} onClick={() => setSelectedId(task.id)} onDragStart={(event) => { event.dataTransfer.effectAllowed = 'move'; event.dataTransfer.setData('text/plain', task.id); setDraggedTask(task) }} onDragEnd={() => { setDraggedTask(null); setDragOverStatus(null) }} />
                    ))}
                    {!loading && columnTasks.length === 0 && <div className="empty-column"><span /><p>No {column.label.toLowerCase()} tasks</p></div>}
                    {loading && <div className="skeleton-card" />}
                  </div>
                </div>
              )
            })}
          </section>
        </div>
      </main> : <WorkspacePage route={route} onNavigate={(view) => navigate({ view })} onOpenSkill={(skill) => navigate({ view: 'skill', skill })} />}

      {selectedId && detail && (
        <TaskDrawer
          detail={detail}
          assignees={assignees}
          busy={actionBusy}
          onClose={() => { setSelectedId(null); setDetail(null) }}
          onAction={(action, reason, assignee) => void runAction(selectedId, action, reason, assignee)}
        />
      )}

      {createOpen && (
        <CreateTaskDialog board={board} assignees={assignees} onClose={() => setCreateOpen(false)} onCreated={async () => {
          setCreateOpen(false)
          setNotice('Task created')
          await refresh()
        }} />
      )}
      <NewBoardDialog onCreated={async (slug) => { await loadBoards(); setBoard(slug); setNotice('Board created') }} />
    </div>
  )
}

function WorkspacePage({ route, onNavigate, onOpenSkill }: { route: Exclude<WorkspaceRoute, { view: 'kanban' }>; onNavigate: (view: WorkspaceView) => void; onOpenSkill: (skill: string) => void }) {
  const [overview, setOverview] = useState<WorkspaceOverview | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  useEffect(() => {
    setLoading(true)
    void api.overview().then(setOverview).catch((cause) => setError(cause instanceof Error ? cause.message : String(cause))).finally(() => setLoading(false))
  }, [])
  if (loading) return <main className="workspace-page"><div className="workspace-loading"><LoaderCircle className="spin" /><span>Loading Hermes workspace…</span></div></main>
  if (error || !overview) return <main className="workspace-page"><div className="workspace-error"><Ban /><h2>Workspace unavailable</h2><p>{error}</p></div></main>
  const view = route.view === 'skill' ? 'skills' : route.view
  const title = route.view === 'skill' ? route.skill : ({ overview: 'Agent workspace', sessions: 'Sessions', agents: 'Agent profiles', automations: 'Automations', skills: 'Skills library', system: 'System' } as Record<string, string>)[view]
  return <main className="workspace-page">
    <header className="workspace-toolbar"><div><small>Hermes Agent</small><h1>{title}</h1></div><button className="icon-button" title="Refresh workspace" aria-label="Refresh workspace" onClick={() => window.location.reload()}><RefreshCw size={16} /></button></header>
    {view === 'overview' && <OverviewView data={overview} onNavigate={onNavigate} />}
    {view === 'sessions' && <SessionsView data={overview} />}
    {view === 'agents' && <AgentsView data={overview} />}
    {view === 'automations' && <AutomationsView data={overview} onNavigate={onNavigate} />}
    {route.view === 'skills' && <SkillsView data={overview} onOpenSkill={onOpenSkill} />}
    {route.view === 'skill' && <SkillDetailView data={overview} slug={route.skill} onBack={() => onNavigate('skills')} />}
    {view === 'system' && <SystemView data={overview} />}
  </main>
}

function OverviewView({ data, onNavigate }: { data: WorkspaceOverview; onNavigate: (view: WorkspaceView) => void }) {
  const totalTasks = data.boards.reduce((sum, board) => sum + board.total, 0)
  return <div className="workspace-content">
    <section className="hero-panel"><div><span className="eyebrow"><Sparkles size={13} /> Control plane online</span><h2>One workspace for every Hermes operation.</h2><p>Coordinate durable tasks, agent profiles, conversation history, automations, skills, and runtime health from a single local interface.</p><div className="hero-actions"><button className="primary-button" onClick={() => onNavigate('kanban')}><Columns3 size={15} />Open Kanban</button><button className="secondary-button" onClick={() => onNavigate('sessions')}><History size={15} />Browse sessions</button></div></div><div className="hero-orbit"><Bot size={34} /><span className="orbit one" /><span className="orbit two" /><i className="node n1" /><i className="node n2" /><i className="node n3" /></div></section>
    <section className="workspace-kpis"><article><span><History /></span><strong>{data.sessionStats.sessions}</strong><small>Sessions</small><em>{data.sessionStats.messages.toLocaleString()} messages</em></article><article><span><Bot /></span><strong>{data.profiles.length}</strong><small>Agent profiles</small><em>{data.profiles.filter((p) => p.gateway === 'running').length} gateway online</em></article><article><span><Columns3 /></span><strong>{totalTasks}</strong><small>Kanban tasks</small><em>{data.boards.length} isolated board{data.boards.length === 1 ? '' : 's'}</em></article><article><span><Library /></span><strong>{data.skillCount}</strong><small>Enabled skills</small><em>Reusable capability library</em></article></section>
    <div className="workspace-grid"><section className="workspace-card recent-card"><header><div><h3>Recent sessions</h3><p>Conversation lineage across workspaces</p></div><button onClick={() => onNavigate('sessions')}>View all</button></header><SessionList sessions={data.sessions.slice(0, 6)} /></section><section className="workspace-card runtime-card"><header><div><h3>Runtime</h3><p>Live Hermes environment</p></div><span className="live-pill"><i />Online</span></header><div className="runtime-model"><span><Cpu size={20} /></span><div><small>Active model</small><strong>{data.system.model}</strong><em>{data.system.provider}</em></div></div><dl><div><dt>Gateway</dt><dd>{data.system.gateway}</dd></div><div><dt>Python</dt><dd>{data.system.python}</dd></div><div><dt>Session DB</dt><dd>{data.sessionStats.databaseSize}</dd></div><div><dt>Cron jobs</dt><dd>{data.cron.count}</dd></div></dl></section></div>
    <section className="workspace-card quick-grid"><header><div><h3>Workspace modules</h3><p>Move from context to execution without leaving the control plane</p></div></header><div><button onClick={() => onNavigate('kanban')}><Columns3 /><span><strong>Kanban</strong><small>Durable multi-agent work queue</small></span><ArrowRight /></button><button onClick={() => onNavigate('agents')}><Bot /><span><strong>Agents</strong><small>Profiles, models, and gateway state</small></span><ArrowRight /></button><button onClick={() => onNavigate('automations')}><Activity /><span><strong>Automations</strong><small>Cron and background operations</small></span><ArrowRight /></button><button onClick={() => onNavigate('skills')}><Library /><span><strong>Skills</strong><small>Reusable procedural capability</small></span><ArrowRight /></button></div></section>
  </div>
}

function SessionList({ sessions }: { sessions: WorkspaceOverview['sessions'] }) { return <div className="session-list">{sessions.map((session) => <article key={session.id}><span className="session-icon"><MessageSquare size={15} /></span><div><strong>{session.title}</strong><small>{session.workspace || 'General workspace'} · {session.lastActive}</small></div><code>{session.id.slice(-6)}</code></article>)}</div> }
function SessionsView({ data }: { data: WorkspaceOverview }) { return <div className="workspace-content"><section className="workspace-kpis compact"><article><span><History /></span><strong>{data.sessionStats.sessions}</strong><small>Total sessions</small></article><article><span><MessageSquare /></span><strong>{data.sessionStats.messages.toLocaleString()}</strong><small>Messages</small></article><article><span><Database /></span><strong>{data.sessionStats.databaseSize}</strong><small>Database</small></article></section><section className="workspace-card"><header><div><h3>Recent conversation history</h3><p>Real sessions from Hermes state.db</p></div></header><SessionList sessions={data.sessions} /></section></div> }
function AgentsView({ data }: { data: WorkspaceOverview }) { return <div className="workspace-content"><section className="agent-grid">{data.profiles.map((profile) => <article className="agent-profile-card" key={profile.name}><header><span><Bot size={22} /></span><i className={profile.gateway === 'running' ? 'online' : ''} /></header><h3>{profile.name}</h3><p>{profile.model}</p><dl><div><dt>Gateway</dt><dd>{profile.gateway}</dd></div><div><dt>Distribution</dt><dd>{profile.distribution || 'Local profile'}</dd></div></dl></article>)}</section></div> }
function AutomationsView({ data, onNavigate }: { data: WorkspaceOverview; onNavigate: (view: WorkspaceView) => void }) { return <div className="workspace-content"><section className="empty-state-panel"><span><Activity size={28} /></span><h2>{data.cron.empty ? 'No scheduled automations yet' : `${data.cron.count} automations configured`}</h2><p>Hermes cron jobs run in fresh agent sessions and can collect data, reason over changes, and deliver results back to your channels.</p><div><button className="primary-button" onClick={() => onNavigate('kanban')}><Columns3 size={15} />View work queue</button></div></section></div> }
function SkillsView({ data, onOpenSkill }: { data: WorkspaceOverview; onOpenSkill: (skill: string) => void }) { return <div className="workspace-content"><section className="skill-grid">{data.skills.map((skill) => <button onClick={() => onOpenSkill(skill.name)} key={skill.name}><span><Library size={16} /></span><div><h3>{skill.name}</h3><p>{skill.category}</p></div><em>{skill.source}</em></button>)}</section></div> }
function SkillDetailView({ data, slug, onBack }: { data: WorkspaceOverview; slug: string; onBack: () => void }) { const skill = data.skills.find((item) => item.name === slug); return <div className="workspace-content"><section className="skill-detail"><button className="skill-back" onClick={onBack}><ArrowRight size={14} />All skills</button><span className="skill-detail-icon"><Library size={26} /></span><small>Hermes capability</small><h2>{slug}</h2>{skill ? <><p>This skill is enabled in the active Hermes profile and can be loaded by agents when its workflow matches a task.</p><dl><div><dt>Category</dt><dd>{skill.category}</dd></div><div><dt>Source</dt><dd>{skill.source}</dd></div><div><dt>Trust</dt><dd>{skill.trust}</dd></div><div><dt>Status</dt><dd>{skill.status}</dd></div></dl></> : <><p>This URL points to a skill that is not present in the current overview cache.</p><div className="unknown-skill">Run <code>hermes skills inspect {slug}</code> to inspect it from the CLI.</div></>}</section></div> }
function SystemView({ data }: { data: WorkspaceOverview }) { const rows = [['Model', data.system.model], ['Provider', data.system.provider], ['Gateway', data.system.gateway], ['Python', data.system.python], ['Hermes source', data.system.project], ['Session database', data.sessionStats.databaseSize]]; return <div className="workspace-content"><section className="workspace-card system-card"><header><div><h3>Runtime diagnostics</h3><p>Current local Hermes Agent configuration</p></div><span className="live-pill"><i />Operational</span></header><div className="system-rows">{rows.map(([label, value]) => <div key={label}><span>{label}</span><strong>{value}</strong></div>)}</div></section><section className="system-modules"><article><Network /><div><strong>Gateway</strong><small>Messaging, cron, and Kanban dispatcher</small></div><em>{data.system.gateway}</em></article><article><Database /><div><strong>State store</strong><small>{data.sessionStats.sessions} sessions indexed</small></div><em>{data.sessionStats.databaseSize}</em></article><article><Cpu /><div><strong>Inference</strong><small>{data.system.provider}</small></div><em>{data.system.model}</em></article></section></div> }

function TaskCard({ task, selected, dragging, onClick, onDragStart, onDragEnd }: { task: KanbanTask; selected: boolean; dragging: boolean; onClick: () => void; onDragStart: (event: React.DragEvent<HTMLButtonElement>) => void; onDragEnd: () => void }) {
  return (
    <button className={`task-card ${selected ? 'selected' : ''} ${dragging ? 'dragging' : ''}`} draggable onDragStart={onDragStart} onDragEnd={onDragEnd} onClick={onClick}>
      <div className="task-card-top"><span className={`priority priority-${priorityTone(task.priority)}`}>{priorityLabel(task.priority)}</span><code>{task.id.slice(0, 10)}</code></div>
      <h3>{task.title}</h3>
      {task.body && <p>{task.body}</p>}
      <footer>
        <span className="assignee"><UserRound size={13} />{task.assignee || 'Unassigned'}</span>
        <time><Clock3 size={12} />{relativeTime(task.created_at)}</time>
      </footer>
      {(task.model_override || task.workspace_kind !== 'scratch') && (
        <div className="task-meta">
          {task.model_override && <span>{task.model_override}</span>}
          {task.workspace_kind !== 'scratch' && <span>{task.workspace_kind}</span>}
        </div>
      )}
    </button>
  )
}

function TaskDrawer({ detail, assignees, busy, onClose, onAction }: {
  detail: TaskDetail
  assignees: Assignee[]
  busy: boolean
  onClose: () => void
  onAction: (action: TaskAction, reason?: string, assignee?: string) => void
}) {
  const task = detail.task
  const [comment, setComment] = useState('')
  const [assignee, setAssignee] = useState(task.assignee || '')
  return (
    <div className="drawer-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <aside className="task-drawer">
        <header><span className={`status-chip status-${task.status}`}>{task.status}</span><button onClick={onClose} aria-label="Close details"><X size={17} /></button></header>
        <div className="drawer-scroll">
          <div className="drawer-title"><code>{task.id}</code><h2>{task.title}</h2>{task.body && <p>{task.body}</p>}</div>
          <dl className="task-facts">
            <div><dt>Assignee</dt><dd>{task.assignee || 'Unassigned'}</dd></div>
            <div><dt>Priority</dt><dd>{priorityLabel(task.priority)}</dd></div>
            <div><dt>Workspace</dt><dd>{task.workspace_kind}</dd></div>
            <div><dt>Created</dt><dd>{formatTime(task.created_at)}</dd></div>
          </dl>

          <section className="drawer-section">
            <h3>Move task</h3>
            <div className="action-grid">
              {(task.status === 'triage' || task.status === 'todo' || task.status === 'blocked' || task.status === 'scheduled') && <button disabled={busy} onClick={() => onAction(task.status === 'blocked' || task.status === 'scheduled' ? 'unblock' : 'promote')}><ArrowRight size={14} />Ready</button>}
              {task.status === 'running' && <button disabled={busy} onClick={() => onAction('review')}><ShieldCheck size={14} />Review</button>}
              {task.status !== 'blocked' && task.status !== 'done' && <button disabled={busy} onClick={() => onAction('block', 'Blocked from Hermes Flow dashboard')}><Ban size={14} />Block</button>}
              {task.status !== 'done' && <button disabled={busy} className="complete" onClick={() => onAction('complete')}><CheckCircle2 size={14} />Complete</button>}
            </div>
          </section>

          <section className="drawer-section">
            <h3>Assignment</h3>
            <div className="inline-form"><select value={assignee} onChange={(event) => setAssignee(event.target.value)}><option value="">Unassigned</option>{assignees.map((item) => <option value={item.name} key={item.name}>{item.name}{item.on_disk ? '' : ' (profile missing)'}</option>)}</select><button disabled={busy} onClick={() => onAction('assign', undefined, assignee)}><UserRound size={14} />Save</button></div>
          </section>

          <section className="drawer-section">
            <h3>Activity <span>{detail.events.length + detail.comments.length}</span></h3>
            <div className="activity-list">
              {[...detail.comments.map((item) => ({ type: 'comment', text: item.body || item.text || 'Comment', at: item.created_at })), ...detail.events.map((item) => ({ type: item.kind, text: eventText(item.kind), at: item.created_at }))]
                .sort((a, b) => b.at - a.at).slice(0, 12).map((item, index) => (
                  <article key={`${item.type}-${item.at}-${index}`}><span><MessageSquare size={13} /></span><div><strong>{item.text}</strong><small>{formatTime(item.at)}</small></div></article>
                ))}
            </div>
          </section>
          <section className="drawer-section danger-zone">
            <div><h3>Archive task</h3><p>Hide this task from the active board while preserving its history.</p></div>
            <button disabled={busy} onClick={() => onAction('archive')}><Archive size={14} />Archive</button>
          </section>
        </div>
        <footer className="drawer-comment"><textarea value={comment} onChange={(event) => setComment(event.target.value)} placeholder="Add a comment..." rows={2} /><button disabled={busy || !comment.trim()} onClick={() => { onAction('comment', comment); setComment('') }}><Send size={15} /></button></footer>
      </aside>
    </div>
  )
}

function CreateTaskDialog({ board, assignees, onClose, onCreated }: { board: string; assignees: Assignee[]; onClose: () => void; onCreated: () => Promise<void> }) {
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [assignee, setAssignee] = useState('')
  const [priority, setPriority] = useState(0)
  const [triage, setTriage] = useState(true)
  const [goal, setGoal] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  async function submit(event: React.FormEvent) {
    event.preventDefault(); setBusy(true); setError(null)
    try { await api.createTask({ board, title, body: body || undefined, assignee: assignee || undefined, priority, triage, goal }); await onCreated() }
    catch (cause) { setError(cause instanceof Error ? cause.message : String(cause)); setBusy(false) }
  }
  return <div className="modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose()}><form className="modal" onSubmit={submit}><header><div><small>Create on {board}</small><h2>New Kanban task</h2></div><button type="button" onClick={onClose}><X size={17} /></button></header>{error && <p className="form-error">{error}</p>}<label><span>Title</span><input autoFocus required maxLength={200} value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Ship the authentication flow" /></label><label><span>Description</span><textarea rows={5} value={body} onChange={(event) => setBody(event.target.value)} placeholder="Define the outcome, constraints, and validation..." /></label><div className="form-grid"><label><span>Assignee</span><select value={assignee} onChange={(event) => setAssignee(event.target.value)}><option value="">Unassigned</option>{assignees.map((item) => <option value={item.name} key={item.name}>{item.name}</option>)}</select></label><label><span>Priority</span><select value={priority} onChange={(event) => setPriority(Number(event.target.value))}><option value={20}>Urgent</option><option value={10}>High</option><option value={0}>Normal</option><option value={-10}>Low</option></select></label></div><label className="check-row"><input type="checkbox" checked={triage} onChange={(event) => setTriage(event.target.checked)} /><span><strong>Start in triage</strong><small>Let Hermes specify or decompose it before dispatch.</small></span></label><label className="check-row"><input type="checkbox" checked={goal} onChange={(event) => setGoal(event.target.checked)} /><span><strong>Goal loop</strong><small>Keep the worker going until a judge agrees the task is done.</small></span></label><footer><button type="button" className="secondary-button" onClick={onClose}>Cancel</button><button className="primary-button" disabled={busy || !title.trim()}>{busy ? <LoaderCircle className="spin" size={15} /> : <Plus size={15} />}Create task</button></footer></form></div>
}

function NewBoardDialog({ onCreated }: { onCreated: (slug: string) => Promise<void> }) {
  const [slug, setSlug] = useState('')
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [color, setColor] = useState('#7c5cff')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError(null)
    try { await api.createBoard({ slug, name: name || undefined, description: description || undefined, color }); await onCreated(slug); (event.currentTarget.parentElement as HTMLDialogElement).close(); setSlug(''); setName(''); setDescription('') }
    catch (cause) { setError(cause instanceof Error ? cause.message : String(cause)); setBusy(false) }
  }
  return <dialog id="new-board-dialog" className="native-dialog"><form className="modal" onSubmit={submit}><header><div><small>Isolated workstream</small><h2>Create board</h2></div><button type="button" onClick={() => document.getElementById('new-board-dialog') instanceof HTMLDialogElement && (document.getElementById('new-board-dialog') as HTMLDialogElement).close()}><X size={17} /></button></header>{error && <p className="form-error">{error}</p>}<label><span>Slug</span><input required pattern="[a-z0-9][a-z0-9-]*" value={slug} onChange={(event) => setSlug(event.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))} placeholder="product-launch" /></label><label><span>Name</span><input value={name} onChange={(event) => setName(event.target.value)} placeholder="Product Launch" /></label><label><span>Description</span><textarea rows={3} value={description} onChange={(event) => setDescription(event.target.value)} placeholder="What this board coordinates" /></label><label><span>Accent</span><input type="color" value={color} onChange={(event) => setColor(event.target.value)} /></label><footer><button type="button" className="secondary-button" onClick={() => (document.getElementById('new-board-dialog') as HTMLDialogElement).close()}>Cancel</button><button className="primary-button" disabled={busy || !slug}>{busy ? <LoaderCircle className="spin" size={15} /> : <Plus size={15} />}Create board</button></footer></form></dialog>
}

function priorityTone(priority: number) { return priority >= 20 ? 'urgent' : priority >= 10 ? 'high' : priority < 0 ? 'low' : 'normal' }
function priorityLabel(priority: number) { return priority >= 20 ? 'Urgent' : priority >= 10 ? 'High' : priority < 0 ? 'Low' : 'Normal' }
function formatTime(epoch: number) { return new Date(epoch * 1000).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) }
function relativeTime(epoch: number) { const seconds = Math.max(0, Math.floor(Date.now() / 1000 - epoch)); if (seconds < 60) return 'now'; if (seconds < 3600) return `${Math.floor(seconds / 60)}m`; if (seconds < 86400) return `${Math.floor(seconds / 3600)}h`; return `${Math.floor(seconds / 86400)}d` }
function eventText(kind: string) { return ({ created: 'Task created', claimed: 'Agent claimed task', status_changed: 'Status changed', completed: 'Task completed', blocked: 'Task blocked', comment: 'Comment added' } as Record<string, string>)[kind] || kind.replaceAll('_', ' ') }

export default App
