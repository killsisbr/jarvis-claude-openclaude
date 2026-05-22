# 🐳 Deploy JARVIS Worker com Docker

Deploy seguro na VPS em 5 minutos.

---

## 1️⃣ Pré-requisitos

```bash
# Instalar Docker + Docker Compose
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# Verificar instalação
docker --version
docker-compose --version

# Adicionar seu usuário ao grupo docker (sem sudo)
sudo usermod -aG docker $USER
# Logout e login novamente para ativar
```

---

## 2️⃣ Setup na VPS

### **A. Clonar o repositório**

```bash
cd /home/ubuntu
git clone https://github.com/Gitlawb/openclaude.git
cd openclaude
```

### **B. Configurar .env**

```bash
# Copiar template
cp .env.example .env

# Editar com suas keys
nano .env
```

Adicionar:
```
ANTHROPIC_API_KEY=sk-ant-...
OPENAI_API_KEY=sk-...
DEEPSEEK_API_KEY=...
JARVIS_SYSTEM_PROMPT="Você é JARVIS, assistente autônomo..."
WORKER_PORT=3000
```

---

## 3️⃣ Build e Deploy

### **Opção A: Build local (recomendado)**

```bash
# Build
docker-compose build

# Verificar (deve listar jarvis-worker)
docker images

# Rodar
docker-compose up -d

# Verificar logs
docker-compose logs -f jarvis-worker

# Verificar se rodou
curl http://localhost:3000/health
```

### **Opção B: Pull imagem pre-built (quando disponível)**

```bash
# Será disponível depois
docker pull killsis/jarvis-worker:latest
docker-compose up -d
```

---

## 4️⃣ Gerenciar o Container

### **Ver status**

```bash
docker-compose ps
# ou
docker ps
```

### **Ver logs em tempo real**

```bash
docker-compose logs -f jarvis-worker

# Últimas 50 linhas
docker-compose logs --tail 50 jarvis-worker

# Apenas erros
docker-compose logs jarvis-worker | grep -i error
```

### **Parar/Reiniciar**

```bash
# Parar
docker-compose stop

# Reiniciar
docker-compose restart

# Parar e remover containers
docker-compose down

# Parar e remover tudo (volumes também)
docker-compose down -v
```

### **Entrar no container (debug)**

```bash
docker-compose exec jarvis-worker bash

# Agora você está dentro do container
# Ver arquivos
ls -la
cat /home/jarvis/.jarvis/logs/*.log
```

---

## 5️⃣ Monitoramento

### **Health check automático**

```bash
# Docker já faz isso (vê docker-compose.yml)
# Verifica http://localhost:3000/health a cada 30s

docker-compose ps
# HEALTH STATUS vai aparecer como "healthy" ou "unhealthy"
```

### **Monitorar recursos (CPU/RAM)**

```bash
# Ver uso em tempo real
docker stats jarvis-worker

# Ou via systemd (se instalou como serviço)
systemctl status docker
```

### **Alertas (opcional)**

```bash
# Notificar se container morrer
watch -n 5 'docker-compose ps | grep jarvis-worker'

# Ou configurar com cron
*/5 * * * * docker ps | grep jarvis-worker || docker-compose restart >> /tmp/jarvis-restart.log 2>&1
```

---

## 6️⃣ Produção (systemd auto-start)

### **Criar serviço systemd**

```bash
sudo nano /etc/systemd/system/jarvis-worker.service
```

Adicionar:
```ini
[Unit]
Description=JARVIS Worker Container
After=docker.service
Requires=docker.service

[Service]
Type=simple
WorkingDirectory=/home/ubuntu/openclaude
ExecStart=/usr/bin/docker-compose up
ExecStop=/usr/bin/docker-compose down
Restart=always
RestartSec=10s
User=ubuntu

[Install]
WantedBy=multi-user.target
```

Ativar:
```bash
sudo systemctl daemon-reload
sudo systemctl enable jarvis-worker
sudo systemctl start jarvis-worker
sudo systemctl status jarvis-worker

# Ver logs
sudo journalctl -u jarvis-worker -f
```

---

## 7️⃣ Nginx Reverse Proxy (opcional)

Se quer acessar `https://jarvis.seu-dominio.com` em vez de `http://vps-ip:3000`:

```bash
sudo apt install nginx
sudo nano /etc/nginx/sites-available/jarvis-worker
```

Adicionar:
```nginx
server {
    listen 80;
    server_name jarvis.seu-dominio.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

Ativar:
```bash
sudo ln -s /etc/nginx/sites-available/jarvis-worker /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx

# HTTPS com Let's Encrypt (certbot)
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d jarvis.seu-dominio.com
```

---

## 8️⃣ Isolamento de Segurança

### **Worker isolado de seus projetos**

No `docker-compose.yml`, os projetos aparecem em read-only:

```yaml
volumes:
  # Descomente pra dar acesso (read-only)
  - /home/ubuntu/crm-venda:/data/crm-venda:ro
  - /home/ubuntu/minecraft-plugins:/data/minecraft-plugins:ro
```

Com isso:
- Worker pode LER `/data/crm-venda` (pesquisar código, análise)
- Worker NÃO consegue ESCREVER/DELETAR
- Mesmo que Claude peça `rm /data/*`, não funciona

### **Recursos limitados**

```yaml
resources:
  limits:
    cpus: '1'           # Máximo 1 CPU
    memory: 2G          # Máximo 2GB RAM
```

Se worker tentar usar mais, é automaticamente killed.

---

## 9️⃣ Troubleshooting

| Erro | Solução |
|------|---------|
| `docker: command not found` | Instalar Docker (veja pré-requisitos) |
| `permission denied` | Adicionar user ao grupo docker: `sudo usermod -aG docker $USER` |
| `Container exits immediately` | Ver logs: `docker-compose logs` |
| `Port 3000 already in use` | Mudar porta em docker-compose.yml: `"3001:3000"` |
| `Can't connect to health check` | Esperar 40s, container está inicializando |

---

## 🎯 Comandos Úteis (Cheat Sheet)

```bash
# Setup inicial
docker-compose build
docker-compose up -d

# Monitoramento
docker-compose ps
docker-compose logs -f
docker stats jarvis-worker

# Gerenciamento
docker-compose restart
docker-compose stop
docker-compose down

# Debug
docker-compose exec jarvis-worker bash
docker inspect jarvis-worker

# Limpeza
docker system prune -a
docker volume prune
```

---

**Pronto! Worker rodando isolado, seguro e 24/7 na VPS.**

Próximo: Configurar cron jobs para disparar missões automaticamente (`/api/mission`).
