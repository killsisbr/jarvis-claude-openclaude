# FASE 7 — Docker + Sandbox + Skill System

## Overview

**Fase 7** brings production-readiness to JARVIS Worker by adding:

1. **Docker Containerization** — Consistent deployment across environments (dev, staging, prod)
2. **Sandbox Manager** — Isolated command execution in ephemeral Docker containers
3. **Skill System** — Plugin architecture for extensibility without restart

All components integrate with Fases 1-6 (KeyPool, Intent Router, Budget, Approval, PlanMode, CronScheduler, Sentinels).

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    JARVIS Worker Container                      │
│  (oven/bun:latest, port 6666)                                   │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌──────────────────────┐       ┌─────────────────────┐         │
│  │  HTTP Server         │       │  WhatsApp Gateway   │         │
│  │  (Express)           │       │  (Baileys)          │         │
│  │                      │       │                     │         │
│  │  GET  /health        │       │  Listens for        │         │
│  │  POST /api/chat      │       │  incoming messages  │         │
│  │  GET  /api/cost      │       │                     │         │
│  │  GET  /api/keys      │       │  Sends responses    │         │
│  │  POST /api/exec      │       │                     │         │
│  │  GET  /api/cron      │       │  QR code pairing    │         │
│  │  POST /api/approve/* │       │                     │         │
│  │  GET  /api/budget/*  │       │                     │         │
│  └──────────────────────┘       └─────────────────────┘         │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │  JARVIS Core (Fase 1-6)                                │    │
│  │                                                         │    │
│  │  • JarvisWorker — API router (Claude/OpenAI/local)    │    │
│  │  • KeyPool — Provider key rotation + cooldown         │    │
│  │  • IntentRouter — Message classification              │    │
│  │  • ChatSession — Session state management             │    │
│  │  • ApprovalSystem — Request approval workflow         │    │
│  │  • BudgetController — Daily cost limits per user      │    │
│  │  • PlanModeManager — Permission levels (dev/audit)   │    │
│  │  • CronScheduler — Background job scheduling          │    │
│  │  • Sentinels — 5 monitoring jobs (24/7)               │    │
│  │  • EventBus — Event pub/sub for integrations          │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                 │
│  ┌──────────────────────┐      ┌──────────────────────┐         │
│  │ SandboxManager       │      │ SkillRegistry        │         │
│  │ (Fase 7)             │      │ (Fase 7)             │         │
│  │                      │      │                      │         │
│  │ Isolated Docker exec │      │ Load skills from     │         │
│  │ • --network none     │      │ worker/skills/*/     │         │
│  │ • 512MB memory       │      │ skill.js             │         │
│  │ • 0.5 CPU           │      │                      │         │
│  │ • 30s timeout        │      │ Hooks:               │         │
│  │ • Auto-cleanup       │      │ • onStartup()        │         │
│  │                      │      │ • onShutdown()       │         │
│  │ POST /api/exec       │      │ • onMessage()        │         │
│  │ req: {cmd, cwd,      │      │ • beforeExecute()    │         │
│  │       timeout}       │      │ • afterExecute()     │         │
│  │ res: {stdout,        │      │                      │         │
│  │       stderr,        │      │ Example: deploy-     │         │
│  │       exitCode,      │      │ helper, monitoring,  │         │
│  │       timedOut}      │      │ custom plugins       │         │
│  └──────────────────────┘      └──────────────────────┘         │
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │  SQLite Database                                         │   │
│  │  • Sessions + messages                                   │   │
│  │  • Approval requests + budget logs                       │   │
│  │  • Cron job history + sentinel alerts                    │   │
│  │  (Persisted via volume: ~/.jarvis:/root/.jarvis)         │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
                                │
                                ├─ /var/run/docker.sock
                                │  (for sandbox isolation)
                                │
                    Creates ephemeral
                    containers for
                    /api/exec requests
```

---

## Components

### 1. Dockerfile (Multi-Stage Build)

```dockerfile
# Stage 1: Builder
FROM oven/bun:latest AS builder
WORKDIR /app
COPY . .
RUN bun install --frozen-lockfile

# Stage 2: Runtime
FROM oven/bun:latest
WORKDIR /app
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/src ./src
COPY --from=builder /app/package.json .

ENV NODE_ENV=production
EXPOSE 6666

HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
  CMD curl -f http://localhost:6666/health || exit 1

