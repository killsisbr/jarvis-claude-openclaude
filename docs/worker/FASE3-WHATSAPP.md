# Fase 3 — WhatsApp Gateway

> Conectar o worker ao WhatsApp via Evolution API (recomendado) ou baileys (fallback).

**Status**: Planejado  
**Estimativa**: 2 dias

---

## Objetivo

O worker recebe mensagens do WhatsApp, processa com JARVIS Core, e responde de volta.

```
WhatsApp ─→ webhook POST ─→ Dispatcher ─→ JARVIS Worker ─→ LLM ─→ Resposta WhatsApp
```

---

## Opção A — Evolution API (Recomendado)

### O que é

Evolution API é um wrapper self-hosted que:
- Gerencia conexão com WhatsApp Web
- Emite QR code na primeira conexão
- Roteia mensagens via webhook
- Suporta multi-dispositivo
- Zero dependência de account principal (apenas um número + dispositivo)

**Repo**: https://github.com/EvolutionAPI/evolution-api

### Setup

#### 1. Docker Compose

Adicionar ao `docker-compose.yml`:

```yaml
evolution:
  image: evolvapi/evolution-api:latest
  ports:
    - "8080:8080"
  environment:
    EVOLUTION_INSTANCE_NAME: jarvis-worker
    EVOLUTION_API_URL: http://localhost:8080
  volumes:
    - ./evolution-data:/home/evolution/instances
```

#### 2. Get QR Code

```bash
curl http://localhost:8080/instance/connect/jarvis-worker
# Resposta: { qrcode: "data:image/png;base64,..." }
```

Escanear o QR com WhatsApp.

#### 3. Webhook Configuration

```bash
curl -X POST http://localhost:8080/instance/webhook \
  -H 'Content-Type: application/json' \
  -d '{
    "instance": "jarvis-worker",
    "url": "http://localhost:3000/webhooks/whatsapp",
    "events": ["MESSAGES_UPSERT"]
  }'
```

#### 4. Webhook Payload

O Evolution API envia `POST /webhooks/whatsapp`:

```json
{
  "instance": "jarvis-worker",
  "data": {
    "message": {
      "key": {
        "remoteJid": "5511999999999@s.whatsapp.net",
        "id": "..."
      },
      "messageStamp": 1234567890,
      "message": {
        "conversation": "Oi, tudo bem?"
      }
    }
  }
}
```

---

## Opção B — Baileys (Fallback)

Se Evolution API tiver problemas, usar baileys (lib Node.js puro).

```typescript
import makeWASocket from '@whiskeysockets/baileys'

const sock = makeWASocket.default({
  auth: state,
  printQRInTerminal: true,
})

sock.ev.on('messages.upsert', async (m) => {
  const msg = m.messages[0]
  // processar msg
})
```

**Vantagem**: zero infra externa, controle total.  
**Desvantagem**: mais frágil com mudanças de protocolo WhatsApp.

---

## Implementação

### `src/worker/gateways/whatsapp.ts`

Interface abstrata:

```typescript
export interface WhatsAppGateway {
  start(): Promise<void>
  stop(): Promise<void>
  sendMessage(to: string, text: string): Promise<void>
  onMessage(handler: (msg: WhatsAppMessage) => void): void
}

export type WhatsAppMessage = {
  from: string
  body: string
  timestamp: number
  messageId: string
}
```

### `src/worker/gateways/evolution.ts`

Implementação Evolution API:

```typescript
export class EvolutionWhatsAppGateway implements WhatsAppGateway {
  private apiUrl: string
  private instance: string
  private messageHandler?: (msg: WhatsAppMessage) => void

  constructor(opts: { apiUrl: string; instance: string }) {
    this.apiUrl = opts.apiUrl
    this.instance = opts.instance
  }

  async start(): Promise<void> {
    // Setup webhook no Evolution API
    // Iniciar servidor webhook
  }

  async stop(): Promise<void> {
    // Parar servidor webhook
  }

  async sendMessage(to: string, text: string): Promise<void> {
    // POST ao Evolution API para enviar mensagem
  }

  onMessage(handler: (msg: WhatsAppMessage) => void): void {
    this.messageHandler = handler
  }

  // Chamar isto no webhook handler
  _handleWebhook(data: any): void {
    const from = extractFrom(data)
    const body = extractBody(data)
    this.messageHandler?.({ from, body, timestamp: Date.now(), messageId: '...' })
  }
}
```

### `src/worker/dispatcher.ts` (novo)

Orquestra: webhook → sessão → JARVIS Worker → resposta.

```typescript
export class WhatsAppDispatcher {
  constructor(
    private worker: JarvisWorker,
    private gateway: WhatsAppGateway,
  ) {
    this.gateway.onMessage((msg) => this.handleMessage(msg))
  }

  private async handleMessage(msg: WhatsAppMessage): Promise<void> {
    // 1. Limpar número (5511999999999 → 5511999999999)
    const userId = msg.from.replace(/[^\d]/g, '')

    // 2. Processar com worker
    const response = await this.worker.processPrompt(msg.body, userId)

    // 3. Enviar resposta
    await this.gateway.sendMessage(userId, response.reply)

    // 4. Log
    console.log(`[whatsapp] ${userId}: "${msg.body.slice(0, 50)}..." → "${response.reply.slice(0, 50)}..."`)
  }

  async start(): Promise<void> {
    await this.gateway.start()
    console.log('[whatsapp] Gateway iniciado')
  }

  async stop(): Promise<void> {
    await this.gateway.stop()
    console.log('[whatsapp] Gateway parado')
  }
}
```

### `src/worker/main.ts` (modificado)

Integrar WhatsApp dispatcher:

```typescript
// Em main()
const gateway = new EvolutionWhatsAppGateway({
  apiUrl: process.env['EVOLUTION_API_URL'] ?? 'http://localhost:8080',
  instance: 'jarvis-worker',
})

const dispatcher = new WhatsAppDispatcher(worker, gateway)

// Startup
await dispatcher.start()

// Shutdown
const shutdown = (signal: string) => {
  console.log(`Recebido ${signal}`)
  await dispatcher.stop()
  process.exit(0)
}
```

---

## Configuração

Adicionar a `settings.json`:

```json
{
  "whatsapp": {
    "enabled": true,
    "provider": "evolution",
    "evolutionApiUrl": "http://localhost:8080",
    "instanceName": "jarvis-worker",
    "webhookPort": 3000
  }
}
```

---

## Dependências novas

```bash
bun add @whiskeysockets/baileys  # só se usar baileys
```

Evolution API roda em Docker, sem dependência Node.

---

## Testes

### 1. Verificar webhook

```bash
curl -X POST http://localhost:3000/webhooks/whatsapp \
  -H 'Content-Type: application/json' \
  -d '{
    "instance": "jarvis-worker",
    "data": {
      "message": {
        "key": { "remoteJid": "5511999999999@s.whatsapp.net" },
        "message": { "conversation": "teste" }
      }
    }
  }'
```

### 2. Enviar mensagem real

Escanear QR, enviar mensagem no WhatsApp. Deve receber resposta em < 5s.

---

## Próxima fase

[Fase 4 — Session Store SQLite](./FASE4-SQLITE.md): persistência real com banco de dados.
