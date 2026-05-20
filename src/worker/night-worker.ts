/**
 * Night Worker — Autonomous long-running mission executor.
 *
 * "Vai dormir, JARVIS trabalha a noite toda."
 *
 * Flow:
 *   1. User submits mission via POST /api/mission
 *   2. Planner breaks it into ordered phases
 *   3. Executor runs phase by phase with checkpoints
 *   4. Test Runner validates each phase
 *   5. Report Generator creates final markdown report
 */

import { randomUUID } from 'node:crypto'
import { spawn } from 'node:child_process'
import { writeFile, mkdir } from 'node:fs/promises'
import { join } from 'node:path'
import { homedir } from 'node:os'
import { getDatabase } from './db/schema.ts'

// ── Types ────────────────────────────────────────────────────────────────────

export interface Mission {
  id: string
  title: string
  description: string
  plan: MissionPlan | null
  status: MissionStatus
  phases: MissionPhase[]
  currentPhase: number
  totalPhases: number
  workingDir: string
  budgetLimit: number
  tokensUsed: number
  costTotal: number
  createdAt: number
  startedAt: number | null
  completedAt: number | null
  reportPath: string | null
  errorMsg: string | null
}

export type MissionStatus =
  | 'queued'
  | 'planning'
  | 'running'
  | 'paused'
  | 'completed'
  | 'failed'
  | 'cancelled'

export interface MissionPlan {
  goal: string
  phases: PhaseDef[]
  testCommand: string | null
  safetyNotes: string[]
}

export interface PhaseDef {
  title: string
  description: string
  successCriteria: string
  estimatedTokens: number
}

export interface MissionPhase {
  id: string
  missionId: string
  phase: number
  phaseTitle: string
  status: 'pending' | 'running' | 'passed' | 'failed' | 'skipped'
  output: string | null
  testsRun: number
  testsPassed: number
  retries: number
  tokensUsed: number
  cost: number
  startedAt: number | null
  completedAt: number | null
}

export interface NightWorkerConfig {
  llmCall: (systemPrompt: string, userPrompt: string) => Promise<{ text: string; tokens: number; cost: number }>
  maxRetries: number
  budgetDefault: number
  reportsDir: string
}

// ── Safety Rules ─────────────────────────────────────────────────────────────

const BLOCKED_PATTERNS = [
  /rm\s+(-rf?|--recursive)\s+[\/\\]/i,
  /git\s+push/i,
  /git\s+push\s+--force/i,
  /npm\s+publish/i,
  /docker\s+push/i,
  /kubectl\s+apply/i,
  /kubectl\s+delete/i,
  /drop\s+table/i,
  /drop\s+database/i,
  /truncate\s+table/i,
  /shutdown/i,
  /reboot/i,
  /format\s+[a-z]:/i,
  /del\s+\/[sf]/i,
]

const BLOCKED_FILES = [
  '.env',
  '.env.production',
  'credentials.json',
  'secrets.yaml',
  'id_rsa',
  'id_ed25519',
]

function isSafeCommand(cmd: string): { safe: boolean; reason?: string } {
  for (const pattern of BLOCKED_PATTERNS) {
    if (pattern.test(cmd)) {
      return { safe: false, reason: `Blocked pattern: ${pattern.source}` }
    }
  }
  for (const file of BLOCKED_FILES) {
    if (cmd.includes(file)) {
      return { safe: false, reason: `Blocked file: ${file}` }
    }
  }
  return { safe: true }
}

// ── CLI Spawner ──────────────────────────────────────────────────────────────

function runCommand(
  cmd: string,
  cwd: string,
  timeoutMs = 120_000,
): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  return new Promise((resolve) => {
    const isWin = process.platform === 'win32'
    const shell = isWin ? 'cmd.exe' : '/bin/bash'
    const shellArgs = isWin ? ['/c', cmd] : ['-c', cmd]

    const child = spawn(shell, shellArgs, {
      cwd,
      timeout: timeoutMs,
      env: { ...process.env },
    })

    let stdout = ''
    let stderr = ''

    child.stdout?.on('data', (d) => { stdout += d.toString() })
    child.stderr?.on('data', (d) => { stderr += d.toString() })

    child.on('close', (code) => {
      resolve({ stdout: stdout.slice(0, 50_000), stderr: stderr.slice(0, 10_000), exitCode: code ?? 1 })
    })

    child.on('error', (err) => {
      resolve({ stdout, stderr: err.message, exitCode: 1 })
    })
  })
}

// ── Night Worker Engine ──────────────────────────────────────────────────────

export class NightWorker {
  private config: NightWorkerConfig
  private running = new Map<string, boolean>()

