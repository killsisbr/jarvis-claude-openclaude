import { describe, expect, test } from 'bun:test'

import {
  routeModel,
  type SmartRoutingConfig,
} from './smartModelRouting.ts'

const ENABLED: SmartRoutingConfig = {
  enabled: true,
  simpleModel: 'claude-haiku-4-5',
  strongModel: 'claude-opus-4-7',
}

describe('routeModel — disabled / misconfigured', () => {
  test('disabled config routes to strong', () => {
    const decision = routeModel(
      { userText: 'hi' },
      { ...ENABLED, enabled: false },
    )
    expect(decision.model).toBe('claude-opus-4-7')
    expect(decision.complexity).toBe('strong')
    expect(decision.reason).toContain('disabled')
  })

  test('missing simpleModel falls back to strong', () => {
    const decision = routeModel(
      { userText: 'hi' },
      { ...ENABLED, simpleModel: '' },
    )
    expect(decision.model).toBe('claude-opus-4-7')
    expect(decision.complexity).toBe('strong')
  })

  test('simpleModel === strongModel routes to strong (no-op)', () => {
    const decision = routeModel(
      { userText: 'hi' },
      { ...ENABLED, simpleModel: 'claude-opus-4-7' },
    )
    expect(decision.model).toBe('claude-opus-4-7')
    expect(decision.complexity).toBe('strong')
  })
})

describe('routeModel — simple path', () => {
  test('short greeting routes to simple', () => {
    const decision = routeModel({ userText: 'thanks!', turnNumber: 5 }, ENABLED)
    expect(decision.model).toBe('claude-haiku-4-5')
    expect(decision.complexity).toBe('simple')
  })

  test('empty input routes to simple', () => {
    const decision = routeModel({ userText: '   ' }, ENABLED)
    expect(decision.model).toBe('claude-haiku-4-5')
    expect(decision.complexity).toBe('simple')
  })

  test('mid-length chatter routes to simple', () => {
    const decision = routeModel(
      { userText: 'yep looks good, go ahead', turnNumber: 10 },
      ENABLED,
    )
    expect(decision.complexity).toBe('simple')
  })
})

describe('routeModel — strong path', () => {
  test('first turn always routes to strong, even when short', () => {
    const decision = routeModel(
      { userText: 'fix the bug', turnNumber: 1 },
      ENABLED,
    )
    expect(decision.model).toBe('claude-opus-4-7')
    expect(decision.complexity).toBe('strong')
    expect(decision.reason).toContain('first turn')
  })

  test('code fence routes to strong', () => {
    const decision = routeModel(
      {
        userText: 'change this:\n```\nfoo()\n```',
        turnNumber: 5,
      },
      ENABLED,
    )
    expect(decision.complexity).toBe('strong')
    expect(decision.reason).toContain('code')
  })

  test('inline code span routes to strong', () => {
    const decision = routeModel(
      { userText: 'rename `foo` to `bar`', turnNumber: 5 },
      ENABLED,
    )
    expect(decision.complexity).toBe('strong')
  })

  test('reasoning keyword "plan" routes to strong even when short', () => {
    const decision = routeModel(
      { userText: 'plan the refactor', turnNumber: 5 },
      ENABLED,
    )
    expect(decision.complexity).toBe('strong')
    expect(decision.reason).toContain('keyword')
  })

  test('reasoning keyword "debug" routes to strong', () => {
    const decision = routeModel(
      { userText: 'debug the test', turnNumber: 5 },
      ENABLED,
    )
    expect(decision.complexity).toBe('strong')
  })

  test('"root cause" multi-word keyword routes to strong', () => {
    const decision = routeModel(
      { userText: 'find the root cause', turnNumber: 5 },
      ENABLED,
    )
    expect(decision.complexity).toBe('strong')
  })

  test('multi-paragraph input routes to strong', () => {
    const decision = routeModel(
      {
        userText: 'first thought.\n\nsecond thought.',
        turnNumber: 5,
      },
      ENABLED,
    )
    expect(decision.complexity).toBe('strong')
    expect(decision.reason).toContain('multi-paragraph')
  })

  test('over-long input routes to strong', () => {
    const long = 'ok '.repeat(100) // ~300 chars, 100 words
    const decision = routeModel(
      { userText: long, turnNumber: 5 },
      ENABLED,
    )
    expect(decision.complexity).toBe('strong')
  })

  test('exactly at the boundary stays simple', () => {
    const text = 'a'.repeat(160)
    const decision = routeModel(
      { userText: text, turnNumber: 5 },
      { ...ENABLED, simpleMaxChars: 160, simpleMaxWords: 28 },
    )
    expect(decision.complexity).toBe('simple')
  })

  test('one char over the boundary routes to strong', () => {
    const text = 'a'.repeat(161)
    const decision = routeModel(
      { userText: text, turnNumber: 5 },
      { ...ENABLED, simpleMaxChars: 160, simpleMaxWords: 28 },
    )
    expect(decision.complexity).toBe('strong')
    expect(decision.reason).toContain('160 chars')
  })
})

