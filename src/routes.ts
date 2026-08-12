export type WorkspaceView = 'overview' | 'kanban' | 'sessions' | 'agents' | 'automations' | 'skills' | 'system'
export type WorkspaceRoute = { view: WorkspaceView } | { view: 'skill'; skill: string }

const viewPaths: Record<WorkspaceView, string> = {
  overview: '/dashboard',
  kanban: '/kanban',
  sessions: '/sessions',
  agents: '/agents',
  automations: '/automations',
  skills: '/skills',
  system: '/system',
}

export function pathForView(view: WorkspaceView): string {
  return viewPaths[view]
}

export function routeFromPath(pathname: string): WorkspaceRoute {
  const path = pathname.replace(/\/+$/, '') || '/'
  if (path === '/' || path === '/dashboard') return { view: 'overview' }
  if (path === '/kanban' || path === '/kaban') return { view: 'kanban' }
  for (const [view, viewPath] of Object.entries(viewPaths)) {
    if (path === viewPath) return { view: view as WorkspaceView }
  }
  const nestedSkill = path.match(/^\/skills\/([a-z0-9][a-z0-9_-]*)$/)
  if (nestedSkill) return { view: 'skill', skill: nestedSkill[1] }
  const rootSlug = path.match(/^\/([a-z0-9][a-z0-9_-]*)$/)
  if (rootSlug) return { view: 'skill', skill: rootSlug[1] }
  return { view: 'overview' }
}
