# 🏗️ Arquitetura Visual - OpenClaude Systems

## 1. Stack Tecnológico

```
┌─────────────────────────────────────────────────────────────┐
│                    OpenClaude v5.0 Stack                    │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Tier 4: Interfaces                                         │
│  ├─ Claude Code CLI (React/Ink TUI)                         │
│  ├─ JARVIS Worker API (Express)                             │
│  └─ WebSocket (skill hot-reload)                            │
│                                                             │
│  Tier 3: AI/Processing                                      │
│  ├─ Claude 3.X (Anthropic)                                  │
│  ├─ GPT-4 (OpenAI - failover)                               │
│  └─ Local LLM (Ollama - fallback)                           │
│                                                             │
│  Tier 2: Services                                           │
│  ├─ Approval System (request + resolve)                     │
│  ├─ Budget Controller (daily limits)                        │
│  ├─ Plan Mode (4 execution levels)                          │
│  ├─ Checkpoint Manager (state snapshots)                    │
│  ├─ Skill Registry (plugin system)                          │
│  ├─ Sandbox Manager (Docker)                               │
│  ├─ Event Bus (pub/sub)                                     │
│  ├─ Cron Scheduler (5 background jobs)                      │
│  └─ Sentinels (5 monitoring agents)                         │
│                                                             │
│  Tier 1: Core                                               │
│  ├─ JarvisWorker (main router)                              │
│  ├─ KeyPool (provider rotation)                             │
│  ├─ IntentRouter (message classification)                   │
│  ├─ MessageDispatcher (multi-gateway)                       │
│  └─ ChatSession (context management)                        │
│                                                             │
│  Tier 0: Storage                                            │
│  ├─ SQLite (relational - sessions, messages, budget)        │
│  ├─ Orama (vector store - embeddings, semantic search)      │
│  ├─ File System (session state, config)                     │
│  └─ Secure Storage (API keys, tokens)                       │
│                                                             │
│  Infrastructure:                                            │
│  ├─ Docker (containerization)                               │
│  ├─ Bun (runtime + package manager)                         │
│  └─ TypeScript (type safety)                                │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## 2. Fluxo de Requisição Completo

```
User sends WhatsApp message
         ↓
    Baileys Gateway
    ├─ Decrypt message
    ├─ Extract metadata (sender, timestamp)
    └─ Pass to MessageDispatcher
         ↓
MessageDispatcher.handle()
    ├─ Extract intent (command, question, info)
    ├─ Route to IntentRouter
    └─ Create/update ChatSession
         ↓
IntentRouter.classify()
    ├─ Keyword matching (skill-specific)
    ├─ Semantic similarity (vector search)
    └─ Intent + confidence score
         ↓
JarvisWorker.processMessage()
    ├─ Load user budget
    ├─ Check approval requirements
    ├─ Select execution mode (dev/audit/operate/execute)
    └─ Enter main pipeline
         ↓
Planning Phase (if needed)
    ├─ GeneratePlan (if mode=audit|operate|execute)
    ├─ RequestApproval (if mode=audit|execute)
    ├─ Wait for user response OR auto-approve (mode=operate)
    └─ Proceed if approved
         ↓
Execution Phase
    ├─ KeyPool.selectKey() → try providers
    │  ├─ Claude API (primary)
    │  ├─ OpenAI (fallback)
    │  └─ Ollama (last resort)
    ├─ Call LLM with context
    ├─ Stream response
    └─ Calculate tokens/cost
         ↓
Sandbox Phase (if code execution)
    ├─ SandboxManager.exec()
    ├─ Create isolated container
    ├─ Execute code
    ├─ Capture output
    └─ Cleanup
         ↓
Post-Processing
    ├─ Create checkpoint (save state)
    ├─ Update budget usage
    ├─ Emit event
    ├─ Execute skill hooks (onMessage)
    └─ Log to database
         ↓
Response Generation
    ├─ Format response
    ├─ Apply markdown→WhatsApp formatting
    └─ Send back via Baileys
         ↓
