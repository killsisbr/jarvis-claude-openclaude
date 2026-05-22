# 🔧 JARVIS Worker — Tutorial Completo

Seu worker é um **servidor HTTP headless** que roda Claude autonomamente na VPS.
Você envia tarefas via HTTP, ele executa e retorna resultados.

---

## 1️⃣ O QUE É O WORKER?

```
+---────────────────────────────────────+
│         Sua máquina                   │
│  curl "http://vps:3000/api/chat"      │  ← Você aqui
└─────────────┬─────────────────────────┘
              │ HTTP POST
              ↓
+───────────────────────────────────────────────────────────────+
│  VPS 24/7 (PM2)                                               │
│  ┌──────────────────────────────────────────────────────────┐ │
│  │ JARVIS Worker (Express)                                  │ │
│  │ ┌────────────────────────────────────────────────────┐   │ │
│  │ │ POST /api/chat                                     │   │ │
│  │ │ POST /api/mission                                  │   │ │
│  │ │ GET /api/cost                                      │   │ │
│  │ │ GET /health                                        │   │ │
│  │ └────────────────────────────────────────────────────┘   │ │
│  └──────────────────────────────────────────────────────────┘ │
└───────────────────────────────────────────────────────────────┘

Você: "Cria um formulário de login em React"
Worker: Processa, invoca Claude, retorna código
```

---

## 2️⃣ INICIAR O WORKER

### **Localmente (desenvolvimento)**

```bash
cd D:\jarvis-claude\openclaude

# Terminal 1: Iniciar worker
bun run worker

# Saída esperada:
# ╔════════════════════════════════════════╗
# ║   JARVIS Worker v5.0.0 (Headless)     ║
# ║   Zero-Telemetry AI Coding Agent       ║
# ╚════════════════════════════════════════╝
# 
# [startup] Carregando configuração...
# [startup] ✓ JarvisWorker pronto
# [startup] ✓ Servidor rodando em http://localhost:3000
```

### **Em VPS (com PM2)**

```bash
# Instalar PM2 (primeira vez)
npm install -g pm2

# Iniciar worker com PM2
pm2 start "bun run worker" --name jarvis-worker

# Verificar status
pm2 status

# Ver logs em tempo real
pm2 logs jarvis-worker

# Parar/reiniciar
pm2 stop jarvis-worker
pm2 restart jarvis-worker

# Remover
pm2 delete jarvis-worker
```

---

## 3️⃣ ENDPOINTS DISPONÍVEIS

| Método | Rota | Descrição |
|--------|------|-----------|
| GET | `/health` | Status do worker (uptime, custo, sessões) |
| POST | `/api/chat` | Enviar mensagem, receber resposta |
| GET | `/api/cost` | Custo do dia + estatísticas |
| GET | `/api/keys` | Status dos pools de API keys |
| POST | `/api/mission` | Criar missão autônoma |
| GET | `/api/mission` | Listar missões |
| GET | `/api/mission/:id` | Detalhes de uma missão |
| GET | `/api/mission/:id/report` | Relatório markdown |
| POST | `/api/mission/:id/cancel` | Cancelar missão |

---

## 4️⃣ EXEMPLOS COM CURL

### **A. Health Check**

```bash
curl http://localhost:3000/health

# Resposta:
# {
#   "status": "running",
#   "uptime": 3600,
#   "version": "v5.0.0-worker",
#   "sessions_active": 2,
#   "cost_today": 0.125,
#   "queries_total": 42
# }
```

### **B. Chat Simples**

```bash
curl -X POST http://localhost:3000/api/chat \
  -H "Content-Type: application/json" \
  -d '{
    "user": "killsis",
    "message": "Cria um formulário de login simples em React"
  }'

# Resposta:
# {
#   "session": "sess_abc123",
#   "reply": "Aqui está um componente de login...\n\n```jsx\nimport...",
#   "cost": 0.045,
#   "model": "claude-3-5-sonnet",
#   "tokens": {
#     "input": 150,
#     "output": 800
#   },
#   "latency_ms": 2340,
#   "category": "code-generation"
# }
```

### **C. Criar Missão Autônoma**

```bash
curl -X POST http://localhost:3000/api/mission \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Criar API de produtos",
    "description": "Gera endpoint GET/POST para CRUD de produtos",
    "maxCost": 1.50,
    "budget": 1.50,
    "approvedBy": "killsis@gmail.com"
  }'

