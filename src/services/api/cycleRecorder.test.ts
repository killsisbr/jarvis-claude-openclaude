import { describe, test, expect, beforeEach, afterEach } from 'bun:test'
import { readFileSync, rmSync, existsSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import {
  initCycleRecorder,
  recordCycle,
  startCycleRecord,
  completeCycleRecord,
  maskKey,
  getCycleLogPath,
  _resetForTest,
  type CycleRecord,
} from './cycleRecorder.ts'

let testDir: string

beforeEach(() => {
  _resetForTest()
  testDir = join(tmpdir(), `cycle-recorder-test-${Date.now()}-${Math.random().toString(36).slice(2)}`)
  mkdirSync(testDir, { recursive: true })
})

afterEach(() => {
  _resetForTest()
  try {
    rmSync(testDir, { recursive: true, force: true })
  } catch {
    // ignore cleanup errors on Windows
  }
})

describe('maskKey', () => {
  test('masks standard API key', () => {
    expect(maskKey('sk-abcdef1234567890')).toBe('sk-a...7890')
  })

  test('short key returns ***', () => {
    expect(maskKey('short')).toBe('***')
  })

  test('empty string returns empty', () => {
    expect(maskKey('')).toBe('')
  })

  test('exactly 8 chars masks correctly', () => {
    expect(maskKey('12345678')).toBe('1234...5678')
  })
})

describe('initCycleRecorder', () => {
  test('creates log directory and sets path', () => {
    const dir = join(testDir, 'sub', 'dir')
    initCycleRecorder(dir)
    expect(getCycleLogPath()).toBe(join(dir, 'routing-cycles.jsonl'))
    expect(existsSync(dir)).toBe(true)
  })

  test('idempotent — second call does not change path', () => {
    initCycleRecorder(testDir)
    const first = getCycleLogPath()
    initCycleRecorder(join(testDir, 'other'))
    expect(getCycleLogPath()).toBe(first)
  })
})

describe('recordCycle', () => {
  test('appends JSONL line', () => {
    initCycleRecorder(testDir)
    const record: CycleRecord = {
      ts: '2026-01-01T00:00:00.000Z',
      turn: 1,
      category: 'simple',
      target: 'ollama-local:qwen2.5:7b',
      reason: 'short (5 chars, 1 words)',
      baseURL: 'http://localhost:11434/v1',
      maskedKey: '',
      outcome: 'success',
      latencyMs: 120,
      tokens: 50,
    }
    recordCycle(record)
    const content = readFileSync(getCycleLogPath()!, 'utf-8')
    const parsed = JSON.parse(content.trim())
    expect(parsed.category).toBe('simple')
    expect(parsed.tokens).toBe(50)
  })

  test('multiple records produce multiple lines', () => {
    initCycleRecorder(testDir)
    recordCycle({
      ts: 'a', turn: 1, category: 'simple', target: 't', reason: 'r',
      baseURL: 'u', maskedKey: '', outcome: 'success', latencyMs: 10,
    })
    recordCycle({
      ts: 'b', turn: 2, category: 'strong', target: 't2', reason: 'r2',
      baseURL: 'u', maskedKey: '', outcome: 'success', latencyMs: 20,
    })
    const lines = readFileSync(getCycleLogPath()!, 'utf-8').trim().split('\n')
    expect(lines.length).toBe(2)
    expect(JSON.parse(lines[0]!).turn).toBe(1)
    expect(JSON.parse(lines[1]!).turn).toBe(2)
  })

  test('no-op when uninitialized', () => {
    // Should not throw
    recordCycle({
      ts: 'x', turn: 1, category: 'simple', target: 't', reason: 'r',
      baseURL: 'u', maskedKey: '', outcome: 'success', latencyMs: 0,
    })
  })
})

describe('startCycleRecord + completeCycleRecord', () => {
  test('creates pending record then finalizes with success', () => {
    initCycleRecorder(testDir)
    const rec = startCycleRecord({
      turn: 3,
      category: 'code',
      target: 'nvidia-nim:deepseek-coder-v2',
      reason: 'contains code block',
      baseURL: 'https://integrate.api.nvidia.com/v1',
      apiKey: 'nvapi-abcdefgh12345678',
    })
    expect(rec.outcome).toBe('pending')
    expect(rec.maskedKey).toBe('nvap...5678')
    expect(rec.turn).toBe(3)

    completeCycleRecord(rec, {
      kind: 'success',
      latencyMs: 450,
      tokens: 1200,
      inputTokens: 800,
      outputTokens: 400,
    })
    expect(rec.outcome).toBe('success')
    expect(rec.latencyMs).toBe(450)
    expect(rec.tokens).toBe(1200)

    // Verify it was written
    const content = readFileSync(getCycleLogPath()!, 'utf-8').trim()
    const parsed = JSON.parse(content)
    expect(parsed.outcome).toBe('success')
    expect(parsed.inputTokens).toBe(800)
  })

  test('finalizes with rate_limit', () => {
    initCycleRecorder(testDir)
    const rec = startCycleRecord({
      turn: 1,
      category: 'strong',
      target: 'zen-pool:claude-sonnet-4',
      reason: 'first turn',
      baseURL: 'https://opencode.ai/zen/v1',
      apiKey: 'sk-z1',
    })
    completeCycleRecord(rec, {
      kind: 'rate_limit',
      latencyMs: 50,
    })
    const parsed = JSON.parse(readFileSync(getCycleLogPath()!, 'utf-8').trim())
    expect(parsed.outcome).toBe('rate_limit')
  })

  test('finalizes with error and message', () => {
    initCycleRecorder(testDir)
    const rec = startCycleRecord({
      turn: 2,
      category: 'reasoning',
      target: 'zen-pool:claude-sonnet-4-thinking',
      reason: 'reasoning keyword',
      baseURL: 'https://opencode.ai/zen/v1',
      apiKey: 'sk-z2',
    })
    completeCycleRecord(rec, {
      kind: 'error',
      latencyMs: 100,
      errorMsg: 'connection refused',
    })
    const parsed = JSON.parse(readFileSync(getCycleLogPath()!, 'utf-8').trim())
    expect(parsed.outcome).toBe('error')
    expect(parsed.errorMsg).toBe('connection refused')
  })
})
