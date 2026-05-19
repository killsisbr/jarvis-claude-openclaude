import React, { useState, useEffect, useCallback } from 'react'
import { Box, Text, useInput } from '../../ink.js'
import type { LocalJSXCommandCall, LocalJSXCommandOnDone } from '../../types/command.js'
import { pingAllProviders, type PingResult } from '../../services/providerPing.js'

type Step = 'scanning' | 'mode-pick' | 'single-select' | 'chain-builder' | 'done'

function getBaseUrl(routeId: string): string {
  const map: Record<string, string> = {
    'nvidia-nim': 'https://integrate.api.nvidia.com/v1',
    'nvidia-flash': 'https://integrate.api.nvidia.com/v1',
    'zen': 'https://api.zen.com/v1',
    'groq': 'https://api.groq.com/openai/v1',
    'deepseek': 'https://api.deepseek.com/v1',
    'ollama': 'http://localhost:11434/v1',
  }
  return map[routeId] || ''
}

function getApiKey(routeId: string, env: NodeJS.ProcessEnv): string {
  const map: Record<string, string> = {
    'nvidia-nim': env.NVIDIA_API_KEY || '',
    'nvidia-flash': env.NVIDIA_API_KEY || '',
    'zen': env.ZEN_API_KEY_1 || '',
    'groq': env.GROQ_API_KEY || '',
    'deepseek': env.DEEPSEEK_API_KEY || '',
    'ollama': 'ollama',
  }
  return map[routeId] || ''
}

// ---- Ink components ----

function Spinner({ label }: { label: string }) {
  const [frame, setFrame] = useState(0)
  const frames = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏']
  useEffect(() => {
    const t = setInterval(() => setFrame(i => (i + 1) % frames.length), 80)
    return () => clearInterval(t)
  }, [])
  return <Text>{frames[frame]} {label}</Text>
}

function PingRow({ result }: { result: PingResult }) {
  const status = result.error
    ? <Text color="red">✗ {result.error}</Text>
    : result.online
      ? <Text color="green">✓ {result.latencyMs}ms</Text>
      : <Text color="yellow">✗ offline</Text>

  return (
    <Box>
      <Text bold>{result.label.padEnd(22)} </Text>
      <Text>{'  '}</Text>
      {status}
    </Box>
  )
}

function ScanningScreen({ results, done }: { results: PingResult[]; done: boolean }) {
  return (
    <Box flexDirection="column">
      <Text bold>Scanning providers...</Text>
      <Box marginY={1} flexDirection="column">
        {results.map((r, i) => (
          <PingRow key={r.routeId} result={r} />
        ))}
        {!done && results.length > 0 && (
          <Box marginTop={1}>
            <Spinner label="Pinging..." />
          </Box>
        )}
      </Box>
    </Box>
  )
}

// ---- Main Rotate component ----

