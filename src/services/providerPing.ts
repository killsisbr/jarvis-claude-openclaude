import https from 'node:https'
import http from 'node:http'

export interface PingResult {
  routeId: string
  label: string
  online: boolean
  latencyMs: number
  model: string
  error?: string
}

interface ProviderDef {
  routeId: string
  label: string
  envKey: string
  baseUrl: string
  modelsPath: string
  defaultModel: string
}

const PROVIDERS: ProviderDef[] = [
  {
    routeId: 'nvidia-nim',
    label: 'NVIDIA NIM',
    envKey: 'NVIDIA_API_KEY',
    baseUrl: 'https://integrate.api.nvidia.com/v1',
    modelsPath: '/models',
    defaultModel: 'qwen/qwen3-coder-480b-a35b-instruct',
  },
  {
    routeId: 'nvidia-flash',
    label: 'NVIDIA Flash (DeepSeek)',
    envKey: 'NVIDIA_API_KEY',
    baseUrl: 'https://integrate.api.nvidia.com/v1',
    modelsPath: '/models',
    defaultModel: 'deepseek-ai/deepseek-v4-flash',
  },
  {
    routeId: 'zen',
    label: 'Zen (Code.ORG)',
    envKey: 'ZEN_API_KEY_1',
    baseUrl: 'https://api.zen.com/v1',
    modelsPath: '/models',
    defaultModel: 'zen-3.5-70b',
  },
  {
    routeId: 'groq',
    label: 'Groq',
    envKey: 'GROQ_API_KEY',
    baseUrl: 'https://api.groq.com/openai/v1',
    modelsPath: '/models',
    defaultModel: 'llama-3.3-70b-versatile',
  },
  {
    routeId: 'deepseek',
    label: 'DeepSeek',
    envKey: 'DEEPSEEK_API_KEY',
    baseUrl: 'https://api.deepseek.com/v1',
    modelsPath: '/models',
    defaultModel: 'deepseek-chat',
  },
  {
    routeId: 'ollama',
    label: 'Ollama (local)',
    envKey: '', // no auth needed
    baseUrl: 'http://localhost:11434',
    modelsPath: '/api/tags',
    defaultModel: 'llama3',
  },
]

function pingUrl(url: string, apiKey?: string, timeoutMs = 5000): Promise<{ ok: boolean; ms: number }> {
  return new Promise(resolve => {
    const t0 = Date.now()
    const isHttps = url.startsWith('https')
    const mod = isHttps ? https : http

    const req = mod.get(url, { headers: apiKey ? { Authorization: `Bearer ${apiKey}` } : {}, timeout: timeoutMs }, res => {
      const ms = Date.now() - t0
      // Consume response to free memory
      res.resume()
      res.on('end', () => resolve({ ok: res.statusCode! >= 200 && res.statusCode! < 400, ms }))
    })
    req.on('timeout', () => { req.destroy(); resolve({ ok: false, ms: timeoutMs }) })
    req.on('error', () => resolve({ ok: false, ms: Date.now() - t0 }))
  })
}

export async function pingProvider(routeId: string, env: NodeJS.ProcessEnv = process.env): Promise<PingResult | null> {
  const def = PROVIDERS.find(p => p.routeId === routeId)
  if (!def) return null

  // Check if key exists (if required)
  if (def.envKey && !env[def.envKey]?.trim()) {
    return { routeId: def.routeId, label: def.label, online: false, latencyMs: 0, model: def.defaultModel, error: 'No API key' }
  }

  const url = def.baseUrl.replace(/\/+$/, '') + def.modelsPath
  const apiKey = def.envKey ? env[def.envKey]?.trim() : undefined

  const result = await pingUrl(url, apiKey)
  return {
    routeId: def.routeId,
    label: def.label,
    online: result.ok,
    latencyMs: result.ms,
    model: def.defaultModel,
    error: result.ok ? undefined : `HTTP error / timeout`,
  }
}

export async function pingAllProviders(env: NodeJS.ProcessEnv = process.env): Promise<PingResult[]> {
  const results: PingResult[] = []
  for (const def of PROVIDERS) {
    const r = await pingProvider(def.routeId, env)
    if (r) results.push(r)
  }
  return results
}
