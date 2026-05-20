# Configurar Claude Code CLI para usar Worker Local

## 🚀 Arquitetura

```
Claude Code CLI
      ↓ HTTP POST /api/chat
JARVIS Worker (localhost:3000)
      ↓ Groq/Anthropic/OpenAI
LLM Provider
```

## 📋 Setup Rápido

### 1. Worker já está rodando?
```bash
curl http://localhost:3000/health
```
Se retornar JSON com status ✅, está pronto.

### 2. Configurar CLI para usar Worker

**Opção A: Via Node.js wrapper script**

Criar arquivo `claude-worker-bridge.js`:

```javascript
#!/usr/bin/env node

const fetch = require('node-fetch');

async function sendToWorker(message, userId = 'cli-user') {
  const response = await fetch('http://localhost:3000/api/chat', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      user: userId,
      message: message,
      model: 'llama-3.3-70b-versatile'
    })
  });

  const data = await response.json();
  return data.message || data.error;
}

// Executar
const args = process.argv.slice(2).join(' ');
sendToWorker(args).then(result => {
  console.log(result);
  process.exit(0);
}).catch(err => {
  console.error('Erro:', err.message);
  process.exit(1);
});
```

**Uso:**
```bash
node claude-worker-bridge.js "escreva um Hello World em Python"
```

---

**Opção B: Integrar no CLI existente**

Se está usando Claude Code CLI diretamente:

```bash
# Terminal 1: Worker rodando
bun run src/worker/main.ts

# Terminal 2: CLI como cliente HTTP
curl -X POST http://localhost:3000/api/chat \
  -H "Content-Type: application/json" \
  -d '{
    "user": "cli-user",
    "message": "seu comando aqui",
    "model": "llama-3.3-70b-versatile"
  }' | jq '.message'
```

---

**Opção C: Bash script wrapper**

Criar `claude-worker.sh`:

```bash
#!/bin/bash

WORKER_URL="http://localhost:3000"
USER_ID="${1:-cli-user}"
MESSAGE="${@:2}"

curl -s -X POST "$WORKER_URL/api/chat" \
  -H "Content-Type: application/json" \
  -d "{
    \"user\": \"$USER_ID\",
    \"message\": \"$MESSAGE\",
    \"model\": \"llama-3.3-70b-versatile\"
  }" | jq '.message'
```

**Uso:**
```bash
chmod +x claude-worker.sh
./claude-worker.sh "analisa meu código"
```

---

## ✅ Benefícios

✓ **Uma única instância Groq**: Worker reutiliza limite com múltiplas requisições  
✓ **Smart Cache ativo**: Respostas repetidas retornam <1ms  
✓ **Proactive Learning**: Worker aprende suas preferências  
✓ **Sem duplicar credenciais**: Tudo centralizado no worker  

---

## 🔧 Troubleshooting

**"Connection refused"**
```bash
# Verificar se worker está rodando
curl http://localhost:3000/health

# Se não, iniciar:
cd D:\jarvis-claude\openclaude
bun run src/worker/main.ts
```

**"Rate limit exceeded"**
→ Aguarde 2 minutos (limite Groq: 30 req/min)

**"Invalid API key"**
→ Verificar GROQ_API_KEY em .env

---

## 📊 Status do Worker

```bash
# Ver status WhatsApp
curl http://localhost:3000/api/whatsapp/status

# Ver custos
curl http://localhost:3000/api/cost

# Ver health
curl http://localhost:3000/health
```

---

**Worker URL:** http://localhost:3000  
**API Key:** sk-local-worker (local)  
**Modelo padrão:** llama-3.3-70b-versatile