function RotateWizard({ onDone }: { onDone: LocalJSXCommandOnDone }) {
  const [step, setStep] = useState<Step>('scanning')
  const [results, setResults] = useState<PingResult[]>([])
  const [scanDone, setScanDone] = useState(false)
  const [cursor, setCursor] = useState(0)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [output, setOutput] = useState('')

  // Call onDone when step reaches 'done' (always-safe hook position)
  useEffect(() => {
    if (step !== 'done') return
    onDone(output, { display: 'system' })
  }, [step, output, onDone])

  // Scan providers on mount
  useEffect(() => {
    let cancelled = false
    let autoAdvance: ReturnType<typeof setTimeout> | undefined
    void (async () => {
      const res: PingResult[] = []
      const pings = await pingAllProviders(process.env)
      for (const r of pings) {
        if (cancelled) return
        res.push(r)
        setResults([...res])
      }
      if (!cancelled) {
        setScanDone(true)
        autoAdvance = setTimeout(() => { if (!cancelled) setStep('mode-pick') }, 500)
      }
    })()
    return () => {
      cancelled = true
      if (autoAdvance) clearTimeout(autoAdvance)
    }
  }, [])

  // Keyboard handler via Ink's useInput
  const handleInput = useCallback((input: string, key: { upArrow?: boolean; downArrow?: boolean; return?: boolean; escape?: boolean; ctrl?: boolean }) => {
    if (step === 'mode-pick') {
      if (input === '1') { setStep('single-select'); setCursor(0) }
      if (input === '2') { setStep('chain-builder'); setCursor(0); setSelected(new Set()) }
      return
    }
    if (step === 'single-select') {
      if (key.upArrow) setCursor(i => Math.max(0, i - 1))
      if (key.downArrow) setCursor(i => Math.min(results.length - 1, i + 1))
      if (key.return) {
        const picked = results[cursor]
        if (picked) {
          const routeId = picked.routeId
          process.env.CLAUDE_CODE_USE_OPENAI = '1'
          process.env.OPENAI_BASE_URL = getBaseUrl(routeId)
          process.env.OPENAI_API_KEY = getApiKey(routeId, process.env)
          process.env.OPENAI_MODEL = picked.model
          if (routeId === 'nvidia-nim') process.env.NVIDIA_NIM = '1'
          delete process.env.ROTATE_MODE
          setOutput(`Active: ${picked.label} (${picked.model})`)
          setStep('done')
        }
      }
      return
    }
    if (step === 'chain-builder') {
      if (key.upArrow) setCursor(i => Math.max(0, i - 1))
      if (key.downArrow) setCursor(i => Math.min(results.length - 1, i + 1))
      if (input === ' ') {
        const id = results[cursor]?.routeId
        if (id) {
          setSelected(prev => {
            const next = new Set(prev)
            if (next.has(id)) next.delete(id); else next.add(id)
            return next
          })
        }
      }
      if (key.return && selected.size > 0) {
        const ordered = results.filter(r => selected.has(r.routeId))
        const chain = ordered.map(r => r.routeId)
        process.env.ROTATE_MODE = '1'
        process.env.ROTATE_CHAIN = chain.join(',')
        process.env.CLAUDE_CODE_USE_OPENAI = '1'
        process.env.OPENAI_BASE_URL = 'http://localhost:9999/v1'
        process.env.OPENAI_API_KEY = 'placeholder'
        process.env.OPENAI_MODEL = 'gpt-4o-mini'
        delete process.env.NVIDIA_NIM
        setOutput(`RotateChain: ${ordered.map(r => r.label).join(' → ')}`)
        setStep('done')
      }
      return
    }
  }, [step, results, cursor, selected])

  useInput(handleInput)

  if (step === 'scanning') {
    return <ScanningScreen results={results} done={scanDone} />
  }

  if (step === 'mode-pick') {
    return (
      <Box flexDirection="column">
        <Text bold>How do you want to use providers?</Text>
        <Box marginY={1} flexDirection="column">
          <Text><Text color="cyan">  1</Text>  Provider único (choose one)</Text>
          <Text><Text color="cyan">  2</Text>  Chain failover (auto-rotate)</Text>
        </Box>
        <Text dimColor>Type 1 or 2</Text>
      </Box>
    )
  }

  if (step === 'single-select') {
    return (
      <Box flexDirection="column">
        <Text bold>Select a provider:</Text>
        <Box marginY={1} flexDirection="column">
          {results.map((r, i) => {
            const online = r.online ? <Text color="green">✓ {r.latencyMs}ms</Text> : <Text color="red">✗ offline</Text>
            const arrow = i === cursor ? <Text color="cyan">❯</Text> : <Text> </Text>
            return (
              <Box key={r.routeId}>
                <Text>{arrow} </Text>
                <Text bold={i === cursor}>{r.label.padEnd(22)}</Text>
                <Text>  </Text>
                {online}
              </Box>
            )
          })}
        </Box>
        <Text dimColor>↑↓ to move, Enter to select</Text>
      </Box>
    )
  }

  if (step === 'chain-builder') {
    const ordered = results.filter(r => selected.has(r.routeId))
    return (
      <Box flexDirection="column">
        <Text bold>Select providers for the chain (in order):</Text>
        <Box marginY={1} flexDirection="column">
          {results.map((r, i) => {
            const sel = selected.has(r.routeId) ? <Text color="green">☑</Text> : <Text color="gray">☐</Text>
            const arrow = i === cursor ? <Text color="cyan">❯</Text> : <Text> </Text>
            return (
              <Box key={r.routeId}>
                <Text>{arrow} {sel} </Text>
                <Text bold={i === cursor}>{r.label.padEnd(22)}</Text>
                <Text>  </Text>
                {r.online ? <Text color="green">✓ {r.latencyMs}ms</Text> : <Text color="red">✗ offline</Text>}
              </Box>
            )
          })}
        </Box>
        {ordered.length > 0 && (
          <Box flexDirection="column" marginTop={1}>
            <Text dimColor>Chain order: {ordered.map(r => r.label).join(' → ')}</Text>
          </Box>
        )}
        <Box marginTop={1}>
          <Text dimColor>Space to toggle, Enter to confirm</Text>
        </Box>
      </Box>
    )
  }

  if (step === 'done') {
    return (
      <Box flexDirection="column">
        <Text bold>{output}</Text>
      </Box>
    )
  }

  return null
}

export const call: LocalJSXCommandCall = (onDone, _context, _args) => {
  return Promise.resolve(<RotateWizard onDone={onDone} />)
}
