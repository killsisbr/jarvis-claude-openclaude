# VPS Analysis Guide - JARVIS Worker Deployment

**Como usar os scripts de análise VPS para diagnóstico e configuração**

---

## 📋 Visão Geral

5 scripts para analisar VPS sem modificar nada:

1. `check_vps.cjs` — Análise geral (11 pontos)
2. `check_pm2_full.cjs` — Processos rodando
3. `check_nginx.cjs` — NGINX config (20 pontos)
4. `check_nginx_retry.cjs` — NGINX com retry
5. `test_vps_ssh.ps1/sh` — Teste SSH multiplataforma

---

## 🚀 Quickstart

### 1. Instalar Dependência

```bash
npm install ssh2
# ou com bun
bun add ssh2
```

### 2. Configurar Credenciais

Editar qualquer `.cjs`:
```javascript
const sshConfig = {
    host: '82.29.58.126',
    port: 22,
    username: 'root',
    password: 'sua-senha'
};
```

### 3. Rodar Análise

```bash
node check_vps.cjs
node check_pm2_full.cjs
node check_nginx.cjs
pwsh test_vps_ssh.ps1        # Windows
bash test_vps_ssh.sh          # Linux/Mac
```

---

## 📊 Script 1: check_vps.cjs

**11 diagnósticos do VPS**

### Uso
```bash
node check_vps.cjs
```

### O que analisa
1. Sistema operacional
2. Espaço em disco
3. Uso de memória
4. CPU (cores, L3 cache)
5. Processos principais
6. Portas abertas
7. Uptime do sistema
8. Network interfaces
9. Swap memory
10. Load average
11. Recomendações de deploy

### Interpretação

| Métrica | Bom | Aviso | Ruim |
|---------|-----|-------|------|
| Disco livre | >50% | 20-50% | <20% |
| Memória | >50% | 20-50% | <20% |
| CPU médio | <70% | 70-90% | >90% |
| Portas livres | >5 | 2-5 | <2 |

**Se disco/memória < 20%**: Limpar antes de deploy.

---

## 📦 Script 2: check_pm2_full.cjs

**Análise de processos PM2**

### Uso
```bash
node check_pm2_full.cjs
```

### Output esperado
```
id | name        | version | pid   | uptime
───┼─────────────┼─────────┼───────┼────────
0  | crm-atlas   | v2.1.0  | 12345 | 11d
1  | saas-web    | v3.0.0  | 23456 | 30h
2  | saas-web-s  | v3.0.0  | 34567 | 30h

Memory:
  crm-atlas: 161.9 MB
  saas-web: 273.4 MB
```

### Interpretação

**Uptime:**
- `11d` = 11 dias (excelente)
- `30h` = 30 horas (recente)
- `⏹️` = parado

**Restarts:**
- 0-5 = normal
- 20-100 = atenção
- >300 = crash loop

**Memória:**
- <500MB = normal
- 500MB-1GB = aceitável
- >1GB = vazamento

---

## 🌐 Script 3: check_nginx.cjs

**20 análises NGINX**

### Uso
```bash
node check_nginx.cjs
```

### O que analisa
```
1️⃣   NGINX STATUS
2️⃣   NGINX VERSION
3️⃣   NGINX CONFIG TEST
4️⃣   MAIN CONFIG
5️⃣   SITES HABILITADOS
6️⃣   SITE DEFAULT
7️⃣   OUTROS SITES
8️⃣   CONFIGURAÇÕES EXTRAS
9️⃣   REVERSE PROXIES
🔟   SERVER BLOCKS
1️⃣1️⃣   SSL CERTIFICATES
1️⃣2️⃣   ACCESS LOGS
1️⃣3️⃣   ERROR LOGS
1️⃣4️⃣   PROCESSOS NGINX
1️⃣5️⃣   PORTAS NGINX
1️⃣6️⃣   DIREITOS DE ARQUIVO
1️⃣7️⃣   WORKER PROCESSES
1️⃣8️⃣   CACHE SETTINGS
1️⃣9️⃣   GZIP COMPRESSION
2️⃣0️⃣   RATE LIMITING
```

