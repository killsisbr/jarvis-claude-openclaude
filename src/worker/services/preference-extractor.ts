import { getUserPreferences, recordPreferenceObservation } from '../db/preferences'

export interface FormattedPreference {
  category: string
  value: string
  confidence: number
}

// Padrões de extração de preferências do texto (simplificado para robustez)
const LANGUAGE_VALUES = ['python', 'javascript', 'typescript', 'go', 'rust', 'java', 'c++', 'c#', 'php', 'ruby', 'scala', 'kotlin']
const FRAMEWORK_VALUES = ['react', 'vue', 'svelte', 'angular', 'nextjs', 'next.js', 'nuxt', 'django', 'flask', 'fastapi', 'spring', 'express', 'nestjs', 'nest.js']
const STYLE_VALUES = ['concise', 'brief', 'detailed', 'thorough', 'verbose', 'terse', 'minimal', 'short', 'long']
const TONE_VALUES = ['casual', 'formal', 'technical', 'friendly', 'professional']
const DATABASE_VALUES = ['postgres', 'postgresql', 'mysql', 'mongodb', 'redis', 'sqlite', 'cassandra', 'dynamodb', 'firestore']

function createPattern(category: string, values: string[]): RegExp {
  const pattern = values.join('|').replace(/\+/g, '\\+').replace(/#/g, '\\#')
  return new RegExp(`(${pattern})`, 'gi')
}

const PREFERENCE_PATTERNS = {
  language: createPattern('language', LANGUAGE_VALUES),
  framework: createPattern('framework', FRAMEWORK_VALUES),
  style: createPattern('style', STYLE_VALUES),
  tone: createPattern('tone', TONE_VALUES),
  database: createPattern('database', DATABASE_VALUES),
}

export async function extractUserPreferences(userId: string, userMessage: string): Promise<FormattedPreference[]> {
  const extracted: Map<string, { value: string; confidence: number; category: string }> = new Map()

  // Procurar padrões em toda a mensagem
  const lowerMessage = userMessage.toLowerCase()

  for (const [categoryKey, regex] of Object.entries(PREFERENCE_PATTERNS)) {
    // Reset regex state
    regex.lastIndex = 0

    let match
    while ((match = regex.exec(lowerMessage)) !== null) {
      // Extrair o valor (primeiro capture group é o valor extraído)
      const value = match[1]?.trim()

      if (value && value.length > 2) {
        const key = `${categoryKey}-${value}`

        if (!extracted.has(key)) {
          extracted.set(key, {
            value: value.charAt(0).toUpperCase() + value.slice(1),
            confidence: 0.75,
            category: categoryKey,
          })
        }
      }
    }
  }

  // Converter para array e registrar no DB
  const preferences: FormattedPreference[] = []

  for (const pref of extracted.values()) {
    preferences.push({
      category: pref.category,
      value: pref.value,
      confidence: pref.confidence,
    })

    // Registrar no DB (incrementa confidence se já existe)
    try {
      recordPreferenceObservation(userId, pref.category, pref.value, 0.15)
    } catch (err) {
      // Silenciar erros de DB
      console.warn('[preference-extractor] DB error:', err instanceof Error ? err.message : String(err))
    }
  }

  return preferences
}

export function formatUserPreferences(preferences: FormattedPreference[]): string {
  if (preferences.length === 0) {
    return ''
  }

  // Agrupar por categoria
  const byCategory: Record<string, string[]> = {}

  for (const pref of preferences) {
    if (!byCategory[pref.category]) {
      byCategory[pref.category] = []
    }
    byCategory[pref.category].push(pref.value)
  }

  // Formatar para injeção
  const lines: string[] = ['## User Preferences:']

  for (const [category, values] of Object.entries(byCategory)) {
    const valueStr = values.join(', ')
    lines.push(`- **${category}**: ${valueStr}`)
  }

  return '\n' + lines.join('\n')
}

export async function injectProactiveContext(
  userId: string,
  baseSystemPrompt: string
): Promise<string> {
  // Recuperar preferências com alta confiança
  const prefs = getUserPreferences(userId)
    .filter((p) => p.confidence >= 0.6)
    .slice(0, 8) // Limitar a 8 preferências para não inchar o prompt

  if (prefs.length === 0) {
    return baseSystemPrompt
  }

  const formatted = formatUserPreferences(
    prefs.map((p) => ({
      category: p.category,
      value: p.value,
      confidence: p.confidence,
    }))
  )

  return baseSystemPrompt + formatted
}