CMD ["bun", "run", "src/worker/main.ts"]
```

**Why multi-stage:**
- Stage 1 builds dependencies (larger image)
- Stage 2 ships only runtime code (smaller image)
- Final image ~500MB (bun + node essentials)

### 2. docker-compose.yml

```yaml
version: '3.8'

services:
  jarvis-worker:
    build:
      context: .
      dockerfile: Dockerfile
    container_name: jarvis-worker
    ports:
      - "6666:6666"
    volumes:
      - ~/.jarvis:/root/.jarvis                # SQLite + Baileys persist
      - /var/run/docker.sock:/var/run/docker.sock  # For sandbox
      - ./src:/app/src                         # Dev: hot-reload
    environment:
      WORKER_PORT: 6666
      NODE_ENV: production
      OPENAI_BASE_URL: ${OPENAI_BASE_URL:-https://api.openai.com/v1}
      OPENAI_API_KEY: ${OPENAI_API_KEY}
      OPENAI_MODEL: ${OPENAI_MODEL:-gpt-4o-mini}
      ROTATE_CHAIN: ${ROTATE_CHAIN:-zen}
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:6666/health"]
      interval: 30s
      timeout: 5s
      retries: 3
      start_period: 10s
    networks:
      - jarvis-net
    logging:
      driver: json-file
      options:
        max-size: "10m"
        max-file: "3"

networks:
  jarvis-net:
    driver: bridge
```

### 3. SandboxManager

Executes commands in isolated Docker containers with:

```typescript
// exec(cmd: string, options: SandboxOptions) → Promise<SandboxResult>

// Input
{
  cmd: "npm list",              // Command to run
  cwd: "/tmp",                  // Working directory
  timeout: 30000,               // Timeout in ms (default 30s)
  env: { USER_ID: "user123" }   // Environment variables
}

// Output
{
  stdout: "npm@10.2.4\n...",    // Command output
  stderr: "",                    // Error output (if any)
  exitCode: 0,                   // Process exit code
  timedOut: false,               // Whether timeout occurred
  error: undefined               // Error message (if timedOut)
}
```

**Security Features:**
- `--network none` — No internet access
- `--memory 512m` — 512MB memory limit
- `--cpus 0.5` — 0.5 CPU limit
- `--rm` — Auto-cleanup after execution
- 30s timeout enforced

**Cost Model:**
- Each `/api/exec` call costs **$50.00** (flat rate)
- Deducted from user budget immediately
- Can be overridden in BudgetController

### 4. SkillRegistry

Plugin system for extending JARVIS with custom skills.

```typescript
// Load all skills from disk
await registry.loadSkills('src/worker/skills')

// Find skill by command
registry.findByCommand('/deploy')

// Execute hook across all skills
await registry.executeHook('onMessage', {
  userId: 'user123',
  text: 'deploy production',
  intent: 'deploy'
})

// List loaded skills
registry.list() → Skill[]

// Get metadata
registry.getStats() → {
  totalSkills: 3,
  skillNames: ['deploy-helper', 'monitor', 'backup'],
  skillCommands: Map<string, string[]>
}
```

**Lifecycle Hooks:**

| Hook | When | Purpose | Example |
|------|------|---------|---------|
| `onStartup()` | Worker starts | Initialize resources | Load config, connect to service |
| `onShutdown()` | Worker stops | Cleanup | Close connections, save state |
| `onMessage(context)` | Message processed | React to user actions | Auto-deploy, monitoring |
| `beforeExecute(action)` | Before action | Pre-flight checks | Create checkpoint, validate |
| `afterExecute(action, result)` | After action | Post-execution | Cleanup, notifications |

---

## How to Use

### 1. Build and Start

```bash
# Clone repository
git clone https://github.com/yourusername/jarvis-claude-openclaude.git
cd jarvis-claude-openclaude

# Copy environment template
cp .env.example .env
# Edit .env with your API keys:
# OPENAI_API_KEY=sk-...
# OPENAI_MODEL=gpt-4o-mini
# ROTATE_CHAIN=zen

# Build Docker image
docker build -t jarvis-worker:latest .

# Start with docker-compose
docker-compose up

# Or run directly
docker run -it \
  -p 6666:6666 \
  -e OPENAI_API_KEY=$OPENAI_API_KEY \
  -v ~/.jarvis:/root/.jarvis \
  -v /var/run/docker.sock:/var/run/docker.sock \
  jarvis-worker:latest
```

### 2. Health Check

```bash
curl http://localhost:6666/health

# Response
{
  "status": "running",
  "uptime": 123.45,
  "version": "v5.0.0-worker",
  "sessions_active": 2,
  "cost_today": 12.34,
  "queries_total": 45,
  "queue_size": 0
}
```

### 3. Test POST /api/chat

```bash
curl -X POST http://localhost:6666/api/chat \
  -H "Content-Type: application/json" \
  -d '{
    "user": "user@example.com",
    "message": "What is 2+2?"
  }'

