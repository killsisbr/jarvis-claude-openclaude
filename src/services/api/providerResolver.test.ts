import { describe, test, expect, beforeEach, afterEach } from 'bun:test'
import { KeyPool } from './keyPool.ts'
import {
  parseTarget,
  collectKeys,
  resolveTarget,
  markRequestOutcome,
  ProviderResolveError,
  type AgentModelsMap,
  type ResolverContext,
} from './providerResolver.ts'

describe('parseTarget', () => {
  test('splits provider:model', () => {
    expect(parseTarget('zen:claude-sonnet-4')).toEqual({
      provider: 'zen',
      model: 'claude-sonnet-4',
    })
  })

  test('preserves colons inside model identifier', () => {
    expect(parseTarget('ollama:qwen2.5:7b')).toEqual({
      provider: 'ollama',
      model: 'qwen2.5:7b',
    })
  })

  test('provider-only target has undefined model', () => {
    expect(parseTarget('ollama-local')).toEqual({
      provider: 'ollama-local',
      model: undefined,
    })
  })

  test('empty string returns null', () => {
    expect(parseTarget('')).toBeNull()
  })

  test('leading colon returns null (empty provider)', () => {
    expect(parseTarget(':model')).toBeNull()
  })

  test('trailing colon = provider-only', () => {
    expect(parseTarget('zen:')).toEqual({
      provider: 'zen',
      model: undefined,
    })
  })
})

describe('collectKeys precedence', () => {
  const originalEnv = process.env
  beforeEach(() => {
    process.env = { ...originalEnv }
  })
  afterEach(() => {
    process.env = originalEnv
  })

  test('api_keys array wins over env and single', () => {
    process.env.X_API_KEY_1 = 'env1'
    expect(
      collectKeys({
        base_url: 'http://x',
        api_keys: ['explicit1', 'explicit2'],
        api_keys_env: 'X_API_KEY_*',
        api_key: 'single',
      }),
    ).toEqual(['explicit1', 'explicit2'])
  })

  test('api_keys_env wins over single when api_keys absent', () => {
    process.env.X_API_KEY_1 = 'env1'
    process.env.X_API_KEY_2 = 'env2'
    const keys = collectKeys({
      base_url: 'http://x',
      api_keys_env: 'X_API_KEY_*',
      api_key: 'single',
    })
    expect(keys.sort()).toEqual(['env1', 'env2'])
  })

  test('single api_key as last resort', () => {
    expect(
      collectKeys({ base_url: 'http://x', api_key: 'only-one' }),
    ).toEqual(['only-one'])
  })

  test('returns empty array when no keys configured (local provider)', () => {
    expect(collectKeys({ base_url: 'http://localhost' })).toEqual([])
  })

  test('drops empty strings inside api_keys', () => {
    expect(
      collectKeys({ base_url: 'http://x', api_keys: ['a', '', 'b'] }),
    ).toEqual(['a', 'b'])
  })
})