describe('routeModel — config overrides', () => {
  test('custom simpleMaxChars is honored', () => {
    const decision = routeModel(
      { userText: 'abcdefghijklmnop', turnNumber: 5 },
      { ...ENABLED, simpleMaxChars: 10 },
    )
    expect(decision.complexity).toBe('strong')
    expect(decision.reason).toContain('10 chars')
  })

  test('custom simpleMaxWords is honored', () => {
    const decision = routeModel(
      { userText: 'one two three four five', turnNumber: 5 },
      { ...ENABLED, simpleMaxWords: 3 },
    )
    expect(decision.complexity).toBe('strong')
    expect(decision.reason).toContain('3 words')
  })
})

describe('routeModel — 5-category targets mode', () => {
  const FIVE_CAT: SmartRoutingConfig = {
    enabled: true,
    targets: {
      simple: 'ollama-local:qwen2.5:7b',
      strong: 'zen-pool:claude-sonnet-4',
      code: 'nvidia-nim:deepseek-coder-v2',
      reasoning: 'zen-pool:claude-sonnet-4-thinking',
      vision: 'groq:llama-3.2-90b-vision',
    },
  }

  test('vision wins over everything when hasImages', () => {
    const decision = routeModel(
      { userText: 'plan the refactor', hasImages: true, turnNumber: 5 },
      FIVE_CAT,
    )
    expect(decision.category).toBe('vision')
    expect(decision.model).toBe('groq:llama-3.2-90b-vision')
  })

  test('code category for inline backtick code', () => {
    const decision = routeModel(
      { userText: 'fix `foo.bar`', turnNumber: 5 },
      FIVE_CAT,
    )
    expect(decision.category).toBe('code')
    expect(decision.model).toBe('nvidia-nim:deepseek-coder-v2')
  })

  test('code category for fenced block', () => {
    const decision = routeModel(
      { userText: 'review:\n```\nx\n```', turnNumber: 5 },
      FIVE_CAT,
    )
    expect(decision.category).toBe('code')
  })

  test('reasoning category for "why" prompts', () => {
    const decision = routeModel(
      { userText: 'why does the test fail', turnNumber: 5 },
      FIVE_CAT,
    )
    expect(decision.category).toBe('reasoning')
    expect(decision.model).toBe('zen-pool:claude-sonnet-4-thinking')
  })

  test('reasoning category for "analyze"', () => {
    const decision = routeModel(
      { userText: 'analyze the bug', turnNumber: 5 },
      FIVE_CAT,
    )
    expect(decision.category).toBe('reasoning')
  })

  test('simple category for short chatter', () => {
    const decision = routeModel(
      { userText: 'thanks!', turnNumber: 5 },
      FIVE_CAT,
    )
    expect(decision.category).toBe('simple')
    expect(decision.model).toBe('ollama-local:qwen2.5:7b')
  })

  test('strong category for first turn even if short', () => {
    const decision = routeModel({ userText: 'build it', turnNumber: 1 }, FIVE_CAT)
    expect(decision.category).toBe('strong')
    expect(decision.model).toBe('zen-pool:claude-sonnet-4')
  })

  test('complexity mirrors category (simple|strong)', () => {
    expect(routeModel({ userText: 'ok', turnNumber: 5 }, FIVE_CAT).complexity).toBe('simple')
    expect(routeModel({ userText: 'check `foo.bar`', turnNumber: 5 }, FIVE_CAT).complexity).toBe('strong')
    expect(routeModel({ userText: 'why does it break', turnNumber: 5 }, FIVE_CAT).complexity).toBe('strong')
  })

  test('falls back to "strong" target when category target absent', () => {
    const config: SmartRoutingConfig = {
      enabled: true,
      targets: {
        strong: 'zen-pool:claude-sonnet-4',
        // no simple / code / reasoning / vision
      },
    }
    const decision = routeModel({ userText: 'why does X happen', turnNumber: 5 }, config)
    expect(decision.category).toBe('reasoning')
    expect(decision.model).toBe('zen-pool:claude-sonnet-4') // fallback
  })

  test('returns empty model when no target resolvable', () => {
    const decision = routeModel(
      { userText: 'hi', turnNumber: 5 },
      { enabled: true, targets: { code: 'x:y' } }, // only code defined
    )
    // 'hi' classifies as 'simple', but neither simple nor strong targets exist
    expect(decision.category).toBe('simple')
    expect(decision.model).toBe('')
  })
})

describe('routeModel — reason strings', () => {
  test('simple decisions include char + word counts', () => {
    const decision = routeModel(
      { userText: 'sounds good', turnNumber: 5 },
      ENABLED,
    )
    expect(decision.reason).toMatch(/\d+ chars, \d+ words/)
  })
})