EventBus.emit('dispatch_complete')
    ├─ Sentinels listen + react
    ├─ SkillRegistry.onMessage() hooks fire
    ├─ Cron jobs may schedule follow-ups
    └─ Analytics logged
         ↓
End of Request (latency logged)
```

---

## 3. Integração de Sistemas

```
                     ┌─────────────────┐
                     │  WhatsApp User  │
                     └────────┬────────┘
                              │
                     ┌────────▼────────┐
                     │ Baileys Gateway │ ←─── SMS/Telegram (Phase 8)
                     └────────┬────────┘
                              │
         ┌────────────────────┼────────────────────┐
         │                    │                    │
    ┌────▼────┐      ┌────────▼────────┐   ┌──────▼──────┐
    │ Listener │      │  MessageDispatcher   │ Event Bus │
    │ (onMsg)  │      └────────┬────────┘   │ (pub/sub) │
    └─────────┘               │             └────┬──────┘
                    ┌─────────▼─────────┐        │
                    │  IntentRouter     │        │
                    │ (classify intent) │        │
                    └─────────┬─────────┘        │
                              │                  │
         ┌────────────────────┴────────────────┬─┴──────────────────┐
         │                                     │                   │
    ┌────▼─────────┐               ┌──────────▼──────────┐  ┌──────▼────────┐
    │ ChatSession  │               │  JarvisWorker      │  │ SkillRegistry │
    │ (context)    │               │  (main router)     │  │ (plugins)     │
    └──────────────┘               └──────┬─────────────┘  └──────┬────────┘
                                           │                       │
         ┌─────────────────────────────────┼───────────────────────┼─────────┐
         │                                 │                       │         │
    ┌────▼────────┐  ┌──────────┐  ┌──────▼─────┐  ┌──────┬──────▼──┐  ┌───▼──┐
    │ KeyPool     │  │ Budget   │  │ Approval   │  │ Plan │ Sandbx │  │Cron  │
    │ (rotation)  │  │ Controller   │ System     │  │ Mode │ Manager  │ │Sched │
    └─────────────┘  └──────────┘  └────────────┘  └──────┴────────┘  └──┬───┘
         │                  │                                          │
         └──────┬───────────┼──────────────────────────────────────────┘
                │           │
         ┌──────▼───────────▼────────┐
         │   Sentinels (5 monitors)   │
         │ ├─ CostMonitor             │
         │ ├─ KeyPoolMonitor          │
         │ ├─ SessionMonitor          │
         │ ├─ DatabaseMonitor         │
         │ └─ ErrorMonitor            │
         └────────┬────────────────────┘
                  │
         ┌────────▼──────────┐
         │ EventBus Listeners │
         │ (50+ possible)     │
         └────────┬──────────┘
                  │
    ┌─────────────┼──────────────────────┐
    │             │                      │
