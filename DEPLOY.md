# DEPLOY — JARVIS v5.0.0

Guia operacional de deployment para múltiplos ambientes.

---

## TL;DR

```bash
# Local (desenvolvimento)
npm run build
jarvis-proactive.bat              # ou haiku.bat, start-jarvis.bat

# VPS (produção com worker 24/7)
bun run build
bun run worker                    # localhost:3000
# Em paralelo: night-worker.bat   # missões autônomas

# Docker (futuro)
docker build -t jarvis:latest .
docker run -e ROTATE_CHAIN=... jarvis:latest
```

---

## 1. LOCAL (Desenvolvimento)

### Build

```bash
npm run build
# Gera: dist/cli.mjs (CLI), dist/sdk.mjs (SDK)
```

### Rodar CLI interativo

```bash
# Provider selector (menu interativo)
start-jarvis.bat

# Modo proativo (autonomous ticks)
jarvis-proactive.bat

# Haiku rápido (cheap + fast)
haiku.bat

# Provider específico
jarvis.bat zen              # Zen OpenCode
jarvis.bat nvidia           # NVIDIA NIM
jarvis.bat deepseek         # DeepSeek API
jarvis.bat groq             # Groq LPU
jarvis.bat ollama           # Ollama local
```

### Variáveis de ambiente (local)

```bash
# .env
CLAUDE_CODE_PROACTIVE=1           # ativar proactive mode
WORKER_MODE=false                 # desabilitar worker
ROTATE_CHAIN=zen,deepseek,groq    # failover chain

# Provider keys (do .env)
ZEN_API_KEY_1=xxx
ZEN_BASE_URL=https://opencode.ai/zen/v1

NVIDIA_API_KEY=xxx
DEEPSEEK_API_KEY=xxx
GROQ_API_KEY=xxx
```

---

## 2. VPS (Produção)

### Setup inicial

```bash
# SSH para VPS
ssh user@vps.example.com

# Clonar repo
git clone https://github.com/Gitlawb/openclaude.git jarvis-claude
cd jarvis-claude

# Build
bun install
bun run build
```

### Rodando Worker 24/7 (daemon)

#### Opção A: PM2

```bash
npm install -g pm2

# Start worker
pm2 start "bun run worker" --name "jarvis-worker" --log-date-format "YYYY-MM-DD HH:mm:ss"

# Status
pm2 status

# Logs (tempo real)
pm2 logs jarvis-worker

# Auto-restart on boot
pm2 startup
pm2 save
```

#### Opção B: systemd

```bash
# Criar service file
sudo tee /etc/systemd/system/jarvis-worker.service > /dev/null <<EOF
[Unit]
Description=JARVIS Worker (OpenClaude headless)
After=network.target

[Service]
Type=simple
User=$USER
WorkingDirectory=/home/$USER/jarvis-claude
Environment="NODE_ENV=production"
Environment="ROTATE_CHAIN=zen,deepseek,groq"
ExecStart=/usr/bin/bun run worker
Restart=always
RestartSec=10
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
EOF

# Ativar
sudo systemctl daemon-reload
sudo systemctl enable jarvis-worker
sudo systemctl start jarvis-worker

# Status
sudo systemctl status jarvis-worker

# Logs
sudo journalctl -u jarvis-worker -f
```

### API Endpoints (Worker)

```bash
# Health check
curl http://localhost:3000/api/health
# ou via /api/chat:
curl -X POST http://localhost:3000/api/chat \
  -H "Content-Type: application/json" \
  -d '{"user": "test", "message": "ping"}'

# Cost dashboard
curl http://localhost:3000/api/cost

# WhatsApp status
curl http://localhost:3000/api/whatsapp/status

# Cron jobs
curl http://localhost:3000/api/cron
```

### Missões Autônomas (Night Worker)

```bash
# Rodar night-worker.bat em schedule
# (Win) Task Scheduler ou PM2
pm2 start night-worker.bat --name "jarvis-night"

# Executa autonomamente a cada intervalo
# Monitora via /api/cost para detectar anomalias
```

### Configuração VPS (.env)

```bash
# Production providers
ROTATE_CHAIN=zen,deepseek,groq,ollama

ZEN_API_KEY_1=xxx
ZEN_API_KEY_2=xxx        # Múltiplos para load balancing
ZEN_BASE_URL=https://opencode.ai/zen/v1

DEEPSEEK_API_KEY=xxx
GROQ_API_KEY=xxx

WORKER_PORT=3000
WORKER_MODE=true

# Optional: Local Ollama
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_MODEL=llama2

# Logging
LOG_LEVEL=info
LOG_FILE=/var/log/jarvis/worker.log
```

