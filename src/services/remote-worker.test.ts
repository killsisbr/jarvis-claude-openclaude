import { describe, it, expect, mock } from 'bun:test'
import { callRemoteWorker, testRemoteWorker } from './remote-worker'

describe('remote-worker service', () => {
  const mockConfig = {
    url: 'http://localhost:3000',
    apiKey: 'sk-test-123'
  }

  it('formats URL correctly (strips trailing slash)', async () => {
    const configWithSlash = {
      url: 'http://localhost:3000/',
      apiKey: 'sk-test-123'
    }

    // Mock fetch to capture the URL
    const originalFetch = global.fetch
    let capturedUrl = ''
    global.fetch = mock(async (url: string) => {
      capturedUrl = url
      return {
        ok: true,
        json: async () => ({
          session: 'test-session',
          reply: 'test response',
          cost: 0.01,
          model: 'claude',
          tokens: { input: 10, output: 5 },
          latency_ms: 100,
          category: 'general'
        })
      } as any
    })

    try {
      await callRemoteWorker(configWithSlash, 'user1', 'test message')
      expect(capturedUrl).toBe('http://localhost:3000/api/chat')
    } finally {
      global.fetch = originalFetch
    }
  })

  it('includes authorization header when apiKey provided', async () => {
    const originalFetch = global.fetch
    let capturedHeaders: any = {}

    global.fetch = mock(async (url: string, options: any) => {
      capturedHeaders = options.headers
      return {
        ok: true,
        json: async () => ({
          session: 'test',
          reply: 'test',
          cost: 0.01,
          model: 'claude',
          tokens: { input: 10, output: 5 },
          latency_ms: 100,
          category: 'general'
        })
      } as any
    })

    try {
      await callRemoteWorker(mockConfig, 'user1', 'test')
      expect(capturedHeaders['Authorization']).toBe('Bearer sk-test-123')
    } finally {
      global.fetch = originalFetch
    }
  })

  it('omits authorization header when no apiKey', async () => {
    const configNoKey = { url: 'http://localhost:3000' }
    const originalFetch = global.fetch
    let capturedHeaders: any = {}

    global.fetch = mock(async (url: string, options: any) => {
      capturedHeaders = options.headers
      return {
        ok: true,
        json: async () => ({
          session: 'test',
          reply: 'test',
          cost: 0.01,
          model: 'claude',
          tokens: { input: 10, output: 5 },
          latency_ms: 100,
          category: 'general'
        })
      } as any
    })

    try {
      await callRemoteWorker(configNoKey, 'user1', 'test')
      expect(capturedHeaders['Authorization']).toBeUndefined()
    } finally {
      global.fetch = originalFetch
    }
  })

  it('sends correct request body', async () => {
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
          model: 'claude',
          tokens: { input: 10, output: 5 },
          latency_ms: 100,
          category: 'general'
        })
      } as any
    })

    try {
      await callRemoteWorker(mockConfig, 'user123', 'hello world')
      const body = JSON.parse(capturedBody)
      expect(body.user).toBe('user123')
      expect(body.message).toBe('hello world')
    } finally {
      global.fetch = originalFetch
    }
  })

  it('throws error on non-ok response', async () => {
    const originalFetch = global.fetch

    global.fetch = mock(async () => {
      return {
        ok: false,
        status: 401,
        text: async () => 'Unauthorized'
      } as any
    })

    try {
      await expect(callRemoteWorker(mockConfig, 'user1', 'test')).rejects.toThrow()
    } finally {
      global.fetch = originalFetch
    }
  })

  it('testRemoteWorker returns true for healthy server', async () => {
    const originalFetch = global.fetch

    global.fetch = mock(async (url: string) => {
      expect(url).toBe('http://localhost:3000/health')
      return { ok: true } as any
    })

    try {
      const healthy = await testRemoteWorker(mockConfig)
      expect(healthy).toBe(true)
    } finally {
      global.fetch = originalFetch
    }
  })

  it('testRemoteWorker returns false for unhealthy server', async () => {
    const originalFetch = global.fetch

    global.fetch = mock(async () => {
      return { ok: false } as any
    })

    try {
      const healthy = await testRemoteWorker(mockConfig)
      expect(healthy).toBe(false)
    } finally {
      global.fetch = originalFetch
    }
  })

  it('testRemoteWorker returns false on connection error', async () => {
    const originalFetch = global.fetch

    global.fetch = mock(async () => {
      throw new Error('Connection refused')
    })

    try {
      const healthy = await testRemoteWorker(mockConfig)
      expect(healthy).toBe(false)
    } finally {
      global.fetch = originalFetch
    }
  })
})
