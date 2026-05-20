# Guia de Deploy VPS — JARVIS Worker 24/7

**Data**: 2026-05-20
**Versao**: v5.0.0
**Status**: Guia de referencia

---

## Requisitos Minimos

| Recurso | Minimo | Recomendado |
|---------|--------|-------------|
| RAM | 512 MB | 1 GB |
| CPU | 1 vCPU | 2 vCPU |
| Disco | 5 GB | 20 GB |
| OS | Ubuntu 22.04+ / Debian 12+ | Ubuntu 24.04 LTS |
| Runtime | Bun 1.1+ | Bun latest |

O Worker e leve — SQLite local, sem dependencias externas pesadas.

---

## 1. Instalacao na VPS

### 1.1 Instalar Bun

```bash
curl -fsSL https://bun.sh/install | bash
source ~/.bashrc
bun --version
```

### 1.2 Clonar o projeto

```bash
cd /opt
git clone <repo-url> jarvis
cd jarvis
bun install
```

### 1.3 Configurar .env

```bash
cp .env.example .env
nano .env
```

Variaveis obrigatorias:
```env
WORKER_PORT=3000
WORKER_MODE=true

# Pelo menos um provider de LLM:
GROQ_API_KEY=gsk_...
# ou
DEEPSEEK_API_KEY=sk-...
# ou
OPENAI_API_KEY=sk-...
```

### 1.4 Testar manualmente

```bash
bun run src/worker/main.ts
# Em outro terminal:
curl http://localhost:3000/health
```

---

## 2. PM2 — Process Manager (Recomendado)

PM2 garante que o Worker reinicia automaticamente se cair.

### 2.1 Instalar PM2

```bash
npm install -g pm2
```

### 2.2 Criar ecosystem.config.js

```bash
cat > /opt/jarvis/ecosystem.config.js << 'EOF'
module.exports = {
  apps: [{
    name: 'jarvis-worker',
    script: 'src/worker/main.ts',
    interpreter: 'bun',
    cwd: '/opt/jarvis',
    env: {
      WORKER_PORT: 3000,
      WORKER_MODE: 'true',
      NODE_ENV: 'production',
    },
    // Restart configs
    max_restarts: 10,
    restart_delay: 5000,
    exp_backoff_restart_delay: 100,
    // Logs
    log_date_format: 'YYYY-MM-DD HH:mm:ss',
    error_file: '/var/log/jarvis/error.log',
    out_file: '/var/log/jarvis/out.log',
    merge_logs: true,
    // Memory guard
    max_memory_restart: '500M',
  }]
}
EOF
```

### 2.3 Iniciar e persistir

```bash
# Criar diretorio de logs
sudo mkdir -p /var/log/jarvis
sudo chown $USER:$USER /var/log/jarvis

# Iniciar
pm2 start ecosystem.config.js

# Verificar
pm2 status
pm2 logs jarvis-worker

# Salvar para reiniciar no boot
pm2 save
pm2 startup
# (execute o comando que ele sugerir com sudo)
```

### 2.4 Comandos uteis PM2

```bash
pm2 status                    # Ver status
pm2 logs jarvis-worker        # Ver logs em tempo real
pm2 restart jarvis-worker     # Reiniciar
pm2 stop jarvis-worker        # Parar
pm2 monit                     # Monitor interativo (CPU, RAM, loops)
pm2 flush                     # Limpar logs
```

---

## 3. Alternativa: systemd

Se preferir nao usar PM2, systemd funciona nativamente no Linux.

### 3.1 Criar service file

```bash
sudo cat > /etc/systemd/system/jarvis-worker.service << 'EOF'
[Unit]
Description=JARVIS Worker v5.0.0
After=network.target

[Service]
Type=simple
User=jarvis
WorkingDirectory=/opt/jarvis
ExecStart=/home/jarvis/.bun/bin/bun run src/worker/main.ts
Restart=always
RestartSec=5
Environment=WORKER_PORT=3000
Environment=WORKER_MODE=true
Environment=NODE_ENV=production

# Logs
StandardOutput=journal
StandardError=journal
SyslogIdentifier=jarvis-worker

# Seguranca
NoNewPrivileges=true
ProtectSystem=strict
ReadWritePaths=/opt/jarvis /home/jarvis/.jarvis

[Install]
WantedBy=multi-user.target
EOF
```

### 3.2 Ativar e iniciar

```bash
sudo systemctl daemon-reload
sudo systemctl enable jarvis-worker
sudo systemctl start jarvis-worker

# Verificar
sudo systemctl status jarvis-worker
sudo journalctl -u jarvis-worker -f    # logs em tempo real
```

---

## 4. Nginx — Reverse Proxy + HTTPS

### 4.1 Instalar Nginx + Certbot

```bash
sudo apt install nginx certbot python3-certbot-nginx
```

### 4.2 Configurar site

