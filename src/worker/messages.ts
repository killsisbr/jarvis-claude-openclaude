export interface MessageTemplate {
  key: string;
  text: string;
  vars?: string[];
}

export class MessageTemplates {
  private static templates: Record<string, string> = {
    WELCOME: `👋 Bem-vindo ao JARVIS!

Sou seu assistente de desenvolvimento 24/7. Posso ajudar com:
- 🆕 CREATE — criar novos arquivos/componentes
- 🔧 FIX — corrigir bugs
- 🚀 DEPLOY — publicar para produção
- 📚 EXPLAIN — explicar conceitos
- 🐛 DEBUG — depurar problemas
- 📊 STATUS — verificar status
- 🏗️ ARCHITECT — design de arquitetura
- 👀 REVIEW — analisar código
- 🆘 SUPPORT — suporte geral
- ✔️ CLOSE — encerrar sessão

Envie sua dúvida ou tarefa!`,

    HELP: `📖 Comandos disponíveis:

/help — este menu
/status — status da sessão
/close — encerrar sesão
/project <nome> — definir projeto atual

Ou simplesmente descreva o que precisa!`,

    TASK_START: `⏱️ Iniciando tarefa...
Intent: {{intent}}
Projeto: {{project}}

Processando...`,

    TASK_COMPLETE: `✅ Tarefa concluída!
Tokens: {{tokens}}
Custo: ${{cost}}
Tempo total: {{duration}}s

Precisa de mais algo?`,

    STATUS_REPORT: `📊 Status da Sessão:
Mensagens: {{messageCount}}
Intent atual: {{currentIntent}}
Projeto: {{currentProject}}
Tokens totais: {{totalTokens}}
Custo: ${{totalCost}}
Tempo online: {{duration}}s`,

    ERROR_GENERIC: `❌ Erro ao processar sua mensagem.
Erro: {{error}}

Tente novamente ou envie /help`,

    ERROR_TIMEOUT: `⏱️ Tempo limite excedido.
A solicitação levou mais de 30 segundos.

Tente com uma mensagem mais curta.`,

    ERROR_INVALID_STATE: `🚫 Ação não permitida neste momento.
Estado: {{state}}

Tipo /help para ver as opções.`,

    ADMIN_ASSIGNED: `🔑 Você foi designado como administrador.
Todos os comandos de admin estão disponíveis.`,

    SESSION_CLOSED: `🔚 Sessão encerrada.
Duração: {{duration}}s
Mensagens: {{messageCount}}
Custo total: ${{totalCost}}

Tipo qualquer coisa para iniciar nova sessão!`,

    RECONNECTING: `🔄 Reconectando...
Tentativa {{attempt}} de {{maxAttempts}}
Próxima tentativa em {{delay}}ms`,

    CONNECTION_LOST: `📡 Conexão perdida.
Tentando reconectar automaticamente...

Seus dados estão salvos.`,
  };

  static get(key: string, vars?: Record<string, any>): string {
    let template = this.templates[key];
    if (!template) {
      console.warn(`[MessageTemplates] Template not found: ${key}`);
      return `[Template não encontrado: ${key}]`;
    }

    if (vars) {
      for (const [varName, value] of Object.entries(vars)) {
        const placeholder = `{{${varName}}}`;
        template = template.replace(
          new RegExp(placeholder, "g"),
          String(value)
        );
      }
    }

    return template;
  }

  static list(): string[] {
    return Object.keys(this.templates);
  }

  static add(key: string, template: string): void {
    this.templates[key] = template;
  }

  static update(key: string, template: string): void {
    if (!this.templates[key]) {
      console.warn(`[MessageTemplates] Template not found: ${key}`);
    }
    this.templates[key] = template;
  }
}