  constructor(config: NightWorkerConfig) {
    this.config = config
  }

  // ── Mission CRUD ─────────────────────────────────────────────────────────

  createMission(title: string, description: string, workingDir: string, budgetLimit?: number): Mission {
    const id = randomUUID()
    const now = Date.now()
    const budget = budgetLimit ?? this.config.budgetDefault

    getDatabase().run(
      `INSERT INTO missions (id, title, description, status, working_dir, budget_limit, created_at)
       VALUES (?, ?, ?, 'queued', ?, ?, ?)`,
      [id, title, description, workingDir, budget, now],
    )

    console.log(`[night-worker] Mission created: ${id} — "${title}"`)

    return {
      id, title, description, plan: null, status: 'queued',
      phases: [], currentPhase: 0, totalPhases: 0,
      workingDir, budgetLimit: budget, tokensUsed: 0, costTotal: 0,
      createdAt: now, startedAt: null, completedAt: null,
      reportPath: null, errorMsg: null,
    }
  }

  getMission(id: string): Mission | null {
    const row = getDatabase().prepare('SELECT * FROM missions WHERE id = ?').get(id) as any
    if (!row) return null

    const phases = getDatabase()
      .prepare('SELECT * FROM mission_logs WHERE mission_id = ? ORDER BY phase')
      .all(id) as any[]

    return {
      id: row.id,
      title: row.title,
      description: row.description,
      plan: row.plan ? JSON.parse(row.plan) : null,
      status: row.status,
      phases: phases.map(p => ({
        id: p.id, missionId: p.mission_id, phase: p.phase,
        phaseTitle: p.phase_title, status: p.status, output: p.output,
        testsRun: p.tests_run, testsPassed: p.tests_passed,
        retries: p.retries, tokensUsed: p.tokens_used, cost: p.cost,
        startedAt: p.started_at, completedAt: p.completed_at,
      })),
      currentPhase: row.current_phase,
      totalPhases: row.total_phases,
      workingDir: row.working_dir,
      budgetLimit: row.budget_limit,
      tokensUsed: row.tokens_used,
      costTotal: row.cost_total,
      createdAt: row.created_at,
      startedAt: row.started_at,
      completedAt: row.completed_at,
      reportPath: row.report_path,
      errorMsg: row.error_msg,
    }
  }

  listMissions(status?: MissionStatus): Mission[] {
    const query = status
      ? 'SELECT id FROM missions WHERE status = ? ORDER BY created_at DESC'
      : 'SELECT id FROM missions ORDER BY created_at DESC'
    const rows = (status
      ? getDatabase().prepare(query).all(status)
      : getDatabase().prepare(query).all()) as any[]

    return rows.map(r => this.getMission(r.id)!).filter(Boolean)
  }

  cancelMission(id: string): boolean {
    const mission = this.getMission(id)
    if (!mission || mission.status === 'completed' || mission.status === 'cancelled') return false

    this.running.set(id, false)
    this.updateMissionStatus(id, 'cancelled')
    console.log(`[night-worker] Mission cancelled: ${id}`)
    return true
  }

  // ── Main Execution Loop ──────────────────────────────────────────────────

  async executeMission(id: string): Promise<Mission> {
    const mission = this.getMission(id)
    if (!mission) throw new Error(`Mission not found: ${id}`)

    this.running.set(id, true)
    console.log(`[night-worker] === Starting mission: "${mission.title}" ===`)

    try {
      // Phase 1: Planning
      this.updateMissionStatus(id, 'planning')
      const plan = await this.planMission(mission)
      this.savePlan(id, plan)
      console.log(`[night-worker] Plan ready: ${plan.phases.length} phases`)

      // Create phase log entries
      for (let i = 0; i < plan.phases.length; i++) {
        this.createPhaseLog(id, i, plan.phases[i].title)
      }
      this.updateMissionField(id, 'total_phases', plan.phases.length)

      // Phase 2: Execute each phase
      this.updateMissionStatus(id, 'running')
      this.updateMissionField(id, 'started_at', Date.now())

      for (let i = 0; i < plan.phases.length; i++) {
        if (!this.running.get(id)) {
          console.log(`[night-worker] Mission cancelled during execution`)
          break
        }

        // Budget check
        const current = this.getMission(id)!
        if (current.costTotal >= current.budgetLimit) {
          this.updateMissionStatus(id, 'paused', 'Budget limit reached')
          console.log(`[night-worker] Budget limit reached: $${current.costTotal.toFixed(2)}/$${current.budgetLimit}`)
          break
        }

        this.updateMissionField(id, 'current_phase', i)
        await this.executePhase(id, i, plan.phases[i], mission.workingDir, plan.testCommand)
      }

      // Phase 3: Generate report
      const finalMission = this.getMission(id)!
      if (finalMission.status === 'running') {
        const allPassed = finalMission.phases.every(p => p.status === 'passed' || p.status === 'skipped')
        this.updateMissionStatus(id, allPassed ? 'completed' : 'failed')
      }

      const reportPath = await this.generateReport(id)
      this.updateMissionField(id, 'report_path', reportPath)
      this.updateMissionField(id, 'completed_at', Date.now())

      const result = this.getMission(id)!
      console.log(`[night-worker] === Mission ${result.status}: "${result.title}" ===`)
      console.log(`[night-worker] Report: ${reportPath}`)
      return result

    } catch (error: any) {
      this.updateMissionStatus(id, 'failed', error.message)
      console.error(`[night-worker] Mission failed:`, error.message)
      await this.generateReport(id)
      return this.getMission(id)!
    } finally {
      this.running.delete(id)
    }
  }

