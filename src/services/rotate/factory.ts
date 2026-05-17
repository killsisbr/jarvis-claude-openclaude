/**
 * factory — constructs a RotateChain from environment variables.
 *
 * Env contract:
 *   ROTATE_CHAIN        = "nvidia,zen,groq" (ordered, comma-separated)
 *   NVIDIA_API_KEY      = ...
 *   NVIDIA_BASE_URL     = https://... (optional, defaults per provider)
 *   NVIDIA_MODEL        = ... (optional, defaults per provider)
 *   ZEN_API_KEY_1       = ... (uses ZEN_API_KEY_1, ZEN_API_KEY_2, etc.)
 *   ZEN_BASE_URL        = ...
 *   ZEN_MODEL           = ...
 *   GROQ_API_KEY        = ...
 *   GROQ_BASE_URL       = ...
 *   GROQ_MODEL          = ...
 *   DEEPSEEK_API_KEY    = ... (used for hard route, not in chain)
 *   DEEPSEEK_BASE_URL   = ...
 *   DEEPSEEK_MODEL      = ...
 *   ROTATE_CIRCUIT_BREAKER_THRESHOLD = 3
 *   ROTATE_CIRCUIT_BREAKER_COOLDOWN  = 300
 */

import { RotateChain, type ProviderEntryConfig, type RotateEventCallback } from './RotateChain.ts'

// ── Defaults per provider ──

const DEFAULT_BASE_URLS: Record<string, string> = {
  nvidia: 'https://api.nvidia.com/v1',
  zen: 'https://opencode.ai/zen/v1',
  groq: 'https://api.groq.com/openai/v1',
  deepseek: 'https://api.deepseek.com',
}

const DEFAULT_MODELS: Record<string, string> = {
  nvidia: 'nvidia/llama-3.1-nemotron-70b-instruct',
  zen: 'GLM-5.1',
  groq: 'llama-3.3-70b-versatile',
  deepseek: 'deepseek-chat',
}

// ── Provider key naming patterns ──

/**
 * Read an env value trying up to N numbered variants, falling back to plain.
 * Example: for "ZEN_API_KEY" with count=5:
 *   tries ZEN_API_KEY_5, ZEN_API_KEY_4, ..., ZEN_API_KEY_1, then ZEN_API_KEY
 */
function readKey(env: Record<string, string | undefined>, base: string, count: number = 1): string {
  for (let i = count; i >= 1; i--) {
    const val = env[`${base}_${i}`]
    if (val && val.trim()) return val.trim()
  }
  return env[base]?.trim() ?? ''
}

function readRequiredKey(env: Record<string, string | undefined>, base: string, count: number = 1): string {
  const val = readKey(env, base, count)
  if (!val) {
    console.error(`[rotate] Missing API key: ${base}. Provider will be unavailable.`)
  }
  return val
}

// ── Factory ──

export type RotateConfig = {
  chain: string[]
  threshold: number
  cooldownMs: number
  env: Record<string, string | undefined>
}

/**
 * Parse ROTATE_CHAIN and related env vars into a RotateConfig.
 */
export function parseRotateConfig(
  env: Record<string, string | undefined> = process.env as Record<string, string | undefined>,
): RotateConfig | null {
  let chainStr = env.ROTATE_CHAIN?.trim()

  // Auto-detect chain from available API keys if ROTATE_CHAIN not set
  if (!chainStr) {
    const detected: string[] = []
    if (env.NVIDIA_API_KEY?.trim()) detected.push('nvidia')
    if (env.ZEN_API_KEY_1?.trim()) detected.push('zen')
    if (env.GROQ_API_KEY?.trim()) detected.push('groq')
    if (detected.length > 0) {
      chainStr = detected.join(',')
    }
  }

  if (!chainStr) return null

  const chain = chainStr
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean)

  if (chain.length === 0) return null

  const threshold = Number(env.ROTATE_CIRCUIT_BREAKER_THRESHOLD) || 3
  const cooldownSec = Number(env.ROTATE_CIRCUIT_BREAKER_COOLDOWN) || 300

  return { chain, threshold, cooldownMs: cooldownSec * 1000, env }
}

/**
 * Build provider configs from a parsed RotateConfig.
 * Returns empty array on missing keys or invalid config.
 */
export function buildProvidersFromConfig(config: RotateConfig): ProviderEntryConfig[] {
  const providers: ProviderEntryConfig[] = []

  for (const id of config.chain) {
    const prefix = id.toUpperCase()
    const env = config.env

    const baseURL = env[`${prefix}_BASE_URL`] || DEFAULT_BASE_URLS[id]
    const model = env[`${prefix}_MODEL`] || DEFAULT_MODELS[id]

    // For Zen, try up to 5 numbered keys (ZEN_API_KEY_1..5)
    const keyCount = id === 'zen' ? 5 : 1
    const apiKey = readRequiredKey(env, `${prefix}_API_KEY`, keyCount)

    if (!apiKey && id !== 'zen') {
      // Only skip truly required keys; Zen can have 0 keys configured
      console.error(`[rotate] Skipping provider "${id}": no API key configured`)
      continue
    }

    providers.push({
      id,
      label: id.charAt(0).toUpperCase() + id.slice(1),
      baseURL,
      model,
      apiKey, // may be empty; runtime will fail gracefully
      threshold: config.threshold,
      cooldownMs: config.cooldownMs,
    })
  }

  return providers
}

/**
 * Create a RotateChain from environment variables.
 * Returns null if ROTATE_CHAIN is not set.
 */
export function createRotateChainFromEnv(
  onEvent?: RotateEventCallback,
  env?: Record<string, string | undefined>,
): RotateChain | null {
  const config = parseRotateConfig(env)
  if (!config) return null

  const providers = buildProvidersFromConfig(config)
  if (providers.length === 0) return null

  return new RotateChain(providers, onEvent)
}

export type { RotateChain }
