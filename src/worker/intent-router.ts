export type IntentCategory =
  | "CREATE"
  | "FIX"
  | "DEPLOY"
  | "EXPLAIN"
  | "DEBUG"
  | "STATUS"
  | "ARCHITECT"
  | "REVIEW"
  | "SUPPORT"
  | "CLOSE"
  | "UNKNOWN";

export interface DetectedIntent {
  category: IntentCategory;
  confidence: number; // 0-1
  entities: {
    filenames?: string[];
    commands?: string[];
    paths?: string[];
    errors?: string[];
    projectName?: string;
  };
  suggestedProject?: string;
}

export class IntentRouter {
  private patterns = new Map<IntentCategory, RegExp[]>([
    [
      "CREATE",
      [
        /(?:criar|novo|adicionar|fazer|implementar|escrever)\s+(?:um\s+)?(?:arquivo|componente|function|classe|módulo|feature|função)/i,
        /(?:crie|cria|crio)\s+(?:um\s+)?(?:novo|fresh)/i,
        /^(novo|create|new)\s+/i,
      ],
    ],
    [
      "FIX",
      [
        /(?:corrigir|consertar|arrumar|fix|resolver|problema|erro|bug)\s+/i,
        /(?:está quebrado|não funciona|erro ao|falha em|problema com)/i,
        /^(fix|corrigir)\s+/i,
      ],
    ],
    [
      "DEPLOY",
      [
        /(?:deploy|publicar|subir|enviar|release|build|compilar)\s+(?:para\s+)?(?:produção|prod|staging|homolog)/i,
        /(?:go live|launch|put in production)/i,
        /^(deploy|publicar|release)\s+/i,
      ],
    ],
    [
      "EXPLAIN",
      [
        /(?:explique|explica|o que é|como funciona|como usar|me explica|entender)\s+/i,
        /(?:como faz|como fazer|qual é)/i,
        /^(explain|explique|help)\s+/i,
      ],
    ],
    [
      "DEBUG",
      [
        /(?:debug|debugar|depuração|passo a passo|breakpoint|trace|console\.log)/i,
        /(?:por que não funciona|por que falha|qual é o problema)/i,
      ],
    ],
    [
      "STATUS",
      [
        /(?:status|como está|qual é o status|tá rodando|tá online|health|ping)/i,
        /^(status|health|ping)\s*/i,
      ],
    ],
    [
      "ARCHITECT",
      [
        /(?:arquitetura|design|padrão|estrutura|refactor|refactorize)/i,
        /(?:como organizar|como estruturar|melhor jeito)/i,
      ],
    ],
    [
      "REVIEW",
      [
        /(?:review|revise|analise|verifique|check|pull request|PR|código)/i,
        /(?:está bom|tá certo|é assim)/i,
      ],
    ],
    [
      "SUPPORT",
      [
        /(?:ajuda|help|socorro|dúvida|não entendo|me ajuda|saiba mais)/i,
        /^(help|ajuda|support)\s*/i,
      ],
    ],
    [
      "CLOSE",
      [
        /(?:fechar|encerrar|pronto|done|concluído|finalizado|terminar)/i,
        /^(close|fechar|done)\s*/i,
      ],
    ],
  ]);

  async detectIntent(text: string): Promise<DetectedIntent> {
    if (!text || text.trim().length === 0) {
      return {
        category: "UNKNOWN",
        confidence: 0,
        entities: {},
      };
    }

    // Fast path: regex matching
    const matches = new Map<IntentCategory, number>();
    for (const [category, regexPatterns] of this.patterns) {
      for (const regex of regexPatterns) {
        if (regex.test(text)) {
          matches.set(category, (matches.get(category) || 0) + 1);
        }
      }
    }

    if (matches.size > 0) {
      const topMatch = Array.from(matches.entries()).reduce((a, b) =>
        a[1] > b[1] ? a : b
      );
      const category = topMatch[0];
      const confidence = Math.min(topMatch[1] / 3, 1); // Normalize to 0-1

      return {
        category,
        confidence,
        entities: this.extractEntities(text),
        suggestedProject: this.extractProjectName(text),
      };
    }

    // Fallback: return UNKNOWN with low confidence
    return {
      category: "UNKNOWN",
      confidence: 0.1,
      entities: this.extractEntities(text),
      suggestedProject: this.extractProjectName(text),
    };
  }

  private extractEntities(text: string): DetectedIntent["entities"] {
    const entities: DetectedIntent["entities"] = {};

    // Extract filenames
    const filenameMatches = text.match(
      /(?:arquivo|file|módulo)\s+(?:named\s+)?["']?([a-zA-Z0-9._-]+)["']?/gi
    );
    if (filenameMatches) {
      entities.filenames = filenameMatches.map((m) =>
        m.split(/\s+/).pop() || ""
      );
    }

    // Extract paths
    const pathMatches = text.match(/(?:\/[a-zA-Z0-9._-]+)+/g);
    if (pathMatches) {
      entities.paths = pathMatches;
    }

    // Extract error messages (lines starting with Error: or Exception)
    const errorMatches = text.match(
      /(?:Error|Exception|TypeError|ReferenceError)[^.\n]*/gi
    );
    if (errorMatches) {
      entities.errors = errorMatches;
    }

    // Extract commands (git, npm, bun, docker, etc.)
    const cmdMatches = text.match(
      /(?:git|npm|bun|docker|python|node|yarn)\s+[a-z]+/gi
    );
    if (cmdMatches) {
      entities.commands = cmdMatches;
    }

    return entities;
  }

  private extractProjectName(text: string): string | undefined {
    // Look for project names after words like "project:", "repo:", "in"
    const projectMatch = text.match(
      /(?:project|repo|in|repository)[:=\s]+([a-zA-Z0-9_-]+)/i
    );
    return projectMatch?.[1];
  }
}
