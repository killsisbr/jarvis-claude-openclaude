# INTEGRAÇÃO: OpenBrowser + KimiProxy → OpenClaude JARVIS

**Data**: 2026-05-25  
**Status**: PLANEJADO  
**Owner**: JARVIS  

---

## EXECUTIVE SUMMARY

Analisamos 2 projetos open-source de elite:
- **OpenBrowser** (8.8k LOC): Multi-agent workflow orchestration + ReAct loops
- **KimiProxy** (3.8k LOC): OpenAI API proxy + Browser automation + Tool execution

**Achado crítico**: Ambos resolveram problemas que o JARVIS Worker vai ter:
1. Structured ReAct loops (max turns, streaming)
2. Tool execution with agentic loop
3. Session persistence + concurrency (Mutex)
4. Memory management with capacity limits
5. Streaming responses

**Oportunidade**: Não reinventar — importar padrões battle-tested de produção.

---

## GAPS ATUAIS (OpenClaude vs OpenBrowser + KimiProxy)

### 1. REPL não é estruturado
- ✅ OpenBrowser: `callWithReAct()` + max 15 turns + loopControl callback
- ✅ KimiProxy: `executeToolLoop()` + structured turns
- ❌ OpenClaude: Ad-hoc REPL, sem max turns, sem streaming callbacks

**Impact**: KAIROS Worker /api/exec não tem agentic loop robusto.

### 2. Tool execution é inline
- ✅ OpenBrowser: Tool calls parsed → executed → results re-sent
- ✅ KimiProxy: `parseToolCallsFromContent()` + `executeToolLoop()`
- ❌ OpenClaude: Tool calling happens inside agent, not coordinated

**Impact**: Difícil debugar tool execution, sem agentic loop structure.

### 3. Memory não tem capacity management
- ✅ OpenBrowser: `manageCapacity()` auto-prune old messages
- ✅ OpenBrowser: Snapshots para checkpoints
- ❌ OpenClaude: Acumula messages infinitamente

**Impact**: Long-running workers eventually hit memory limits.

### 4. Concurrency não é thread-safe
- ✅ KimiProxy: `Mutex` class para UI interactions
- ✅ KimiProxy: Headers TTL cache (10 min)
- ❌ OpenClaude: Worker sessions podem ter race conditions

**Impact**: Multi-user worker unstable under load.

### 5. Streaming é naive
- ✅ OpenBrowser: `ReActStreamCallback` com eventos estruturados
- ✅ KimiProxy: Connect/gRPC parser para streaming
- ❌ OpenClaude: Basic streaming, sem callback chain

**Impact**: Worker /api/exec/:id/stream não é production-ready.

---

## PLANO DE INTEGRAÇÃO

### FASE 1: REPL Refactor (1-2 semanas)

**Goal**: Upgrade REPL da ad-hoc para structured ReAct

#### 1.1 ReAct Loop Pattern
**Source**: OpenBrowser `src/llm/react.ts`

```typescript
// NEW: src/cli/react-loop.ts
export async function callWithReAct(
  rlm: RetryLanguageModel,
  request: LLMRequest,
  toolCallCallback: (toolCall) => Promise<any>,
  streamCallback?: (event) => void,
  loopControl?: (req, parts, turn) => boolean
): Promise<AssistantParts>

// Max 15 turns (like OpenBrowser)
loopControl = (req, parts, turn) => turn < 15 && hasToolCalls(parts)
```

**Changes**:
- Replace ad-hoc REPL loop with `callWithReAct()`
- Add `loopControl` callback for early exit
- Stream events: `loop_start`, `tool_call`, `tool_result`, `loop_end`
- File: `src/cli/print.ts` → use new `react-loop.ts`

#### 1.2 Tool Executor Pattern
**Source**: KimiProxy `src/tools/executor.ts`