  // ── Planner ──────────────────────────────────────────────────────────────

  private async planMission(mission: Mission): Promise<MissionPlan> {
    const systemPrompt = `You are a mission planner for an autonomous coding agent.
Given a task description, break it into ordered phases.

RULES:
- Each phase must be independently verifiable
- Order phases by dependency (foundations first)
- Include a test/verification step in each phase
- Be specific about what files to create/modify
- Estimate token usage per phase (1000-50000)
- Identify the test command (npm test, bun test, etc) or null if none

Respond in JSON only:
{
  "goal": "one-line summary",
  "phases": [
    {
      "title": "Phase title",
      "description": "What to do in detail",
      "successCriteria": "How to verify it worked",
      "estimatedTokens": 5000
    }
  ],
  "testCommand": "npm test" or null,
  "safetyNotes": ["things to be careful about"]
}`

    const userPrompt = `Mission: ${mission.title}\n\nDescription:\n${mission.description}\n\nWorking directory: ${mission.workingDir}`

    const result = await this.config.llmCall(systemPrompt, userPrompt)
    this.addTokenCost(mission.id, result.tokens, result.cost)

    try {
      const jsonMatch = result.text.match(/\{[\s\S]*\}/)
      if (!jsonMatch) throw new Error('No JSON in planner response')
      return JSON.parse(jsonMatch[0]) as MissionPlan
    } catch {
      return {
        goal: mission.title,
        phases: [{
          title: 'Execute task',
          description: mission.description,
          successCriteria: 'Task completed without errors',
          estimatedTokens: 10000,
        }],
        testCommand: null,
        safetyNotes: ['Single-phase fallback — planner could not parse phases'],
      }
    }
  }

  // ── Phase Executor ───────────────────────────────────────────────────────

