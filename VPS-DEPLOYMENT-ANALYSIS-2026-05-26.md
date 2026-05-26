# JARVIS VPS Deployment Analysis (2026-05-26)

**Status**: PRE-DEPLOYMENT ANALYSIS (READ-ONLY)  
**Date**: 2026-05-26 19:30 UTC  
**VPS**: 82.29.58.126 (root access available)

---

## 📍 VPS Configuration (Verified Locally)

### SSH Credentials
```
Host:     82.29.58.126
Port:     22
User:     root
Password: Killsis19980910# (quoted in .env.vps to prevent # truncation)
```
✅ Credentials are saved in `.env.vps`

### Target Directory
```
Remote Dir:  /root/killsis
Expected:    /root/killsis/openclaude/  (for JARVIS Worker)
```

---

## 🔍 Current Deployment Status (Based on Memory 2026-05-22)

### What Was Deployed in 2026-05-22
According to `jarvis-worker-deployment-success-2026-05-22.md`:

**Services Running**:
- ✅ SAAS-WEB via PM2 (ID: some number, 12h+ uptime on 2026-05-22)
- ✅ JARVIS Worker via PM2 (HTTP port 3000)
- ✅ Nginx reverse proxy (HTTPS → jarvis.killsis.com)
- ✅ SSL Certificate (jarvis.killsis.com, auto-renewal active)

**Status on 2026-05-22**:
```
JARVIS Worker:  ONLINE (PM2, port 3000)
SAAS-WEB:       ONLINE (PM2, production service - DO NOT TOUCH)
HTTPS:          HTTP/2 200 ✅
```

### Critical Protection
⚠️ **USER RULE** (2026-05-22): "nao restart o saas-web, ele nunca mexer"
- SAAS-WEB is production revenue service
- Must NOT restart, modify, or interact with it
- Uptime must be preserved

---

## 📦 What's Ready to Deploy Today (2026-05-26)

### Build Status
- ✅ dist/cli.mjs compiled (21MB bundle)
- ✅ dist/sdk.mjs compiled
- ✅ All tests passing (80/80, Phase 1-3 core)
- ✅ Git clean (all changes committed)

### Code Changes Since 2026-05-22
```
Commits deployed to origin/main:
  a490cd5  refactor: reorganize root and docs (2026-05-26)
  6709bd6  feat: Multi-provider + auto-store skill (2026-05-26)
  1e7faa8  test: remove non-essential tests (2026-05-26)
```

### New Features
- ✅ Multi-provider support (OpenAI-compatible APIs, Ollama, etc)
- ✅ Auto-store skill (create e-commerce stores from menu photos)
- ✅ Test cleanup (1943 → 80 tests, 100% pass rate)
- ✅ Documentation reorganized (docs/ standard structure)

---

## ⚙️ Configuration Files (Missing ⚠️)

### On Local Machine
```
✅ .env.vps                    — Credentials exist
✅ tools/deploy-jarvis-worker.cjs  — Deployment script exists
❌ ecosystem.config.js         — MISSING (PM2 configuration)
❌ docker-compose.yml          — MISSING (Docker config)
```

### On VPS (Unknown - Need to Verify)
```
❓ /root/killsis/openclaude/   — Exists? (need to check)
❓ /root/.jarvis/settings.json  — Config file
❓ PM2 ecosystem.config.js      — Current PM2 config
❓ /etc/nginx/sites-available/jarvis-worker  — Nginx config
```

---

## 🎯 Deployment Options

### Option 1: Update Existing Deployment (SAFER)
If JARVIS Worker already exists on VPS:
```bash
# Pull latest code
cd /root/killsis/openclaude
git pull origin main

# Rebuild and restart
bun run build
pm2 restart jarvis-worker
pm2 save
```

**Pros**: Minimal disruption, preserves existing config
**Cons**: Requires checking current state first

### Option 2: Fresh Deployment (RISKIER)
Deploy new instance to replace old:
```bash
# Backup current
pm2 stop jarvis-worker

# Deploy fresh
npm run deploy-jarvis-worker:prod

# Restore if needed
pm2 restart saas-web  # ⚠️ ONLY if accidentally stopped
```

