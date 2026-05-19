/**
 * CLI command: jarvis skill create <name>
 *
 * Scaffolds a new skill with template, validation, and lifecycle hooks.
 */

import fs from 'fs'
import path from 'path'
import { homedir } from 'os'

const SKILLS_DIR = path.join(homedir(), '.jarvis', 'skills')

interface SkillTemplate {
  name: string
  version: string
  description: string
  commands: string[]
}

/**
 * Generate skill template code
 */
function generateSkillTemplate(name: string): string {
  return `/**
 * Skill: ${name}
 *
 * Generated at: ${new Date().toISOString()}
 * Update this file and the skill will hot-reload automatically.
 */

module.exports = {
  // Metadata
  name: '${name}',
  version: '1.0.0',
  description: 'Custom skill for ${name}',
  commands: ['${name}'],

  // Lifecycle: called when skill loads
  async init(context) {
    console.log('[${name}] Initialized');
    // Setup: initialize connections, load data, etc
  },

  // Lifecycle: validate input before execution
  async validate(input, context) {
    if (!input || typeof input !== 'string') {
      return { valid: false, error: 'Input must be a non-empty string' };
    }
    return { valid: true };
  },

  // Main execution
  async execute(input, context) {
    const { logger, db, eventBus } = context;

    logger?.log(\`[${name}] Executing with input: \${input}\`);

    // Your skill logic here
    const result = {
      success: true,
      message: \`${name} executed successfully\`,
      input,
      timestamp: new Date().toISOString(),
    };

    // Emit event for other systems
    eventBus?.emit('skill_executed', {
      skill: '${name}',
      result,
    });

    return result;
  },

  // Lifecycle: cleanup on unload
  async cleanup(context) {
    console.log('[${name}] Cleaning up');
    // Cleanup: close connections, save state, etc
  },

  // Optional: custom error handler
  async onError(error, context) {
    console.error(\`[${name}] Error: \${error.message}\`);
    return {
      success: false,
      error: error.message,
      skill: '${name}',
    };
  },
};
`
}

/**
 * Create a new skill
 */
export async function createSkill(name: string): Promise<{ success: boolean; path?: string; error?: string }> {
  // Validate skill name
  if (!name || !/^[a-z0-9-]+$/.test(name)) {
    return {
      success: false,
      error: 'Skill name must be lowercase alphanumeric with hyphens only',
    }
  }

  // Create directory structure
  const skillDir = path.join(SKILLS_DIR, name)
  const skillFile = path.join(skillDir, 'skill.js')

  try {
    // Check if skill already exists
    if (fs.existsSync(skillDir)) {
      return {
        success: false,
        error: `Skill "${name}" already exists at ${skillDir}`,
      }
    }

    // Create directory
    fs.mkdirSync(skillDir, { recursive: true })

    // Generate template
    const template = generateSkillTemplate(name)

    // Write skill file
    fs.writeFileSync(skillFile, template, 'utf-8')

    // Create README
    const readme = `# Skill: ${name}

Generated skill template for ${name}.

## Files

- \`skill.js\` - Main skill implementation

## Development

1. Edit \`skill.js\` with your skill logic
2. Use \`jarvis skill test ./skill.js\` to test locally
3. Use \`jarvis skill watch ./skill.js\` for hot-reload during development

## Available Context

When your skill executes, you have access to:

\`\`\`javascript
context = {
  logger: Logger,           // Log messages
  db: Database,             // SQLite connection
  eventBus: EventBus,       // Pub/sub messaging
  worker: JarvisWorker,     // Main worker instance
  userId: string,           // Current user ID
  timestamp: number,        // Execution timestamp
}
\`\`\`

## Lifecycle Hooks

1. \`init(context)\` - Called when skill loads
2. \`validate(input, context)\` - Validate input before execution
3. \`execute(input, context)\` - Main skill logic
4. \`cleanup(context)\` - Called when skill unloads
5. \`onError(error, context)\` - Error handling

## Example

\`\`\`javascript
async execute(input, context) {
  const { logger } = context;
  logger?.log(\`Processing: \${input}\`);

  // Your logic here
  return { success: true, result: 'done' };
}
\`\`\`
`

    fs.writeFileSync(path.join(skillDir, 'README.md'), readme, 'utf-8')

    // Create package.json for metadata
    const pkg = {
      name: name,
      version: '1.0.0',
      type: 'skill',
      main: 'skill.js',
    }

    fs.writeFileSync(path.join(skillDir, 'package.json'), JSON.stringify(pkg, null, 2), 'utf-8')

    console.log(`[skill-create] ✓ Skill "${name}" created`)
    console.log(`[skill-create]   Path: ${skillDir}`)
    console.log(`[skill-create]   Files: skill.js, README.md, package.json`)

    return {
      success: true,
      path: skillDir,
    }
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : String(err),
    }
  }
}

/**
 * List all skills
 */
export function listSkills(): Array<SkillTemplate & { path: string }> {
  if (!fs.existsSync(SKILLS_DIR)) {
    return []
  }

  const dirs = fs.readdirSync(SKILLS_DIR, { withFileTypes: true }).filter((d) => d.isDirectory())

  return dirs
    .map((dir) => {
      const pkgPath = path.join(SKILLS_DIR, dir.name, 'package.json')

      if (!fs.existsSync(pkgPath)) {
        return null
      }

      try {
        const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'))
        return {
          ...pkg,
          path: path.join(SKILLS_DIR, dir.name),
        }
      } catch {
        return null
      }
    })
    .filter((s) => s !== null) as Array<SkillTemplate & { path: string }>
}

/**
 * Delete a skill
 */
export async function deleteSkill(name: string): Promise<{ success: boolean; error?: string }> {
  const skillDir = path.join(SKILLS_DIR, name)

  if (!fs.existsSync(skillDir)) {
    return {
      success: false,
      error: `Skill "${name}" not found`,
    }
  }

  try {
    fs.rmSync(skillDir, { recursive: true })
    console.log(`[skill-create] ✓ Skill "${name}" deleted`)
    return { success: true }
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : String(err),
    }
  }
}