  private async executePhase(
    missionId: string,
    phaseIdx: number,
    phaseDef: PhaseDef,
    workingDir: string,
    testCommand: string | null,
  ): Promise<void> {
    const phaseNum = phaseIdx + 1
    console.log(`[night-worker] Phase ${phaseNum}: ${phaseDef.title}`)
    this.updatePhaseStatus(missionId, phaseIdx, 'running')
    this.updatePhaseField(missionId, phaseIdx, 'started_at', Date.now())

    let lastOutput = ''
    let retries = 0

    for (let attempt = 0; attempt <= this.config.maxRetries; attempt++) {
      retries = attempt

      const systemPrompt = `You are an autonomous coding agent executing phase ${phaseNum} of a mission.

WORKING DIRECTORY: ${workingDir}
PHASE: ${phaseDef.title}
DESCRIPTION: ${phaseDef.description}
SUCCESS CRITERIA: ${phaseDef.successCriteria}
${attempt > 0 ? `\nPREVIOUS ATTEMPT FAILED:\n${lastOutput}\n\nFix the issue and try again.` : ''}

RULES:
- Write actual code, not pseudocode
- Use relative paths from the working directory
- Each code block must have a filename comment on the first line: // filename: path/to/file.ts
- For shell commands, prefix with: // cmd: command here
- Do NOT use dangerous commands (rm -rf, git push, npm publish, etc)
- Be thorough but concise

Respond with the code/commands needed to complete this phase.`

      const result = await this.config.llmCall(systemPrompt, phaseDef.description)
      this.addTokenCost(missionId, result.tokens, result.cost)
      this.updatePhaseField(missionId, phaseIdx, 'tokens_used', result.tokens)

      // Extract and execute code blocks
      const execResult = await this.executeCodeBlocks(result.text, workingDir)
      lastOutput = execResult.output

      // Run tests if available
      let testsPassed = true
      let testsRun = 0
      let testsOk = 0

      if (testCommand) {
        const safety = isSafeCommand(testCommand)
        if (safety.safe) {
          console.log(`[night-worker]   Running tests: ${testCommand}`)
          const testResult = await runCommand(testCommand, workingDir, 180_000)
          testsRun = 1
          testsPassed = testResult.exitCode === 0
          testsOk = testsPassed ? 1 : 0
          lastOutput += `\n\n--- TEST OUTPUT ---\n${testResult.stdout}\n${testResult.stderr}`
        }
      }

      this.updatePhaseField(missionId, phaseIdx, 'tests_run', testsRun)
      this.updatePhaseField(missionId, phaseIdx, 'tests_passed', testsOk)
      this.updatePhaseField(missionId, phaseIdx, 'retries', retries)
      this.updatePhaseField(missionId, phaseIdx, 'output', lastOutput.slice(0, 50_000))

      if (!execResult.hasErrors && testsPassed) {
        this.updatePhaseStatus(missionId, phaseIdx, 'passed')
        this.updatePhaseField(missionId, phaseIdx, 'completed_at', Date.now())
        console.log(`[night-worker]   Phase ${phaseNum}: PASSED ${retries > 0 ? `(after ${retries} retries)` : ''}`)
        return
      }

      if (attempt < this.config.maxRetries) {
        console.log(`[night-worker]   Phase ${phaseNum}: retry ${attempt + 1}/${this.config.maxRetries}`)
      }
    }

    // All retries exhausted
    this.updatePhaseStatus(missionId, phaseIdx, 'failed')
    this.updatePhaseField(missionId, phaseIdx, 'completed_at', Date.now())
    console.log(`[night-worker]   Phase ${phaseNum}: FAILED after ${retries} retries`)
  }

  // ── Code Block Executor ──────────────────────────────────────────────────

  private async executeCodeBlocks(
    text: string,
    workingDir: string,
  ): Promise<{ output: string; hasErrors: boolean }> {
    const blocks = text.match(/```[\s\S]*?```/g) || []
    let output = ''
    let hasErrors = false

    for (const block of blocks) {
      const content = block.replace(/^```\w*\n?/, '').replace(/\n?```$/, '')
      const lines = content.split('\n')

      // Check for command blocks
      const cmdLine = lines.find(l => l.trim().startsWith('// cmd:'))
      if (cmdLine) {
        const cmd = cmdLine.replace(/\/\/\s*cmd:\s*/, '').trim()
        const safety = isSafeCommand(cmd)
        if (!safety.safe) {
          output += `\n[BLOCKED] ${cmd} — ${safety.reason}`
          continue
        }
        console.log(`[night-worker]   Exec: ${cmd}`)
        const result = await runCommand(cmd, workingDir)
        output += `\n$ ${cmd}\n${result.stdout}`
        if (result.exitCode !== 0) {
          output += `\nSTDERR: ${result.stderr}\nEXIT: ${result.exitCode}`
          hasErrors = true
        }
        continue
      }

      // Check for file writes
      const fileLine = lines.find(l => l.trim().startsWith('// filename:'))
      if (fileLine) {
        const filePath = fileLine.replace(/\/\/\s*filename:\s*/, '').trim()
        const fileContent = lines.filter(l => !l.trim().startsWith('// filename:')).join('\n')
        const fullPath = join(workingDir, filePath)

        // Safety check on path
        if (BLOCKED_FILES.some(f => filePath.includes(f))) {
          output += `\n[BLOCKED] Cannot write to ${filePath}`
          continue
        }

        try {
          await mkdir(join(fullPath, '..'), { recursive: true })
          await writeFile(fullPath, fileContent, 'utf-8')
          output += `\n[WROTE] ${filePath} (${fileContent.length} bytes)`
          console.log(`[night-worker]   Wrote: ${filePath}`)
        } catch (err: any) {
          output += `\n[ERROR] Writing ${filePath}: ${err.message}`
          hasErrors = true
        }
      }
    }

    return { output, hasErrors }
  }

  // ── Report Generator ─────────────────────────────────────────────────────