### Reverse Proxy (Nginx)

```nginx
upstream jarvis {
    server localhost:3000;
}

server {
    listen 80;
    server_name jarvis.example.com;

    location / {
        proxy_pass http://jarvis;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        # WebSocket (WhatsApp/Baileys)
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }

    # SSL (Let's Encrypt)
    listen 443 ssl;
    ssl_certificate /etc/letsencrypt/live/jarvis.example.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/jarvis.example.com/privkey.pem;
}
```

---

## 3. Docker (Futuro)

```dockerfile
# Dockerfile
FROM oven/bun:latest

WORKDIR /app
COPY . .

RUN bun install

ENV NODE_ENV=production
ENV WORKER_MODE=true
ENV WORKER_PORT=3000

EXPOSE 3000

CMD ["bun", "run", "worker"]
```

```bash
# Build
docker build -t jarvis:latest .

# Run
docker run -d \
  --name jarvis-worker \
  -p 3000:3000 \
  -e ROTATE_CHAIN=zen,deepseek,groq \
  -e ZEN_API_KEY_1=xxx \
  -e DEEPSEEK_API_KEY=xxx \
  -e GROQ_API_KEY=xxx \
  -v /var/log/jarvis:/app/logs \
  jarvis:latest

# Logs
docker logs -f jarvis-worker

# Stop
docker stop jarvis-worker
```

---

## 4. Monitoramento

### Health Checks

```bash
# Script simples (bash)
#!/bin/bash
curl -s http://localhost:3000/api/cost | jq '.cost' || echo "DEAD"

# Cron job (a cada 5 min)
*/5 * * * * /path/to/check_health.sh >> /var/log/jarvis/health.log
```

### Logs

```bash
# Ver últimas linhas
tail -100 /var/log/jarvis/worker.log

# Buscar erros
grep ERROR /var/log/jarvis/worker.log

# Contar requisições por hora
awk '{print substr($4, 2, 13)}' /var/log/jarvis/worker.log | sort | uniq -c
```

### Cost Tracking

```bash
# Diário via /cost endpoint
curl -s http://localhost:3000/api/cost | jq '.'
# Output: { cost: 123.45, tokens: 45000, ...}

# Integrar com alertas (Slack, Discord)
COST=$(curl -s http://localhost:3000/api/cost | jq '.cost')
if (( $(echo "$COST > 100" | bc -l) )); then
  curl -X POST https://hooks.slack.com/... -d "Cost Alert: \$${COST}"
fi
```

---

## 5. Troubleshooting

### Worker não inicia

```bash
# Verificar porta
lsof -i :3000
# Se ocupada: kill -9 <PID>

# Verificar logs
pm2 logs jarvis-worker
# ou
sudo journalctl -u jarvis-worker -n 50

# Build sujo?
rm -rf dist node_modules
bun install
bun run build
bun run worker
```

### API retorna 401

```bash
# API key inválida ou expirada
# Verificar .env
cat .env | grep API_KEY

# Testar key manualmente
curl -H "Authorization: Bearer $ZEN_API_KEY_1" \
  https://opencode.ai/zen/v1/models

# Se falhar: regenerar key no provider dashboard
```

### Memory leak no worker

```bash
# Monitorar via PM2
pm2 monit

# Ou manual (Linux)
watch -n 5 'ps aux | grep bun'

# Se crescer: restart automático via PM2
pm2 restart jarvis-worker --max-memory-restart 500M
```

### WhatsApp QR code

```bash
# Acessar via browser
http://jarvis.example.com/api/whatsapp/qr

# Ou curl
curl http://localhost:3000/api/whatsapp/qr | jq '.'

# Se travado: limpar session
rm -rf ~/.jarvis/whatsapp-session.json
# Restart worker
```

---

## 6. Rollout Checklist

- [ ] Build passes: `bun run build`
- [ ] Tests pass: `npm run test`
- [ ] .env configurado (todas as API keys)
- [ ] ROTATE_CHAIN validado (at least 2 providers)
- [ ] Worker inicia sem erros: `bun run worker`
- [ ] API endpoints respondem: `/api/cost`, `/api/chat`
- [ ] Reverse proxy configurado (se VPS)
- [ ] PM2/systemd auto-restart configurado
- [ ] Logs configurados (journalctl ou arquivo)
- [ ] Health checks rodando
- [ ] Backups do .env (seguro!)
- [ ] Monitoramento de custos ativo

---

## Suporte

Erros? Consulte:
- `docs/DEPLOYMENT_SAFETY.md` — zero-impact deployment
- `docs/PROACTIVE-MODE.md` — autonomous ticks behavior
- `COMECE_AQUI.md` — quickstart rápido
