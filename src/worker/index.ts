/**
 * JARVIS Worker — entrypoint.
 *
 * Carrega configuração do ambiente, inicializa JarvisWorker e Express.
 *
 * Uso:
 *   bun run src/worker/index.ts
 *
 * Variáveis de ambiente:
 *   OPENAI_BASE_URL     → provider de fallback (obrigatório)
 *   OPENAI_API_KEY      → API key do fallback (obrigatório)
 *   OPENAI_MODEL        → modelo de fallback (default: deepseek-chat)
 *   WORKER_PORT         → porta HTTP (default: 3000)
 *   JARVIS_SYSTEM_PROMPT → system prompt customizado (opcional)
 */

import { JarvisWorker, type WorkerConfig } from './worker-core.ts'
import { createServer } from './server.ts'

function loadConfig(): WorkerConfig {
  const baseURL = process.env['OPENAI_BASE_URL']
  const apiKey = process.env['OPENAI_API_KEY']
  const model = process.env['OPENAI_MODEL'] ?? 'deepseek-chat'

  if (!baseURL) {
    console.error('[worker] OPENAI_BASE_URL não definida. Configure o provider de fallback.')
    process.exit(1)
  }
  if (!apiKey) {
    console.error('[worker] OPENAI_API_KEY não definida.')
    process.exit(1)
  }

  const config: WorkerConfig = {
    fallback: { baseURL, apiKey, model },
    systemPrompt: process.env['JARVIS_SYSTEM_PROMPT'],
    smartRouting: null,   // Fase 2: carregar de settings.json
    agentModels: null,    // Fase 2: carregar de settings.json
  }

  return config
}

async function main() {
  console.log('[worker] Iniciando JARVIS Worker v5...')

  const config = loadConfig()
  const worker = new JarvisWorker(config)
  const app = createServer(worker)

  const port = parseInt(process.env['WORKER_PORT'] ?? '3000', 10)

  app.listen(port, () => {
    console.log(`[worker] Rodando em http://localhost:${port}`)
    console.log(`[worker] Provider: ${config.fallback.baseURL} | Modelo: ${config.fallback.model}`)
    console.log('[worker] Rotas:')
    console.log(`  GET  http://localhost:${port}/health`)
    console.log(`  POST http://localhost:${port}/api/chat`)
    console.log(`  GET  http://localhost:${port}/api/cost`)
    console.log(`  GET  http://localhost:${port}/api/keys`)
  })

  // Graceful shutdown
  const shutdown = () => {
    console.log('\n[worker] Encerrando...')
    process.exit(0)
  }
  process.on('SIGINT', shutdown)
  process.on('SIGTERM', shutdown)
}

main().catch((err) => {
  console.error('[worker] Falha fatal:', err)
  process.exit(1)
})