# Response
{
  "session": "user@example.com-1234567890",
  "reply": "2 + 2 = 4",
  "cost": 0.0015,
  "model": "gpt-4o-mini",
  "tokens": {"input": 10, "output": 5},
  "latency_ms": 523,
  "category": "math"
}
```

### 4. Test POST /api/exec (Sandbox)

```bash
curl -X POST http://localhost:6666/api/exec \
  -H "Content-Type: application/json" \
  -d '{
    "cmd": "echo \"Hello from sandbox\"",
    "cwd": "/tmp",
    "timeout": 5000
  }'

# Response
{
  "stdout": "Hello from sandbox",
  "stderr": "",
  "exitCode": 0,
  "timedOut": false
}
```

### 5. Test Timeout

```bash
curl -X POST http://localhost:6666/api/exec \
  -H "Content-Type: application/json" \
  -d '{
    "cmd": "sleep 60",
    "timeout": 2000
  }'

# Response (after 2s)
{
  "stdout": "",
  "stderr": "",
  "exitCode": null,
  "timedOut": true,
  "error": "Execution timeout after 2000ms"
}
```

### 6. Create Custom Skill

Create `src/worker/skills/my-skill/skill.js`:

```javascript
export default {
  name: 'my-skill',
  description: 'My custom skill',
  version: '1.0.0',
  author: 'You',
  commands: ['/mycommand', '/help-myskill'],

  async onStartup() {
    console.log('[my-skill] Inicializando...');
    // Load config, connect to service, etc.
  },

  async onShutdown() {
    console.log('[my-skill] Desligando...');
    // Close connections, save state
  },

  async onMessage(context) {
    const { userId, text, intent, sessionId } = context;
    
    if (text.includes('/mycommand')) {
      console.log(`[my-skill] ${userId} triggered /mycommand`);
      // Custom logic
    }
  },

  async beforeExecute(action) {
    const { type, target, description } = action;
    
    if (type === 'delete') {
      console.log(`[my-skill] Delete action on ${target}, consider checkpoint`);
      // Could auto-create checkpoint
    }
  },

  async afterExecute(action, result) {
    if (result && result.error) {
      console.error(`[my-skill] Action failed: ${result.error}`);
      // Notify admin, rollback, etc.
    }
  }
};
```

Restart container:

```bash
docker-compose restart
```

Logs should show:

```
[startup] ✓ 2 skills carregadas
[my-skill] Inicializando...
```

---

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `WORKER_PORT` | 3000 | HTTP server port |
| `NODE_ENV` | production | Deployment environment |
| `OPENAI_BASE_URL` | https://api.openai.com/v1 | Provider base URL |
| `OPENAI_API_KEY` | required | API key for provider |
| `OPENAI_MODEL` | gpt-4o-mini | Default model |
| `ROTATE_CHAIN` | zen | Key pool rotation strategy |
| `JARVIS_SYSTEM_PROMPT` | (default) | Custom system prompt |

### Example .env

```bash
# Docker
WORKER_PORT=6666
NODE_ENV=production

# OpenAI
OPENAI_BASE_URL=https://api.openai.com/v1
OPENAI_API_KEY=sk-proj-abc123...
OPENAI_MODEL=gpt-4o-mini

# Rotation
ROTATE_CHAIN=zen

# Optional
JARVIS_SYSTEM_PROMPT="You are JARVIS, a coding agent..."
```

---

## Logs and Monitoring

### View Container Logs

```bash
# Follow logs in real-time
docker-compose logs -f jarvis-worker

# Last 50 lines
docker-compose logs --tail=50 jarvis-worker

