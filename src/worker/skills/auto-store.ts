/**
 * auto-store.ts — Skill que cria lojas automaticamente a partir de fotos de cardápio
 *
 * Modo de uso:
 * 1. Usuário envia foto de cardápio
 * 2. Worker extrai informações com Vision
 * 3. Cria loja automaticamente no SAAS-WEB
 * 4. Retorna link pronto pra usar
 *
 * Exemplo de invocação:
 * "Crie uma loja a partir dessa foto de cardápio"
 * <attach image>
 */

import type { JarvisWorker } from '../worker-core'
import type { MessageDispatcher } from '../dispatcher'
import { MenuVisionService } from '../services/menu-vision-service'
import { AutoStoreCreator } from '../services/auto-store-creator'
import * as fs from 'node:fs'
import * as path from 'node:path'

export interface AutoStoreSkillConfig {
  saasWebUrl?: string
  authToken?: string
  destinationEmail?: string
}

const DEFAULT_CONFIG: AutoStoreSkillConfig = {
  saasWebUrl: process.env.SAAS_WEB_URL || 'http://localhost:3001',
  authToken: process.env.SAAS_WEB_TOKEN,
  destinationEmail: process.env.AUTO_STORE_EMAIL || 'loja@killsis.com',
}

export const autoStoreSkill = {
  name: 'auto-store',
  version: '1.0.0',
  description: 'Cria lojas automaticamente a partir de fotos de cardápio',
  author: 'killsis',

  /**
   * Inicialização da skill
   */
  async onStartup() {
    console.log('[auto-store] ✓ Skill de auto-criação de loja inicializada')

    // Testar conexão com SAAS-WEB
    const creator = new AutoStoreCreator(DEFAULT_CONFIG.saasWebUrl, DEFAULT_CONFIG.authToken)
    const connected = await creator.testConnection()

    if (connected) {
      console.log(`[auto-store] ✓ Conectado ao SAAS-WEB: ${DEFAULT_CONFIG.saasWebUrl}`)
    } else {
      console.warn(`[auto-store] ⚠️ Não conseguiu conectar ao SAAS-WEB: ${DEFAULT_CONFIG.saasWebUrl}`)
    }
  },

  /**
   * Processa requisição de criação de loja
   */
  async process(params: {
    imagePath: string
    email?: string
    name?: string
    workerInstance?: any // JarvisWorker
  }) {
    console.log('[auto-store] Processando criação de loja...')

    try {
      // Validar arquivo
      if (!params.imagePath || !fs.existsSync(params.imagePath)) {
        return {
          success: false,
          error: 'Arquivo de imagem não encontrado',
          code: 'FILE_NOT_FOUND',
        }
      }

      // Extrair menu
      console.log('[auto-store] 📸 Extraindo menu da imagem...')
      const visionService = new MenuVisionService()
      const menu = await visionService.extractMenuFromImage(params.imagePath)

      // Analisar qualidade
      const quality = await visionService.analyzeMenuQuality(menu)
      console.log('[auto-store] 📊 Análise de qualidade:', {
        score: quality.score,
        suggestions: quality.suggestions,
      })

      // Criar loja
      console.log('[auto-store] 🏪 Criando loja no SAAS-WEB...')
      const creator = new AutoStoreCreator(DEFAULT_CONFIG.saasWebUrl, DEFAULT_CONFIG.authToken)

      const email = params.email || DEFAULT_CONFIG.destinationEmail
      const response = await creator.createStore(menu, email)

      if (!response.success) {
        return {
          success: false,
          error: response.message,
          code: 'CREATE_STORE_FAILED',
        }
      }

      // Log de sucesso
      console.log('[auto-store] ✅ Loja criada com sucesso:', {
        tenantId: response.tenantId,
        slug: response.slug,
        url: response.url,
      })

      return {
        success: true,
        data: {
          tenantId: response.tenantId,
          slug: response.slug,
          name: menu.restaurantName,
          url: response.url,
          productCount: menu.categories.reduce((sum, cat) => sum + cat.products.length, 0),
          categoryCount: menu.categories.length,
          qualityScore: quality.score,
          suggestions: quality.suggestions,
        },
        message: response.message,
      }
    } catch (err) {
      const errorMsg = (err as Error).message
      console.error('[auto-store] ❌ Erro:', errorMsg)

      return {
        success: false,
        error: errorMsg,
        code: 'PROCESSING_ERROR',
      }
    }
  },

  /**
   * Hook para processamento de mensagens (integração com dispatcher)
   */
  async onMessage(event: {
    userId: string
    message: string
    attachments?: Array<{ type: string; path: string }>
  }) {
    // Detectar se é um comando de criação de loja
    const isAutoStoreRequest =
      event.message.toLowerCase().includes('criar loja') ||
      event.message.toLowerCase().includes('cardápio') ||
      event.message.toLowerCase().includes('auto-store')

    if (!isAutoStoreRequest || !event.attachments || event.attachments.length === 0) {
      return null // Não é pra essa skill
    }

    const imageAttachment = event.attachments.find((a) => a.type.startsWith('image/'))
    if (!imageAttachment) {
      return {
        handled: true,
        response: '❌ Por favor, envie uma foto do cardápio.',
      }
    }

    // Processar
    const result = await this.process({
      imagePath: imageAttachment.path,
      email: `${event.userId}@killsis.com`,
    })

    if (!result.success) {
      return {
        handled: true,
        response: `❌ Erro ao criar loja: ${result.error}`,
      }
    }

    const data = (result as any).data
    const storeLink = `\n🔗 Acesse sua loja: ${data.url}`
    const summary = `
✅ Loja criada com sucesso!

📝 Nome: ${data.name}
🛍️ Produtos: ${data.productCount}
📂 Categorias: ${data.categoryCount}
⭐ Qualidade: ${data.qualityScore}/100

${storeLink}

💡 Dicas:
${data.suggestions.map((s: string) => `• ${s}`).join('\n')}
    `.trim()

    return {
      handled: true,
      response: summary,
    }
  },

  /**
   * Configuração de rota HTTP (se o dispatcher expuser)
   */
  getHttpHandlers() {
    return {
      'POST /api/skills/auto-store': async (req: any) => {
        const { imagePath, email } = req.body

        if (!imagePath) {
          return {
            statusCode: 400,
            body: { error: 'imagePath é obrigatório' },
          }
        }

        const result = await this.process({ imagePath, email })
        return {
          statusCode: result.success ? 200 : 400,
          body: result,
        }
      },
    }
  },
}
