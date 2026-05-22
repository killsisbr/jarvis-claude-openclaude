# 🚀 JARVIS Worker — Deploy Guide

**Quick Links**:
- 📋 [DEPLOY-CHECKLIST.md](DEPLOY-CHECKLIST.md) — Step-by-step tracker
- ⚡ [docs/QUICK-START.md](docs/QUICK-START.md) — 5-minute workflow
- 📚 [docs/SESSION-2026-05-22-SUMMARY.md](docs/SESSION-2026-05-22-SUMMARY.md) — Full history

---

## ⚡ 2-Minute Setup

```bash
# 1. Validate VPS (10s)
npm run test-vps

# 2. Deploy staging (2 min)
npm run deploy-worker:staging

# 3. Deploy production (30s)
npm run deploy-worker:prod

# Done!
```

---

## 📊 What's Ready

| Component | Status | Type |
|-----------|--------|------|
| Heap protection | ✅ | Auto-fix |
| Deploy script | ✅ | SSH2/SFTP |
| Status check | ✅ | Validation |
| Docker setup | ✅ | Alternative |
| Documentation | ✅ | 4 guides |
| .env.vps | ✅ | Git-ignored |
| **SSH auth** | ⏳ | Needs fix |

---

## 🔴 Current Blocker

SSH authentication failing with user `ubuntu`. 

**Fix** (choose one):
1. Use `root` temporarily: Edit `.env.vps` → `VPS_USER=root`
2. Create user ubuntu on VPS: `ssh root@82.29.58.126` → `useradd -m -s /bin/bash ubuntu` → `passwd ubuntu`
3. Use SSH keys (future): See docs/DEPLOY-SCRIPT-VPS.md

---

## 📚 Documentation

Start here when you wake up:

```
1. DEPLOY-CHECKLIST.md (this directory)
   ↓ Step-by-step tracker for the whole process
   
2. docs/QUICK-START.md
   ↓ Fast 5-minute workflow with troubleshooting
   
3. docs/SESSION-2026-05-22-SUMMARY.md
   ↓ Complete history if you need context
   
4. docs/DEPLOY-SCRIPT-VPS.md
   ↓ Detailed guide on how script works
   
5. docs/VPS-STATUS-CHECK.md
   ↓ Interpret npm run test-vps output
```

---

## 🎯 Next Steps

1. **Fix SSH** → Use root or create ubuntu user
2. **Validate** → `npm run test-vps`
3. **Deploy staging** → `npm run deploy-worker:staging`
4. **Test staging** → `curl http://localhost:3000/health`
5. **Deploy prod** → `npm run deploy-worker:prod`

---

## 📦 Scripts

```bash
npm run test-vps                # Validate VPS
npm run deploy-worker:staging   # Deploy to staging
npm run deploy-worker:prod      # Deploy to production
npm run worker                  # Run locally
```

---

## 🐳 Alternative: Docker

```bash
# Build & start
docker-compose build
docker-compose up -d

# Logs
docker-compose logs -f jarvis-worker

# Stop
docker-compose down
```

---

## 📞 SSH Commands

```bash
# Connect
ssh ubuntu@82.29.58.126

# View logs
pm2 logs jarvis-worker

# Status
pm2 status

# Restart
pm2 restart jarvis-worker
```

---

## ⚙️ Configuration

`.env.vps` (git-ignored):
```
VPS_HOST=82.29.58.126
VPS_PORT=22
VPS_USER=ubuntu
VPS_PASSWORD=Killsis19980910#
VPS_REMOTE_DIR=/home/ubuntu/openclaude
```

---

## 📊 Status

- ✅ Heap blocker: Fixed
- ✅ Gates: 8 removed (Priority 2)
- ✅ Worker: Ready
- ✅ Deploy: Ready
- ✅ Docs: Complete
- ⏳ SSH: Needs auth fix

**Overall**: 95% ready. Awaiting SSH validation.

---

## 🎓 Learn More

- `docs/WORKER-TUTORIAL.md` — API reference + examples
- `docs/DOCKER-DEPLOY.md` — Docker alternative
- `docs/VPS-STATUS-CHECK.md` — Status check interpretation

---

## 💾 Session Info

- Date: 2026-05-22
- Commits: 4 (heap, gates, deploy-scripts, docs)
- Files: 15+ new/modified
- Lines: 2000+ documentation

See `docs/SESSION-2026-05-22-SUMMARY.md` for full history.

---

**Ready? Start with DEPLOY-CHECKLIST.md** ☑️

Or jump to Quick Start: `docs/QUICK-START.md` ⚡
