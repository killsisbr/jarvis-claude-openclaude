# FASE 3 — WhatsApp Baileys + Intent Router + Chat State Machine

**Status**: ✅ Implementado  
**Data**: 2026-05-16  
**Linhas adicionadas**: ~1,200 LOC

---

## Visão Geral

Fase 3 completa a integração do JARVIS com WhatsApp através do Baileys (50MB, sem Chromium), adiciona classificação inteligente de intents (11 categorias em português) e implementa uma state machine explícita para gerenciar o ciclo de vida das conversas.

### Arquitetura

```
┌──────────────┐
│ WhatsApp App │
└──────┬───────┘
       │ messages + media
       ↓
┌─────────────────────────┐
│ Baileys Gateway         │ QR code, auto-reconnect
└──────┬──────────────────┘
       │ WhatsAppMessage
       ↓
┌─────────────────────────┐
│ Message Dispatcher      │ orquestra tudo
└─┬────┬────────┬────────┘
  ↓    ↓        ↓
Intent Router   Chat Session   Worker
  (classify)    (state machine) (process)
  │             │               │
  └─────────────┼───────────────┘
                ↓
            Response
```

---

## Componentes Implementados

### 1. WhatsApp Gateway — `src/worker/gateways/`

#### Interface: `whatsapp.ts` (80 LOC)
Contrato abstrato para qualquer implementação WhatsApp:
- `connect()` — conectar ao WhatsApp
- `disconnect()` — desconectar
- `sendMessage(chatId, text)` — enviar texto
- `sendMedia(chatId, buffer, type, filename?)` — enviar áudio/imagem
- `getStatus()` — verificar conexão
- Events: `message`, `connected`, `disconnected`, `error`, `qr`

#### Implementação: `baileys.ts` (250 LOC)
Baileys integrado com recursos de produção:

**Conexão:**
- QR code exibido no terminal via `qrcode-terminal`
- Persistência: `multiFileAuthState` em `~/.jarvis/baileys/`
- Auto-reconnect: exponential backoff (1s → 30s, máx 5 tentativas)

**Mensagens:**
- Recebe: texto, áudio, imagem, documentos
- Extrai: senderId, chatId, timestamp, senderName, media metadata
- Admin assignment: primeira mensagem define admin

**Eventos:**
- `connected` — conectado ao WhatsApp
- `disconnected` — desconectado
- `message` — nova mensagem recebida
- `qr` — código QR para scan
- `error` — erro de conexão

---

### 2. Intent Router — `src/worker/intent-router.ts` (200 LOC)

Classificação em 2 caminhos:

#### Fast Path: Regex (90%, < 1ms)
11 categorias com padrões PT-BR otimizados:

| Categoria | Exemplos |
|-----------|----------|
| **CREATE** | "criar arquivo", "novo feature", "escrever função" |
| **FIX** | "corrigir bug", "está quebrado", "resolver problema" |
| **DEPLOY** | "publicar", "subir produção", "release" |
| **EXPLAIN** | "explique", "como funciona", "o que é" |
| **DEBUG** | "debug", "depuração", "por que falha" |
| **STATUS** | "status", "tá rodando", "health check" |
| **ARCHITECT** | "arquitetura", "design", "refactor" |
| **REVIEW** | "review", "analise", "está bom" |
| **SUPPORT** | "ajuda", "dúvida", "socorro" |
| **CLOSE** | "fechar", "encerrar", "pronto" |
| **UNKNOWN** | não classificado |

#### Slow Path: LLM (10%, ~500ms)
Para mensagens ambíguas, fallback para Haiku LLM.

#### Entity Extraction
Extrai automaticamente:
- `filenames` — nomes de arquivo
- `paths` — diretórios
- `errors` — mensagens de erro
- `commands` — git, npm, docker, etc.
- `projectName` — projeto mencionado

---

### 3. Chat Session State Machine — `src/worker/chat-session.ts` (180 LOC)

6 estados com transições explícitas:

```
CRIADO → ANALISANDO → ATIVO → COMPLETO
   ↓        ↓          ↓ ↓        ↓
   └─────────→ AGUARDANDO ←──────┘
                            ↓
                          FECHADO
                    (auto-close 24h)
```

#### Métodos
- `receive(message)` — registra msg, transição para ANALISANDO
- `startWork(intent, project?)` — transição para ATIVO
- `updateCost(tokens, cost)` — atualiza stats
- `complete(result)` — transição para COMPLETO
- `close()` — transição para FECHADO
- `reopen()` — reabre sessão fechada
- `checkAutoClose()` — verifica > 24h inativo
- `save()` — persiste estado (async)

#### Features
- **Auto-save** a cada 30s (debounced)
- **Auto-close** após 24h inatividade
- **EventEmitter** para extensibilidade
- **Metadata storage** para dados customizados
- **State guards** — transições válidas apenas

#### Dados
```typescript
{
  userId: string,
  state: ChatState,
  startTime: number,
  lastActivityTime: number,
  currentProject?: string,
  currentIntent?: string,
  messageCount: number,
  totalTokens: number,
  totalCost: number,
  metadata: Record<string, any>
}
```

---

### 4. Message Dispatcher — `src/worker/dispatcher.ts` (150 LOC)

Orquestra todo o fluxo: Baileys → IntentRouter → ChatSession → Worker → resposta.

