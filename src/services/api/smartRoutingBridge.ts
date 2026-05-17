/**
 * smartRoutingBridge — thin bridge between query.ts and the smart routing stack.
 *
 * query.ts calls `trySmartRoute()` before each `deps.callModel()`. If smart
 * routing is configured AND no agent-level providerOverride already exists,
 * the bridge classifies the turn, resolves the provider, and returns a
 * ProviderOverride for the API client. Otherwise returns null (use defaults).
 *
 * Why a bridge instead of inlining in query.ts?
 *   1. query.ts is ~1600 LOC of hot-path orchestration — minimal additions only
 *   2. The bridge is independently testable with fast unit tests
 *   3. Clean seam if smart routing needs to be feature-flagged or removed
 */

import { routeModel, type SmartRoutingConfig, type RoutingDecision, type RoutingInput } from './smartModelRouting.ts'
import { resolveTarget, markRequestOutcome, type ResolverContext, type ProviderOverride } from './providerResolver.ts'
import { KeyPool } from './keyPool.ts'
import type { AgentModelsMap } from './providerResolver.ts'
import { RotateChain, type ProviderEntryConfig } from '../rotate/RotateChain.ts'

/** Shared pool cache — survives across turns within a session. */
const globalPoolCache = new Map<string, KeyPool>()

/**
 * Return a ProviderOverride from the active provider in a RotateChain.
 * RotateChain providers are resolved directly (no pool / resolver).
 */
function rotateProviderToOverride(chain: RotateChain): ProviderOverride | null {
  const provider = chain.getActiveProvider()
  if (!provider) return null
  return {
    baseURL: provider.baseURL,
    apiKey: provider.apiKey,
    model: provider.model,
  }
}

export type SmartRouteResult = {
  /** The resolved provider override to pass to the API client. Null = use default. */
  override: ProviderOverride | null
  /** The routing decision for instrumentation / logging. */
  decision: RoutingDecision
  /** The full target string (e.g. "zen-pool:claude-sonnet-4") — needed for markRequestOutcome. */
  target: string
  /** RotateChain instance (present only when rotate mode is active). */
  rotateChain?: RotateChain | null
}

/**
 * Attempt smart routing for a turn. Returns null when:
 *   - Smart routing is not configured / disabled
 *   - An agent-level providerOverride is already active (explicit > automatic)
 *   - The routing decision resolves to an empty model (no target for category)
 *
 * @param userText - The user's message text for classification
 * @param turnNumber - 1-indexed turn within the session
 * @param hasImages - Whether the user attached images
 * @param existingOverride - Provider override from agent routing (if any)
 * @param smartRoutingConfig - Smart routing config from settings
 * @param agentModels - Provider definitions from settings
 * @param fallbackProvider - Fallback provider alias (optional)
 * @param rotateChain - RotateChain instance (optional). When set, non-"code" categories
 *   use the chain's active provider instead of routing through the resolver.
 */
export function trySmartRoute(opts: {
  userText: string
  turnNumber: number
  hasImages?: boolean
  existingOverride?: ProviderOverride | null
  smartRoutingConfig?: SmartRoutingConfig | null
  agentModels?: AgentModelsMap | null
  fallbackProvider?: string
  rotateChain?: RotateChain | null
}): SmartRouteResult | null {
  // Agent-level override takes precedence — don't interfere.
  if (opts.existingOverride) return null

  // Need both smartRouting config AND agentModels to resolve targets.
  const config = opts.smartRoutingConfig
  if (!config || !config.enabled) return null

  const models = opts.agentModels
  if (!models || Object.keys(models).length === 0) return null

  // Classify the turn.
  const input: RoutingInput = {
    userText: opts.userText,
    turnNumber: opts.turnNumber,
    hasImages: opts.hasImages,
  }
  const decision = routeModel(input, config)

  // Empty model means "no target for this category" — fall through to default.
  if (!decision.model) return null

  // ── RotateChain mode ──
  // If a RotateChain is configured and the category is NOT "vision" or "code",
  // use the chain's active provider directly instead of routing through targets.
  const chain = opts.rotateChain
  if (chain && decision.category !== 'code' && decision.category !== 'vision') {
    const override = rotateProviderToOverride(chain)
    if (!override) return null
    return {
      override,
      decision,
      target: `rotate:${chain.getProviderIds().join(',')}`,
      rotateChain: chain,
    }
  }

  // ── Standard / Hard-route mode ──
  // For "code" and "vision" categories (or when no chain), resolve via targets.
  // The decision.model is a target string like "zen-pool:claude-sonnet-4" or
  // a bare model name like "claude-haiku-4-5". Resolve it via providerResolver.
  const ctx: ResolverContext = {
    agentModels: models,
    poolCache: globalPoolCache,
    fallbackProvider: opts.fallbackProvider,
  }

  try {
    const override = resolveTarget(decision.model, ctx)
    return {
      override,
      decision,
      target: decision.model,
    }
  } catch {
    // Resolution failed (provider not found, exhausted pool, etc.)
    // Fail open — let the default provider handle it.
    return null
  }
}

/**
 * Report the outcome of a smart-routed request back to the pool.
 * No-op when target is empty or pool doesn't exist.
 */
export function reportOutcome(
  target: string,
  outcome:
    | { kind: 'success'; apiKey: string; tokens?: number }
    | { kind: 'rate_limit'; apiKey: string; cooldownMs?: number },
  agentModels?: AgentModelsMap | null,
): void {
  if (!target || !agentModels) return
  const ctx: ResolverContext = {
    agentModels,
    poolCache: globalPoolCache,
  }
  markRequestOutcome(target, outcome, ctx)
}

/** Get the shared pool cache (for diagnostics / /cost command). */
export function getPoolCache(): ReadonlyMap<string, KeyPool> {
  return globalPoolCache
}

/** Reset shared state (for tests). */
export function _resetPoolCacheForTest(): void {
  globalPoolCache.clear()
}
