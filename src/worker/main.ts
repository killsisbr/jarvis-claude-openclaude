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
import { MessageDispatcher } from './dispatcher.ts'
import { closeDatabase } from './db/schema.ts'

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

    // Criar e inicializar Message Dispatcher (WhatsApp)
    console.log('[startup] Inicializando Message Dispatcher (WhatsApp)...')
    const dispatcher = new MessageDispatcher(worker)
    await dispatcher.initialize()
    console.log('[startup] ✓ Message Dispatcher pronto')

    // Load Fase 7 skills
    console.log('[startup] Carregando Skill Registry (Fase 7)...')
    await dispatcher.skillRegistry.loadSkills('src/worker/skills')
    const loadedSkills = dispatcher.skillRegistry.list()
    console.log(`[startup] ✓ ${loadedSkills.length} skills carregadas`)

    // Execute skill onStartup hooks
    for (const skill of loadedSkills) {
      if (skill.onStartup) {
        try {
          await skill.onStartup()
        } catch (err) {
          console.error(`[startup] Erro ao inicializar skill ${skill.name}:`, err)
        }
      }
    }

    // Setup dispatcher listeners para logs
    dispatcher.on('session_created', (data) => {
      console.log(`[whatsapp] Nova sessão: ${data.userName} (${data.userId})`)
    })
    dispatcher.on('dispatch_complete', async (event) => {
      console.log(
        `[whatsapp] ${event.userId}: intent=${event.intent}, tokens=${event.tokens}, cost=$${event.cost.toFixed(4)}, latency=${event.duration}ms`
      )

      // Execute skill onMessage hooks (Fase 7)
      for (const skill of dispatcher.skillRegistry.list()) {
        if (skill.onMessage) {
          try {
            await skill.onMessage({
              userId: event.userId,
              text: event.originalText,
              intent: event.intent,
              sessionId: event.messageId,
            })
          } catch (err) {
            console.error(`[skill] Erro em onMessage para ${skill.name}:`, err)
          }
        }
      }
    })
    dispatcher.on('dispatch_error', (error) => {
      console.error(`[whatsapp] Erro ao processar ${error.userId}: ${error.error}`)
    })
    dispatcher.on('connected', () => {
      console.log('[whatsapp] ✓ Conectado ao WhatsApp')
    })
    dispatcher.on('disconnected', () => {
      console.error('[whatsapp] ✗ Desconectado do WhatsApp')
    })

    // Setup sentinel listeners (Fase 6)
    dispatcher.eventBus.on('sentinel_alert', (alert) => {
      console.log(`[sentinel] ALERTA: ${alert.message}`)
      // In future: send WhatsApp notification to admin
    })

    dispatcher.eventBus.on('job_error', (event) => {
      console.error(`[cron] Job "${event.name}" falhou: ${event.error}`)
    })

    // Criar Express app
    console.log('[startup] Iniciando Express server...')
    const app = createServer(worker, dispatcher)
    const port = parseInt(process.env['WORKER_PORT'] ?? '3000', 10)

    // Listen
    const server = app.listen(port, () => {
      // Initialize Fase 6 sentinels
      console.log('[startup] Inicializando sentinelas (Fase 6)...')
      dispatcher.sentinels.registerAll()
      console.log('[startup] ✓ 5 sentinelas registradas')

      console.log(`[startup] ✓ Servidor rodando em http://localhost:${port}`)
      console.log('')
      console.log('Rotas disponíveis:')
      console.log(`  GET  http://localhost:${port}/health              → status do worker`)
      console.log(`  POST http://localhost:${port}/api/chat            → enviar mensagem`)
      console.log(`  GET  http://localhost:${port}/api/cost            → custo + estatísticas`)
      console.log(`  GET  http://localhost:${port}/api/keys            → status dos pools`)
      console.log(`  GET  http://localhost:${port}/api/whatsapp/status → WhatsApp status`)
      console.log(`  GET  http://localhost:${port}/api/whatsapp/qr     → QR code info`)
      console.log(`  GET  http://localhost:${port}/api/cron            → cron jobs status`)
      console.log('')
      console.log('[startup] Pressione Ctrl+C para encerrar')
      console.log('')
    })

    // Graceful shutdown
    const shutdown = async (signal: string) => {
      console.log(`\n[shutdown] Recebido ${signal}. Encerrando gracefully...`)

      try {
        console.log('[shutdown] Encerrando skills (Fase 7)...')
        for (const skill of dispatcher.skillRegistry.list()) {
          if (skill.onShutdown) {
            try {
              await skill.onShutdown()
            } catch (err) {
              console.error(`[shutdown] Erro ao desligar skill ${skill.name}:`, err)
            }
          }
        }
        console.log('[shutdown] ✓ Skills desligadas')
      } catch (err) {
        console.error('[shutdown] Erro ao encerrar skills:', err)
      }

      try {
        console.log('[shutdown] Encerrando Message Dispatcher...')
        await dispatcher.shutdown()
        console.log('[shutdown] ✓ Message Dispatcher encerrado')
      } catch (err) {
        console.error('[shutdown] Erro ao encerrar dispatcher:', err)
      }

      try {
        console.log('[shutdown] Fechando banco de dados...')
        closeDatabase()
        console.log('[shutdown] ✓ Banco de dados fechado')
      } catch (err) {
        console.error('[shutdown] Erro ao fechar banco de dados:', err)
      }

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