# Specific time range
docker-compose logs --since 2 hours --until 30 minutes ago jarvis-worker
```

### Health Check

```bash
# Check if container is healthy
docker-compose ps

# STATUS should be "Up (healthy)"
# If "Up (unhealthy)", check logs

# Manual health endpoint
curl -v http://localhost:6666/health
```

### Monitor Sentinels

Every 5 minutes, 5 sentinels monitor:

1. **Cost Sentinel** — Daily spend tracking
2. **Key Pool Sentinel** — Provider rotation + cooldown
3. **Session Sentinel** — Active session monitoring
4. **Database Sentinel** — SQLite health
5. **Error Sentinel** — Exception rate tracking

Check logs for sentinel alerts:

```
[sentinel] ALERTA: Cost exceeded 80% of budget
[sentinel] ALERTA: All API keys in cooldown
[cron] Job "cost-watcher" sucesso: processed 12 sessions
```

---

## Integration with Fase 5-6

### Approval System

`/api/exec` requests require approval before execution:

```typescript
// In dispatcher.sandboxManager.exec()
const approval = dispatcher.approvalSystem.createRequest(
  'sandbox_exec',
  { cmd: cmd.substring(0, 100), cwd },
  'critical',      // Danger level
  'Execute command in isolated sandbox'
)

const approved = await dispatcher.approvalSystem.waitForApproval(approval.id)
if (!approved.approved) {
  res.status(403).json({ error: 'Approval denied' })
  return
}
```

Check pending approvals:

```bash
curl http://localhost:6666/api/approvals/pending

# Response
{
  "pending": [
    {
      "id": "req-123",
      "type": "sandbox_exec",
      "level": "critical",
      "description": "Execute command in isolated sandbox",
      "data": { "cmd": "rm -rf /" },
      "createdAt": "2026-05-17T10:00:00Z",
      "timeout": 300000
    }
  ],
  "stats": {
    "pending": 1,
    "approved": 45,
    "denied": 2,
    "timedOut": 0
  }
}
```

Approve/deny:

```bash
# Approve
curl -X POST http://localhost:6666/api/approve/req-123 \
  -H "Content-Type: application/json" \
  -d '{"approver": "admin@example.com"}'

# Deny
curl -X POST http://localhost:6666/api/deny/req-123 \
  -H "Content-Type: application/json" \
  -d '{"reason": "Unsafe command"}'
```

### Budget Controller

Each user has a daily budget (default $100). `/api/exec` costs $50:

```bash
curl http://localhost:6666/api/budget/user@example.com

# Response
{
  "userId": "user@example.com",
  "limit": 100.00,
  "spent": 25.50,
  "remaining": 74.50,
  "resetAt": "2026-05-18T00:00:00Z"
}
```

Set budget limit:

```bash
curl -X PUT http://localhost:6666/api/budget/user@example.com/limit \
  -H "Content-Type: application/json" \
  -d '{"limit": 500.00}'
```

### PlanMode (Permission Levels)

Check if bash execution is allowed:

```bash
curl http://localhost:6666/api/mode

# Response
{
  "current": "operate",
  "available": ["dev", "audit", "operate", "execute"],
  "permissions": {
    "bash": { "allowed": true, "level": "operate" },
    "delete": { "allowed": true, "level": "operate" },
    "create": { "allowed": false, "level": "execute" }
  }
}
```

Switch mode:

```bash
curl -X PUT http://localhost:6666/api/mode \
  -H "Content-Type: application/json" \
  -d '{"mode": "audit"}'
```

---

## Performance

| Operation | Time | Notes |
|-----------|------|-------|
| Docker build | ~90s | Cached after first build |
| Container startup | 8-10s | Bun is fast, skip build |
| /health endpoint | <50ms | Status check only |
| /api/chat endpoint | 500-2000ms | Depends on model + latency |
| /api/exec spin | 200-500ms | Create container + start |
| /api/exec run | 100ms-30s | Command execution + timeout |
| Skill load | <500ms | Scan + require all skills |
| Skill hook | <100ms | onMessage hook typical |

---

## Troubleshooting

### Container fails to start

```bash
docker-compose logs jarvis-worker

# Common issues:
# 1. OPENAI_API_KEY not set
#    Fix: export OPENAI_API_KEY=sk-... or add to .env

# 2. Port 6666 already in use
#    Fix: docker-compose down && docker-compose up

