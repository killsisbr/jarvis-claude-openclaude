# JARVIS Deployment — Ready to Execute ✅

**Status**: All systems ready | **Date**: 2026-05-26 20:00 UTC  
**Scripts**: Analyzed & optimized | **Risk Level**: LOW (if test-vps passes)

---

## 🎯 Recommended Action Plan

### Phase 1: Verification (No Changes - Read-Only)

#### Step 1️⃣: Test SSH Connection (5 seconds)
```bash
node tools/test-ssh-simple.cjs
```

**What to expect**:
```
✅ SUCESSO! Conectado via SSH.

📊 PM2 Processes:
┌────┬───────────┬─────────┐
│ id │ name      │ version │
├────┼───────────┼─────────┤
│ 0  │ saas-web  │ 1.0.0   │
│ 26 │ jarvis... │ 5.0.0   │  (if already deployed)
└────┴───────────┴─────────┘
```

**If fails**: SSH credentials invalid → check `.env.vps`

**Time**: ~5 seconds

---

#### Step 2️⃣: Full VPS Diagnosis (20 seconds)
```bash
npm run test-vps
```

**What to expect**:
```
✅ Conectado com sucesso!

🔍 Verificação de Conectividade
✓ SSH conectado

👤 Informações do Usuário
root uid=0(root) gid=0(root)

💾 Espaço em Disco
/dev/sda1 50G 15G 35G ← Need >5GB for deploy

⚙️ Recursos Disponíveis
CPU Cores: 4
RAM Total: 8GB ← Enough for worker + SAAS-WEB

🔄 PM2 Status (Todos os processos)
id │ name       │ status
0  │ saas-web   │ online ← PROTECTED
26 │ jarvis...  │ online | offline | (missing?)

[... 10 more checks ...]

📋 Próximos Passos:
   1. Verificar se bun está instalado ✅
   2. Confirmar espaço em disco ✅ (35GB livre)
   3. Se não existe /home/ubuntu/openclaude, será criado
   4. Rodar: npm run deploy-worker:staging
```

**Critical checks**:
- [ ] SAAS-WEB is **online** (do NOT touch)
- [ ] Disk space > 5GB
- [ ] Bun is installed (or will be installed)
- [ ] Port 3000 available

**If any fails**: Consult troubleshooting section

**Time**: ~15-20 seconds

---

### Phase 2: Decision Point ⚠️

Based on Step 2 results, choose deployment strategy:

#### Option A: Update Existing (If JARVIS Worker already online)
**Best for**: Code updates, small iterations

```bash
# On VPS:
cd /home/ubuntu/openclaude
git pull origin main
bun run build
pm2 restart jarvis-worker
pm2 save
```

**Pros**: 
- Minimal disruption
- Preserves existing config

**Cons**:
- Need SSH access directly
- Git history on VPS matters

**Risk**: LOW

---

#### Option B: Fresh Deploy via Script (Recommended)
**Best for**: First deployment or major changes

```bash
# Staging first (safe test)
npm run deploy-worker:staging

# After verification
npm run deploy-worker:prod
```

**Pros**:
- Automated
- Backup before deploy
- Idempotent (can re-run safely)
- Fast (30 seconds)

**Cons**:
- Creates separate directory (/home/ubuntu/openclaude)
- Overwrites if path exists

**Risk**: LOW-MEDIUM (backup exists)

---

#### Option C: Docker (Safest)
**Best for**: Long-term production

Not covered in this script set. See Docker deployment guide.

**Risk**: LOWEST

---

### Phase 3: Execution (After Decision)

#### If choosing Option B (Script):

**Step 3️⃣: Deploy to Staging**
```bash
npm run deploy-worker:staging
```

**What happens**:
1. ZIP local code (~18MB)
2. SSH connect to VPS
3. SFTP upload ZIP (5-10s)
4. Backup existing version
5. Extract ZIP
6. `bun install --production`
7. `bun run build`
8. `pm2 restart jarvis-worker-staging`
9. Show logs

**Expected output**:
```
╔════════════════════════════════════════════════════════════╗
║        JARVIS Worker Deploy Script                         ║
╚════════════════════════════════════════════════════════════╝

📦 Target: [STAGING]
📍 Remote: /home/ubuntu/openclaude-staging
🔄 PM2: jarvis-worker-staging

🔍 Escaneando arquivos locais...
📦 ZIP criado: openclaude.zip (18.5 MB)
📤 Enviando via SFTP...  [████████████████████] 100%
✅ Upload concluído

🚀 Executando deploy remoto...
📦 Extraindo ZIP...
📦 Instalando dependências...
[... progress ...]
✅ Deploy concluído com sucesso!

📊 Status:
   jarvis-worker-staging ONLINE (uptime 0s)

📝 Logs (últimas 5 linhas):
   [server] ✓ Server started on port 3000
   [health] GET /health → 200 OK
   [ready] Worker ready for requests
```

**Verification after staging**:
```bash
# Check if it's running
pm2 describe jarvis-worker-staging

# Check logs
pm2 logs jarvis-worker-staging --lines 20

# Check health
curl http://localhost:3001/health  # if using different port
# or from VPS: curl http://localhost:3000/health
```

