/**
 * Smart model routing — cheap-for-simple, strong-for-hard.
 *
 * For everyday short chatter ("ok", "thanks", "what does this do?") the
 * incremental quality of Opus/GPT-5 over Haiku/Mini is negligible while the
 * cost and latency are an order of magnitude worse. Smart routing opts a
 * user into routing such "obviously simple" turns to a cheaper model while
 * keeping the strong model for the anything-non-trivial path.
 *
 * This module is a pure primitive: it takes a turn description (the user's
 * text + light context) and returns which model to use, based on config.
 * It never reads env vars or state directly — caller supplies everything.
 *
 * Off by default. Users opt in via settings.smartRouting.enabled. Intent:
 * make this a copy-paste-small config block rather than a hidden heuristic,
 * so the tradeoff is visible and the user controls it.
 */

/**
 * Routing categories (5).
 * Order matters for classification — first match wins:
 *   1. vision   — input has an image attachment
 *   2. code     — input contains ``` fence or ` inline code
 *   3. reasoning — input has analytical keywords (debug, why, root cause, plan)
 *   4. strong   — anything not classifiable as simple
 *   5. simple   — short trivial chatter under char/word cutoffs
 */
export type RoutingCategory = 'simple' | 'strong' | 'code' | 'reasoning' | 'vision'

/**
 * Legacy alias kept for the 0.11 baseline tests (simple|strong only).
 * Prefer RoutingCategory in new code.
 */
export type Complexity = 'simple' | 'strong'

export type SmartRoutingConfig = {
  enabled: boolean
  /**
   * NEW: target map by category. When provided, takes precedence over
   * simpleModel/strongModel. Values are model identifiers (the resolver
   * upstream is responsible for translating to provider+key).
   */
  targets?: Partial<Record<RoutingCategory, string>>
  /** Legacy: model to use for turns classified as "simple". */
  simpleModel?: string
  /** Legacy: model to use for turns classified as "strong" (or when unsure). */
  strongModel?: string
  /** Max characters in user input to qualify as "simple". Default 160. */
  simpleMaxChars?: number
  /** Max whitespace-separated words to qualify as "simple". Default 28. */
  simpleMaxWords?: number
}

export type RoutingDecision = {
  model: string
  /** 5-category classification — preferred. */
  category: RoutingCategory
  /** Legacy 2-category view, derived from category. */
  complexity: Complexity
  /** Human-readable reason — useful for the UI indicator and debug logs. */
  reason: string
}

export type RoutingInput = {
  /** The user's message text for this turn. */
  userText: string
  /**
   * Optional: how many tool-use blocks the assistant has emitted in the
   * recent conversation. High values correlate with "continue this work"
   * follow-ups that can still be cheap, UNLESS the user also typed code
   * or strong-keyword text.
   */
  recentToolUses?: number
  /**
   * Optional: turn number within the current session (1-indexed). The first
   * turn is often task-setup and benefits from the strong model even if
   * short — a bare "build X" opens the whole task.
   */
  turnNumber?: number
  /**
   * Optional: true when the user attached one or more images to this turn.
   * Routes to the "vision" category regardless of other heuristics.
   */
  hasImages?: boolean
}

const DEFAULT_SIMPLE_MAX_CHARS = 160
const DEFAULT_SIMPLE_MAX_WORDS = 28

// Keywords that strongly suggest reasoning/planning/design work.
// Matching is word-boundary / case-insensitive. Must include enough anchors
// that short prompts like "plan the refactor" route to strong even under
// the char/word cutoff.
const STRONG_KEYWORDS = [
  'plan',
  'design',
  'architect',
  'architecture',
  'refactor',
  'debug',
  'investigate',
  'analyze',
  'analyse',
  'implement',
  'optimize',
  'optimise',
  'review',
  'audit',
  'diagnose',
  'root cause',
  'root-cause',
  'why does',
  'why is',
  'how should',
  'why did',
  'propose',
  'trace',
  'reproduce',
]

const STRONG_KEYWORD_RE = new RegExp(
  `\\b(?:${STRONG_KEYWORDS.map(k => k.replace(/[-]/g, '[-\\s]')).join('|')})\\b`,
  'i',
)

