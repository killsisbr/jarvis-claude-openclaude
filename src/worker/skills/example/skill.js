/**
 * Example Skill — Template for custom skills
 *
 * Skills are loaded from ~/jarvis/skills/*/skill.js on startup.
 * Hooks are called at specific points in the worker lifecycle.
 */

export default {
  // Metadata
  name: 'example-skill',
  description: 'Example skill demonstrating all hooks',
  version: '1.0.0',
  author: 'JARVIS',
  commands: ['/example', '/help-example'],

  // Called when worker starts
  async onStartup() {
    console.log('[example-skill] 🚀 Skill initialized');
  },

  // Called when worker shuts down
  async onShutdown() {
    console.log('[example-skill] 🛑 Skill shutting down');
  },

  // Called after every message is processed
  async onMessage(context) {
    const { userId, text, intent, sessionId } = context;

    if (text.includes('/example')) {
      console.log(
        `[example-skill] User ${userId} triggered example command`
      );
    }

    if (text.toLowerCase().includes('deploy')) {
      console.log('[example-skill] Deploy keyword detected');
      // Could trigger auto-actions here
    }
  },

  // Called before executing an action (create/modify/delete/execute)
  async beforeExecute(action) {
    const { type, target, description } = action;

    console.log(`[example-skill] Before ${type}: ${target}`);

    if (type === 'delete') {
      console.log('[example-skill] ⚠️  Delete action detected — consider checkpoint');
    }
  },

  // Called after executing an action
  async afterExecute(action, result) {
    const { type, target } = action;

    if (result && typeof result === 'object' && 'error' in result) {
      console.log(
        `[example-skill] ❌ Action ${type} failed: ${result.error}`
      );
    } else {
      console.log(`[example-skill] ✓ Action ${type} succeeded`);
    }
  },
};

/**
 * Skill Hook Reference:
 *
 * onStartup()
 *   - Called once when worker starts
 *   - Use for initialization (load config, setup listeners)
 *   - Timing: After SkillRegistry loads, before HTTP server starts
 *
 * onShutdown()
 *   - Called once when worker shuts down
 *   - Use for cleanup (close connections, save state)
 *   - Timing: Before server closes
 *
 * onMessage(context)
 *   - Called after every message is processed
 *   - context: { userId, text, intent, sessionId }
 *   - Use for: monitoring, auto-actions, analytics
 *   - Async safe, all hooks run concurrently
 *
 * beforeExecute(action)
 *   - Called before executing create/modify/delete/execute actions
 *   - action: { type, target?, description? }
 *   - Use for: pre-flight checks, checkpoints, logging
 *
 * afterExecute(action, result)
 *   - Called after action completes
 *   - action: { type, target?, description? }
 *   - result: action result (varies by type)
 *   - Use for: cleanup, error handling, notifications
 *
 * Error Handling:
 *   - Hooks that throw are caught and logged
 *   - Other hooks continue executing
 *   - Worker is NOT affected by skill errors
 *
 * Access to Worker:
 *   - Current implementation: No direct access (future: dependency injection)
 *   - Via context parameter when available
 */