**Time**: ~30 seconds

---

**Step 4️⃣: Deploy to Production** (After staging verified)
```bash
npm run deploy-worker:prod
```

Same process as staging, but to `/home/ubuntu/openclaude` (production path)

**Time**: ~30 seconds

---

### Phase 4: Post-Deployment Verification

```bash
# 1. Check PM2 status (both workers)
pm2 status

# 2. Check SAAS-WEB (must be unchanged)
pm2 describe saas-web
# Should show: same uptime as before deploy

# 3. Check JARVIS Worker logs
pm2 logs jarvis-worker --lines 20

# 4. Test endpoint
curl http://localhost:3000/health
# Should return: { "status": "running", ... }

# 5. Check HTTPS (if configured)
curl https://jarvis.killsis.com/health
# Should return: 200 OK
```

**✅ Success**: All checks pass, SAAS-WEB uptime preserved

**❌ Problem**: Immediately restore backup
```bash
# On VPS:
rm -rf /home/ubuntu/openclaude
mv /home/ubuntu/openclaude.backup.TIMESTAMP /home/ubuntu/openclaude
pm2 restart jarvis-worker
```

---

## 📋 Complete Pre-Deployment Checklist

Run these before executing Phase 2-3:

**Local Machine**:
- [ ] Build succeeds: `bun run build`
- [ ] Tests pass: `bun test`
  - Expected: 80/80 tests passing ✅
- [ ] Git clean: `git status`
  - Expected: "nothing to commit, working tree clean"
- [ ] All commits pushed: `git log --oneline | head -5`
  - Expected: Latest 3 commits visible
- [ ] .env.vps exists: `cat .env.vps`
  - Expected: VPS_HOST, VPS_USER, VPS_PASSWORD filled

**VPS (via test-vps)**:
- [ ] SSH connection works
- [ ] SAAS-WEB is online
- [ ] Disk space > 5GB
- [ ] Bun installed
- [ ] PM2 installed
- [ ] Port 3000 available (or configure differently)

---

## 🔴 Critical Rules (MUST Follow)

### 1. Never Touch SAAS-WEB
- Do NOT restart SAAS-WEB
- Do NOT modify /root/killsis/SAAS-WEB/
- Do NOT run `pm2 restart all` (use `pm2 restart jarvis-worker` only)
- Do NOT delete SAAS-WEB database

**Why**: Production revenue service (DeliveryHub)

### 2. Always Test VPS First
- Run `npm run test-vps` before any deploy
- Review output for errors
- Fix any blockers before proceeding

### 3. Always Backup Before Deploy
- Deployment script creates automatic backup
- But: Review backup location: `/home/ubuntu/openclaude.backup.TIMESTAMP/`
- Know how to restore if needed

### 4. Watch First Deploy Logs
- Don't assume deploy succeeded
- Run `pm2 logs jarvis-worker --lines 20`
- Look for any ERROR messages
- Verify health endpoint

---

## 🎯 Deployment Decision (You Choose)

**Which strategy?**

### ✅ Recommended: Option B (Script)
```bash
# Test first
node tools/test-ssh-simple.cjs
npm run test-vps

# Then deploy
npm run deploy-worker:staging
npm run deploy-worker:prod
```

**Reasons**:
1. Fully automated
2. Backup before deploy
3. Tested on SAAS-WEB (same VPS)
4. Fast (30s per iteration)
5. Safe (separate directory)

**Next Step**: Run `node tools/test-ssh-simple.cjs`

---

## 📊 Expected Timeline

| Phase | Step | Time | Notes |
|-------|------|------|-------|
| 1 | SSH test | 5s | Quick sanity check |
| 1 | Full diagnosis | 20s | 14-point check |
| 2 | Decision | 2m | Choose strategy |
| 3 | Deploy staging | 30s | First deployment |
| 3 | Verify staging | 5m | Check logs, health |
| 3 | Deploy prod | 30s | Production deployment |
| 4 | Post-deploy check | 5m | Verify everything |
| **Total** | — | **~40 minutes** | First time |
| **Subsequent** | — | **~1-2 minutes** | Git pull + rebuild |

---

## 🚀 Ready to Start?

### Run This Now:
```bash
node tools/test-ssh-simple.cjs
```

**Then report**:
- ✅ Connected successfully, or
- ❌ SSH connection failed

**Based on result**: Next step is either:
- `npm run test-vps` (if connected), or
- Check .env.vps credentials (if failed)

---

## 📞 Support

**If you hit issues**:

1. Check [DEPLOY-SCRIPTS-ANALYSIS.md](DEPLOY-SCRIPTS-ANALYSIS.md) → Troubleshooting section
2. Check [VPS-DEPLOYMENT-ANALYSIS-2026-05-26.md](VPS-DEPLOYMENT-ANALYSIS-2026-05-26.md) → Risk assessment
3. Review script output carefully (error messages are usually clear)

---

**Status**: ✅ READY TO EXECUTE

**Next Action**: `node tools/test-ssh-simple.cjs`

