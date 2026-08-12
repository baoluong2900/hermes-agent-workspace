import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { readdir } from 'node:fs/promises'
import path from 'node:path'
import express from 'express'
import { z } from 'zod'
import { parseProjects } from './project-parser'

const execFileAsync = promisify(execFile)
const app = express()
const port = Number(process.env.PORT || 4178)

app.use(express.json({ limit: '256kb' }))

const boardSchema = z.string().trim().min(1).max(64).regex(/^[a-z0-9][a-z0-9-]*$/)
const taskIdSchema = z.string().trim().regex(/^t_[a-zA-Z0-9]+$/)
const statusSchema = z.enum(['triage', 'todo', 'ready', 'running', 'review', 'blocked', 'scheduled', 'done', 'archived'])

async function hermes(args: string[], board?: string): Promise<unknown> {
  const boardArgs = board ? ['--board', board] : []
  const { stdout } = await execFileAsync('hermes', ['kanban', ...boardArgs, ...args], {
    timeout: 30_000,
    maxBuffer: 4 * 1024 * 1024,
    env: process.env,
  })
  const output = stdout.trim()
  if (!output) return null
  try {
    return JSON.parse(output)
  } catch {
    return { message: output }
  }
}

async function hermesText(args: string[], timeout = 30_000): Promise<string> {
  const { stdout } = await execFileAsync('hermes', args, {
    timeout,
    maxBuffer: 8 * 1024 * 1024,
    env: { ...process.env, NO_COLOR: '1', TERM: 'dumb' },
  })
  return stdout.trim()
}

function splitTableRow(line: string): string[] {
  return line.trim().split(/\s{2,}/).map((value) => value.trim()).filter(Boolean)
}

function parseSessions(output: string) {
  return output.split('\n').slice(2).map(splitTableRow).filter((row) => row.length >= 4).map((row) => ({
    title: row[0], workspace: row[1] === '—' ? null : row[1], lastActive: row[2], id: row[3],
  }))
}

function parseProfiles(output: string) {
  return output.split('\n').slice(2).map((line) => splitTableRow(line.replace('◆', ''))).filter((row) => row.length >= 3).map((row) => ({
    name: row[0], model: row[1], gateway: row[2], alias: row[3] === '—' ? null : row[3], distribution: row[4] === '—' ? null : row[4],
  }))
}

function parseSkills(output: string) {
  return output.split('\n').filter((line) => line.includes('│') && !line.includes('Name')).map((line) => line.split('│').slice(1, -1).map((value) => value.trim())).filter((row) => row.length === 5 && row[0]).map((row) => ({
    name: row[0], category: row[1] || 'uncategorized', source: row[2], trust: row[3], status: row[4],
  }))
}

function parseSessionStats(output: string) {
  const number = (pattern: RegExp) => Number(output.match(pattern)?.[1] || 0)
  return { sessions: number(/Total sessions:\s*(\d+)/), messages: number(/Total messages:\s*(\d+)/), databaseSize: output.match(/Database size:\s*([^\n]+)/)?.[1]?.trim() || '—' }
}

function parseSystemStatus(output: string) {
  const value = (label: string) => output.match(new RegExp(`${label}:\\s+([^\\n]+)`))?.[1]?.trim() || '—'
  return { model: value('Model'), provider: value('Provider'), python: value('Python'), gateway: value('Status'), project: value('Project'), activeSessions: Number(output.match(/Active:\s+(\d+)/)?.[1] || 0), scheduledJobs: Number(output.match(/Jobs:\s+(\d+)/)?.[1] || 0) }
}

function parseBoard(value: unknown): string | undefined {
  if (value === undefined || value === null || value === '') return undefined
  return boardSchema.parse(value)
}

function errorMessage(error: unknown): string {
  if (error instanceof z.ZodError) return error.issues.map((issue) => issue.message).join(', ')
  if (error instanceof Error) return error.message
  return String(error)
}

app.get('/api/health', async (_request, response) => {
  try {
    const boards = await hermes(['boards', 'list', '--json'])
    response.json({ ok: true, boards })
  } catch (error) {
    response.status(503).json({ ok: false, error: errorMessage(error) })
  }
})

app.get('/api/workspace/overview', async (_request, response) => {
  try {
    const [sessionsRaw, statsRaw, profilesRaw, skillsRaw, statusRaw, cronRaw, boards] = await Promise.all([
      hermesText(['sessions', 'list', '--limit', '8']), hermesText(['sessions', 'stats']), hermesText(['profile', 'list']),
      hermesText(['skills', 'list', '--enabled-only']), hermesText(['status', '--all'], 60_000), hermesText(['cron', 'list', '--all']),
      hermes(['boards', 'list', '--json']),
    ])
    const skills = parseSkills(skillsRaw)
    response.json({ sessions: parseSessions(sessionsRaw), sessionStats: parseSessionStats(statsRaw), profiles: parseProfiles(profilesRaw), skills: skills.slice(0, 12), skillCount: skills.length, system: parseSystemStatus(statusRaw), cron: { count: cronRaw.includes('No scheduled jobs') ? 0 : 1, empty: cronRaw.includes('No scheduled jobs') }, boards })
  } catch (error) { response.status(500).json({ error: errorMessage(error) }) }
})

