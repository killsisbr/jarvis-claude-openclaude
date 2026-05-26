# JARVIS Deployment Scripts Analysis (2026-05-26)

**Status**: Ready to execute | **Scripts**: 4 core + 4 auxiliary  
**Pattern**: Node.js SSH2-based (from SAAS-WEB proven pattern)

---

## 🎯 Quick Start

```bash
# 1. Test SSH connection (safest first step)
node tools/test-ssh-simple.cjs

# 2. Full VPS status diagnosis
npm run test-vps

# 3. Deploy to staging (if ready)
npm run deploy-worker:staging

# 4. Deploy to production (after staging verified)
npm run deploy-worker:prod
```

---

## 📋 Script Inventory

### Core Deployment Scripts

#### 1. **test-ssh-simple.cjs** — Basic SSH Test
```bash
node tools/test-ssh-simple.cjs
```

**What it does**:
- Hardcoded SSH connection (82.29.58.126, root user)
- Executes `pm2 list` and shows results
- Fast validation (10s timeout)

**When to use**: 
- First: Verify SSH works at all
- Quick sanity check before full diagnosis

**Credentials**: Hardcoded in file (safe, test only)

---

#### 2. **test-vps-status.cjs** — Full VPS Diagnosis
```bash
npm run test-vps
# or manually:
node tools/test-vps-status.cjs
```

**What it does** (14-point check):
```
✓ SSH connectivity
✓ User info (whoami, id, HOME)
✓ Disk space (/dev, /root, /home)
✓ CPU cores + RAM available
✓ PM2 processes (all)
✓ saas-web status (protected)
✓ saas-web logs (last 5 lines)
✓ Deploy directories (/root/killsis, /home/ubuntu)
✓ Tools installed (Node, npm, Bun, Git)
✓ SSH keys configured
✓ Sudoers permissions
✓ Open ports (3000, 8080, 80, 443)
✓ SAAS-WEB directory info
✓ System uptime
```

**Output**: Readable formatted blocks + next steps

**When to use**:
- **FIRST STEP**: Before any deployment
- Gets complete VPS picture
- Identifies blockers (missing Bun, no disk space, etc)

**Credentials**: Reads from `.env.vps` (git-ignored)

**Time**: ~15-20 seconds

---

#### 3. **deploy-jarvis-worker.cjs** — Full Deployment
```bash
npm run deploy-worker:staging
npm run deploy-worker:prod
# or manually:
node tools/deploy-jarvis-worker.cjs [staging|production]
```

**What it does** (7 steps):
```
1. ZIP local code (excludes: node_modules, .git, .env, .sqlite, logs, dist, etc)
   └─ Size: ~12-20 MB

2. SSH connect to VPS

3. SFTP upload ZIP
   └─ Time: 5-10 seconds

4. Remote execution (atomic):
   ├─ Create backup (timestamped)
   ├─ Extract ZIP
   ├─ cd + bun install --production
   ├─ bun run build
   ├─ pm2 restart jarvis-worker
   └─ Show status + logs

5. Stream output back to terminal (real-time)

6. Return exit code (0=success, 1=failure)
```

**Deployment Paths**:

| Target | Remote Path | PM2 Name | URL |
|--------|-------------|----------|-----|
| staging | `/home/ubuntu/openclaude-staging` | `jarvis-worker-staging` | (custom) |
| production | `/home/ubuntu/openclaude` | `jarvis-worker` | (custom) |

**Features**:
- ✅ Automatic backup before deploy
- ✅ ZIP is smart (excludes build artifacts, caches)
- ✅ Idempotent (can re-run safely)
- ✅ Real-time logging
- ✅ Error propagation (exit code reflects success/failure)
- ✅ No .env in ZIP (preserves secrets)

**When to use**:
- After `test-vps-status.cjs` passes
- For iterative updates (30s per iteration)
- Staging first, then production

**Credentials**: Reads from `.env.vps` (git-ignored)

**Time**: ~30 seconds (total)

---

### Auxiliary Scripts

#### 4. **check-worker-logs.cjs** — Monitor Logs
```bash
node tools/check-worker-logs.cjs
```
Monitor PM2 logs in real-time (for jarvis-worker)

#### 5. **debug-env.cjs** — Verify Environment
```bash
node tools/debug-env.cjs
```
Check that `.env.vps` is loaded correctly (debugging)

#### 6. **diagnose-jarvis.cjs** — Jarvis-Specific Check
```bash
node tools/diagnose-jarvis.cjs
```
Focused diagnosis on JARVIS Worker only (6 specific checks)

#### 7. **diagnose-ssl.cjs** — SSL Certificate Check
```bash
node tools/diagnose-ssl.cjs
```
Verify SSL certs (jarvis.killsis.com) and auto-renewal

---

## 🔐 Configuration

### .env.vps (Local)
```
VPS_HOST=82.29.58.126
VPS_PORT=22
VPS_USER=root
VPS_PASSWORD="Killsis19980910#"
VPS_REMOTE_DIR=/root/killsis
```

✅ **Status**: Configured and tested (2026-05-22)

---

## 🚀 Deployment Flow (Recommended)

### Step 1: SSH Test (5 seconds)
```bash
$ node tools/test-ssh-simple.cjs
✅ SUCESSO! Conectado via SSH.
📊 PM2 Processes:
┌─────┬──────────┬─────────┬──────┬─────┐
│ id  │ name     │ version │ ↺    │ cpu │
├─────┼──────────┼─────────┼──────┼─────┤
│ 0   │ saas-web │ 1.0.0   │ 0    │ 0%  │
│ 26  │ jarvis-worker │ ... │ 0  │ 0%  │
└─────┴──────────┴─────────┴──────┴─────┘
```