describe('resolveTarget', () => {
  const baseAgentModels: AgentModelsMap = {
    'zen-pool': {
      base_url: 'https://opencode.ai/zen/v1',
      api_keys: ['sk-z1', 'sk-z2', 'sk-z3'],
      rotation: 'round-robin',
    },
    'nvidia-nim': {
      base_url: 'https://integrate.api.nvidia.com/v1',
      api_key: 'nvapi-x',
    },
    'ollama-local': {
      base_url: 'http://localhost:11434/v1',
      model: 'qwen2.5:7b',
    },
  }

  test('returns ProviderOverride for valid target', () => {
    const ctx: ResolverContext = {
      agentModels: baseAgentModels,
      poolCache: new Map<string, KeyPool>(),
    }
    const result = resolveTarget('zen-pool:claude-sonnet-4', ctx)
    expect(result.model).toBe('claude-sonnet-4')
    expect(result.baseURL).toBe('https://opencode.ai/zen/v1')
    expect(['sk-z1', 'sk-z2', 'sk-z3']).toContain(result.apiKey)
  })

  test('rotates keys across consecutive calls (same poolCache)', () => {
    const ctx: ResolverContext = {
      agentModels: baseAgentModels,
      poolCache: new Map<string, KeyPool>(),
    }
    const k1 = resolveTarget('zen-pool:m', ctx).apiKey
    const k2 = resolveTarget('zen-pool:m', ctx).apiKey
    const k3 = resolveTarget('zen-pool:m', ctx).apiKey
    expect(new Set([k1, k2, k3]).size).toBe(3) // all three distinct
  })

  test('provider-only target uses entry.model as default', () => {
    const ctx: ResolverContext = {
      agentModels: baseAgentModels,
      poolCache: new Map<string, KeyPool>(),
    }
    const result = resolveTarget('ollama-local', ctx)
    expect(result.model).toBe('qwen2.5:7b')
    expect(result.apiKey).toBe('') // local — no key needed
  })

  test('throws when provider missing and no fallback', () => {
    const ctx: ResolverContext = { agentModels: baseAgentModels }
    expect(() => resolveTarget('missing-provider:m', ctx)).toThrow(
      ProviderResolveError,
    )
  })

  test('uses fallbackProvider when primary missing', () => {
    const ctx: ResolverContext = {
      agentModels: baseAgentModels,
      poolCache: new Map<string, KeyPool>(),
      fallbackProvider: 'nvidia-nim',
    }
    const result = resolveTarget('missing-provider:claude-sonnet-4', ctx)
    expect(result.baseURL).toBe('https://integrate.api.nvidia.com/v1')
    expect(result.apiKey).toBe('nvapi-x')
    expect(result.model).toBe('claude-sonnet-4')
  })

  test('throws when no model in target and no default model on entry', () => {
    const ctx: ResolverContext = {
      agentModels: { p: { base_url: 'http://x', api_key: 'k' } },
    }
    expect(() => resolveTarget('p', ctx)).toThrow(/did not include a model/)
  })

  test('throws on empty target', () => {
    const ctx: ResolverContext = { agentModels: baseAgentModels }
    expect(() => resolveTarget('', ctx)).toThrow(ProviderResolveError)
  })
})

describe('markRequestOutcome', () => {
  test('429 puts key in cooldown so next pick rotates', () => {
    const agentModels: AgentModelsMap = {
      pool: {
        base_url: 'http://x',
        api_keys: ['k1', 'k2'],
        cooldown_ms: 60_000,
      },
    }
    const ctx: ResolverContext = {
      agentModels,
      poolCache: new Map<string, KeyPool>(),
    }
    const first = resolveTarget('pool:m', ctx).apiKey
    markRequestOutcome('pool:m', { kind: 'rate_limit', apiKey: first }, ctx)
    const second = resolveTarget('pool:m', ctx).apiKey
    expect(second).not.toBe(first)
  })

  test('success accumulates tokens visible in pool stats', () => {
    const agentModels: AgentModelsMap = {
      pool: { base_url: 'http://x', api_keys: ['k1'] },
    }
    const cache = new Map<string, KeyPool>()
    const ctx: ResolverContext = { agentModels, poolCache: cache }
    const k = resolveTarget('pool:m', ctx).apiKey
    markRequestOutcome('pool:m', { kind: 'success', apiKey: k, tokens: 500 }, ctx)
    markRequestOutcome('pool:m', { kind: 'success', apiKey: k, tokens: 300 }, ctx)
    const stats = cache.get('pool')!.getStats()
    expect(stats.perKey[0]!.totalTokens).toBe(800)
    expect(stats.perKey[0]!.successes).toBe(2)
  })

  test('no-op when no pool cached (single-key, local)', () => {
    const ctx: ResolverContext = {
      agentModels: { p: { base_url: 'http://x' } }, // local, no key
    }
    expect(() =>
      markRequestOutcome('p:m', { kind: 'success', apiKey: 'x' }, ctx),
    ).not.toThrow()
  })
})