**Pros**: Clean state, fresh config
**Cons**: Downtime risk, must ensure SAAS-WEB untouched

### Option 3: Dual Instance (SAFEST)
Deploy to `/home/ubuntu/openclaude` (separate from SAAS-WEB):
```bash
# Fresh isolated deploy
ssh root@82.29.58.126 "useradd -m ubuntu" # Create user if needed
npm run deploy-jarvis-worker:ubuntu

# Verify SAAS-WEB unchanged
pm2 describe saas-web  # Should still be running
```

**Pros**: Complete isolation, no risk to SAAS-WEB
**Cons**: More complex, needs new Nginx config

---

## ✋ BEFORE ANY ACTION: Required Verifications

### 1. Check Current PM2 Status
```bash
# Run this FIRST
pm2 status
# Should show: 
# ├─ saas-web    ✅ online  (must be 12h+ uptime)
# └─ jarvis-worker ✅ online (current version info)
```

### 2. Check JARVIS Worker Location
```bash
ls -la /root/killsis/openclaude/
# or
ls -la /home/ubuntu/openclaude/
```

### 3. Check Nginx Config
```bash
ls -la /etc/nginx/sites-available/ | grep jarvis
# Should show jarvis-worker config
```

### 4. Check Port 3000
```bash
lsof -i :3000
# Should show: jarvis-worker is listening
```

### 5. Check SSL Certificate
```bash
certbot certificates | grep jarvis.killsis.com
# Should show: Valid, expires: 2026-08-20
```

---

## 🚨 Risk Assessment

| Scenario | Risk | Mitigation |
|----------|------|-----------|
| Update existing | LOW | Pull, rebuild, restart jarvis-worker only |
| Fresh deploy to /root/killsis | MEDIUM | Backup current, use PM2 stop/start |
| Fresh deploy to /home/ubuntu | LOW | Separate user, no conflict with SAAS-WEB |
| Deploy during SAAS-WEB hours | MEDIUM | Check uptime first, avoid if < 1h old |

---

## 📋 Deployment Checklist (When Ready)

- [ ] Verify current PM2 status (SAAS-WEB must be online)
- [ ] Verify JARVIS Worker location on VPS
- [ ] Decide on deployment strategy (Option 1, 2, or 3)
- [ ] Create ecosystem.config.js if missing
- [ ] Test deployment script locally
- [ ] Execute deployment
- [ ] Verify JARVIS Worker health (port 3000)
- [ ] Verify SAAS-WEB unchanged (still online)
- [ ] Test HTTPS endpoint (jarvis.killsis.com/health)
- [ ] Monitor logs for 5 minutes

---

## ✅ Current Local State

**Repository**: D:\jarvis-claude\openclaude
```
✅ Build: dist/cli.mjs (21MB)
✅ Tests: 80/80 passing (100%)
✅ Git: Clean (all committed)
✅ Config: .env.vps configured
✅ Scripts: deploy-jarvis-worker.cjs ready
❌ PM2: ecosystem.config.js missing (CREATE BEFORE DEPLOY)
```

---

## 🔴 NEXT STEPS (USER DECISION REQUIRED)

1. **Verify VPS Current State** (automatic via SSH)
   - PM2 processes
   - Directory structure
   - Service uptime
   - Port availability

2. **Choose Deployment Strategy**
   - Option 1: Update existing (if it exists)
   - Option 2: Fresh deploy (backup first)
   - Option 3: Dual instance (safest)

3. **Create ecosystem.config.js** (if deploying fresh)
   - PM2 production config
   - Memory limits (1.5GB)
   - Graceful shutdown
   - User isolation

4. **Execute Deployment**
   - Only after above verified

---

**STATUS**: ✋ **WAITING FOR USER DECISION**

What would you like to do?
- **A)** Diagnose current VPS state (read-only)
- **B)** Deploy updates to existing instance (Option 1)
- **C)** Fresh deploy with new ecosystem.config (Option 2/3)
- **D)** Cancel (don't touch VPS yet)