┌───▼──┐   ┌─────▼────┐   ┌──────┬──────▼──┐
│AutoSv │   │AutoCheck │   │Slack │ Custom  │
│(save) │   │(snapshot)│   │Notify│Integr.  │
└───────┘   └──────────┘   └──────┴────────┘
```

---

## 4. Ciclo de Vida de um Skill

```
┌─────────────────────────────────────────────────────┐
│         Skill Lifecycle in SkillRegistry            │
├─────────────────────────────────────────────────────┤
│                                                     │
│ [1] LOAD (bootstrap)                                │
│     ├─ Read skill.json manifest                     │
│     ├─ Validate schema                              │
│     ├─ Execute skill.js (exports Skill class)       │
│     ├─ Call onLoad() hook                           │
│     ├─ Register handlers (onMessage, onStartup...)  │
│     └─ Add to registry                              │
│                                                     │
│ [2] STARTUP (app initialization)                    │
│     ├─ App starts (main.ts)                         │
│     ├─ SkillRegistry.loadSkills('src/worker/skills')│
│     ├─ Iterate each loaded skill                    │
│     ├─ Call onStartup() hook                        │
│     │  (ex: CostMonitor configures alerts)          │
│     └─ Ready for messages                           │
│                                                     │
│ [3] MESSAGE (per-message processing)               │
│     ├─ MessageDispatcher receives message           │
│     ├─ Emit EventBus('message.received')            │
│     ├─ For each loaded skill:                       │
│     │  ├─ Call skill.onMessage(event)               │
│     │  │  (ex: CostMonitor logs usage)              │
│     │  └─ Await completion                          │
│     └─ Continue processing                          │
│                                                     │
│ [4] UNLOAD (skill disable/reload)                   │
│     ├─ App receives SIGTERM or manual command       │
│     ├─ For each skill: call onUnload()              │
│     │  (ex: close WebSocket connections)            │
│     ├─ Remove from registry                         │
│     └─ Cleanup complete                             │
│                                                     │
│ [5] CLEANUP (app shutdown)                          │
│     ├─ Cleanup handlers                             │
│     ├─ Close database                               │
│     ├─ Close Express server                         │
│     └─ Exit gracefully                              │
│                                                     │
└─────────────────────────────────────────────────────┘
```

### Exemplo de Hook

```typescript
// src/worker/skills/cost-monitor/skill.js
export class CostMonitor {
  onLoad() {
    // Load configuration
    this.alertThreshold = config.costAlertThreshold
    this.dailyBudget = config.dailyBudget
  }

  onStartup() {
    // Initialize alerts
    this.lastAlertTime = null
    console.log(`[cost-monitor] Ready. Alert threshold: $${this.alertThreshold}`)
  }

  async onMessage(event) {
    // React to each message
    const { cost, userId } = event
    if (cost > this.alertThreshold) {
      await this.sendAlert(userId, cost)
    }
  }

  onUnload() {
    // Cleanup
    this.alertThreshold = null
  }
}
```

---

## 5. Plan Mode State Machine

```
┌─────────────────────────────────────────────────────────┐
│           Plan Mode: 4-Level Execution Control          │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  ┌────────────────────────────────────────────────┐    │
│  │ [DEV MODE] - Maximum Autonomy                  │    │
│  │ ├─ Approval: OFF                               │    │
│  │ ├─ Plan: Optional                              │    │
│  │ ├─ Execute: Immediate                          │    │
│  │ ├─ Sandbox: Full access (network enabled)      │    │
│  │ ├─ Cost: Tracked but not limited               │    │
│  │ └─ Use: Development & testing                  │    │
│  └────────────────────────────────────────────────┘    │
│                           ↓ (user mode switch)          │
│  ┌────────────────────────────────────────────────┐    │
│  │ [AUDIT MODE] - Review & Approve                │    │
│  │ ├─ Approval: Manual review required            │    │
│  │ ├─ Plan: Always generated                      │    │
│  │ ├─ Execute: Waits for user approval            │    │
│  │ ├─ Sandbox: Network disabled                   │    │
│  │ ├─ Cost: Pre-calculated, shown to user         │    │
│  │ └─ Use: Code review, security audit            │    │
│  └────────────────────────────────────────────────┘    │
│                           ↓                             │
│  ┌────────────────────────────────────────────────┐    │
│  │ [OPERATE MODE] - Auto Approval                 │    │
│  │ ├─ Approval: Auto-approve low-risk ops         │    │
│  │ ├─ Plan: Generated, visible but not blocking   │    │
│  │ ├─ Execute: May proceed without user wait      │    │
│  │ ├─ Sandbox: Limited network (whitelist)        │    │
│  │ ├─ Cost: Tracked & limited to $50/day          │    │
│  │ └─ Use: Stable workflows, trusted environment  │    │
│  └────────────────────────────────────────────────┘    │
│                           ↓                             │
│  ┌────────────────────────────────────────────────┐    │
│  │ [EXECUTE MODE] - Full Autonomy + Guards        │    │
│  │ ├─ Approval: ALL ops require explicit approval │    │
│  │ ├─ Plan: Complex plans break into steps        │    │
│  │ ├─ Execute: Sequential, with checkpoints       │    │
│  │ ├─ Sandbox: Heavily restricted (--security)    │    │
│  │ ├─ Cost: Strict limit enforcement ($20/day)    │    │
│  │ └─ Use: Production, customer-facing ops        │    │
│  └────────────────────────────────────────────────┘    │
│                                                         │
└─────────────────────────────────────────────────────────┘

