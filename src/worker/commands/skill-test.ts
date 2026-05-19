/**
 * CLI command: jarvis skill test <path>
 *
 * Test a skill locally without reloading the server.
 */

import fs from 'fs'
import path from 'path'

interface SkillContext {
  logger: Console
  db: null
  eventBus: { emit: (event: string, data: any) => void }
  worker: null
  userId: string
  timestamp: number
}

/**
 * Load and test a skill
 */
export async function testSkill(
  skillPath: string,
  input: string = 'test input'
): Promise<{
  success: boolean
  result?: any
  error?: string
  latencyMs?: number
}> {
  const t0 = Date.now()

  try {
    // Resolve path
    const resolvedPath = path.resolve(skillPath)

    if (!fs.existsSync(resolvedPath)) {
      return {
        success: false,
        error: `File not found: ${resolvedPath}`,
      }
    }

    // Load the skill module
    delete require.cache[require.resolve(resolvedPath)]
    const skillModule = require(resolvedPath)

    // Validate skill structure
    if (!skillModule.execute) {
      return {
        success: false,
        error: 'Skill must export an execute() function',
      }
    }

    // Create mock context
    const context: SkillContext = {
      logger: console,
      db: null,
      eventBus: {
        emit: (event, data) => {
          console.log(`[event] ${event}:`, data)
        },
      },
      worker: null,
      userId: 'test-user',
      timestamp: Date.now(),
    }

    // Run init if provided
    if (skillModule.init) {
      console.log('[test] Running init...')
      await skillModule.init(context)
    }

    // Validate input if provided
    if (skillModule.validate) {
      console.log('[test] Validating input...')
      const validation = await skillModule.validate(input, context)

      if (!validation.valid) {
        return {
          success: false,
          error: validation.error || 'Validation failed',
          latencyMs: Date.now() - t0,
        }
      }
    }

    // Execute skill
    console.log(`[test] Executing with input: "${input}"`)
    const result = await skillModule.execute(input, context)

    // Run cleanup if provided
    if (skillModule.cleanup) {
      console.log('[test] Running cleanup...')
      await skillModule.cleanup(context)
    }

    const latencyMs = Date.now() - t0

    console.log(`[test] ✓ Skill executed successfully in ${latencyMs}ms`)

    return {
      success: true,
      result,
      latencyMs,
    }
  } catch (err) {
    const latencyMs = Date.now() - t0
    const errorMsg = err instanceof Error ? err.message : String(err)

    console.error(`[test] ✗ Error: ${errorMsg}`)

    return {
      success: false,
      error: errorMsg,
      latencyMs,
    }
  }
}

/**
 * Interactive skill testing
 */
export async function interactiveTestSkill(skillPath: string): Promise<void> {
  const skillName = path.basename(path.dirname(skillPath))

  console.log(`\n🧪 Testing skill: ${skillName}`)
  console.log(`   Path: ${skillPath}\n`)

  // Test 1: Load skill
  console.log('Test 1: Load skill')
  const resolvedPath = path.resolve(skillPath)

  if (!fs.existsSync(resolvedPath)) {
    console.log('   ✗ File not found\n')
    return
  }

  try {
    delete require.cache[require.resolve(resolvedPath)]
    const skillModule = require(resolvedPath)
    console.log(`   ✓ Loaded (name: ${skillModule.name}, version: ${skillModule.version})\n`)

    // Test 2: Validate structure
    console.log('Test 2: Validate structure')
    const required = ['execute']
    const optional = ['init', 'validate', 'cleanup', 'onError']

    const missing = required.filter((fn) => !skillModule[fn])
    if (missing.length > 0) {
      console.log(`   ✗ Missing required functions: ${missing.join(', ')}\n`)
      return
    }

    const hasOptional = optional.filter((fn) => skillModule[fn]).join(', ') || 'none'
    console.log(`   ✓ All required functions present`)
    console.log(`   ✓ Optional functions: ${hasOptional}\n`)

    // Test 3: Execute with test input
    console.log('Test 3: Execute with default input')
    const testResult = await testSkill(skillPath, 'test input')

    if (testResult.success) {
      console.log(`   ✓ Execution successful (${testResult.latencyMs}ms)`)
      console.log(`   ✓ Result:`, JSON.stringify(testResult.result, null, 2))
    } else {
      console.log(`   ✗ Execution failed: ${testResult.error}`)
    }
    console.log()
  } catch (err) {
    console.log(`   ✗ Failed to load: ${err instanceof Error ? err.message : String(err)}\n`)
  }
}

/**
 * Get skill metadata
 */
export function getSkillMetadata(skillPath: string): any {
  try {
    const resolvedPath = path.resolve(skillPath)

    if (!fs.existsSync(resolvedPath)) {
      return null
    }

    delete require.cache[require.resolve(resolvedPath)]
    const skillModule = require(resolvedPath)

    return {
      name: skillModule.name,
      version: skillModule.version,
      description: skillModule.description,
      commands: skillModule.commands || [],
      hasInit: !!skillModule.init,
      hasValidate: !!skillModule.validate,
      hasCleanup: !!skillModule.cleanup,
      hasOnError: !!skillModule.onError,
    }
  } catch {
    return null
  }
}
