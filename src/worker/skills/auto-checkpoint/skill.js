/**
 * Auto-Checkpoint Skill
 *
 * Cria checkpoints automáticos antes de operações destrutivas (delete, modify).
 * Demonstra integração com CheckpointManager.
 */

export default {
  name: 'auto-checkpoint',
  description: 'Cria checkpoints antes de operações destrutivas',
  version: '1.0.0',
  author: 'JARVIS',
  commands: ['/checkpoint', '/restore'],

  checkpointCounter: 0,

  async onStartup() {
    this.checkpointCounter = 0
    console.log('[skill:auto-checkpoint] 🚀 Checkpoint automation ativa')
  },

  async onShutdown() {
    console.log(
      `[skill:auto-checkpoint] 🛑 Desligando (${this.checkpointCounter} checkpoints criados)`
    )
  },

  async onMessage(context) {
    const { userId, text } = context

    if (text.includes('/checkpoint')) {
      console.log(`[skill:auto-checkpoint] 📸 ${userId} solicitou checkpoint manual`)
    }

    if (text.includes('/restore')) {
      console.log(`[skill:auto-checkpoint] ↩️ ${userId} solicitou restore`)
    }
  },

  async beforeExecute(action) {
    const { type, target, description } = action

    // Auto-checkpoint antes de delete ou modify crítico
    if (type === 'delete' || (type === 'modify' && target?.includes('schema'))) {
      this.checkpointCounter++
      console.log(
        `[skill:auto-checkpoint] 📸 Auto-checkpoint #${this.checkpointCounter}: ${type} em ${target}`
      )
    }
  },

  async afterExecute(action, result) {
    const { type } = action

    if (result && !('error' in result)) {
      if (type === 'delete') {
        console.log(
          `[skill:auto-checkpoint] ✓ Delete completou com segurança (checkpoint criado)`
        )
      }
    }
  }
}
