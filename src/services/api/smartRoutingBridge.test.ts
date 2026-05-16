import { describe, test, expect, beforeEach } from 'bun:test'
import { trySmartRoute, reportOutcome, _resetPoolCacheForTest } from './smartRoutingBridge.ts'
import type { SmartRoutingConfig } from './smartModelRouting.ts'
import type { AgentModelsMap } from './providerResolver.ts'

const MODELS: AgentModelsMap = {
  'zen-pool': {
    base_url: 'https://opencode.ai/zen/v1',
    api_keys: ['sk-z1', 'sk-z2'],
    rotation: 'round-robin',
    cooldown_ms: 60_000,
  },
  'ollama-local': {
    base_url: 'http://localhost:11434/v1',
    model: 'qwen2.5:7b',
  },
  'nvidia-nim': {
    base_url: 'https://integrate.api.nvidia.com/v1',
    api_key: 'nvapi-x',
  },
}

const FIVE_CAT: SmartRoutingConfig = {
  enabled: true,
  targets: {
    simple: 'ollama-local',
    strong: 'zen-pool:claude-sonnet-4',
    code: 'nvidia-nim:deepseek-coder-v2',
    reasoning: 'zen-pool:claude-sonnet-4-thinking',
  },
}

beforeEach(() => {
  _resetPoolCacheForTest()
})

describe('trySmartRoute — bypass conditions', () => {
  test('returns null when existing agent override is present', () => {
    const result = trySmartRoute({
      userText: 'hi',
      turnNumber: 5,
      existingOverride: { model: 'x', baseURL: 'http://x', apiKey: 'k' },
      smartRoutingConfig: FIVE_CAT,
      agentModels: MODELS,
    })
    expect(result).toBeNull()
  })

  test('returns null when smart routing is disabled', () => {
    const result = trySmartRoute({
      userText: 'hi',
      turnNumber: 5,
      smartRoutingConfig: { ...FIVE_CAT, enabled: false },
      agentModels: MODELS,
    })
    expect(result).toBeNull()
  })

  test('returns null when no config provided', () => {
    const result = trySmartRoute({
      userText: 'hi',
      turnNumber: 5,
      agentModels: MODELS,
    })
    expect(result).toBeNull()
  })

  test('returns null when no agentModels provided', () => {
    const result = trySmartRoute({
      userText: 'hi',
      turnNumber: 5,
      smartRoutingConfig: FIVE_CAT,
    })
    expect(result).toBeNull()
  })

  test('returns null when decision has no model target', () => {
    // Config with only code target — "hi" classifies as simple, no target
    const result = trySmartRoute({
      userText: 'hi',
      turnNumber: 5,
      smartRoutingConfig: { enabled: true, targets: { code: 'nvidia-nim:x' } },
      agentModels: MODELS,
    })
    expect(result).toBeNull()
  })
})

describe('trySmartRoute — successful routing', () => {
  test('simple chatter routes to ollama-local', () => {
    const result = trySmartRoute({
      userText: 'thanks!',
      turnNumber: 5,
      smartRoutingConfig: FIVE_CAT,
      agentModels: MODELS,
    })
    expect(result).not.toBeNull()
    expect(result!.decision.category).toBe('simple')
    expect(result!.override!.model).toBe('qwen2.5:7b') // ollama default model
    expect(result!.override!.baseURL).toBe('http://localhost:11434/v1')
    expect(result!.override!.apiKey).toBe('') // local, no key
  })

  test('first turn routes to strong (zen-pool)', () => {
    const result = trySmartRoute({
      userText: 'build it',
      turnNumber: 1,
      smartRoutingConfig: FIVE_CAT,
      agentModels: MODELS,
    })
    expect(result).not.toBeNull()
    expect(result!.decision.category).toBe('strong')
    expect(result!.override!.model).toBe('claude-sonnet-4')
    expect(result!.override!.baseURL).toBe('https://opencode.ai/zen/v1')
    expect(['sk-z1', 'sk-z2']).toContain(result!.override!.apiKey)
  })

  test('code content routes to nvidia-nim', () => {
    const result = trySmartRoute({
      userText: 'fix `foo.bar`',
      turnNumber: 5,
      smartRoutingConfig: FIVE_CAT,
      agentModels: MODELS,
    })
    expect(result).not.toBeNull()
    expect(result!.decision.category).toBe('code')
    expect(result!.override!.model).toBe('deepseek-coder-v2')
    expect(result!.override!.baseURL).toBe('https://integrate.api.nvidia.com/v1')
  })

  test('reasoning keyword routes to zen-pool with thinking model', () => {
    const result = trySmartRoute({
      userText: 'why does the test fail',
      turnNumber: 5,
      smartRoutingConfig: FIVE_CAT,
      agentModels: MODELS,
    })
    expect(result).not.toBeNull()
    expect(result!.decision.category).toBe('reasoning')
    expect(result!.override!.model).toBe('claude-sonnet-4-thinking')
  })

  test('target string is preserved for outcome reporting', () => {
    const result = trySmartRoute({
      userText: 'build it',
      turnNumber: 1,
      smartRoutingConfig: FIVE_CAT,
      agentModels: MODELS,
    })
    expect(result!.target).toBe('zen-pool:claude-sonnet-4')
  })
})

