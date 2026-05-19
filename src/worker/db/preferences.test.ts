import { describe, it, expect, beforeEach, afterEach } from 'bun:test'
import {
  setUserPreference,
  getUserPreferences,
  getTopPreferences,
  recordPreferenceObservation,
  clearUserPreferences
} from './preferences'
import { getDatabase, closeDatabase } from './schema'

describe('preferences management', () => {
  beforeEach(() => {
    getDatabase()
  })

  afterEach(() => {
    closeDatabase()
  })

  it('sets a new preference', () => {
    setUserPreference('user1', 'language', 'Python', 0.8)

    const prefs = getUserPreferences('user1', 'language')
    expect(prefs).toHaveLength(1)
    expect(prefs[0].value).toBe('Python')
    expect(prefs[0].confidence).toBe(0.8)
    expect(prefs[0].observedCount).toBe(1)
  })

  it('updates existing preference confidence', () => {
    setUserPreference('user1', 'language', 'Python', 0.6)
    setUserPreference('user1', 'language', 'Python', 0.8)

    const prefs = getUserPreferences('user1', 'language')
    expect(prefs).toHaveLength(1)
    expect(prefs[0].confidence).toBeGreaterThan(0.6)
    expect(prefs[0].observedCount).toBe(2)
  })

  it('increments observed count on duplicate set', () => {
    setUserPreference('user1', 'framework', 'React')
    setUserPreference('user1', 'framework', 'React')
    setUserPreference('user1', 'framework', 'React')

    const prefs = getUserPreferences('user1', 'framework')
    expect(prefs[0].observedCount).toBe(3)
  })

  it('returns preferences ordered by confidence', () => {
    setUserPreference('user1', 'language', 'Python', 0.5)
    setUserPreference('user1', 'language', 'JavaScript', 0.9)
    setUserPreference('user1', 'language', 'Rust', 0.7)

    const prefs = getUserPreferences('user1', 'language')
    expect(prefs[0].value).toBe('JavaScript')
    expect(prefs[1].value).toBe('Rust')
    expect(prefs[2].value).toBe('Python')
  })

  it('gets top preferences by limit', () => {
    for (let i = 0; i < 10; i++) {
      setUserPreference('user1', 'language', `lang${i}`, 0.5)
    }

    const top3 = getTopPreferences('user1', 'language', 3)
    expect(top3).toHaveLength(3)
  })

  it('records preference observation boost', () => {
    setUserPreference('user1', 'style', 'concise', 0.5)

    const before = getUserPreferences('user1', 'style')[0]
    const beforeConfidence = before.confidence

    recordPreferenceObservation('user1', 'style', 'concise', 0.2)

    const after = getUserPreferences('user1', 'style')[0]
    expect(after.confidence).toBeGreaterThan(beforeConfidence)
    expect(after.observedCount).toBe(2)
  })

  it('clears all preferences for a user', () => {
    setUserPreference('user1', 'language', 'Python')
    setUserPreference('user1', 'framework', 'Django')

    clearUserPreferences('user1')

    const prefs = getUserPreferences('user1')
    expect(prefs).toHaveLength(0)
  })

  it('maintains separate preferences per user', () => {
    setUserPreference('user1', 'language', 'Python')
    setUserPreference('user2', 'language', 'JavaScript')

    const prefs1 = getUserPreferences('user1', 'language')
    const prefs2 = getUserPreferences('user2', 'language')

    expect(prefs1[0].value).toBe('Python')
    expect(prefs2[0].value).toBe('JavaScript')
  })

  it('caps confidence at 1.0', () => {
    setUserPreference('user1', 'language', 'Rust', 0.9)
    setUserPreference('user1', 'language', 'Rust', 0.9)
    setUserPreference('user1', 'language', 'Rust', 0.9)

    const pref = getUserPreferences('user1', 'language')[0]
    expect(pref.confidence).toBeLessThanOrEqual(1.0)
  })
})