#### Fluxo
1. Baileys emite `message`
2. Dispatcher.dispatch(msg)
3. Recupera ou cria ChatSession
4. Verifica auto-close (> 24h → fecha e reabre)
5. IntentRouter classifica intent
6. Transição: CRIADO → ANALISANDO → ATIVO
7. JarvisWorker.processPrompt() com contexto
8. Recebe: resposta + tokens + cost
9. Atualiza ChatSession
10. Envia resposta via Baileys
11. Transição: COMPLETO
12. Emite `dispatch_complete`

#### Métodos
- `initialize()` — conectar gateway
- `dispatch(msg)` — processar mensagem
- `shutdown()` — salvar e desconectar
- `getSession(userId)` — recuperar sessão
- `getAllSessions()` — listar todas
- `getStats()` — agregado (sessões, mensagens, tokens, custo)

#### Error Handling
- Try-catch com emit `dispatch_error`
- Tenta enviar erro ao usuário
- Sessions permanecem para recuperação

---

### 5. Message Templates — `src/worker/messages.ts` (100 LOC)

Centraliza templates com variáveis:

```typescript
MessageTemplates.get('TASK_COMPLETE', {
  tokens: 150,
  cost: 0.0045,
  duration: 8.2
})
```

Templates:
- WELCOME, HELP, TASK_START, TASK_COMPLETE
- STATUS_REPORT, ERROR_*, SESSION_CLOSED
- ADMIN_ASSIGNED, RECONNECTING, CONNECTION_LOST

---

### 6. Server Extensions — `src/worker/server.ts`

Novas rotas:

#### `GET /api/whatsapp/status`
```json
{
  "active_sessions": 3,
  "total_sessions": 15,
  "total_messages": 142,
  "total_tokens": 15230,
  "total_cost": 0.4567,
  "timestamp": "2026-05-16T10:30:45Z"
}
```

#### `GET /api/whatsapp/qr`
```json
{
  "message": "QR code is displayed in terminal",
  "info": "Scan the QR code with your WhatsApp mobile device"
}
```

---

## Setup e Execução

### 1. Dependências ✅ (Já instaladas)
```bash
bun add @whiskeysockets/baileys qrcode-terminal
```

### 2. Atualizar Entrypoint (main.ts)
```typescript
import { MessageDispatcher } from './dispatcher'

// ... após JarvisWorker ...

const dispatcher = new MessageDispatcher(worker)
await dispatcher.initialize()

const server = createServer(worker, dispatcher)

process.on('SIGTERM', async () => {
  console.log('[Worker] Shutting down...')
  await dispatcher.shutdown()
  process.exit(0)
})
```

### 3. Executar
```bash
bun run worker
```

Terminal exibe QR code:
```
████████████████████████
████████████████████████ ← Scan com WhatsApp
████████████████████████

[Baileys] Conectado com sucesso!
```

### 4. Testar
Enviar mensagem no WhatsApp:
```
"criar um arquivo chamado hello.ts"
```

Resposta esperada: código gerado pelo JARVIS.

---

## Performance

| Métrica | Target | Notas |
|---------|--------|-------|
| Intent classification | < 1ms | Regex, 90% dos casos |
| WhatsApp latency | < 5s | Inclui LLM roundtrip |
| Session creation | < 50ms | Estado em memória |
| QR scan → connected | < 30s | Handshake Baileys |
| RAM per session | < 10KB | Apenas estado |
| Total RAM | < 100MB | 10 sessões ativas |

---

## Arquivos Criados/Modificados

```
src/worker/
├── gateways/
│   ├── whatsapp.ts         (80 LOC)   novo
│   └── baileys.ts          (250 LOC)  novo
├── intent-router.ts        (200 LOC)  novo
├── chat-session.ts         (180 LOC)  novo
├── dispatcher.ts           (150 LOC)  novo
├── messages.ts             (100 LOC)  novo
└── server.ts               (+40 LOC)  modificado

docs/worker/
└── FASE3-WHATSAPP.md       (este arquivo)
```

**Total Fase 3**: ~1,200 LOC

---

## Próximas Fases

### Fase 4 — SQLite + KnowledgeGraph
- Persistir ChatSession em SQLite
- Adicionar histórico de mensagens
- Knowledge graph de entidades
- Spaced repetition learning

### Fase 5 — Budget + Approval + Checkpoints
- Limites de custo por usuário
- Approval system (Y/n para ações críticas)
- Checkpoints para restore de arquivos
- Plan mode (READONLY/SANDBOX/PRODUCTION)

### Fase 6 — Cron + Sentinelas
- Health check (60s)
- Key rotation (1min)
- Cost monitoring (5min)
- Daily reports (24h)
- Spaced repetition decay (24h)

---

## Troubleshooting

### QR Code não aparece
- Verificar `qrcode-terminal` instalado
- Terminal pode não suportar modo bruto
- Tentar `bun pm cache clean`

### Baileys desconecta constantemente
- Usar conta WhatsApp dedicada (não pessoal)
- Verificar conexão de internet
- Aumentar `maxReconnectAttempts` se necessário

### "Not connected" ao enviar
- Aguardar 5-10s após escanear QR
- Verificar console para evento `connected`
- Checar logs de autenticação

### Memory leak em sessões longas
- Implementar GC de sessões FECHADO (Fase 4)
- Monitorar via `/api/whatsapp/status`
- Reiniciar worker a cada 24h se necessário

---

## Métricas

- **LOC Fase 3**: ~1,200
- **Modules**: 7 (gateways, intents, session, dispatcher, messages, server, docs)
- **Dependencies**: 2 new (baileys, qrcode-terminal)
- **Performance**: 90% < 1ms (regex), 10% ~500ms (LLM)
- **RAM**: < 100MB típico

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
