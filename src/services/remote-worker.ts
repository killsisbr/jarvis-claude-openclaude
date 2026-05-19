/**
 * Remote Worker Client
 *
 * Permite que o CLI se conecte a um JARVIS Worker remoto na VPS.
 * Transparente ao resto do código - processa prompts via HTTP.
 */

export interface RemoteWorkerConfig {
  url: string
  apiKey?: string
}

export interface RemoteWorkerResponse {
  session: string
  reply: string
  cost: number
  model: string
  tokens: { input: number; output: number }
  latency_ms: number
  category: string
}

/**
 * Chama o worker remoto via HTTP.
 * Throws se houver erro de conexão ou resposta inválida.
 */
export async function callRemoteWorker(
  config: RemoteWorkerConfig,
  userId: string,
  message: string
): Promise<RemoteWorkerResponse> {
  const url = `${config.url.replace(/\/$/, '')}/api/chat`

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  }

  if (config.apiKey) {
    headers['Authorization'] = `Bearer ${config.apiKey}`
  }

  const response = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      user: userId,
      message,
    }),
  })

  if (!response.ok) {
    const text = await response.text()
    throw new Error(`Remote worker error ${response.status}: ${text.slice(0, 200)}`)
  }

  const data = (await response.json()) as RemoteWorkerResponse
  return data
}

/**
 * Testa a conexão com o worker remoto.
 */
export async function testRemoteWorker(config: RemoteWorkerConfig): Promise<boolean> {
  try {
    const url = `${config.url.replace(/\/$/, '')}/health`
    const response = await fetch(url)
    return response.ok
  } catch {
    return false
  }
}