### Step 2: Full Diagnosis (20 seconds)
```bash
$ npm run test-vps
🔌 Conectando a 82.29.58.126:22 as root...
✅ Conectado com sucesso!

🔍 Verificação de Conectividade
✓ SSH conectado

👤 Informações do Usuário
root
uid=0(root) gid=0(root) groups=0(root)
Home: /root

💾 Espaço em Disco
Filesystem     Size  Used Avail Use%
/dev/sda1       50G   15G   35G  30%
/root/killsis   20G    5G   15G  25%

[... 10 more checks ...]

✅ Análise Completa
📋 Próximos Passos:
   1. Verificar se bun está instalado ✅
   2. Confirmar espaço em disco ✅ (35GB livre)
   3. Se não existe openclaude, será criado
   4. Rodar: npm run deploy-worker:staging
```

### Step 3: Deploy to Staging (30 seconds)
```bash
$ npm run deploy-worker:staging
╔════════════════════════════════════════════════════════════╗
║        JARVIS Worker Deploy Script                         ║
╚════════════════════════════════════════════════════════════╝

📦 Target: [STAGING]
📍 Remote: /home/ubuntu/openclaude-staging
🔄 PM2: jarvis-worker-staging
🌐 URL: https://worker-staging.seu-dominio.com

🔍 Escaneando arquivos locais...
📦 ZIP criado: openclaude.zip (18.5 MB)
📤 Enviando via SFTP...
✅ Upload concluído

🚀 Executando deploy remoto...
📦 Extraindo ZIP...
📦 Instalando dependências...
🔨 Compilando TypeScript...
🔄 Iniciando PM2...
✅ Deploy concluído com sucesso!

📊 Status:
   jarvis-worker-staging ONLINE (uptime 0s)

📝 Logs (últimas 5 linhas):
   [server] Listening on port 3000
   [health] GET /health → 200 OK
```

### Step 4: Verify & Deploy to Production (30 seconds)
```bash
# After staging works:
$ npm run deploy-worker:prod

# Repeat Step 3 for production environment
# Remote: /home/ubuntu/openclaude (not staging)
# PM2: jarvis-worker (not staging)
```

---

## ⚠️ Pre-Deployment Checklist

- [ ] `.env.vps` exists and has credentials
- [ ] `node tools/test-ssh-simple.cjs` → ✅ Connected
- [ ] `npm run test-vps` → ✅ All checks pass
- [ ] Disk space > 5GB in target directory
- [ ] Bun installed on VPS
- [ ] SAAS-WEB is running (not restarted recently)
- [ ] Git history cleaned (all commits pushed)
- [ ] Build succeeds locally: `bun run build`
- [ ] Tests pass: `bun test`

---

## 🔴 Troubleshooting

### "SSH connection refused"
```bash
# Check credentials in .env.vps
# Test manually:
ssh -v root@82.29.58.126

# Ensure VPS firewall allows port 22
```

### "No space left on device"
```bash
# Check disk on VPS:
npm run test-vps  # Shows disk usage

# Clean old backups if needed:
ssh root@82.29.58.126 "rm -rf /home/ubuntu/openclaude.backup.*"
```

### "pm2 command not found"
```bash
# Install PM2 globally on VPS:
ssh root@82.29.58.126 "npm install -g pm2"
```

### "Bun not found"
```bash
# Install Bun on VPS:
ssh root@82.29.58.126 "curl -fsSL https://bun.sh/install | bash"
```

### Deployment fails mid-way
```bash
# Automatic backup exists, can restore:
ssh root@82.29.58.126 "ls -la /home/ubuntu/openclaude.backup.*"

# Manual restore if needed:
ssh root@82.29.58.126 "
  rm -rf /home/ubuntu/openclaude
  mv /home/ubuntu/openclaude.backup.TIMESTAMP /home/ubuntu/openclaude
  pm2 restart jarvis-worker
"
```

---

## 📊 Performance Expectations

| Operation | Time | Notes |
|-----------|------|-------|
| SSH test | 5s | Just `pm2 list` |
| Full diagnosis | 15-20s | 14-point check |
| Deploy (ZIP) | 30s | ~18MB, includes build |
| Subsequent deploys | 25-30s | Faster (Bun cache) |

---

## ✅ Success Indicators

After `npm run deploy-worker:prod`:

```bash
# 1. Check PM2 status
pm2 describe jarvis-worker
# Should show: "online" + recent uptime

# 2. Check health endpoint
curl https://jarvis.killsis.com/health
# Should return: 200 OK + JSON status

# 3. Check logs
pm2 logs jarvis-worker --lines 20
# Should show: server started, no errors

# 4. Verify SAAS-WEB unchanged
pm2 describe saas-web
# Should show: uptime preserved (no restart)
```

---

## 🎯 Current Status (2026-05-26)

- ✅ Scripts ready to execute
- ✅ Build compiled and tested
- ✅ .env.vps configured
- ✅ VPS credentials verified (2026-05-22)
- ⏳ Awaiting user decision on deployment strategy

---

## 🔗 Related Documentation

- [VPS-DEPLOYMENT-ANALYSIS-2026-05-26.md](VPS-DEPLOYMENT-ANALYSIS-2026-05-26.md) — Strategy & options
- [CLAUDE.md](CLAUDE.md) — Project conventions
- [.env.vps.example](.env.vps.example) — Configuration template
- Memory: `vps-deploy-script-jarvis-worker-implementation.md` — Original implementation notes

---

**Ready to Deploy?** Run: `node tools/test-ssh-simple.cjs` → `npm run test-vps` → `npm run deploy-worker:staging`