# 3. Docker socket permission denied
#    Fix: sudo usermod -aG docker $USER && newgrp docker
```

### Health check failing

```bash
# Check container is running
docker ps | grep jarvis-worker

# Manual health check
curl -v http://localhost:6666/health

# If 503: worker not ready yet, wait 10s
# If connection refused: port wrong or container crashed
```

### Sandbox exec timing out

```bash
# Test locally first
curl -X POST http://localhost:6666/api/exec \
  -H "Content-Type: application/json" \
  -d '{"cmd": "echo test", "timeout": 5000}'

# If timeout, check:
# 1. Docker daemon running: docker ps
# 2. Socket permission: ls -l /var/run/docker.sock
# 3. Logs: docker-compose logs jarvis-worker
```

### Skill not loading

```bash
# Check skill file exists
ls -la src/worker/skills/my-skill/skill.js

# Verify export syntax
cat src/worker/skills/my-skill/skill.js | head -20

# Check logs during startup
docker-compose logs | grep "skill"

# Must export default:
export default { name: '...', ... }
```

---

## Known Limitations

| Limitation | Workaround | Future |
|-----------|-----------|--------|
| Skills require restart | Skills auto-loaded at startup only | Fase 8: Hot reload via WebSocket |
| No skill dependency management | Load skills in order, no imports | Fase 8: Skill dependency graph |
| Sandbox network isolated | Can't access external APIs from sandbox | Fase 8: Allow-list networks |
| No skill template generation | Manual file creation | Fase 8: `jarvis skill create` CLI |

---

## Next Steps (Fase 8+)

- **Hot-reload Skills** — Reload skills without container restart
- **CLI Integration** — `jarvis skill create`, `jarvis skill test`
- **Marketplace** — Share skills via registry (like npm)
- **WebSocket Real-Time** — Stream sandbox output live
- **Skill Dependencies** — Import/require between skills

---

## Reference

### Directory Structure

```
jarvis-claude-openclaude/
├── Dockerfile                 # Multi-stage build
├── docker-compose.yml         # Container orchestration
├── .dockerignore              # Build exclusions
├── src/
│   └── worker/
│       ├── main.ts            # Entrypoint (startup + shutdown)
│       ├── server.ts          # Express routes (+ /api/exec)
│       ├── sandbox.ts         # SandboxManager
│       ├── skills/
│       │   ├── registry.ts     # SkillRegistry loader
│       │   ├── hooks.ts        # Type definitions
│       │   └── example/
│       │       └── skill.js    # Example skill template
│       ├── worker-core.ts      # JarvisWorker (Fase 1-6)
│       ├── dispatcher.ts       # MessageDispatcher
│       ├── approval.ts         # ApprovalSystem (Fase 5)
│       ├── budget.ts           # BudgetController (Fase 5)
│       ├── plan-mode.ts        # PlanModeManager (Fase 5)
│       ├── cron-scheduler.ts   # CronScheduler (Fase 6)
│       ├── sentinels.ts        # Sentinels (Fase 6)
│       ├── event-bus.ts        # EventBus (Fase 6)
│       └── db/
│           └── schema.ts       # SQLite schema
└── docs/
    └── worker/
        └── FASE7-DOCKER.md     # This file
```

### API Endpoints (Complete)

```
GET  /health                    Health status
POST /api/chat                  Send message to JARVIS
GET  /api/cost                  Daily cost + statistics
GET  /api/keys                  Key pool status
POST /api/exec                  Execute command (sandbox)
GET  /api/whatsapp/status       WhatsApp connection status
GET  /api/whatsapp/qr           QR code info
GET  /api/cron                  Cron job status
GET  /api/approvals/pending     Pending approval requests
POST /api/approve/:id           Approve request
POST /api/deny/:id              Deny request
GET  /api/budget/:userId        User budget status
GET  /api/budget/all/today      All user budgets
PUT  /api/budget/:userId/limit  Set user budget limit
GET  /api/mode                  Current PlanMode
PUT  /api/mode                  Switch PlanMode
GET  /api/checkpoints           List checkpoints
POST /api/checkpoints           Create checkpoint
POST /api/checkpoints/:id/restore  Restore checkpoint
```

---

**Status:** ✅ Fase 7 complete and ready for production
**Deployment:** Docker image ready, no external VPS required for testing
**Next Phase:** Fase 8 (CLI + Hot Reload Skills)
