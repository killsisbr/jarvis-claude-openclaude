/**
 * providerResolver — translate a routing decision into a concrete API target.
 *
 * The smart router (smartModelRouting.ts) decides WHICH category a turn falls
 * into and returns a target string like "zen-pool:claude-sonnet-4".
 *
 * This module is the second half: given the target string and the user's
 * settings.agentModels map, it:
 *
 *   1. Splits "provider:model" → provider alias + model name
 *   2. Looks up the provider in settings.agentModels
 *   3. Builds (or reuses) the KeyPool for that provider
 *   4. Picks the next rotated key
 *   5. Returns a fully-resolved ProviderOverride { model, baseURL, apiKey }
 *
 * The result is the SAME shape OpenClaude's OpenAIShim already accepts via its
 * providerOverride constructor argument — so wiring is one line in query.ts.
 */

import { KeyPool, expandKeysFromEnv } from './keyPool.ts'

/**
 * The shape OpenAIShim already accepts.
 * (Defined here to avoid a circular import.)
 */
export type ProviderOverride = {
  model: string
  baseURL: string
  apiKey: string
}

/** A single entry from settings.agentModels (back-compat + pool extensions). */
export type AgentModelEntry = {
  base_url: string
  api_key?: string
  api_keys?: string[]
  api_keys_env?: string
  rotation?: 'round-robin' | 'least-recent'
  cooldown_ms?: number
  /** Default model identifier when the target string omits the model part. */
  model?: string
}

/** Map of provider alias → connection config. */
export type AgentModelsMap = Record<string, AgentModelEntry>

export type ResolverContext = {
  agentModels: AgentModelsMap
  /**
   * Optional in-process cache of KeyPool instances keyed by provider alias.
   * Reusing a pool is REQUIRED — round-robin and cooldown only work when
   * the same KeyPool is consulted across requests. Callers should pass a
   * shared Map at app boot.
   */
  poolCache?: Map<string, KeyPool>
  /** Fallback provider if the target's provider alias is missing. */
  fallbackProvider?: string
}

export class ProviderResolveError extends Error {
  constructor(
    message: string,
    public readonly target: string,
  ) {
    super(message)
    this.name = 'ProviderResolveError'
  }
}

/**
 * Parse a target string into (providerAlias, model?).
 *
 * Examples:
 *   "zen-pool:claude-sonnet-4"            → { provider: "zen-pool", model: "claude-sonnet-4" }
 *   "nvidia-nim:meta/llama-3.1-70b"       → { provider: "nvidia-nim", model: "meta/llama-3.1-70b" }
 *   "ollama-local"                        → { provider: "ollama-local", model: undefined }
 *   ""                                    → null
 *
 * Splits on the FIRST colon only — model identifiers like "meta/llama:8b"
 * keep their colons.
 */
export function parseTarget(target: string): { provider: string; model?: string } | null {
  if (!target) return null
  const idx = target.indexOf(':')
  if (idx === -1) return { provider: target }
  const provider = target.slice(0, idx)
  const model = target.slice(idx + 1)
  if (!provider) return null
  return { provider, model: model || undefined }
}

/**
 * Collect every API key for a provider entry, preserving precedence:
 *   1. api_keys (explicit array)
 *   2. api_keys_env (env glob)
 *   3. api_key (single)
 *
 * The first non-empty list wins — we DO NOT mix sources, since callers
 * usually mean "I configured this one way; don't surprise me".
 */
export function collectKeys(entry: AgentModelEntry): string[] {
  if (entry.api_keys && entry.api_keys.length > 0) {
    return entry.api_keys.filter((k) => typeof k === 'string' && k.length > 0)
  }
  if (entry.api_keys_env) {
    return expandKeysFromEnv(entry.api_keys_env)
  }
  if (entry.api_key) {
    return [entry.api_key]
  }
  return []
}

/**
 * Build or fetch a cached KeyPool for a provider.
 * Returns null when the provider has no keys at all — caller decides
 * whether that's acceptable (local Ollama doesn't need a key).
 */
function getOrBuildPool(
  providerAlias: string,
  entry: AgentModelEntry,
  cache: Map<string, KeyPool> | undefined,
): KeyPool | null {
  if (cache?.has(providerAlias)) return cache.get(providerAlias)!
  const keys = collectKeys(entry)
  if (keys.length === 0) return null
  const pool = new KeyPool({
    name: providerAlias,
    keys,
    rotation: entry.rotation,
    cooldownMs: entry.cooldown_ms,
  })
  cache?.set(providerAlias, pool)
  return pool
}

/**
 * Main resolver. Given a target like "zen-pool:claude-sonnet-4", produce the
 * { model, baseURL, apiKey } triple ready to pass to OpenAIShim.
 *
 * Throws ProviderResolveError when:
 *   - target is empty/malformed
 *   - provider not in agentModels (and no fallbackProvider)
 *   - provider needs a key but pool is exhausted (caller may catch and retry)
 */
export function resolveTarget(
  target: string,
  ctx: ResolverContext,
): ProviderOverride {
  const parsed = parseTarget(target)
  if (!parsed) {
    throw new ProviderResolveError(`Invalid target "${target}" — expected "provider" or "provider:model"`, target)
  }

  let entry = ctx.agentModels[parsed.provider]
  let providerName = parsed.provider

  if (!entry && ctx.fallbackProvider) {
    entry = ctx.agentModels[ctx.fallbackProvider]
    providerName = ctx.fallbackProvider
  }
  if (!entry) {
    throw new ProviderResolveError(
      `Provider "${parsed.provider}" not found in agentModels` +
        (ctx.fallbackProvider ? ` (also tried fallback "${ctx.fallbackProvider}")` : ''),
      target,
    )
  }

  const model = parsed.model ?? entry.model
  if (!model) {
    throw new ProviderResolveError(
      `Target "${target}" did not include a model name and agentModels["${providerName}"].model is unset`,
      target,
    )
  }

  // Local-only providers (Ollama) often don't need a key — accept that.
  const pool = getOrBuildPool(providerName, entry, ctx.poolCache)
  const apiKey = pool ? pool.pick() : ''

  return {
    model,
    baseURL: entry.base_url,
    apiKey,
  }
}

/**
 * Notify the resolver about the outcome of a request. Forwards to the pool so
 * rotation/cooldown stay accurate. No-op when no pool exists for the provider
 * (single-key or local).
 */
export function markRequestOutcome(
  target: string,
  outcome:
    | { kind: 'success'; apiKey: string; tokens?: number }
    | { kind: 'rate_limit'; apiKey: string; cooldownMs?: number },
  ctx: ResolverContext,
): void {
  const parsed = parseTarget(target)
  if (!parsed) return
  const providerName = parsed.provider
  const pool = ctx.poolCache?.get(providerName)
  if (!pool) return
  if (outcome.kind === 'success') {
    pool.markSuccess(outcome.apiKey, { tokens: outcome.tokens })
  } else {
    pool.markCooldown(outcome.apiKey, outcome.cooldownMs)
  }
}
