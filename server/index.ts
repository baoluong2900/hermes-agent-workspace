import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import express from 'express'
import { z } from 'zod'

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

app.get('/api/boards', async (_request, response) => {
  try {
    response.json(await hermes(['boards', 'list', '--json']))
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
    }).parse(request.body)
    const args = ['boards', 'create', body.slug]
    if (body.name) args.push('--name', body.name)
    if (body.description) args.push('--description', body.description)
    if (body.color) args.push('--color', body.color)
    await hermes(args)
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
      action: z.enum(['promote', 'block', 'unblock', 'review', 'complete', 'archive', 'comment', 'assign', 'schedule']),
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
  console.log(`Hermes Kanban Web API listening on http://127.0.0.1:${port}`)
})

export { app }
