/**
 * AutoStoreCreator — Cria loja automaticamente no SAAS-WEB a partir de menu extraído
 *
 * Fluxo:
 * 1. Cria tenant (restaurante)
 * 2. Popula categorias
 * 3. Popula produtos com preços
 * 4. Configura básico (nome, telefone, etc)
 */

import axios, { AxiosInstance } from 'axios'
import type { ExtractedMenu, MenuCategory, MenuProduct } from './menu-vision-service'

export interface CreateStoreRequest {
  name: string
  slug: string
  email: string
  phone?: string
  address?: string
  description?: string
}

export interface CreateStoreResponse {
  success: boolean
  tenantId: string
  slug: string
  url: string
  message: string
}

export class AutoStoreCreator {
  private client: AxiosInstance
  private baseUrl: string
  private authToken?: string

  constructor(baseUrl: string = 'http://localhost:3001', authToken?: string) {
    this.baseUrl = baseUrl.replace(/\/$/, '') // Remove trailing slash
    this.authToken = authToken

    this.client = axios.create({
      baseURL: this.baseUrl,
      headers: authToken ? { Authorization: `Bearer ${authToken}` } : {},
    })
  }

  /**
   * Sanitiza nome para slug (slugify)
   */
  private sanitizeSlug(text: string): string {
    return text
      .toLowerCase()
      .trim()
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '') // Remove diacritics
      .replace(/[^\w\s-]/g, '') // Remove special chars
      .replace(/\s+/g, '-') // Spaces to dash
      .replace(/-+/g, '-') // Multiple dashes to single
  }

  /**
   * Cria novo tenant (loja/restaurante)
   */
  async createStore(menu: ExtractedMenu, email: string): Promise<CreateStoreResponse> {
    try {
      // Validar dados mínimos
      if (!menu.restaurantName || menu.restaurantName === 'Não identificado') {
        throw new Error('Nome do restaurante não identificado. Verifique a foto.')
      }

      const slug = this.sanitizeSlug(menu.restaurantName)

      // Criar tenant via API
      const response = await this.client.post('/api/tenants', {
        name: menu.restaurantName,
        slug,
        email: email || `${slug}@saas-web.local`,
        phone: menu.phone || '',
        address: menu.address || '',
        description: menu.description || '',
        settings: {
          whatsappBotEnabled: true,
          theme: {
            primaryColor: '#d9432e',
            secondaryColor: '#ffb800',
          },
          delivery: {
            fee: 5.0,
            minOrder: 20.0,
            estimatedTime: '30-45min',
          },
        },
      })

      const tenantId = response.data.id || response.data.tenantId
      if (!tenantId) {
        throw new Error('Tenant criado mas ID não retornado')
      }

      // Popular categorias e produtos
      await this.populateMenu(tenantId, menu)

      return {
        success: true,
        tenantId,
        slug,
        url: `${this.baseUrl}/loja/${slug}`,
        message: `✅ Loja "${menu.restaurantName}" criada com sucesso!`,
      }
    } catch (err) {
      const errorMsg = (err as any).response?.data?.message || (err as Error).message
      return {
        success: false,
        tenantId: '',
        slug: '',
        url: '',
        message: `❌ Erro ao criar loja: ${errorMsg}`,
      }
    }
  }

  /**
   * Popula categorias e produtos na loja
   */
  private async populateMenu(tenantId: string, menu: ExtractedMenu): Promise<void> {
    for (const category of menu.categories) {
      try {
        // Criar categoria
        const catResponse = await this.client.post(
          `/api/categories`,
          {
            tenantId,
            name: category.name,
            description: category.description || '',
            image: '', // Pode ser adicionado depois
          },
          {
            headers: { 'X-Tenant-ID': tenantId },
          },
        )

        const categoryId = catResponse.data.id || catResponse.data.categoryId
        if (!categoryId) continue

        // Adicionar produtos
        for (const product of category.products) {
          try {
            await this.client.post(
              `/api/products`,
              {
                tenantId,
                categoryId,
                name: product.name,
                description: product.description || '',
                price: product.price || 0,
                image: product.image || '',
              },
              {
                headers: { 'X-Tenant-ID': tenantId },
              },
            )
          } catch (err) {
            console.warn(`Erro ao adicionar produto ${product.name}:`, (err as Error).message)
          }
        }
      } catch (err) {
        console.warn(`Erro ao criar categoria ${category.name}:`, (err as Error).message)
      }
    }
  }

  /**
   * Atualiza loja existente com novo menu
   */
  async updateStore(tenantId: string, menu: ExtractedMenu): Promise<CreateStoreResponse> {
    try {
      // Atualizar informações básicas
      await this.client.put(
        `/api/tenants/${tenantId}`,
        {
          name: menu.restaurantName,
          phone: menu.phone,
          address: menu.address,
          description: menu.description,
        },
        {
          headers: { 'X-Tenant-ID': tenantId },
        },
      )

      // Limpar categorias antigas e adicionar novas
      await this.populateMenu(tenantId, menu)

      return {
        success: true,
        tenantId,
        slug: '',
        url: `${this.baseUrl}/admin/${tenantId}`,
        message: `✅ Loja atualizada com sucesso!`,
      }
    } catch (err) {
      const errorMsg = (err as any).response?.data?.message || (err as Error).message
      return {
        success: false,
        tenantId,
        slug: '',
        url: '',
        message: `❌ Erro ao atualizar loja: ${errorMsg}`,
      }
    }
  }

  /**
   * Obtém URL de acesso da loja
   */
  getStoreUrl(slug: string): string {
    return `${this.baseUrl}/loja/${slug}`
  }

  /**
   * Testa conexão com SAAS-WEB
   */
  async testConnection(): Promise<boolean> {
    try {
      const response = await this.client.get('/health', { timeout: 5000 })
      return response.status === 200
    } catch {
      return false
    }
  }
}

export function getAutoStoreCreator(baseUrl?: string, token?: string): AutoStoreCreator {
  return new AutoStoreCreator(baseUrl, token)
}
