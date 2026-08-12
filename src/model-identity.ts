export type ModelFamily = 'claude' | 'openai' | 'gemini' | 'qwen' | 'deepseek' | 'grok' | 'kimi' | 'minimax' | 'glm' | 'mistral' | 'sakana' | 'generic'
export type ModelIdentity = { family: ModelFamily; mark: string; label: string }

const identities: Array<[RegExp, ModelIdentity]> = [
  [/claude|anthropic/i, { family: 'claude', mark: 'A', label: 'Anthropic Claude' }],
  [/(^|\/)gpt-|openai/i, { family: 'openai', mark: '◎', label: 'OpenAI GPT' }],
  [/gemini|google/i, { family: 'gemini', mark: '✦', label: 'Google Gemini' }],
  [/qwen/i, { family: 'qwen', mark: 'Q', label: 'Qwen' }],
  [/deepseek/i, { family: 'deepseek', mark: 'D', label: 'DeepSeek' }],
  [/grok|x-ai/i, { family: 'grok', mark: 'X', label: 'xAI Grok' }],
  [/kimi|moonshot/i, { family: 'kimi', mark: 'K', label: 'Kimi' }],
  [/minimax/i, { family: 'minimax', mark: 'M', label: 'MiniMax' }],
  [/glm|z-ai/i, { family: 'glm', mark: 'Z', label: 'GLM' }],
  [/mistral|ministral|codestral/i, { family: 'mistral', mark: 'M', label: 'Mistral' }],
  [/sakana|fugu/i, { family: 'sakana', mark: '魚', label: 'Sakana AI' }],
]

export function modelIdentity(model: string): ModelIdentity {
  return identities.find(([pattern]) => pattern.test(model))?.[1] || { family: 'generic', mark: 'AI', label: 'AI model' }
}
