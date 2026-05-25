/**
 * MenuVisionService — Extrai cardápio de fotos usando Claude Vision
 *
 * Processa imagem do cardápio e extrai:
 * - Nome do estabelecimento
 * - Categorias
 * - Produtos com preços
 * - Descrições
 */

import Anthropic from '@anthropic-ai/sdk'
import * as fs from 'node:fs'
import * as path from 'node:path'

export interface MenuCategory {
  name: string
  description?: string
  products: MenuProduct[]
}

export interface MenuProduct {
  name: string
  description?: string
  price: number
  image?: string
  options?: MenuOption[]
}

export interface MenuOption {
  name: string
  choices: string[]
}

export interface ExtractedMenu {
  restaurantName: string
  description?: string
  categories: MenuCategory[]
  phone?: string
  address?: string
  openingHours?: string
}

export class MenuVisionService {
  private client: Anthropic

  constructor(apiKey?: string) {
    this.client = new Anthropic({
      apiKey: apiKey || process.env.ANTHROPIC_API_KEY,
    })
  }

  /**
   * Extrai menu de uma imagem (arquivo ou base64)
   */
  async extractMenuFromImage(imagePath: string): Promise<ExtractedMenu> {
    // Ler arquivo e converter para base64
    let imageData: string
    let mediaType: 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp'

    if (imagePath.startsWith('data:image')) {
      // Já é base64 com prefixo
      const matches = imagePath.match(/^data:image\/([a-z]+);base64,(.+)$/)
      if (!matches) throw new Error('Invalid base64 image format')
      mediaType = `image/${matches[1]}` as any
      imageData = matches[2]
    } else {
      // Arquivo local
      const buffer = fs.readFileSync(imagePath)
      imageData = buffer.toString('base64')

      const ext = path.extname(imagePath).toLowerCase()
      mediaType = ext === '.png' ? 'image/png' : 'image/jpeg'
    }

    // Chamar Claude Vision
    const message = await this.client.messages.create({
      model: 'claude-3-5-sonnet-20241022',
      max_tokens: 2000,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image',
              source: {
                type: 'base64',
                media_type: mediaType,
                data: imageData,
              },
            },
            {
              type: 'text',
              text: `Você é um especialista em análise de cardápios. Analise esta imagem de cardápio e extraia as informações em JSON estruturado.

Retorne um JSON com a seguinte estrutura:
{
  "restaurantName": "Nome do restaurante (se visível)",
  "description": "Descrição breve do tipo de cozinha/estabelecimento",
  "phone": "Telefone (se visível)",
  "address": "Endereço (se visível)",
  "openingHours": "Horário de funcionamento (se visível)",
  "categories": [
    {
      "name": "Nome da categoria (ex: Hambúrgueres)",
      "description": "Descrição da categoria (opcional)",
      "products": [
        {
          "name": "Nome do produto",
          "description": "Descrição completa",
          "price": 25.90,
          "options": [
            {
              "name": "Tamanho",
              "choices": ["P", "M", "G"]
            }
          ]
        }
      ]
    }
  ]
}

IMPORTANTE:
- Extraia TODOS os produtos visíveis
- Mantenha os preços em número decimal (ex: 25.90)
- Se não conseguir ler alguma informação, omita do JSON
- Retorne APENAS o JSON, sem explicações
- Se a imagem não for um cardápio, retorne um JSON vazio com restaurantName: "Não identificado"`,
            },
          ],
        },
      ],
    })

    // Extrair JSON da resposta
    const responseText = message.content
      .filter((block) => block.type === 'text')
      .map((block) => (block.type === 'text' ? block.text : ''))
      .join('')

    // Parse JSON com tratamento de erros
    try {
      const jsonMatch = responseText.match(/\{[\s\S]*\}/)
      if (!jsonMatch) {
        console.error('Nenhum JSON encontrado na resposta:', responseText)
        throw new Error('No JSON found in response')
      }

      const extracted = JSON.parse(jsonMatch[0]) as ExtractedMenu
      return extracted
    } catch (err) {
      console.error('Erro ao fazer parse do JSON:', err)
      console.error('Resposta recebida:', responseText)
      throw new Error(`Failed to parse menu from image: ${(err as Error).message}`)
    }
  }

  /**
   * Analisa menu extraído e sugere otimizações
   */
  async analyzeMenuQuality(menu: ExtractedMenu): Promise<{
    suggestions: string[]
    score: number
    completeness: number
  }> {
    const totalProducts = menu.categories.reduce((sum, cat) => sum + cat.products.length, 0)
    const productsWithPrice = menu.categories.reduce(
      (sum, cat) => sum + cat.products.filter((p) => p.price && p.price > 0).length,
      0,
    )
    const productsWithDesc = menu.categories.reduce(
      (sum, cat) => sum + cat.products.filter((p) => p.description).length,
      0,
    )

    const suggestions: string[] = []
    let score = 100

    if (!menu.restaurantName || menu.restaurantName === 'Não identificado') {
      suggestions.push('❌ Nome do restaurante não identificado. Adicione manualmente.')
      score -= 20
    }

    if (totalProducts === 0) {
      suggestions.push('❌ Nenhum produto encontrado. Verifique a qualidade da imagem.')
      score -= 50
    } else if (totalProducts < 5) {
      suggestions.push('⚠️ Poucos produtos extraídos. Considere adicionar mais manualmente.')
      score -= 10
    }

    const priceCompletion = (productsWithPrice / Math.max(totalProducts, 1)) * 100
    if (priceCompletion < 80) {
      suggestions.push(`⚠️ Apenas ${priceCompletion.toFixed(0)}% dos produtos têm preço.`)
      score -= 15
    }

    const descCompletion = (productsWithDesc / Math.max(totalProducts, 1)) * 100
    if (descCompletion < 50) {
      suggestions.push(`💡 Apenas ${descCompletion.toFixed(0)}% dos produtos têm descrição. Considere melhorar.`)
      score -= 5
    }

    if (!menu.phone) {
      suggestions.push('💡 Adicione telefone para melhorar contato com clientes.')
    }

    if (!menu.address) {
      suggestions.push('💡 Adicione endereço para facilitar localização.')
    }

    if (suggestions.length === 0) {
      suggestions.push('✅ Cardápio bem estruturado!')
    }

    return {
      suggestions,
      score: Math.max(0, Math.min(100, score)),
      completeness: priceCompletion,
    }
  }
}

export function getMenuVisionService(): MenuVisionService {
  return new MenuVisionService()
}
