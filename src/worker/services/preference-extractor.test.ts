import { describe, it, expect, beforeEach, afterEach } from 'bun:test'
import { extractUserPreferences, formatUserPreferences, getPreferenceContext } from './preference-extractor'
import { getDatabase, closeDatabase } from '../db/schema'

describe('preference extractor', () => {
  beforeEach(() => {
    getDatabase()
  })

  afterEach(() => {
    closeDatabase()
  })

  describe('extractUserPreferences', () => {
    it('detects language preferences', () => {
      const prefs = extractUserPreferences('user1', 'I love using Python for everything')
      expect(prefs).toContainEqual(
        expect.objectContaining({
          category: 'language',
          value: 'python',
          confidence: expect.any(Number)
        })
      )
    })

    it('detects framework preferences', () => {
      const prefs = extractUserPreferences('user1', 'I use React for all my frontend work')
      expect(prefs).toContainEqual(
        expect.objectContaining({
          category: 'framework',
          value: 'react',
          confidence: expect.any(Number)
        })
      )
    })

    it('detects style preferences', () => {
      const prefs = extractUserPreferences('user1', 'I prefer concise answers')
      expect(prefs).toContainEqual(
        expect.objectContaining({
          category: 'style',
          value: 'concise',
          confidence: expect.any(Number)
        })
      )
    })

    it('detects multiple preferences', () => {
      const prefs = extractUserPreferences(
        'user1',
        'I use Python with Django and prefer concise explanations'
      )
      expect(prefs.length).toBeGreaterThanOrEqual(2)
    })

    it('handles case insensitivity', () => {
      const prefsLower = extractUserPreferences('user1', 'i like python')
      const prefsUpper = extractUserPreferences('user2', 'I LIKE PYTHON')

      expect(prefsLower).toHaveLength(1)
      expect(prefsUpper).toHaveLength(1)
      expect(prefsLower[0].value).toBe(prefsUpper[0].value)
    })

    it('avoids duplicate preferences in single extraction', () => {
      const prefs = extractUserPreferences(
        'user1',
        'Python is great. I use Python every day. Python and more Python.'
      )
      const pythonPrefs = prefs.filter(p => p.value === 'python')
      expect(pythonPrefs).toHaveLength(1)
    })

    it('detects testing framework preferences', () => {
      const prefs = extractUserPreferences('user1', 'I use Jest for testing')
      expect(prefs).toContainEqual(
        expect.objectContaining({
          category: 'testing',
          value: 'jest'
        })
      )
    })

    it('returns empty array for no matches', () => {
      const prefs = extractUserPreferences('user1', 'Hello, how are you today?')
      expect(prefs).toHaveLength(0)
    })
  })

  describe('formatUserPreferences', () => {
    it('returns empty string for user with no preferences', () => {
      const formatted = formatUserPreferences('newuser')
      expect(formatted).toBe('')
    })

    it('formats preferences as markdown', () => {
      extractUserPreferences('user1', 'I use Python and React with concise style')

      const formatted = formatUserPreferences('user1')
      expect(formatted).toContain('## User Preferences')
      expect(formatted).toContain('language')
      expect(formatted).toContain('framework')
      expect(formatted).toContain('confidence')
    })

    it('includes only categories with preferences', () => {
      extractUserPreferences('user1', 'Python is my language')

      const formatted = formatUserPreferences('user1')
      expect(formatted).toContain('language')
      expect(formatted).not.toContain('framework')
    })

    it('limits to top 3 preferences per category', () => {
      for (let i = 0; i < 5; i++) {
        extractUserPreferences('user1', `language${i}`)
      }

      const formatted = formatUserPreferences('user1')
      // Should have max 3 per category
      const languageMatches = (formatted.match(/language/g) || []).length
      expect(languageMatches).toBeLessThanOrEqual(5) // Header + max 3
    })
  })

  describe('getPreferenceContext', () => {
    it('returns empty string for new user', () => {
      const context = getPreferenceContext('newuser')
      expect(context).toBe('')
    })

    it('returns formatted preferences for existing user', () => {
      extractUserPreferences('user1', 'I use Python and React')

      const context = getPreferenceContext('user1')
      expect(context).toContain('User Preferences')
    })

    it('includes confidence percentages', () => {
      extractUserPreferences('user1', 'I prefer Python')

      const context = getPreferenceContext('user1')
      expect(context).toMatch(/confidence: \d+%/)
    })
  })
})