const CODE_FENCE_RE = /```[\s\S]*?```|`[^`\n]+`/

function countWords(text: string): number {
  const trimmed = text.trim()
  if (!trimmed) return 0
  return trimmed.split(/\s+/).length
}

function hasMultiParagraph(text: string): boolean {
  return /\n\s*\n/.test(text)
}

function hasCode(text: string): boolean {
  return CODE_FENCE_RE.test(text)
}

function hasStrongKeyword(text: string): boolean {
  return STRONG_KEYWORD_RE.test(text)
}

/**
 * Resolve the effective model identifier for a given category, with sensible
 * fallbacks across the new `targets` map and the legacy simple/strong fields.
 *
 * Resolution order:
 *   1. config.targets[category]                       — explicit per-category target
 *   2. config.targets.strong                          — generic fallback
 *   3. config.strongModel (legacy)                    — back-compat
 *   4. config.simpleModel (legacy) when category=simple
 *   5. null (caller must handle — typically use the global default model)
 */
function resolveCategoryTarget(
  category: RoutingCategory,
  config: SmartRoutingConfig,
): string | null {
  // 1. explicit per-category target wins
  const explicit = config.targets?.[category]
  if (explicit) return explicit

  // 2. legacy back-compat: simple category → simpleModel BEFORE generic fallback
  if (category === 'simple' && config.simpleModel) return config.simpleModel

  // 3. generic fallback inside the targets map
  const fallback = config.targets?.strong
  if (fallback) return fallback

  // 4. legacy strongModel as last-resort
  if (config.strongModel) return config.strongModel

  return null
}

/** Map 5-category to legacy 2-category. */
function toComplexity(category: RoutingCategory): Complexity {
  return category === 'simple' ? 'simple' : 'strong'
}

function decide(
  category: RoutingCategory,
  config: SmartRoutingConfig,
  reason: string,
): RoutingDecision {
  const model = resolveCategoryTarget(category, config)
  return {
    model: model ?? '', // empty string signals "use global default"
    category,
    complexity: toComplexity(category),
    reason,
  }
}

/**
 * Classify a turn into one of 5 categories and pick the appropriate model.
 *
 * When `targets` is provided, each category resolves to its own model.
 * When only legacy `simpleModel`/`strongModel` are set, behavior collapses
 * back to the 0.11 two-category routing (back-compat for existing users).
 */
export function routeModel(
  input: RoutingInput,
  config: SmartRoutingConfig,
): RoutingDecision {
  if (!config.enabled) {
    return decide('strong', config, 'smart-routing disabled')
  }

  // Sanity: need at least one target (new or legacy) to do anything useful.
  const hasAnyTarget =
    !!config.targets?.strong ||
    !!config.targets?.simple ||
    !!config.targets?.code ||
    !!config.targets?.reasoning ||
    !!config.targets?.vision ||
    !!config.strongModel ||
    !!config.simpleModel
  if (!hasAnyTarget) {
    return decide('strong', config, 'no targets configured')
  }

  // Legacy back-compat block (no `targets` map — caller is using simpleModel/strongModel only):
  //   - missing simpleModel ⇒ everything routes to strong (matches 0.11 behavior)
  //   - simpleModel === strongModel ⇒ collapse to strong (no-op routing)
  // Categories simple/code/reasoning/vision require an explicit targets map to differentiate.
  if (!config.targets) {
    if (!config.simpleModel) {
      return decide('strong', config, 'simpleModel or strongModel missing from config')
    }
    if (config.simpleModel === config.strongModel) {
      return decide('strong', config, 'simpleModel equals strongModel')
    }
  }

  const text = input.userText ?? ''
  const trimmed = text.trim()

  // 1. Vision — image attachment always wins.
  if (input.hasImages) {
    return decide('vision', config, 'input contains image(s)')
  }

  // Empty input (resumed tool-use chain) → cheap by default.
  if (!trimmed) {
    return decide('simple', config, 'empty user text')
  }

  // First turn of a session is task-setup — always strong.
  if (input.turnNumber === 1) {
    return decide('strong', config, 'first turn of session')
  }

  const maxChars = config.simpleMaxChars ?? DEFAULT_SIMPLE_MAX_CHARS
  const maxWords = config.simpleMaxWords ?? DEFAULT_SIMPLE_MAX_WORDS

  // 2. Code — fences or inline code.
  if (hasCode(trimmed)) {
    return decide('code', config, 'contains code block or inline code')
  }

  // 3. Reasoning — analytical/planning keywords.
  if (hasStrongKeyword(trimmed)) {
    return decide('reasoning', config, 'contains reasoning/planning keyword')
  }

  // 4. Strong — multi-paragraph or above size cutoffs.
  if (hasMultiParagraph(trimmed)) {
    return decide('strong', config, 'multi-paragraph input')
  }
  if (trimmed.length > maxChars) {
    return decide('strong', config, `input > ${maxChars} chars`)
  }
  if (countWords(trimmed) > maxWords) {
    return decide('strong', config, `input > ${maxWords} words`)
  }

  // 5. Simple — short trivial chatter.
  return decide(
    'simple',
    config,
    `short (${trimmed.length} chars, ${countWords(trimmed)} words)`,
  )
}
