import { describe, it, expect, mock } from 'bun:test'
import { executeQuery, testRemoteWorkerConnection } from './queryEngineWrapper'
import type { RemoteWorkerConfig } from '../config/remoteWorkerConfig'

describe('queryEngineWrapper', () => {
  const mockLocalExecutor = async () => ({
    reply: 'Local response',
    model: 'local-model',
    tokens: { input: 10, output: 20 },
    cost: 0.01,
    latency_ms: 500,
    source: 'local' as const
  })

  const mockRemoteConfig: RemoteWorkerConfig = {
    url: 'http://localhost:3000',
    apiKey: 'sk-test-key',
    enabled: true
  }

  describe('executeQuery', () => {
    it('routes to remote worker when configured', async () => {
      const originalFetch = global.fetch
      global.fetch = mock(async () => ({
        ok: true,
        json: async () => ({
          session: 'test',
          reply: 'Remote response',
          cost: 0.02,
          model: 'claude',
          tokens: { input: 100, output: 200 },
          latency_ms: 1000,
          category: 'general'
        })
      } as any))

      try {
        const response = await executeQuery(
          { userId: 'user1', message: 'test' },
          mockRemoteConfig,
          mockLocalExecutor
        )

        expect(response.source).toBe('remote')
        expect(response.reply).toBe('Remote response')
        expect(response.model).toBe('claude')
      } finally {
        global.fetch = originalFetch
      }
    })

    it('falls back to local on remote error', async () => {
      const originalFetch = global.fetch
      global.fetch = mock(async () => {
        throw new Error('Connection refused')
      })

      try {
        const response = await executeQuery(
          { userId: 'user1', message: 'test' },
          mockRemoteConfig,
          mockLocalExecutor
        )

        expect(response.source).toBe('local')
        expect(response.reply).toBe('Local response')
      } finally {
        global.fetch = originalFetch
      }
    })

    it('uses local executor when no remote configured', async () => {
      const response = await executeQuery(
        { userId: 'user1', message: 'test' },
        null,
        mockLocalExecutor
      )

      expect(response.source).toBe('local')
      expect(response.reply).toBe('Local response')
    })

    it('throws error when no executor available', async () => {
      try {
        await executeQuery(
          { userId: 'user1', message: 'test' },
          null,
          undefined
        )
        expect.unreachable()
      } catch (error: any) {
        expect(error.message).toContain('No query executor configured')
      }
    })

    it('passes request metadata correctly', async () => {
      const originalFetch = global.fetch
      let capturedBody = ''

      global.fetch = mock(async (url: string, options: any) => {
        capturedBody = options.body
        return {
          ok: true,
          json: async () => ({
            session: 'test',
            reply: 'test',
            cost: 0.01,
            model: 'test',
            tokens: { input: 1, output: 1 },
            latency_ms: 100,
            category: 'test'
          })
        } as any
      })

      try {
        await executeQuery(
          {
            userId: 'user123',
            message: 'hello world',
            model: 'custom-model'
          },
          mockRemoteConfig,
          mockLocalExecutor
        )

        const body = JSON.parse(capturedBody)
        expect(body.user).toBe('user123')
        expect(body.message).toBe('hello world')
      } finally {
        global.fetch = originalFetch
      }
    })
  })

  describe('testRemoteWorkerConnection', () => {
    it('returns healthy status for working server', async () => {
      const originalFetch = global.fetch
      global.fetch = mock(async () => ({
        ok: true
      } as any))

      try {
        const result = await testRemoteWorkerConnection(mockRemoteConfig)
        expect(result.healthy).toBe(true)
        expect(result.latency_ms).toBeGreaterThan(0)
        expect(result.error).toBeUndefined()
      } finally {
        global.fetch = originalFetch
      }
    })

    it('returns unhealthy status for failing server', async () => {
      const originalFetch = global.fetch
      global.fetch = mock(async () => ({
        ok: false,
        status: 500
      } as any))

      try {
        const result = await testRemoteWorkerConnection(mockRemoteConfig)
        expect(result.healthy).toBe(false)
        expect(result.error).toContain('500')
      } finally {
        global.fetch = originalFetch
      }
    })

    it('returns unhealthy on connection error', async () => {
      const originalFetch = global.fetch
      global.fetch = mock(async () => {
        throw new Error('Connection timeout')
      })

      try {
        const result = await testRemoteWorkerConnection(mockRemoteConfig)
        expect(result.healthy).toBe(false)
        expect(result.error).toContain('Connection timeout')
      } finally {
        global.fetch = originalFetch
      }
    })

    it('returns error when no config', async () => {
      const result = await testRemoteWorkerConnection(null)
      expect(result.healthy).toBe(false)
      expect(result.error).toContain('No remote worker configured')
    })

    it('measures latency correctly', async () => {
      const originalFetch = global.fetch
      global.fetch = mock(async () => {
        await new Promise(r => setTimeout(r, 10))
        return { ok: true } as any
      })

      try {
        const result = await testRemoteWorkerConnection(mockRemoteConfig)
        expect(result.latency_ms).toBeGreaterThanOrEqual(10)
      } finally {
        global.fetch = originalFetch
      }
    })
  })
})