```typescript
// NEW: src/cli/tool-executor.ts
export async function executeToolCall(
  toolCall: ParsedToolCall,
  registry: ToolRegistry,
  context: ToolContext
): Promise<ToolCallResult>

// Robusto JSON parsing
import { robustParseJSON } from 'utils/json'
parseToolCallsFromContent(content): { textContent, toolCalls[] }
```

**Changes**:
- Extract tool execution from REPL into separate module
- Use `robustParseJSON()` for parsing (handles partial/malformed JSON)
- Parse tool calls from XML tags: `<tool_call>...</tool_call>`
- File: `src/cli/tool-executor.ts` (new)

#### 1.3 Memory Capacity Management
**Source**: OpenBrowser `src/memory/memory.ts`

```typescript
// REFACTOR: src/memory/conversation.ts
class ConversationMemory {
  async manageCapacity(): Promise<void>
  async import(data): Promise<void>
  async export(): Promise<MemorySnapshot>
}
```

**Changes**:
- Import `OpenBrowserMemory` pattern
- Add `manageCapacity()` with auto-prune
- Enable snapshots for `/plan-mode`
- TTL per message (default: 24h)
- File: `src/memory/conversation.ts` (refactor)

#### 1.4 Testing
```bash
bun test src/cli/react-loop.test.ts
bun test src/cli/tool-executor.test.ts
bun test src/memory/conversation.test.ts
```

**Success Criteria**:
- REPL respects max 15 turns
- Tool calls parse correctly (XML + JSON)
- Memory prunes old messages
- Streaming callbacks fire in order

---

### FASE 2: Worker Hardening (2-3 semanas)

**Goal**: Upgrade `/api/exec` com agentic loop + session management

#### 2.1 Agentic Loop for /api/exec
**Source**: KimiProxy `executeToolLoop()` pattern

```typescript
// REFACTOR: src/worker/services/executor-service.ts
export async function executeWithTools(
  prompt: string,
  tools: Tool[],
  maxTurns: number = 10,
  model: string = 'deepseek-chat'
): Promise<ExecutionResult>

// Loop:
// 1. LLM call with tools
// 2. Parse tool calls
// 3. Execute each tool
// 4. Re-send results to LLM
// 5. Repeat until stop_reason or max turns
```

**Endpoint**:
```
POST /api/exec
{
  "prompt": "...",
  "tools": [{ name, description, schema }],
  "maxTurns": 10,
  "model": "deepseek-chat"
}

Response:
{
  "executionId": "exec_xyz",
  "content": "...",
  "toolCalls": [...],
  "finalMessage": "..."
}
```

#### 2.2 Session Management (Mutex + TTL)
**Source**: KimiProxy `src/services/playwright.ts`

```typescript
// NEW: src/worker/services/session-manager.ts
class SessionManager {
  private sessions: Map<string, SessionContext> = new Map()
  private uiMutex = new Mutex()

  async acquireLock(sessionId: string): Promise<() => void> {
    return this.uiMutex.acquire()
  }

  async getOrCreateSession(sessionId: string): Promise<SessionContext> {
    // TTL: 30 min (configurable)
    // Auto-expire old sessions
  }
}

// Per-request context
interface SessionContext {
  sessionId: string
  headers: Record<string, string>
  cookies: string
  expiresAt: number
  lastUsed: number
}
```

**Changes**:
- Add Mutex to prevent race conditions
- Per-session context with TTL
- Auto-cleanup expired sessions
- File: `src/worker/services/session-manager.ts` (new)

#### 2.3 Streaming Responses
**Source**: OpenBrowser `ReActStreamCallback`

```typescript
// REFACTOR: src/worker/routes/exec.ts
GET /api/exec/:id/stream

// Server-Sent Events
event: tool_call
data: { name, arguments }

event: tool_result
data: { name, result, success }

event: final_response
data: { content, reason }
```

