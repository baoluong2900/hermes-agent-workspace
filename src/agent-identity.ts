export type AgentFamily = 'orchestration' | 'engineering' | 'creation' | 'knowledge' | 'assurance' | 'neutral'
export type AgentIcon = 'command' | 'route' | 'braces' | 'panels' | 'search' | 'shield' | 'flask' | 'server' | 'bot'
export type AgentIdentity = { family: AgentFamily; icon: AgentIcon; role: string }

const identities: Record<string, AgentIdentity> = {
  default: { family: 'orchestration', icon: 'command', role: 'General coordinator' },
  planner: { family: 'orchestration', icon: 'route', role: 'Plans and decomposes work' },
  backend: { family: 'engineering', icon: 'braces', role: 'APIs, services and data' },
  devops: { family: 'engineering', icon: 'server', role: 'Deployment and operations' },
  frontend: { family: 'creation', icon: 'panels', role: 'Product UI and interactions' },
  researcher: { family: 'knowledge', icon: 'search', role: 'Technical investigation' },
  reviewer: { family: 'assurance', icon: 'shield', role: 'Quality and security review' },
  tester: { family: 'assurance', icon: 'flask', role: 'Tests and verification' },
}

export function agentIdentity(name: string): AgentIdentity {
  return identities[name] || { family: 'neutral', icon: 'bot', role: 'Custom agent' }
}
