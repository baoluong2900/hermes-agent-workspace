export type HermesProject = { slug: string; name: string; primaryPath: string | null; active: boolean }

export function parseProjects(listOutput: string, showOutputs: Map<string, string>): HermesProject[] {
  return listOutput.split('\n').map((line) => {
    const active = line.trimStart().startsWith('*')
    const clean = line.replace(/^\s*\*?\s*/, '').trim()
    const match = clean.match(/^([a-z0-9][a-z0-9-]*)\s{2,}(.+?)\s{2,}\[\d+ folder\(s\)\]$/)
    if (!match) return null
    const slug = match[1]
    const show = showOutputs.get(slug) || ''
    const name = show.match(/^\s*name:\s*(.+)$/m)?.[1]?.trim() || match[2].trim()
    const primaryPath = show.match(/^\s*primary:\s*(.+)$/m)?.[1]?.trim() || null
    return { slug, name, primaryPath, active }
  }).filter((project): project is HermesProject => project !== null)
}