  private async generateReport(missionId: string): Promise<string> {
    const mission = this.getMission(missionId)!
    const now = new Date()
    const duration = mission.startedAt
      ? Math.round((Date.now() - mission.startedAt) / 60_000)
      : 0

    const phasesReport = mission.phases.map(p => {
      const icon = p.status === 'passed' ? '✅' : p.status === 'failed' ? '❌' : p.status === 'skipped' ? '⏭️' : '⏳'
      const tests = p.testsRun > 0 ? ` | Tests: ${p.testsPassed}/${p.testsRun}` : ''
      const retries = p.retries > 0 ? ` | Retries: ${p.retries}` : ''
      return `${icon} **Phase ${p.phase + 1}: ${p.phaseTitle}** — ${p.status}${tests}${retries}`
    }).join('\n')

    const passedCount = mission.phases.filter(p => p.status === 'passed').length
    const failedCount = mission.phases.filter(p => p.status === 'failed').length

    const report = `# Mission Report: ${mission.title}

**Date**: ${now.toISOString().split('T')[0]}
**Status**: ${mission.status.toUpperCase()}
**Duration**: ${duration} minutes
**Cost**: $${mission.costTotal.toFixed(4)}
**Tokens**: ${mission.tokensUsed.toLocaleString()}

---

## Summary

${mission.plan?.goal || mission.description}

- Phases completed: ${passedCount}/${mission.totalPhases}
- Phases failed: ${failedCount}
- Budget used: $${mission.costTotal.toFixed(4)} / $${mission.budgetLimit}

---

## Phases

${phasesReport}

---

## Phase Details

${mission.phases.map(p => `### Phase ${p.phase + 1}: ${p.phaseTitle}

**Status**: ${p.status}
**Tokens**: ${p.tokensUsed.toLocaleString()}
**Cost**: $${p.cost.toFixed(4)}
${p.retries > 0 ? `**Retries**: ${p.retries}` : ''}
${p.testsRun > 0 ? `**Tests**: ${p.testsPassed}/${p.testsRun} passed` : ''}

<details>
<summary>Output</summary>

\`\`\`
${(p.output || 'No output').slice(0, 5000)}
\`\`\`

</details>
`).join('\n')}

---

## Safety Notes

${mission.plan?.safetyNotes?.map(n => `- ${n}`).join('\n') || 'None'}

${mission.errorMsg ? `## Error\n\n\`\`\`\n${mission.errorMsg}\n\`\`\`\n` : ''}

---

*Generated by JARVIS Night Worker v5.0.0*
`

    const reportsDir = this.config.reportsDir
    await mkdir(reportsDir, { recursive: true })
    const filename = `mission-${now.toISOString().split('T')[0]}-${missionId.slice(0, 8)}.md`
    const reportPath = join(reportsDir, filename)
    await writeFile(reportPath, report, 'utf-8')

    return reportPath
  }

  // ── DB Helpers ───────────────────────────────────────────────────────────

  private updateMissionStatus(id: string, status: MissionStatus, errorMsg?: string): void {
    if (errorMsg) {
      getDatabase().run('UPDATE missions SET status = ?, error_msg = ? WHERE id = ?', [status, errorMsg, id])
    } else {
      getDatabase().run('UPDATE missions SET status = ? WHERE id = ?', [status, id])
    }
  }

  private updateMissionField(id: string, field: string, value: any): void {
    getDatabase().run(`UPDATE missions SET ${field} = ? WHERE id = ?`, [value, id])
  }

  private savePlan(id: string, plan: MissionPlan): void {
    getDatabase().run('UPDATE missions SET plan = ?, total_phases = ? WHERE id = ?',
      [JSON.stringify(plan), plan.phases.length, id])
  }

  private createPhaseLog(missionId: string, phase: number, title: string): void {
    getDatabase().run(
      `INSERT INTO mission_logs (id, mission_id, phase, phase_title, status)
       VALUES (?, ?, ?, ?, 'pending')`,
      [randomUUID(), missionId, phase, title],
    )
  }

  private updatePhaseStatus(missionId: string, phase: number, status: string): void {
    getDatabase().run(
      'UPDATE mission_logs SET status = ? WHERE mission_id = ? AND phase = ?',
      [status, missionId, phase],
    )
  }

  private updatePhaseField(missionId: string, phase: number, field: string, value: any): void {
    getDatabase().run(
      `UPDATE mission_logs SET ${field} = ? WHERE mission_id = ? AND phase = ?`,
      [value, missionId, phase],
    )
  }

  private addTokenCost(missionId: string, tokens: number, cost: number): void {
    getDatabase().run(
      'UPDATE missions SET tokens_used = tokens_used + ?, cost_total = cost_total + ? WHERE id = ?',
      [tokens, cost, missionId],
    )
    getDatabase().run(
      'UPDATE mission_logs SET cost = cost + ? WHERE mission_id = ? AND phase = (SELECT current_phase FROM missions WHERE id = ?)',
      [cost, missionId, missionId],
    )
  }
}