Flow:
┌─────────────┐     ┌─────────────┐     ┌──────────────┐     ┌─────────────┐
│    DEV      │ --> │   AUDIT     │ --> │   OPERATE    │ --> │  EXECUTE    │
│ (dev only)  │     │ (review)    │     │ (auto ok)    │     │ (strict)    │
└─────────────┘     └─────────────┘     └──────────────┘     └─────────────┘
     ↑                                                                │
     └────────────────────── user can switch back ──────────────────┘
```

---

## 6. Sentinels - Continuous Monitoring

```
┌─────────────────────────────────────────────────────────┐
│          5 Sentinels: 24/7 Autonomous Monitoring       │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  ┌─────────────────────────────────────────────────┐   │
│  │ [1] CostMonitor                                 │   │
│  │ ├─ Checks every 5 minutes                       │   │
│  │ ├─ Tracks cumulative spend                      │   │
│  │ ├─ Detects anomalies (3x normal rate)           │   │
│  │ ├─ Actions:                                     │   │
│  │ │  └─ Alert user (Slack/WhatsApp)               │   │
│  │ │  └─ Create checkpoint (recovery point)        │   │
│  │ │  └─ Reduce budget for next day                │   │
│  │ └─ Metric: $/hour                               │   │
│  └─────────────────────────────────────────────────┘   │
│                                                         │
│  ┌─────────────────────────────────────────────────┐   │
│  │ [2] KeyPoolMonitor                              │   │
│  │ ├─ Checks every 10 minutes                      │   │
│  │ ├─ Tests provider health (rate limit, timeout)  │   │
│  │ ├─ Tracks cooldown state                        │   │
│  │ ├─ Actions:                                     │   │
│  │ │  └─ Mark provider as DOWN                     │   │
│  │ │  └─ Force failover to next in pool            │   │
│  │ │  └─ Notify ops if all offline                 │   │
│  │ └─ Metric: availability %                       │   │
│  └─────────────────────────────────────────────────┘   │
│                                                         │
│  ┌─────────────────────────────────────────────────┐   │
│  │ [3] SessionMonitor                              │   │
│  │ ├─ Checks every 15 minutes                      │   │
│  │ ├─ Finds idle sessions (no activity > 2 hours)  │   │
│  │ ├─ Detects stale message queues                 │   │
│  │ ├─ Actions:                                     │   │
│  │ │  └─ Archive idle sessions                     │   │
│  │ │  └─ Free memory (remove from cache)           │   │
│  │ │  └─ Resume on next message                    │   │
│  │ └─ Metric: active sessions                      │   │
│  └─────────────────────────────────────────────────┘   │
│                                                         │
│  ┌─────────────────────────────────────────────────┐   │
│  │ [4] DatabaseMonitor                             │   │
│  │ ├─ Checks every 20 minutes                      │   │
│  │ ├─ Validates SQLite integrity                   │   │
│  │ ├─ Monitors size (cleanup old data)             │   │
│  │ ├─ Actions:                                     │   │
│  │ │  └─ VACUUM (reclaim space)                    │   │
│  │ │  └─ Archive messages > 90 days old            │   │
│  │ │  └─ Alert if corruption detected              │   │
│  │ └─ Metric: DB size in MB                        │   │
│  └─────────────────────────────────────────────────┘   │
│                                                         │
│  ┌─────────────────────────────────────────────────┐   │
│  │ [5] ErrorMonitor                                │   │
│  │ ├─ Checks every 2 minutes                       │   │
│  │ ├─ Counts errors (API, DB, Sandbox)             │   │
│  │ ├─ Tracks error rate (errors/hour)              │   │
│  │ ├─ Actions:                                     │   │
│  │ │  └─ If rate > 10%: disable sandbox            │   │
│  │ │  └─ If rate > 25%: scale down message queue   │   │
│  │ │  └─ If rate > 50%: circuit breaker (STOP)     │   │
│  │ │  └─ Always: notify ops                        │   │
│  │ └─ Metric: error rate %                         │   │
│  └─────────────────────────────────────────────────┘   │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

