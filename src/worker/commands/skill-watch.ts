/**
 * CLI command: jarvis skill watch <path>
 *
 * Watch skill file for changes and display real-time reload feedback.
 * Uses WebSocket to track server-side hot-reload progress.
 */

import fs from 'fs'
import path from 'path'
import { SkillWatcher, getSkillWatcher } from '../services/skill-watcher'
import { getSkillReloader } from '../services/skill-reloader'
import { getSkillMetadata } from './skill-test'

interface WatchStats {
  reloads: number
  successful: number
  failed: number
  startTime: Date
}

const Colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
}

function colorize(text: string, color: string): string {
  return `${color}${text}${Colors.reset}`
}

function log(message: string, color: string = Colors.reset): void {
  const time = new Date().toLocaleTimeString()
  console.log(`${Colors.dim}[${time}]${Colors.reset} ${colorize(message, color)}`)
}

/**
 * Start watching a skill file
 */
export async function watchSkill(skillPath: string): Promise<void> {
  const resolvedPath = path.resolve(skillPath)

  // Validate file exists
  if (!fs.existsSync(resolvedPath)) {
    console.error(colorize(`✗ File not found: ${resolvedPath}`, Colors.red))
    return
  }

  const skillName = path.basename(path.dirname(resolvedPath))
  const metadata = getSkillMetadata(resolvedPath)

  if (!metadata) {
    console.error(colorize(`✗ Failed to load skill metadata`, Colors.red))
    return
  }

  // Initialize stats
  const stats: WatchStats = {
    reloads: 0,
    successful: 0,
    failed: 0,
    startTime: new Date(),
  }

  // Display header
  console.clear()
  console.log(colorize(`\n🔍 Watching skill: ${skillName}\n`, Colors.cyan))
  console.log(`   ${colorize('Path:', Colors.bright)} ${resolvedPath}`)
  console.log(`   ${colorize('Version:', Colors.bright)} ${metadata.version}`)
  console.log(`   ${colorize('Lifecycle hooks:', Colors.bright)} ${['init', 'validate', 'execute', 'cleanup', 'onError'].filter((h) => metadata[`has${h[0].toUpperCase()}${h.slice(1)}`]).join(', ') || 'execute only'}`)
  console.log()
  console.log(colorize('Watching for changes... (press Ctrl+C to stop)\n', Colors.dim))

  // Setup watcher
  const watcher = getSkillWatcher({
    onReload: async (reloadPath) => {
      stats.reloads++

      log(`📝 File changed detected`, Colors.yellow)
      log(`⏳ Reloading...`, Colors.yellow)

      const reloader = getSkillReloader()
      const result = await reloader.reload(reloadPath)

      if (result.success) {
        stats.successful++
        log(`✓ Reload successful (${result.latencyMs}ms)`, Colors.green)
      } else {
        stats.failed++
        log(`✗ Reload failed: ${result.error}`, Colors.red)
      }

      displayStats(stats)
    },
  })

  try {
    // Start watching
    watcher.watch(resolvedPath)

    // Setup keyboard input for commands
    setupKeyboardHandling(skillPath, watcher, stats)

    // Keep process alive
    await new Promise(() => {
      // Never resolves, keeps process running
    })
  } catch (err) {
    console.error(colorize(`✗ Error: ${err instanceof Error ? err.message : String(err)}`, Colors.red))
  }
}

/**
 * Display current stats
 */
function displayStats(stats: WatchStats): void {
  const elapsed = Math.floor((Date.now() - stats.startTime.getTime()) / 1000)
  const successRate =
    stats.reloads > 0 ? `${((stats.successful / stats.reloads) * 100).toFixed(0)}%` : 'N/A'

  console.log()
  console.log(colorize(`   📊 Stats:`, Colors.bright))
  console.log(
    `      ${colorize('Reloads:', Colors.dim)} ${stats.reloads} ${colorize('|', Colors.dim)} ${colorize('Success:', Colors.green)} ${stats.successful} ${colorize('|', Colors.dim)} ${colorize('Failed:', Colors.red)} ${stats.failed} ${colorize('|', Colors.dim)} ${colorize('Success rate:', Colors.bright)} ${successRate}`
  )
  console.log(`      ${colorize('Elapsed:', Colors.dim)} ${elapsed}s`)
  console.log()
  console.log(colorize(`   ⌨️  Commands: [r]eload | [s]tats | [h]elp | [q]uit`, Colors.dim))
  console.log()
}

/**
 * Setup keyboard input handling
 */
function setupKeyboardHandling(skillPath: string, watcher: SkillWatcher, stats: WatchStats): void {
  // Enable raw mode for keyboard input
  if (process.stdin.isTTY) {
    process.stdin.setRawMode(true)
    process.stdin.resume()
    process.stdin.setEncoding('utf8')

    process.stdin.on('data', async (char) => {
      const lower = char.toLowerCase()

      switch (lower) {
        case 'r':
          // Manual reload
          log(`⏳ Manual reload...`, Colors.yellow)
          const reloader = getSkillReloader()
          const result = await reloader.reload(skillPath)

          if (result.success) {
            stats.successful++
            log(`✓ Reload successful (${result.latencyMs}ms)`, Colors.green)
          } else {
            stats.failed++
            log(`✗ Reload failed: ${result.error}`, Colors.red)
          }
          stats.reloads++
          displayStats(stats)
          break

        case 's':
          // Show stats
          displayStats(stats)
          break

        case 'h':
          // Help
          console.log(colorize(`\n📖 Help`, Colors.cyan))
          console.log(`   r - Manual reload the skill`)
          console.log(`   s - Show detailed stats`)
          console.log(`   h - Show this help`)
          console.log(`   q - Quit watching\n`)
          break

        case 'q':
        case 'c':
          // Quit
          console.log()
          log(`👋 Stopped watching`, Colors.cyan)
          process.exit(0)
          break
      }
    })
  }
}

/**
 * Interactive skill watcher (future: integrate with WebSocket)
 */
export async function watchSkillWithWebSocket(skillPath: string, serverUrl: string = 'http://localhost:3001'): Promise<void> {
  const resolvedPath = path.resolve(skillPath)
  const skillName = path.basename(path.dirname(resolvedPath))

  if (!fs.existsSync(resolvedPath)) {
    console.error(colorize(`✗ File not found: ${resolvedPath}`, Colors.red))
    return
  }

  console.clear()
  console.log(colorize(`\n🔍 Watching skill: ${skillName} (WebSocket enabled)\n`, Colors.cyan))
  console.log(`   ${colorize('Path:', Colors.bright)} ${resolvedPath}`)
  console.log(`   ${colorize('Server:', Colors.bright)} ${serverUrl}`)
  console.log()

  const stats: WatchStats = {
    reloads: 0,
    successful: 0,
    failed: 0,
    startTime: new Date(),
  }

  // Setup local watcher
  const watcher = getSkillWatcher({
    onReload: async () => {
      stats.reloads++
      log(`📝 File changed, reloading...`, Colors.yellow)
    },
  })

  try {
    watcher.watch(resolvedPath)

    // TODO: Connect to WebSocket at serverUrl/ws/skills
    // Listen for reload events and update stats

    log(`✓ Watching enabled (Ctrl+C to stop)`, Colors.green)

    setupKeyboardHandling(resolvedPath, watcher, stats)

    await new Promise(() => {
      // Never resolves
    })
  } catch (err) {
    console.error(colorize(`✗ Error: ${err instanceof Error ? err.message : String(err)}`, Colors.red))
  }
}