**Changes**:
- Add `/api/exec/:id/stream` endpoint
- Emit structured SSE events
- Client can monitor real-time progress
- File: `src/worker/routes/exec.ts` (refactor)

#### 2.4 Testing
```bash
bun test src/worker/services/executor-service.test.ts
bun test src/worker/services/session-manager.test.ts
```

**Success Criteria**:
- `/api/exec` runs max 10 turns
- Session TTL works (30 min)
- Streaming events fire in order
- Mutex prevents race conditions

---

### FASE 3: Workflow Synthesis (4+ semanas)

**Goal**: Enable `/api/plan-workflow` endpoint (Planner from OpenBrowser)

#### 3.1 Workflow Planner
**Source**: OpenBrowser `src/agent/plan.ts`

```typescript
// NEW: src/worker/services/planner.ts
class WorkflowPlanner {
  async plan(taskPrompt: string): Promise<Workflow> {
    // Generate DAG of micro-agents
    // Each agent: specific capability
    // Returns: { agents[], edges[], executionOrder }
  }

  async replan(
    taskId: string,
    failure: string
  ): Promise<Workflow> {
    // Adapt workflow based on failure
  }
}

// Endpoint
POST /api/plan-workflow
{
  "prompt": "Create a landing page for a SaaS",
  "context": { ... }
}

Response:
{
  "workflowId": "wf_xyz",
  "agents": [
    { name: "research", description: "...", tools: [...] },
    { name: "designer", description: "...", tools: [...] },
    { name: "developer", description: "...", tools: [...] }
  ],
  "edges": [
    { from: "research", to: "designer" },
    { from: "designer", to: "developer" }
  ],
  "executionOrder": ["research", "designer", "developer"]
}
```

#### 3.2 Agent Composition (Skill System)
**Source**: JARVIS 5.0 audit + OpenBrowser A2A

```typescript
// Agents são skills reutilizáveis
// Each skill = { name, description, tools[], execute() }
// Worker loads skills from src/worker/skills/
// A2A: Agents podem chamar outros agents
```

#### 3.3 Approval System + Checkpoints
**Source**: JARVIS 5.0 ideas

```typescript
// NEW: src/worker/services/approval-system.ts
class ApprovalSystem {
  async requestApproval(
    action: string,
    dangerLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL',
    timeout: number = 5 * 60 * 1000
  ): Promise<'approved' | 'rejected' | 'timeout'>
}

// NEW: src/worker/services/checkpoints.ts
class CheckpointManager {
  async saveCheckpoint(
    workflowId: string,
    state: WorkflowState
  ): Promise<CheckpointId>

  async loadCheckpoint(
    checkpointId: string
  ): Promise<WorkflowState>

  async rollbackToCheckpoint(
    checkpointId: string
  ): Promise<void>
}
```

---

## IMPORTS (Copy-paste ready)

### From OpenBrowser

**File 1: ReAct Loop**
```
src/llm/react.ts → src/cli/react-loop.ts
Lines: 1-150 (core logic)
- callWithReAct() function
- loopControl callback pattern
- streamCallback event chain
```

**File 2: Memory**
```
src/memory/memory.ts → src/memory/conversation.ts
Lines: 1-200 (core logic)
- OpenBrowserMemory class
- manageCapacity() method
- import/export snapshots
```

**File 3: Types**
```
src/types/llm.types.ts → src/types/react.types.ts
- ReActTool, LLMRequest, AssistantParts, etc
```

**File 4: Utilities**
```
src/common/utils.ts → src/common/react-utils.ts
- uuidv4(), sleep(), retry logic
```

### From KimiProxy

**File 1: Tool Executor**
```
src/tools/executor.ts → src/cli/tool-executor.ts
Lines: 1-200 (core logic)
- executeToolCall() function
- LoopTurnResult interface
- executeToolLoop() orchestrator
```

**File 2: Tool Parser**
```
src/tools/parser.ts → src/cli/tool-parser.ts
Lines: 1-100 (parsing logic)
- parseToolCallsFromContent()
- XML tag extraction
```