describe('trySmartRoute — provider not found (fail-open)', () => {
  test('returns null when provider alias not in agentModels', () => {
    const config: SmartRoutingConfig = {
      enabled: true,
      targets: { strong: 'missing-provider:model' },
    }
    const result = trySmartRoute({
      userText: 'build it',
      turnNumber: 1,
      smartRoutingConfig: config,
      agentModels: MODELS,
    })
    expect(result).toBeNull() // fail-open
  })
})

describe('trySmartRoute — key rotation across calls', () => {
  test('rotates keys from zen-pool across consecutive calls', () => {
    const keys = new Set<string>()
    for (let i = 0; i < 4; i++) {
      const result = trySmartRoute({
        userText: 'build it',
        turnNumber: 1,
        smartRoutingConfig: FIVE_CAT,
        agentModels: MODELS,
      })
      keys.add(result!.override!.apiKey)
    }
    expect(keys.size).toBe(2) // only 2 keys in the pool
  })
})

describe('reportOutcome', () => {
  test('rate_limit puts key in cooldown, next call gets different key', () => {
    const first = trySmartRoute({
      userText: 'build it',
      turnNumber: 1,
      smartRoutingConfig: FIVE_CAT,
      agentModels: MODELS,
    })
    const firstKey = first!.override!.apiKey

    reportOutcome(
      first!.target,
      { kind: 'rate_limit', apiKey: firstKey },
      MODELS,
    )

    const second = trySmartRoute({
      userText: 'build it',
      turnNumber: 1,
      smartRoutingConfig: FIVE_CAT,
      agentModels: MODELS,
    })
    expect(second!.override!.apiKey).not.toBe(firstKey)
  })

  test('no-op when target is empty', () => {
    expect(() =>
      reportOutcome('', { kind: 'success', apiKey: 'x' }, MODELS),
    ).not.toThrow()
  })

  test('no-op when agentModels is null', () => {
    expect(() =>
      reportOutcome('zen-pool:m', { kind: 'success', apiKey: 'x' }, null),
    ).not.toThrow()
  })
})

describe('trySmartRoute — legacy 2-category config', () => {
  test('works with simpleModel/strongModel (no targets map)', () => {
    const legacyConfig: SmartRoutingConfig = {
      enabled: true,
      simpleModel: 'ollama-local',
      strongModel: 'zen-pool:claude-sonnet-4',
    }
    // Simple turn
    const simple = trySmartRoute({
      userText: 'ok',
      turnNumber: 5,
      smartRoutingConfig: legacyConfig,
      agentModels: MODELS,
    })
    expect(simple).not.toBeNull()
    expect(simple!.decision.complexity).toBe('simple')
    expect(simple!.override!.model).toBe('qwen2.5:7b') // ollama default

    // Strong turn (first turn)
    const strong = trySmartRoute({
      userText: 'build it',
      turnNumber: 1,
      smartRoutingConfig: legacyConfig,
      agentModels: MODELS,
    })
    expect(strong).not.toBeNull()
    expect(strong!.decision.complexity).toBe('strong')
    expect(strong!.override!.model).toBe('claude-sonnet-4')
  })
})