```bash
sudo cat > /etc/nginx/sites-available/jarvis << 'EOF'
server {
    listen 80;
    server_name jarvis.seudominio.com;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;

        # Timeout longo para missoes longas
        proxy_read_timeout 300s;
        proxy_connect_timeout 75s;
    }
}
EOF

sudo ln -s /etc/nginx/sites-available/jarvis /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

### 4.3 HTTPS com Let's Encrypt

```bash
sudo certbot --nginx -d jarvis.seudominio.com
# Renovacao automatica ja fica configurada
```

---

## 5. Seguranca

### 5.1 Firewall (UFW)

```bash
sudo ufw allow ssh
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
# NAO abra a porta 3000 diretamente — use Nginx como proxy
sudo ufw enable
```

### 5.2 Autenticacao na API

O Worker ja tem tabela `api_users` no SQLite. Para ativar autenticacao:

1. Crie um usuario via SQLite:
```bash
bun -e "
const { getDatabase } = require('./src/worker/db/schema.ts');
const db = getDatabase();
const crypto = require('crypto');
const key = 'jrv_' + crypto.randomBytes(24).toString('hex');
db.run('INSERT INTO api_users (id, username, api_key, is_admin, created_at, is_active) VALUES (?, ?, ?, 1, ?, 1)',
  [crypto.randomUUID(), 'admin', key, Date.now()]);
console.log('API Key:', key);
"
```

2. Use a key nas requisicoes:
```bash
curl -H "Authorization: Bearer jrv_..." http://localhost:3000/api/mission
```

> **Nota**: O middleware de auth precisa ser implementado no server.ts
> para validar o header Authorization contra a tabela api_users.
> Atualmente os endpoints sao abertos. Implemente antes de expor na internet.

### 5.3 Rate Limiting

Adicione no Nginx:

```nginx
# No bloco http {} do nginx.conf
limit_req_zone $binary_remote_addr zone=jarvis:10m rate=10r/s;

# No bloco location do site
limit_req zone=jarvis burst=20 nodelay;
```

---

## 6. Monitoramento

### 6.1 Health Check automatico

Crie um cron que verifica se o Worker esta respondendo:

```bash
# Adicionar ao crontab (crontab -e)
*/5 * * * * curl -sf http://localhost:3000/health > /dev/null || pm2 restart jarvis-worker
```

### 6.2 Log Rotation

```bash
sudo cat > /etc/logrotate.d/jarvis << 'EOF'
/var/log/jarvis/*.log {
    daily
    missingok
    rotate 14
    compress
    delaycompress
    notifempty
    create 0640 jarvis jarvis
    sharedscripts
    postrotate
        pm2 flush
    endscript
}
EOF
```

### 6.3 Alertas (opcional)

Script simples de alerta via webhook/telegram:

```bash
#!/bin/bash
# /opt/jarvis/scripts/health-alert.sh
STATUS=$(curl -sf http://localhost:3000/health | jq -r .status)
if [ "$STATUS" != "running" ]; then
    curl -s "https://api.telegram.org/bot<TOKEN>/sendMessage" \
      -d "chat_id=<CHAT_ID>&text=JARVIS Worker DOWN!"
fi
```

---

## 7. Backup

### 7.1 SQLite Database

```bash
# Backup diario do banco
0 3 * * * cp ~/.jarvis/worker.db ~/.jarvis/backups/worker-$(date +\%Y\%m\%d).db
```

### 7.2 Relatorios de Missao

```bash
# Sync relatorios para storage externo
0 4 * * * rsync -az ~/.jarvis/night-worker-reports/ /backup/jarvis-reports/
```

---

## 8. Checklist de Deploy

- [ ] Bun instalado e atualizado
- [ ] Projeto clonado em `/opt/jarvis`
- [ ] `.env` configurado com pelo menos 1 provider LLM
- [ ] `bun run src/worker/main.ts` funciona manualmente
- [ ] PM2 ou systemd configurado e ativo
- [ ] `pm2 save` + `pm2 startup` executados
- [ ] Nginx configurado como reverse proxy
- [ ] HTTPS via Let's Encrypt ativo
- [ ] Firewall (UFW) ativo — apenas 22, 80, 443
- [ ] Autenticacao na API implementada (antes de expor)
- [ ] Health check cron ativo
- [ ] Log rotation configurado
- [ ] Backup do SQLite agendado
- [ ] Teste: `curl https://jarvis.dominio.com/health`

---

## Troubleshooting

### Worker nao inicia

```bash
# Verificar logs
pm2 logs jarvis-worker --lines 50

# Verificar porta em uso
ss -tlnp | grep 3000

# Verificar Bun
which bun && bun --version
```

### Missao fica presa em "running"

```bash
# Verificar missoes ativas
curl localhost:3000/api/mission?status=running

# Cancelar missao travada
curl -X POST localhost:3000/api/mission/<ID>/cancel
```

### Banco corrompido

```bash
# Parar worker
pm2 stop jarvis-worker

# Verificar integridade
sqlite3 ~/.jarvis/worker.db "PRAGMA integrity_check;"

# Se corrompido, restaurar backup
cp ~/.jarvis/backups/worker-YYYYMMDD.db ~/.jarvis/worker.db

# Reiniciar
pm2 start jarvis-worker
```

### Alta memoria

```bash
# PM2 ja reinicia se passar de 500M (configurado no ecosystem)
# Para verificar manualmente:
pm2 monit
```