---

## 7. Data Flow: Message Processing

```
WhatsApp Message: "Generate TypeScript SDK"
      │
      ▼
┌─────────────────────────────┐
│ Baileys Gateway             │
│ decode("JB2X...") → plaintext
└────────────┬────────────────┘
             │
             ▼
┌─────────────────────────────┐
│ MessageDispatcher           │
│ {userId, message, timestamp}
└────────────┬────────────────┘
             │
             ▼
┌─────────────────────────────┐
│ IntentRouter.classify()     │
│ Intent: GENERATE_CODE       │
│ Confidence: 0.95            │
│ Params: {lang: typescript}  │
└────────────┬────────────────┘
             │
             ▼
┌─────────────────────────────┐
│ ChatSession.load()          │
│ Retrieve conversation hx    │
│ Load user learnings         │
│ Set context window          │
└────────────┬────────────────┘
             │
             ▼
┌─────────────────────────────┐
│ Budget Check                │
│ User spent: $8.50 (today)   │
│ Limit: $50/day              │
│ Request cost est: $2.30     │
│ OK to proceed               │
└────────────┬────────────────┘
             │
             ▼
┌─────────────────────────────┐
│ Plan Mode: AUDIT            │
│ Generate plan first         │
│ Request approval            │
│ Wait: 30 seconds max        │
└────────────┬────────────────┘
             │
             ▼ (user approves)
┌─────────────────────────────┐
│ Create Checkpoint           │
│ Save pre-execution state    │
│ Checkpoint ID: c7x3k2       │
└────────────┬────────────────┘
             │
             ▼
┌─────────────────────────────┐
│ KeyPool.selectKey()         │
│ Try Claude API              │
│ ├─ Rate limit check: OK     │
│ ├─ Connection test: OK      │
│ └─ Selected: claude-opus    │
└────────────┬────────────────┘
             │
             ▼
┌─────────────────────────────┐
│ LLM Call                    │
│ System prompt               │
│ + conversation history      │
│ + user learnings            │
│ = Tokens: 1,234 in          │
│ Response: 8,765 out         │
│ Cost: $2.15                 │
└────────────┬────────────────┘
             │
             ▼
┌─────────────────────────────┐
│ Sandbox: Code Execution     │
│ Docker container            │
│ Execute: npm run build      │
│ Output: ✓ success           │
│ Duration: 245ms             │
└────────────┬────────────────┘
             │
             ▼
┌─────────────────────────────┐
│ Update Budget               │
│ Previous: $8.50             │
│ + LLM cost: $2.15           │
│ = New: $10.65               │
│ Tokens: +9,999              │
└────────────┬────────────────┘
             │
             ▼
┌─────────────────────────────┐
│ Format Response             │
│ ├─ Markdown formatting      │
│ ├─ WhatsApp emoji cleanup   │
│ └─ Length check (<4000)      │
│    (if > 4000: segment)      │
└────────────┬────────────────┘
             │
             ▼
┌─────────────────────────────┐
│ Send via Baileys            │
│ Message: "✓ SDK generated..." 
└────────────┬────────────────┘
             │
             ▼
┌─────────────────────────────┐
│ EventBus.emit()             │
│ 'dispatch_complete' event   │
│ {userId, cost, tokens,...}  │
└────────────┬────────────────┘
             │
        ┌────┴──────┬──────────┬──────────┐
        ▼           ▼          ▼          ▼
   ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐
   │ Skill  │ │Sentinel│ │ AutoSv │ │Cron    │
   │onMsg() │ │onAlert │ │(save)  │ │(queue) │
   └────────┘ └────────┘ └────────┘ └────────┘
```

