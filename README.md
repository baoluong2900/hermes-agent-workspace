# Hermes Agent Workspace

A local operations workspace for [Hermes Agent](https://github.com/NousResearch/hermes-agent).

It is a separate project and does not modify Agentic Workspace or Hermes Agent source code. The server invokes the installed `hermes kanban` CLI with argument arrays (no shell interpolation), while the React frontend provides a readable board UI.

## Workspace modules

- Operational overview with real Hermes runtime data
- Conversation sessions and state database statistics
- Agent profiles, models, and gateway state
- Automations and cron visibility
- Installed skills library
- Runtime diagnostics
- Switch between isolated Hermes Kanban boards
- View `triage`, `todo`, `ready`, `running`, `review`, `blocked`, `scheduled`, and `done` columns
- Search tasks and inspect task activity
- Create boards and tasks
- Assign profiles
- Promote, block, unblock, request review, complete, comment on, and archive tasks
- Auto-refresh every 8 seconds
- Responsive desktop and mobile layouts

## Requirements

- Node.js 22+
- Hermes Agent installed and available as `hermes`
- A Kanban database initialized with `hermes kanban init`
- For automatic task dispatch, run the Hermes gateway separately

## Development

```bash
npm install
npm run dev
```

Open <http://127.0.0.1:5173>.

## Production build

```bash
npm run build
npm start
```

Open <http://127.0.0.1:4178>.

## Verification

```bash
npm run check
```

## Security model

The server binds to `127.0.0.1` only. It validates board slugs, task IDs, statuses, and request payloads with Zod. Hermes is launched through `execFile`, never through a shell command string.

## License

MIT
