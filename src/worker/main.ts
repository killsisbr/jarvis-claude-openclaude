/**
 * JARVIS Worker — entrypoint de produção.
 *
 * Carrega configuração completa, inicializa JarvisWorker + key pools,
 * e inicia servidor Express.
 *
 * Uso:
 *   bun run worker
 *   # ou direto
 *   bun run src/worker/main.ts
 *
 * Variáveis de ambiente (opcionais, fallback):
 *   OPENAI_BASE_URL     → provider de fallback
 *   OPENAI_API_KEY      → API key do fallback
 *   OPENAI_MODEL        → modelo de fallback
 *   WORKER_PORT         → porta HTTP (default: 3000)
 *   JARVIS_SYSTEM_PROMPT → system prompt customizado
 */

import { JarvisWorker } from './worker-core.ts'
import { createServer } from './server.ts'
import { loadConfig, logConfig } from './config.ts'

async function main() {
  console.log('')
  console.log('╔════════════════════════════════════════╗')
  console.log('║   JARVIS Worker v5.0.0 (Headless)     ║')
  console.log('║   Zero-Telemetry AI Coding Agent       ║')
  console.log('╚════════════════════════════════════════╝')
  console.log('')

  try {
    // Carregar configuração
    console.log('[startup] Carregando configuração...')
    const config = loadConfig()
    logConfig(config)
    console.log('')

    // Criar worker
    console.log('[startup] Inicializando JarvisWorker...')
    const worker = new JarvisWorker(config)
    console.log('[startup] ✓ JarvisWorker pronto')

    // Criar Express app
    console.log('[startup] Iniciando Express server...')
    const app = createServer(worker)
    const port = parseInt(process.env['WORKER_PORT'] ?? '3000', 10)

    // Listen
    const server = app.listen(port, () => {
      console.log(`[startup] ✓ Servidor rodando em http://localhost:${port}`)
      console.log('')
      console.log('Rotas disponíveis:')
      console.log(`  GET  http://localhost:${port}/health         → status do worker`)
      console.log(`  POST http://localhost:${port}/api/chat       → enviar mensagem`)
      console.log(`  GET  http://localhost:${port}/api/cost       → custo + estatísticas`)
      console.log(`  GET  http://localhost:${port}/api/keys       → status dos pools`)
      console.log('')
      console.log('[startup] Pressione Ctrl+C para encerrar')
      console.log('')
    })

    // Graceful shutdown
    const shutdown = (signal: string) => {
      console.log(`\n[shutdown] Recebido ${signal}. Encerrando gracefully...`)
      server.close(() => {
        console.log('[shutdown] ✓ Servidor encerrado')
        process.exit(0)
      })

      // Timeout: força saída após 10 segundos
      setTimeout(() => {
        console.error('[shutdown] Timeout: forçando saída')
        process.exit(1)
      }, 10_000)
    }

    process.on('SIGINT', () => shutdown('SIGINT'))
    process.on('SIGTERM', () => shutdown('SIGTERM'))

    // Uncaught exception handler
    process.on('uncaughtException', (err) => {
      console.error('[fatal] Uncaught exception:', err)
      process.exit(1)
    })

    process.on('unhandledRejection', (reason) => {
      console.error('[fatal] Unhandled rejection:', reason)
      process.exit(1)
    })
  } catch (err) {
    console.error('[fatal] Falha ao iniciar:', err instanceof Error ? err.message : String(err))
    if (err instanceof Error && err.stack) {
      console.error(err.stack)
    }
    process.exit(1)
  }
}

main()