# Resposta:
# {
#   "id": "mission_abc123",
#   "name": "Criar API de produtos",
#   "status": "running",
#   "created": "2026-05-22T10:30:00Z",
#   "estimatedCompletion": "2026-05-22T10:32:00Z"
# }
```

### **D. Ver Status de Missão**

```bash
curl http://localhost:3000/api/mission/mission_abc123

# Resposta:
# {
#   "id": "mission_abc123",
#   "status": "completed",
#   "progress": 100,
#   "result": {
#     "code": "...",
#     "tests": "...",
#     "documentation": "..."
#   },
#   "cost": 0.87
# }
```

### **E. Ver Custo do Dia**

```bash
curl http://localhost:3000/api/cost

# Resposta:
# {
#   "cost_today": 2.345,
#   "queries_today": 24,
#   "sessions_active": 3,
#   "pools": [
#     { "name": "anthropic", "active_keys": 1, "cooldown_keys": 0, "total_keys": 2 },
#     { "name": "deepseek", "active_keys": 2, "cooldown_keys": 0, "total_keys": 3 }
#   ]
# }
```

---

## 5️⃣ EXEMPLOS EM JAVASCRIPT/NODE.JS

### **Chat Simples**

```javascript
async function askWorker(message) {
  const response = await fetch('http://localhost:3000/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      user: 'killsis',
      message
    })
  })
  
  const data = await response.json()
  console.log('Claude:', data.reply)
  console.log('Custo:', `$${data.cost}`)
  console.log('Latência:', `${data.latency_ms}ms`)
  return data
}

// Usar:
await askWorker('Cria um servidor Express simples')
```

### **Criar Missão e Aguardar**

```javascript
async function createMission(name, description, budget = 2.0) {
  // 1. Criar missão
  const createRes = await fetch('http://localhost:3000/api/mission', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name,
      description,
      maxCost: budget,
      budget,
      approvedBy: 'killsis@gmail.com'
    })
  })
  
  const mission = await createRes.json()
  console.log(`[MISSÃO] ${mission.name} → ID: ${mission.id}`)
  
  // 2. Aguardar conclusão (polling)
  let status = 'running'
  while (status === 'running') {
    await new Promise(resolve => setTimeout(resolve, 2000)) // espera 2s
    
    const statusRes = await fetch(`http://localhost:3000/api/mission/${mission.id}`)
    const updated = await statusRes.json()
    status = updated.status
    
    console.log(`[${new Date().toISOString()}] Status: ${status} (${updated.progress}%)`)
    
    if (status === 'completed') {
      console.log('\n✅ MISSÃO COMPLETA!')
      console.log(`Custo total: $${updated.cost}`)
      return updated.result
    }
    
    if (status === 'failed') {
      console.log('\n❌ MISSÃO FALHOU!')
      console.log(`Erro: ${updated.error}`)
      throw new Error(updated.error)
    }
  }
}

// Usar:
const result = await createMission(
  'Criar CRUD de usuários',
  'API REST completa com validação e testes',
  2.5
)
console.log(result)
```

### **Monitorar Custo em Tempo Real**

```javascript
async function monitCost() {
  setInterval(async () => {
    const res = await fetch('http://localhost:3000/api/cost')
    const data = await res.json()
    
    console.clear()
    console.log('╔════════════════════════════════════════╗')
    console.log('║   CUSTO DO DIA                         ║')
    console.log('╚════════════════════════════════════════╝')
    console.log(`Custo: $${data.cost_today.toFixed(3)}`)
    console.log(`Queries: ${data.queries_today}`)
    console.log(`Sessões ativas: ${data.sessions_active}`)
    console.log('')
    console.log('API Pools:')
    for (const pool of data.pools) {
      console.log(`  ${pool.name}: ${pool.active_keys} ativa / ${pool.total_keys} total`)
    }
  }, 5000) // atualiza a cada 5 segundos
}

// Usar (run indefinidamente):
monitCost()
```

---

## 6️⃣ MONITORAMENTO & DEBUGGING

### **Ver logs do worker em tempo real**

```bash
# Local
bun run worker 2>&1 | tee worker.log

# VPS (PM2)
pm2 logs jarvis-worker