app.get('/api/workspace/sessions', async (_request, response) => {
  try { response.json(parseSessions(await hermesText(['sessions', 'list', '--limit', '50']))) }
  catch (error) { response.status(500).json({ error: errorMessage(error) }) }
})

app.get('/api/workspace/profiles', async (_request, response) => {
  try { response.json(parseProfiles(await hermesText(['profile', 'list']))) }
  catch (error) { response.status(500).json({ error: errorMessage(error) }) }
})

app.get('/api/model-options', async (_request, response) => {
  try {
    const script = "import sys,json; sys.path.insert(0,'/Users/baoluong0209/.hermes/hermes-agent'); from hermes_cli.inventory import build_models_payload,load_picker_context; p=build_models_payload(load_picker_context(),explicit_only=True,canonical_order=True,probe_custom_providers=False); print(json.dumps({'providers':[{'slug':r.get('slug',''),'label':r.get('label') or r.get('slug',''),'models':list(dict.fromkeys(r.get('models') or []))} for r in p.get('providers',[]) if r.get('models')]}))"
    const { stdout } = await execFileAsync('python3', ['-c', script], { maxBuffer: 5 * 1024 * 1024, timeout: 30_000 })
    response.json(JSON.parse(stdout.trim().split('\n').at(-1) || '{"providers":[]}'))
  } catch (error) { response.status(500).json({ error: errorMessage(error) }) }
})

app.patch('/api/profiles/:name/model', async (request, response) => {
  try {
    const name = z.string().regex(/^[a-z0-9][a-z0-9_-]*$/).parse(request.params.name)
    const body = z.object({ model: z.string().trim().min(1).max(300), provider: z.string().trim().min(1).max(100) }).parse(request.body)
    await hermesText(['--profile', name, 'config', 'set', 'model', body.model])
    await hermesText(['--profile', name, 'config', 'set', 'provider', body.provider])
    response.json({ ok: true, name, ...body })
  } catch (error) { response.status(400).json({ error: errorMessage(error) }) }
})

app.get('/api/workspace/skills', async (_request, response) => {
  try { response.json(parseSkills(await hermesText(['skills', 'list']))) }
  catch (error) { response.status(500).json({ error: errorMessage(error) }) }
})

app.get('/api/workspace/system', async (_request, response) => {
  try { response.json(parseSystemStatus(await hermesText(['status', '--all'], 60_000))) }
  catch (error) { response.status(500).json({ error: errorMessage(error) }) }
})

app.get('/api/workspace/cron', async (_request, response) => {
  try { const raw = await hermesText(['cron', 'list', '--all']); response.json({ raw, empty: raw.includes('No scheduled jobs') }) }
  catch (error) { response.status(500).json({ error: errorMessage(error) }) }
})

app.get('/api/boards', async (_request, response) => {
  try {
    response.json(await hermes(['boards', 'list', '--json']))
  } catch (error) {
    response.status(500).json({ error: errorMessage(error) })
  }
})

app.get('/api/projects', async (_request, response) => {
  try {
    const list = await hermesText(['project', 'list'])
    const slugs = list.split('\n').map((line) => line.replace(/^\s*\*?\s*/, '').trim().match(/^([a-z0-9][a-z0-9-]*)\s{2,}/)?.[1]).filter((slug): slug is string => Boolean(slug))
    const shows = new Map<string, string>()
    await Promise.all(slugs.map(async (slug) => shows.set(slug, await hermesText(['project', 'show', slug]))))
    const registered = parseProjects(list, shows).map((project) => ({ ...project, registered: true }))
    const registeredPaths = new Set(registered.map((project) => project.primaryPath).filter(Boolean))
    const discoveryRoot = process.env.HERMES_PROJECTS_ROOT || path.join(process.env.HOME || '', 'GitTool')
    let discovered: Array<{ slug: string; name: string; primaryPath: string; active: boolean; registered: boolean }> = []
    try {
      const entries = await readdir(discoveryRoot, { withFileTypes: true })
      discovered = entries.filter((entry) => entry.isDirectory()).map((entry) => ({ slug: entry.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''), name: entry.name, primaryPath: path.join(discoveryRoot, entry.name), active: false, registered: false })).filter((project) => !registeredPaths.has(project.primaryPath))
      const gitChecks = await Promise.all(discovered.map(async (project) => {
        try { await readdir(path.join(project.primaryPath, '.git')); return project } catch { return null }
      }))
      discovered = gitChecks.filter((project): project is NonNullable<typeof project> => project !== null)
    } catch { /* discovery root is optional */ }
    response.json([...registered, ...discovered].sort((a, b) => Number(b.registered) - Number(a.registered) || a.name.localeCompare(b.name)))
  } catch (error) {
    response.status(500).json({ error: errorMessage(error) })
  }
})