### Interpretação

**Status:**
- `active (running)` = ✅
- `inactive (dead)` = ⚠️
- `failed` = ❌

**Config Test:**
- `successful` = ✅ válida
- `failed` = ❌ erro de sintaxe

**SSL:**
- `/etc/letsencrypt/live/` = Let's Encrypt ativo
- `/etc/nginx/ssl/` = Certificados custom
- Nenhum = HTTP apenas

---

## 🔄 Script 4: check_nginx_retry.cjs

Mesmo que `check_nginx.cjs`, mas com retry automático (3 tentativas).

Útil quando VPS está sob carga.

---

## 🔐 Script 5: test_vps_ssh.ps1 / .sh

**Teste SSH multiplataforma**

### Windows
```bash
pwsh test_vps_ssh.ps1
```

Requer: PowerShell 7+, sshpass (instalado automaticamente)

### Linux/Mac
```bash
bash test_vps_ssh.sh
```

Requer: Bash 4+, sshpass (instalado automaticamente)

### Troubleshooting SSH

**"sshpass: command not found"**
```bash
# Ubuntu/Debian
sudo apt-get install sshpass

# CentOS/RHEL
sudo yum install sshpass

# macOS
brew install sshpass
```

**"Connection refused"**
- VPS offline
- Firewall bloqueando porta 22
- Limite de conexões atingido → tente em alguns segundos

**"Authentication failed"**
- Credenciais incorretas
- Remova ~/.ssh/known_hosts e tente novamente

---

## 📊 Workflow Completo

### 1️⃣ Teste SSH
```bash
pwsh test_vps_ssh.ps1    # Windows
bash test_vps_ssh.sh     # Linux/Mac
```
✅ Esperado: conectado com sucesso

### 2️⃣ Análise VPS
```bash
node check_vps.cjs
```
Verificar:
- ✅ Portas livres (3001+)
- ✅ Disco >50GB livre
- ✅ Memória >10GB livre

### 3️⃣ Análise PM2
```bash
node check_pm2_full.cjs
```
Verificar:
- ✅ Processos rodando
- ✅ Portas ocupadas
- ⚠️ Muitos restarts? = app instável

### 4️⃣ Análise NGINX
```bash
node check_nginx_retry.cjs
```
Verificar:
- ✅ NGINX: `active (running)`
- ✅ Config: `successful`
- ✅ Certificados SSL (se necessário)

### 5️⃣ Decisão de Deploy
```bash
# Opção A: Direto (simples)
WORKER_PORT=3001 bun src/worker/main.ts

# Opção B: PM2 (recomendado)
pm2 start bun --name jarvis-worker -- src/worker/main.ts

# Opção C: NGINX reverse proxy (produção)
# (seguir recomendações do check_nginx.cjs)
```

---

## ⚠️ Troubleshooting

**"Connection lost before handshake"**
- VPS rejeitando conexões (limite SSH atingido)
- Solução: Aguarde 30s e tente novamente

**"All configured authentication methods failed"**
- Senha incorreta
- Solução: Verificar sshConfig (com `#` se necessário)

**Script lento/timeout**
- NGINX tem muita configuração
- Solução: Usar `check_nginx_retry.cjs`

**Sem acesso à VPS**
- Firewall bloqueando SSH
- Solução: Contactar provedor VPS

---

## ✅ Checklist Pré-Deploy

- [ ] SSH funcionando
- [ ] Disco livre >50GB
- [ ] Memória livre >10GB
- [ ] Porta 3001+ disponível
- [ ] NGINX rodando
- [ ] Sem crash loops (restarts <100)

---

## 🔗 Links

- [GUIA_DEPLOYMENT_VPS.md](GUIA_DEPLOYMENT_VPS.md) — Deploy passo a passo
- [README.md](README.md) — Quick start
- [ARCHITECTURE.md](ARCHITECTURE.md) — Design técnico

---

**Última atualização**: 2026-05-19  
**Status**: Scripts testados ✅