# Ou ver histórico
tail -f ~/.jarvis/logs/worker.log
```

### **Verificar API key status**

```bash
curl http://localhost:3000/api/keys | jq .

# Procura por:
# - "cooldown_keys" (0 = tudo ok, >0 = aguardando)
# - "active_keys" (deve ser > 0)
```

### **Teste de carga**

```bash
# Enviar 10 requisições em paralelo
for i in {1..10}; do
  (
    curl -X POST http://localhost:3000/api/chat \
      -H "Content-Type: application/json" \
      -d "{\"user\":\"user$i\",\"message\":\"Hi\"}" &
  )
done
wait
```

---

## 7️⃣ CASOS DE USO REAIS

### **Caso 1: Melhorar código automaticamente**

```javascript
// Tarefa: Refatorar função lenta
await askWorker(`
Refatore esta função para ser mais rápida:

\`\`\`javascript
function findDuplicates(arr) {
  const result = []
  for (let i = 0; i < arr.length; i++) {
    for (let j = i + 1; j < arr.length; j++) {
      if (arr[i] === arr[j] && !result.includes(arr[i])) {
        result.push(arr[i])
      }
    }
  }
  return result
}
\`\`\`

Retorna código otimizado + explicação.
`)
```

### **Caso 2: Gerar documentação**

```javascript
// Tarefa: Criar README para projeto
await askWorker(`
Cria um README.md profissional para:
- Nome: "CRM-VENDA"
- Stack: Node.js + Prisma + PostgreSQL
- Features: leads, pipeline, relatórios
- Deploy: Docker + PM2
`)
```

### **Caso 3: Criar nova SaaS (missão autônoma)**

```javascript
// Tarefa: Criar SaaS completa
await createMission(
  'Criar SaaS de Invoicing',
  `
  Node.js + React + Stripe:
  - CRUD faturas
  - Integração Stripe
  - Relatórios PDF
  - Autenticação JWT
  - Testes completos
  Código pronto para deploy.
  `,
  3.50 // orçamento máximo
)
```

---

## 8️⃣ CONFIGURAÇÃO AVANÇADA

### **Variáveis de Ambiente**

```bash
# .env ou export
WORKER_PORT=3000                    # Porta HTTP
JARVIS_SYSTEM_PROMPT="..."          # Prompt customizado
ANTHROPIC_API_KEY="sk-..."          # API key
MAX_TOKENS_PER_REQUEST=50000        # Limite de tokens
BUDGET_DAILY_USD=10.0               # Orçamento diário
```

### **Rodar em VPS com auto-restart**

```bash
# systemd service (~/.config/systemd/user/jarvis-worker.service)
[Unit]
Description=JARVIS Worker
After=network.target

[Service]
Type=simple
ExecStart=/usr/local/bin/bun run /home/ubuntu/openclaude/src/worker/main.ts
Restart=always
RestartSec=10
User=ubuntu

[Install]
WantedBy=default.target

# Ativar
systemctl --user enable jarvis-worker
systemctl --user start jarvis-worker
systemctl --user status jarvis-worker
```

---

## 9️⃣ TROUBLESHOOTING

| Erro | Solução |
|------|---------|
| `ECONNREFUSED` | Worker não está rodando. Execute `bun run worker` |
| `401 Unauthorized` | API key inválida ou expirada em `.env` |
| `429 Too Many Requests` | API rate limited. Aguarde ou use outra chave |
| `Timeout` | Tarefa muito grande. Aumente `maxTokens` ou reduza escopo |

---

## 🎯 PRÓXIMOS PASSOS

1. **Teste agora**:
   ```bash
   bun run worker &
   curl http://localhost:3000/health
   ```

2. **Crie sua primeira tarefa**:
   ```bash
   curl -X POST http://localhost:3000/api/chat \
     -H "Content-Type: application/json" \
     -d '{"user":"killsis","message":"Oi"}'
   ```

3. **Deploy na VPS**:
   - Copie o código
   - Configure `.env`
   - Rode com PM2/systemd
   - Configure nginx reverse proxy (porta 3000 → domínio)

4. **Automatize tarefas**:
   - Cron job: `0 22 * * * curl -X POST http://localhost/api/mission ...`
   - Webhook: receba eventos → dispare missões

---

**Pronto? Qual é sua primeira tarefa pro worker?**
