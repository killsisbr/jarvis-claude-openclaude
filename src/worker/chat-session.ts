import { EventEmitter } from "events";

export type ChatState =
  | "CRIADO"
  | "ANALISANDO"
  | "ATIVO"
  | "AGUARDANDO"
  | "COMPLETO"
  | "FECHADO";

export interface ChatSessionData {
  userId: string;
  state: ChatState;
  startTime: number;
  lastActivityTime: number;
  currentProject?: string;
  currentIntent?: string;
  messageCount: number;
  totalTokens: number;
  totalCost: number;
  metadata: Record<string, any>;
}

export class ChatSession extends EventEmitter {
  private data: ChatSessionData;
  private autoCloseMs = 24 * 60 * 60 * 1000; // 24 hours
  private autoSaveMs = 30 * 1000; // 30 seconds
  private lastSaveTime = 0;

  constructor(userId: string) {
    super();
    this.data = {
      userId,
      state: "CRIADO",
      startTime: Date.now(),
      lastActivityTime: Date.now(),
      messageCount: 0,
      totalTokens: 0,
      totalCost: 0,
      metadata: {},
    };
  }

  get userId(): string {
    return this.data.userId;
  }

  get state(): ChatState {
    return this.data.state;
  }

  get isActive(): boolean {
    return this.data.state !== "FECHADO" && this.data.state !== "COMPLETO";
  }

  async receive(message: string): Promise<void> {
    this.data.lastActivityTime = Date.now();
    this.data.messageCount++;

    if (this.data.state === "CRIADO") {
      await this.transitionTo("ANALISANDO");
    }

    this.emit("message", { text: message, timestamp: Date.now() });
    await this.tryAutoSave();
  }

  async startWork(intent: string, project?: string): Promise<void> {
    this.data.currentIntent = intent;
    if (project) this.data.currentProject = project;
    this.data.lastActivityTime = Date.now();

    await this.transitionTo("ATIVO");
    this.emit("work_started", { intent, project });
    await this.tryAutoSave();
  }

  async updateCost(tokens: number, cost: number): Promise<void> {
    this.data.totalTokens += tokens;
    this.data.totalCost += cost;
    this.data.lastActivityTime = Date.now();
    this.emit("cost_updated", { tokens, cost });
    await this.tryAutoSave();
  }

  async complete(result: string): Promise<void> {
    this.data.lastActivityTime = Date.now();
    await this.transitionTo("COMPLETO");
    this.emit("work_completed", { result });
    await this.tryAutoSave();
  }

  async close(): Promise<void> {
    this.data.lastActivityTime = Date.now();
    await this.transitionTo("FECHADO");
    this.emit("closed", { duration: Date.now() - this.data.startTime });
    await this.tryAutoSave();
  }

  async reopen(): Promise<void> {
    if (this.data.state === "FECHADO") {
      await this.transitionTo("CRIADO");
      this.emit("reopened");
      await this.tryAutoSave();
    }
  }

  checkAutoClose(): boolean {
    const idleTime = Date.now() - this.data.lastActivityTime;
    if (idleTime > this.autoCloseMs && this.isActive) {
      return true;
    }
    return false;
  }

  async autoCloseIfNeeded(): Promise<void> {
    if (this.checkAutoClose()) {
      await this.close();
    }
  }

  private async tryAutoSave(): Promise<void> {
    const now = Date.now();
    if (now - this.lastSaveTime >= this.autoSaveMs) {
      await this.save();
    }
  }

  async save(): Promise<void> {
    this.lastSaveTime = Date.now();
    this.emit("saved", this.data);
  }

  getData(): ChatSessionData {
    return { ...this.data };
  }

  setMetadata(key: string, value: any): void {
    this.data.metadata[key] = value;
  }

  getMetadata(key: string): any {
    return this.data.metadata[key];
  }

  private async transitionTo(newState: ChatState): Promise<void> {
    const validTransitions: Record<ChatState, ChatState[]> = {
      CRIADO: ["ANALISANDO", "FECHADO"],
      ANALISANDO: ["ATIVO", "COMPLETO", "FECHADO"],
      ATIVO: ["AGUARDANDO", "COMPLETO", "FECHADO"],
      AGUARDANDO: ["ATIVO", "COMPLETO", "FECHADO"],
      COMPLETO: ["FECHADO", "ANALISANDO", "ATIVO"],
      FECHADO: ["CRIADO"],
    };

    const allowed = validTransitions[this.data.state] || [];
    if (!allowed.includes(newState)) {
      throw new Error(
        `Invalid state transition: ${this.data.state} → ${newState}`
      );
    }

    const oldState = this.data.state;
    this.data.state = newState;
    this.emit("state_changed", { from: oldState, to: newState });
  }
}
