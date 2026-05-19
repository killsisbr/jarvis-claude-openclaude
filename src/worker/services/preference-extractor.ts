/**
 * Preference Extractor
 *
 * Analyzes user messages to detect and extract preferences
 * (language, framework, style, etc)
 */

import { setUserPreference, getTopPreferences } from '../db/preferences'

export interface ExtractedPreference {
  category: string
  value: string
  confidence: number
  reason: string
}

const PREFERENCE_PATTERNS: Record<string, Array<{ pattern: RegExp; category: string; value: string; confidence: number }>> = {
  language: [
    { pattern: /\b(python|javascript|typescript|rust|go|java|c\+\+|csharp|c#|php|ruby|kotlin)\b/i, category: 'language', value: '', confidence: 0.8 },
    { pattern: /i\s+(prefer|like|use)\s+(python|js|ts|rust|go)\b/i, category: 'language', value: '', confidence: 0.9 }
  ],
  framework: [
    { pattern: /\b(react|vue|angular|svelte|next\.?js|nuxt|django|fastapi|spring|rails|express)\b/i, category: 'framework', value: '', confidence: 0.8 },
    { pattern: /i\s+(prefer|like|use)\s+(react|vue|django)\b/i, category: 'framework', value: '', confidence: 0.9 }
  ],
  style: [
    { pattern: /\b(concise|detailed|verbose|brief|short|long)\s+(answers?|explanations?|code)/i, category: 'style', value: '', confidence: 0.7 },
    { pattern: /i\s+(prefer|like)\s+(concise|detailed|verbose|brief|short)\s+(answers?|explanations?)/i, category: 'style', value: '', confidence: 0.9 }
  ],
  approach: [
    { pattern: /\b(functional|object-?oriented|oop|imperative|declarative)\s+(programming|approach)?/i, category: 'approach', value: '', confidence: 0.7 },
    { pattern: /i\s+(prefer|like)\s+(functional|oop|declarative)\s+(programming|approach)?/i, category: 'approach', value: '', confidence: 0.9 }
  ],
  testing: [
    { pattern: /\b(jest|mocha|pytest|unittest|vitest|rspec)\b/i, category: 'testing', value: '', confidence: 0.8 },
    { pattern: /\b(tdd|bdd|test-?driven|behavior-?driven)\b/i, category: 'testing', value: '', confidence: 0.8 }
  ]
}

/**
 * Extract preferences from user message
 */
export function extractUserPreferences(userId: string, message: string): ExtractedPreference[] {
  const preferences: ExtractedPreference[] = []
  const lowerMessage = message.toLowerCase()

  // Check each pattern category
  for (const [, patterns] of Object.entries(PREFERENCE_PATTERNS)) {
    for (const pattern of patterns) {
      const match = lowerMessage.match(pattern.pattern)
      if (match) {
        const value = match[1] || pattern.value
        if (value) {
          const pref: ExtractedPreference = {
            category: pattern.category,
            value: value.toLowerCase(),
            confidence: pattern.confidence,
            reason: `Detected from message: "${match[0]}"`
          }

          // Avoid duplicates
          if (!preferences.some(p => p.category === pref.category && p.value === pref.value)) {
            preferences.push(pref)
            setUserPreference(userId, pref.category, pref.value, pref.confidence)
          }
        }
      }
    }
  }

  return preferences
}

/**
 * Format preferences for prompt injection
 */
export function formatUserPreferences(userId: string): string {
  // Get top preferences for each category
  const categories = ['language', 'framework', 'style', 'approach', 'testing']
  const sections: string[] = []

  for (const category of categories) {
    const topPrefs = getTopPreferences(userId, category, 3)
    if (topPrefs.length > 0) {
      const values = topPrefs
        .map(p => `${p.value} (confidence: ${(p.confidence * 100).toFixed(0)}%)`)
        .join(', ')

      sections.push(`- **${category}**: ${values}`)
    }
  }

  if (sections.length === 0) {
    return ''
  }

  return `
## User Preferences (Observed)

${sections.join('\n')}

Use these preferences to tailor responses when applicable, but always prioritize accuracy and best practices.
`
}

/**
 * Get preference injection context for a user
 * Returns empty string if no preferences, or formatted preferences section
 */
export function getPreferenceContext(userId: string): string {
  return formatUserPreferences(userId)
}