---

## 8. Deployment Topology

```
┌─────────────────────────────────────────────────────┐
│           Production Deployment (Future)            │
├─────────────────────────────────────────────────────┤
│                                                     │
│  ┌──────────────────────────────────────────────┐   │
│  │         Kubernetes Cluster                   │   │
│  │                                              │   │
│  │  ┌─────────────┐  ┌─────────────┐            │   │
│  │  │  OpenClaude │  │  OpenClaude │  (replicas)│   │
│  │  │  Worker Pod │  │  Worker Pod │            │   │
│  │  └──────┬──────┘  └──────┬──────┘            │   │
│  │         │                │                   │   │
│  │         └────────┬───────┘                   │   │
│  │                  ▼                           │   │
│  │  ┌─────────────────────────────────────┐    │   │
│  │  │ Kubernetes Service (Load Balancer)  │    │   │
│  │  │ :3000 → Worker Pods (round-robin)   │    │   │
│  │  └──────────────────┬──────────────────┘    │   │
│  │                     │                       │   │
│  └─────────────────────┼───────────────────────┘   │
│                        │                           │
│  ┌─────────────────────▼───────────────────────┐   │
│  │         External Load Balancer              │   │
│  │  IP: 34.56.78.90                            │   │
│  │  ├─ Sticky sessions (user affinity)         │   │
│  │  ├─ Rate limiting (500 req/min/IP)          │   │
│  │  └─ SSL termination                         │   │
│  └─────────────────────┬───────────────────────┘   │
│                        │                           │
│  ┌─────────────────────▼───────────────────────┐   │
│  │         Internet                            │   │
│  │  ├─ WhatsApp API (Twilio gateway)           │   │
│  │  ├─ Claude API (primary)                    │   │
│  │  └─ OpenAI API (fallback)                   │   │
│  └───────────────────────────────────────────┘    │
│                                                     │
│  Stateful Services:                                │
│  ┌──────────────────────────────────────────────┐  │
│  │ PostgreSQL (session sync across pods)        │  │
│  │ Redis (cache + job queue)                    │  │
│  │ Elasticsearch (logging aggregation)          │  │
│  │ Prometheus (metrics)                         │  │
│  └──────────────────────────────────────────────┘  │
│                                                     │
└─────────────────────────────────────────────────────┘
```

---

## 9. Comparison: Claude Code CLI vs JARVIS Worker

```
┌──────────────────────────────────────────────────────┐
│          CLI vs Worker: When to Use Each?            │
├──────────────────────────────────────────────────────┤
│                                                      │
│  Claude Code CLI (Frontend)                          │
│  ├─ Interface: TUI (Terminal)                        │
│  ├─ Deploy: Local machine only                       │
│  ├─ Multi-session: Sequential (one at a time)        │
│  ├─ Use case: Developer tool, interactive            │
│  ├─ Best for:                                        │
│  │  ├─ Quick code reviews                            │
│  │  ├─ Real-time coding assistance                   │
│  │  ├─ Interactive debugging                         │
│  │  └─ Feature exploration                           │
│  └─ Limit: Single user, human-driven                 │
│                                                      │
│  JARVIS Worker (Backend - KAIROS)                    │
│  ├─ Interface: REST API                              │
│  ├─ Deploy: Server/cloud (containerized)             │
│  ├─ Multi-session: Parallel (100s concurrent)        │
│  ├─ Use case: Autonomous agent, programmatic        │
│  ├─ Best for:                                        │
│  │  ├─ Multi-user SaaS applications                  │
│  │  ├─ Scheduled/background tasks                    │
│  │  ├─ Integration with external systems             │
│  │  ├─ Cost tracking & governance                    │
│  │  └─ 24/7 autonomous operation                     │
│  └─ Strength: Highly scalable, autonomous            │
│                                                      │
└──────────────────────────────────────────────────────┘
```

---

**Visual Architecture Complete!**

Esses diagramas fornecem uma visão clara de como os sistemas se inter-relacionam e como fluxo de dados flui através do sistema.