**File 3: JSON Parser**
```
src/utils/json.ts → src/utils/robust-json.ts
- robustParseJSON() with fallback
- Handles malformed/partial JSON
```

**File 4: Mutex + Session**
```
src/services/playwright.ts → src/worker/services/session-manager.ts
Lines: 25-52 (Mutex pattern)
- Mutex class implementation
- Acquire/release pattern
- Queue-based locking
```

---

## RISK ANALYSIS

### Low Risk
✅ **ReAct Loop (Phase 1)**
- Battle-tested in OpenBrowser (production)
- No breaking changes to current code
- Can run in parallel with REPL

✅ **Tool Executor (Phase 1)**
- Simple, focused module
- Easy to test in isolation
- Fallback JSON parsing reduces failures

### Medium Risk
⚠️ **Memory Capacity (Phase 1)**
- Need to audit existing memory usage first
- Pruning old messages = need snapshot restore strategy
- Mitigation: Snapshot before prune

⚠️ **Session Manager (Phase 2)**
- Concurrency is tricky
- Mutex can deadlock if not careful
- Mitigation: Timeout on lock acquire (5s)

### Low-Medium Risk
⚠️ **Streaming Responses (Phase 2)**
- SSE events can buffer if client slow
- Need backpressure handling
- Mitigation: Limit buffered events (max 100)

### Mitigation Strategy
1. **Test each phase independently** before merging
2. **Shadow mode**: New code runs in parallel, REPL unchanged
3. **Gradual rollout**: Phase 1 → Phase 2 → Phase 3 (staggered)
4. **Revert plan**: Tag git commits before each phase

---

## TIMELINE

| Phase | Duration | Files Changed | Tests Added |
|-------|----------|----------------|-------------|
| 1: REPL Refactor | 1-2 weeks | 5-6 files | 15+ tests |
| 2: Worker Hardening | 2-3 weeks | 6-7 files | 20+ tests |
| 3: Workflow Synthesis | 4+ weeks | 10+ files | 30+ tests |

**Total**: 7-9 weeks, ~450+ lines of new code + tests

---

## SUCCESS METRICS

### Phase 1
- [ ] REPL respects max 15 turns
- [ ] Tool calls parse from XML correctly
- [ ] Memory prunes messages after 24h
- [ ] 15+ tests pass, 80%+ coverage

### Phase 2
- [ ] `/api/exec` runs max 10 turns
- [ ] Session TTL works (30 min auto-cleanup)
- [ ] `/api/exec/:id/stream` emits events
- [ ] Mutex prevents race conditions
- [ ] 20+ tests pass, 80%+ coverage

### Phase 3
- [ ] `/api/plan-workflow` generates DAGs
- [ ] Agents compose workflows correctly
- [ ] Approval system requests/accepts
- [ ] Checkpoints save/restore state
- [ ] 30+ tests pass, 80%+ coverage

---

## NEXT STEPS

**This session** (2026-05-25):
1. [x] Analyze openbrowser + kimiproxy (DONE)
2. [x] Document patterns + gaps (DONE)
3. [ ] Start Phase 1: Copy ReAct loop pattern
4. [ ] Create `src/cli/react-loop.ts`
5. [ ] Add first tests

**This week**:
- Finish Phase 1 implementation
- Test REPL with new ReAct loops
- Verify no regressions

**This month**:
- Finish Phase 2
- Harden Worker /api/exec
- Production testing

---

## REFERENCES

- [OpenBrowser GitHub](https://github.com/open-browser/open-browser-core)
- [KimiProxy GitHub](https://github.com/kimi-ai-proxy/kimiproxy)
- Local copies: `D:\jarvis-claude\openbrowser-main`, `D:\jarvis-claude\kimiproxy`
- Integration memo: `memory/integration-openbrowser-kimiproxy.md`