app.post('/api/boards', async (request, response) => {
  try {
    const body = z.object({
      slug: boardSchema,
      name: z.string().trim().min(1).max(100).optional(),
      description: z.string().trim().max(500).optional(),
      color: z.string().trim().regex(/^#[0-9a-fA-F]{6}$/).optional(),
      project: boardSchema.optional(),
      defaultWorkdir: z.string().trim().max(2000).optional(),
      registerProject: z.boolean().optional(),
    }).parse(request.body)
    const args = ['boards', 'create', body.slug]
    if (body.name) args.push('--name', body.name)
    if (body.description) args.push('--description', body.description)
    if (body.color) args.push('--color', body.color)
    if (body.defaultWorkdir) args.push('--default-workdir', body.defaultWorkdir)
    await hermes(args)
    if (body.project && body.registerProject && body.defaultWorkdir) {
      await hermesText(['project', 'create', body.name || body.project, body.defaultWorkdir, '--slug', body.project, '--primary', body.defaultWorkdir])
    }
    if (body.project) await hermesText(['project', 'bind-board', body.project, body.slug])
    response.status(201).json({ ok: true })
  } catch (error) {
    response.status(400).json({ error: errorMessage(error) })
  }
})

app.get('/api/assignees', async (request, response) => {
  try {
    response.json(await hermes(['assignees', '--json'], parseBoard(request.query.board)))
  } catch (error) {
    response.status(500).json({ error: errorMessage(error) })
  }
})

app.get('/api/tasks', async (request, response) => {
  try {
    const board = parseBoard(request.query.board)
    const status = request.query.status ? statusSchema.parse(request.query.status) : undefined
    const args = ['ls', '--json', '--sort', 'priority-desc']
    if (status) args.push('--status', status)
    if (request.query.archived === 'true') args.push('--archived')
    response.json(await hermes(args, board))
  } catch (error) {
    response.status(400).json({ error: errorMessage(error) })
  }
})

app.get('/api/tasks/:id', async (request, response) => {
  try {
    const id = taskIdSchema.parse(request.params.id)
    response.json(await hermes(['show', id, '--json'], parseBoard(request.query.board)))
  } catch (error) {
    response.status(400).json({ error: errorMessage(error) })
  }
})

app.post('/api/tasks', async (request, response) => {
  try {
    const body = z.object({
      board: boardSchema.optional(),
      title: z.string().trim().min(1).max(200),
      body: z.string().trim().max(10_000).optional(),
      assignee: z.string().trim().max(100).optional(),
      priority: z.number().int().min(-100).max(100).default(0),
      triage: z.boolean().default(false),
      workspace: z.string().trim().max(1000).optional(),
      goal: z.boolean().default(false),
    }).parse(request.body)
    const args = ['create', body.title, '--priority', String(body.priority), '--json']
    if (body.body) args.push('--body', body.body)
    if (body.assignee) args.push('--assignee', body.assignee)
    if (body.triage) args.push('--triage')
    if (body.workspace) args.push('--workspace', body.workspace)
    if (body.goal) args.push('--goal')
    response.status(201).json(await hermes(args, body.board))
  } catch (error) {
    response.status(400).json({ error: errorMessage(error) })
  }
})

app.post('/api/tasks/:id/action', async (request, response) => {
  try {
    const id = taskIdSchema.parse(request.params.id)
    const body = z.object({
      board: boardSchema.optional(),
      action: z.enum(['promote', 'block', 'unblock', 'review', 'complete', 'archive', 'comment', 'assign', 'schedule', 'specify', 'decompose']),
      reason: z.string().trim().max(5000).optional(),
      assignee: z.string().trim().max(100).optional(),
    }).parse(request.body)
    let args: string[]
    switch (body.action) {
      case 'promote':
        args = ['promote', id, body.reason || 'Promoted from web dashboard', '--json']
        break
      case 'block':
        args = ['block', id, body.reason || 'Blocked from web dashboard']
        break
      case 'unblock':
        args = ['unblock', id]
        if (body.reason) args.push('--reason', body.reason)
        break
      case 'review':
        args = ['request-review', id, '--summary', body.reason || 'Ready for review from web dashboard']
        break
      case 'complete':
        args = ['complete', id, '--result', body.reason || 'Completed from web dashboard']
        break
      case 'archive':
        args = ['archive', id]
        break
      case 'comment':
        args = ['comment', id, body.reason || 'Updated from web dashboard']
        break
      case 'assign':
        args = ['assign', id, body.assignee || 'none']
        break
      case 'schedule':
        args = ['schedule', id, body.reason || 'Scheduled from web dashboard']
        break
      case 'specify':
        args = ['specify', id, '--author', 'web-dashboard', '--json']
        break
      case 'decompose':
        args = ['decompose', id, '--author', 'web-dashboard', '--json']
        break
    }
    response.json(await hermes(args, body.board))
  } catch (error) {
    response.status(400).json({ error: errorMessage(error) })
  }
})

if (process.env.NODE_ENV === 'production') {
  const dist = new URL('../dist', import.meta.url).pathname
  app.use(express.static(dist))
  app.use((_request, response) => response.sendFile('index.html', { root: dist }))
}

app.listen(port, '127.0.0.1', () => {
  console.log(`Hermes Agent Workspace listening on http://127.0.0.1:${port}`)
})

export { app }
