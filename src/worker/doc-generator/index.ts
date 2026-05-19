/**
 * Documentation generator orchestrator.
 *
 * Combines schema, learnings, and formatting to generate CLAUDE.md.
 */

import fs from 'fs'
import { join } from 'path'
import { homedir } from 'os'
import {
  extractAPIEndpoints,
  extractDataModels,
  extractIntegrations,
  extractMetrics,
} from './schema-extractor'
import { extractKeyLearnings, getLearningStats } from './learnings-extractor'
import { generateClaudeMd, type DocumentationInput } from './markdown-formatter'

const CLAUDE_MD_PATH = join(homedir(), '.jarvis', 'CLAUDE.md')
const BACKUP_SUFFIX = '.backup'

/**
 * Generate CLAUDE.md documentation.
 * Returns the generated markdown content.
 */
export async function generateDocumentation(): Promise<string> {
  const t0 = Date.now()

  // Extract all data
  const endpoints = extractAPIEndpoints()
  const models = extractDataModels()
  const integrations = extractIntegrations()
  const metrics = extractMetrics()
  const learnings = extractKeyLearnings(3)

  // Compile input
  const input: DocumentationInput = {
    endpoints,
    models,
    integrations,
    metrics,
    learnings,
    generatedAt: new Date(),
  }

  // Generate markdown
  const markdown = generateClaudeMd(input)
  const latencyMs = Date.now() - t0

  console.log(`[doc-gen] Generated CLAUDE.md in ${latencyMs}ms`)
  console.log(`[doc-gen]   - ${endpoints.length} endpoints`)
  console.log(`[doc-gen]   - ${models.length} tables`)
  console.log(`[doc-gen]   - ${integrations.length} integrations`)
  console.log(`[doc-gen]   - ${learnings.size} learning categories`)

  return markdown
}

/**
 * Save documentation to disk.
 */
export async function saveDocumentation(markdown: string): Promise<void> {
  // Create directory if needed
  const dir = join(homedir(), '.jarvis')
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true })
  }

  // Backup existing
  if (fs.existsSync(CLAUDE_MD_PATH)) {
    fs.copyFileSync(CLAUDE_MD_PATH, `${CLAUDE_MD_PATH}${BACKUP_SUFFIX}`)
  }

  // Write new
  fs.writeFileSync(CLAUDE_MD_PATH, markdown, 'utf-8')
  console.log(`[doc-gen] Saved to ${CLAUDE_MD_PATH}`)
}

/**
 * Load documentation from disk.
 */
export async function loadDocumentation(): Promise<string | null> {
  if (!fs.existsSync(CLAUDE_MD_PATH)) {
    return null
  }

  return fs.readFileSync(CLAUDE_MD_PATH, 'utf-8')
}

/**
 * Generate and save documentation.
 * This is the main entry point for the doc generation pipeline.
 */
export async function regenerateDocumentation(): Promise<{ success: boolean; latencyMs: number; size: number }> {
  const t0 = Date.now()

  try {
    const markdown = await generateDocumentation()
    await saveDocumentation(markdown)

    const latencyMs = Date.now() - t0
    return {
      success: true,
      latencyMs,
      size: markdown.length,
    }
  } catch (err) {
    console.error('[doc-gen] Error:', err instanceof Error ? err.message : String(err))
    return {
      success: false,
      latencyMs: Date.now() - t0,
      size: 0,
    }
  }
}

/**
 * Get summary of documentation status.
 */
export function getDocumentationStats() {
  const learningStats = getLearningStats()
  const exists = fs.existsSync(CLAUDE_MD_PATH)

  let size = 0
  let modifiedAt: Date | null = null

  if (exists) {
    const stats = fs.statSync(CLAUDE_MD_PATH)
    size = stats.size
    modifiedAt = stats.mtime
  }

  return {
    exists,
    size,
    modifiedAt,
    learnings: learningStats,
  }
}
