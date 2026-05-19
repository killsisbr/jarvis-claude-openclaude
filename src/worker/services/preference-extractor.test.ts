import { describe, test, expect, beforeEach, afterEach } from 'bun:test'
import {
  extractUserPreferences,
  formatUserPreferences,
  injectProactiveContext,
} from './preference-extractor'

describe('preference-extractor', () => {
  describe('extractUserPreferences', () => {
    test('extracts language preference (explicit)', async () => {
      const prefs = await extractUserPreferences('user1', 'I prefer Python for everything')
      const python = prefs.find((p) => p.category === 'language' && p.value.toLowerCase() === 'python')
      expect(python).toBeDefined()
      expect(python?.confidence).toBeGreaterThanOrEqual(0.7)
    })

    test('extracts framework preference', async () => {
      const prefs = await extractUserPreferences('user2', 'I like React for building UI components')
      const react = prefs.find((p) => p.category === 'framework' && p.value.toLowerCase() === 'react')
      expect(react).toBeDefined()
    })

    test('extracts style preference', async () => {
      const prefs = await extractUserPreferences('user3', 'Keep it concise')
      const concise = prefs.find((p) => p.category === 'style')
      expect(concise).toBeDefined()
      expect(concise?.value.toLowerCase()).toContain('concise')
    })

    test('extracts tone preference', async () => {
      const prefs = await extractUserPreferences('user4', 'Be casual when explaining')
      const casual = prefs.find((p) => p.category === 'tone')
      expect(casual).toBeDefined()
      expect(casual?.value.toLowerCase()).toContain('casual')
    })

    test('extracts database preference', async () => {
      const prefs = await extractUserPreferences('user5', 'I use postgres for all my projects')
      const postgres = prefs.find((p) => p.category === 'database')
      expect(postgres).toBeDefined()
      expect(postgres?.value.toLowerCase()).toContain('postgres')
    })

    test('returns empty array when no preferences detected', async () => {
      const prefs = await extractUserPreferences('user6', 'What is the weather today?')
      expect(prefs.length).toBe(0)
    })

    test('extracts multiple preferences from same message', async () => {
      const prefs = await extractUserPreferences(
        'user7',
        'I prefer Python and love using React for frontend development. Keep answers brief and technical.'
      )
      expect(prefs.length).toBeGreaterThanOrEqual(2)
    })

    test('normalizes extracted values to Title Case', async () => {
      const prefs = await extractUserPreferences('user8', 'i like typescript')
      const ts = prefs.find((p) => p.category === 'language')
      expect(ts?.value).toMatch(/^[A-Z]/)
    })
  })

  describe('formatUserPreferences', () => {
    test('formats preferences for system prompt injection', () => {
      const prefs = [
        { category: 'language', value: 'Python', confidence: 0.9 },
        { category: 'framework', value: 'React', confidence: 0.8 },
      ]

      const formatted = formatUserPreferences(prefs)

      expect(formatted).toContain('## User Preferences:')
      expect(formatted).toContain('Python')
      expect(formatted).toContain('React')
      expect(formatted).toContain('language')
      expect(formatted).toContain('framework')
    })

    test('returns empty string for empty preferences', () => {
      const formatted = formatUserPreferences([])
      expect(formatted).toBe('')
    })

    test('groups preferences by category', () => {
      const prefs = [
        { category: 'language', value: 'Python', confidence: 0.9 },
        { category: 'language', value: 'Go', confidence: 0.7 },
      ]

      const formatted = formatUserPreferences(prefs)

      // Ambas as linguagens devem estar na mesma linha de categoria
      const langLine = formatted.split('\n').find((l) => l.includes('language'))
      expect(langLine).toContain('Python')
      expect(langLine).toContain('Go')
    })

    test('formats as markdown with bold categories', () => {
      const prefs = [{ category: 'style', value: 'Concise', confidence: 0.8 }]

      const formatted = formatUserPreferences(prefs)

      expect(formatted).toContain('**style**')
    })
  })

  describe('injectProactiveContext', () => {
    test('returns base prompt if user has no preferences', async () => {
      const basePrompt = 'You are helpful.'
      const result = await injectProactiveContext('user-no-prefs', basePrompt)
      expect(result).toBe(basePrompt)
    })

    test('injects preferences into system prompt', async () => {
      // First, register some preferences
      await extractUserPreferences('user-with-prefs', 'I prefer Python and React')

      const basePrompt = 'You are helpful.'
      const result = await injectProactiveContext('user-with-prefs', basePrompt)

      // Result should be longer than base (preferences added)
      expect(result.length).toBeGreaterThan(basePrompt.length)
      // Should start with base prompt
      expect(result).toContain('You are helpful.')
      // Should include preferences section
      expect(result).toContain('## User Preferences:')
    })

    test('limits preferences to 8 to avoid prompt bloat', async () => {
      // Criar usuário com muitas preferências
      for (let i = 0; i < 10; i++) {
        await extractUserPreferences('user-many-prefs', `I like language${i}`)
      }

      const basePrompt = 'You are helpful.'
      const result = await injectProactiveContext('user-many-prefs', basePrompt)

      // Contar quantas linhas de preferência existem
      const prefLines = result.split('\n').filter((l) => l.match(/^-\s+\*\*/))
      expect(prefLines.length).toBeLessThanOrEqual(8)
    })
  })
})
