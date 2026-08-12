export type CatalogProvider = { slug: string; label: string; models: string[]; featuredModels: string[]; source?: string | null; warning?: string | null }

const DEFAULT_VISIBLE_PER_PROVIDER = 50

export function filterVisibleProviders(providers: CatalogProvider[], stored: Set<string> | null): CatalogProvider[] {
  return providers.flatMap((provider) => {
    const prefix = `${provider.slug}::`
    const providerKeys = stored ? [...stored].filter((key) => key.startsWith(prefix)) : []
    const hasSentinel = providerKeys.includes(prefix)
    const explicit = providerKeys.filter((key) => key !== prefix).map((key) => key.slice(prefix.length))
    let models: string[]
    if (hasSentinel && explicit.length === 0) models = []
    else if (explicit.length > 0) models = provider.models.filter((model) => explicit.includes(model))
    else if (provider.featuredModels.length > 0) models = provider.models.filter((model) => provider.featuredModels.includes(model))
    else models = provider.models.slice(0, DEFAULT_VISIBLE_PER_PROVIDER)
    return models.length ? [{ ...provider, models }] : []
  })
}

export function parseDesktopVisibleModels(raw: string | null): Set<string> | null {
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? new Set(parsed.filter((value): value is string => typeof value === 'string')) : null
  } catch { return null }
}
