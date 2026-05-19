#!/usr/bin/env bun

/**
 * Remote JARVIS Worker CLI
 *
 * Uso:
 *   bun remote-cli.ts --url http://seu-dominio.com:3000 "sua mensagem aqui"
 *   bun remote-cli.ts --url http://vps.com:3000 --key sk-xyz "gera um form de login"
 *
 * Configuração persistente em ~/.jarvis/remote-worker-config.json
 */

import { readFileSync, writeFileSync, existsSync } from 'fs'
import { join } from 'path'
import { homedir } from 'os'

interface RemoteConfig {
  workerUrl: string
  apiKey?: string
}

const CONFIG_PATH = join(homedir(), '.jarvis', 'remote-worker-config.json')

function loadConfig(): RemoteConfig | null {
  if (!existsSync(CONFIG_PATH)) return null
  try {
    return JSON.parse(readFileSync(CONFIG_PATH, 'utf-8'))
  } catch {
    return null
  }
}

function saveConfig(config: RemoteConfig): void {
  const dir = join(homedir(), '.jarvis')
  if (!existsSync(dir)) {
    // @ts-ignore
    Bun.file(dir).type = 'directory'
  }
  writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2))
  console.log(`✅ Configuração salva em ${CONFIG_PATH}`)
}

async function callWorker(config: RemoteConfig, message: string): Promise<void> {
  const url = `${config.workerUrl.replace(/\/$/, '')}/api/chat`

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
      user: 'cli',
      message,
    }),
  })

  if (!response.ok) {
    console.error(`❌ Erro ${response.status}: ${response.statusText}`)
    const text = await response.text()
    console.error(text.slice(0, 500))
    process.exit(1)
  }

  const data = (await response.json()) as any
  console.log('\n📝 Resposta do Worker:')
  console.log('─'.repeat(60))
  console.log(data.reply)
  console.log('─'.repeat(60))
  console.log(`\n📊 Stats:`)
  console.log(`  Model: ${data.model}`)
  console.log(`  Tokens: ${data.tokens.input} input + ${data.tokens.output} output`)
  console.log(`  Custo: $${data.cost.toFixed(6)}`)
  console.log(`  Latência: ${data.latency_ms}ms`)
}

async function main(): Promise<void> {
  const args = process.argv.slice(2)

  if (args.length === 0 || args[0] === '--help' || args[0] === '-h') {
    console.log(`
🚀 JARVIS Remote Worker CLI

Uso:
  bun remote-cli.ts --config                    # Configurar servidor
  bun remote-cli.ts "sua mensagem"              # Enviar mensagem
  bun remote-cli.ts --url http://vps.com:3000 "sua mensagem"  # URL ad-hoc

Exemplos:
  bun remote-cli.ts --url http://localhost:3000 --key sk-xyz "teste"
  bun remote-cli.ts "gera um formulário de login bonito"
  bun remote-cli.ts --config  # Salvar config
    `)
    return
  }

  // --config: Interactive setup
  if (args[0] === '--config') {
    const workerUrl = prompt('🔗 URL do Worker (ex: http://localhost:3000): ') || ''
    const apiKey = prompt('🔑 API Key (opcional): ') || undefined

    if (!workerUrl) {
      console.error('❌ URL é obrigatória')
      process.exit(1)
    }

    saveConfig({ workerUrl, apiKey })
    return
  }

  // Parse CLI args
  let url: string | undefined
  let key: string | undefined
  let message = ''
  let i = 0

  while (i < args.length) {
    if (args[i] === '--url' && i + 1 < args.length) {
      url = args[++i]
    } else if (args[i] === '--key' && i + 1 < args.length) {
      key = args[++i]
    } else {
      message = args[i]
    }
    i++
  }

  // Load config or use CLI args
  let config = loadConfig()

  if (url) {
    config = { workerUrl: url, apiKey: key }
  }

  if (!config) {
    console.error('❌ Nenhuma configuração encontrada')
    console.error('Use: bun remote-cli.ts --config')
    process.exit(1)
  }

  if (!message) {
    console.error('❌ Mensagem obrigatória')
    process.exit(1)
  }

  console.log(`🔗 Conectando a: ${config.workerUrl}`)
  await callWorker(config, message)
}

main().catch((err) => {
  console.error('❌ Erro:', err.message)
  process.exit(1)
})
