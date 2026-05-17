/**
 * Cost Monitor Skill
 *
 * Monitora gastos diários e emite alertas quando limites são atingidos.
 * Demonstra todos os hooks do skill system.
 */

export default {
  // Metadata
  name: 'cost-monitor',
  description: 'Monitora custos diários e alertas',
  version: '1.0.0',
  author: 'JARVIS',
  commands: ['/custos', '/gastos', '/orçamento'],

  // Estado interno
  dailyLimit: 100.0,
  alertThresholds: [50, 75, 90, 100],
  lastAlert: null,

  async onStartup() {
    console.log('[skill:cost-monitor] 🚀 Inicializado')
    console.log(`[skill:cost-monitor] Limite diário: $${this.dailyLimit}`)
  },

  async onShutdown() {
    console.log('[skill:cost-monitor] 🛑 Desligando')
  },

  async onMessage(context) {
    const { userId, text, intent } = context

    // Detectar comandos de custo
    if (
      text.toLowerCase().includes('/custos') ||
      text.toLowerCase().includes('/gastos') ||
      text.toLowerCase().includes('/orçamento')
    ) {
      console.log(
        `[skill:cost-monitor] 💰 ${userId} perguntou sobre custos (intent: ${intent})`
      )
    }

    // Auto-alerta se detector keyword "budget"
    if (text.toLowerCase().includes('budget') || text.toLowerCase().includes('orçamento')) {
      console.log('[skill:cost-monitor] 📊 Detectado discussão sobre orçamento')
    }
  },

  async beforeExecute(action) {
    const { type, target, description } = action

    if (type === 'execute') {
      console.log(
        `[skill:cost-monitor] ⚙️ Sobre executar: ${target || description}`
      )
      // Poderia calcular custo estimado aqui
    }

    if (type === 'delete') {
      console.log(`[skill:cost-monitor] ⚠️ DELETE detectado em ${target}`)
    }
  },

  async afterExecute(action, result) {
    const { type, target } = action

    if (result && typeof result === 'object' && 'error' in result) {
      console.log(
        `[skill:cost-monitor] ❌ Ação ${type} falhou: ${result.error}`
      )
    } else if (type === 'execute') {
      // Podia debitaráqui após execução bem-sucedida
      console.log(`[skill:cost-monitor] ✓ Execução bem-sucedida`)
    }
  }
}
