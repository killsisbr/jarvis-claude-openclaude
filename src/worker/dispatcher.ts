import { EventEmitter } from "events";
import { BaileysGateway } from "./gateways/baileys";
import { IntentRouter, IntentCategory } from "./intent-router";
import { ChatSession } from "./chat-session";
import { WhatsAppMessage } from "./gateways/whatsapp";
import { JarvisWorker } from "./worker-core";
import * as sessionDb from "./db/sessions";
import { AutoSave } from "./auto-save";
import { ApprovalSystem } from "./approval";
import { BudgetController } from "./budget";
import { CheckpointManager } from "./checkpoints";
import { PlanModeManager } from "./plan-mode";
import { CronScheduler } from "./cron-scheduler";
import { Sentinels } from "./sentinels";
import { EventBus } from "./event-bus";
import { getDatabase } from "./db/schema";
import { SandboxManager } from "./sandbox";
import { SkillRegistry } from "./skills/registry";

export interface DispatchEvent {
  messageId: string;
  userId: string;
  intent: IntentCategory;
  originalText: string;
  response: string;
  tokens: number;
  cost: number;
  duration: number;
  sessionState: string;
  timestamp: number;
}

export class MessageDispatcher extends EventEmitter {
  private gateway: BaileysGateway;
  private intentRouter: IntentRouter;
  private sessions: Map<string, ChatSession> = new Map();
  private worker: JarvisWorker;
  private autoSave: AutoSave;

  // Fase 5 systems
  approvalSystem: ApprovalSystem;
  budgetController: BudgetController;
  checkpointManager: CheckpointManager;
  planModeManager: PlanModeManager;

  // Fase 6 systems
  cronScheduler: CronScheduler;
  sentinels: Sentinels;
  eventBus: EventBus;

  // Fase 7 systems
  sandboxManager: SandboxManager;
  skillRegistry: SkillRegistry;

  constructor(worker: JarvisWorker) {
    super();
    this.worker = worker;
    this.gateway = new BaileysGateway();
    this.intentRouter = new IntentRouter();

    // Initialize auto-save for session persistence (Fase 4)
    this.autoSave = new AutoSave(async (fns) => {
      for (const fn of fns) {
        await fn();
      }
    }, { delayMs: 1000 });

    // Initialize Fase 5 systems
    const db = getDatabase();
    this.approvalSystem = new ApprovalSystem(db);
    this.budgetController = new BudgetController(db);
    this.checkpointManager = new CheckpointManager();
    this.planModeManager = new PlanModeManager();

    // Initialize Fase 6 systems
    this.eventBus = new EventBus();
    this.cronScheduler = new CronScheduler(this.eventBus);
    this.sentinels = new Sentinels(this.cronScheduler, this.eventBus);

    // Initialize Fase 7 systems
    this.sandboxManager = new SandboxManager();
    this.skillRegistry = new SkillRegistry();

    this.setupGatewayListeners();
  }

  async initialize(): Promise<void> {
    await this.gateway.connect();
    console.log("[Dispatcher] WhatsApp gateway initialized");
  }

  async dispatch(whatsAppMsg: WhatsAppMessage): Promise<void> {
    const startTime = Date.now();
    const messageId = `${whatsAppMsg.senderId}-${whatsAppMsg.timestamp}`;

    try {
      // Ensure session exists
      let session = this.sessions.get(whatsAppMsg.senderId);
      if (!session) {
        session = new ChatSession(whatsAppMsg.senderId);
        this.sessions.set(whatsAppMsg.senderId, session);
        this.emit("session_created", {
          userId: whatsAppMsg.senderId,
          userName: whatsAppMsg.senderName,
        });
      }

      // Check for auto-close
      if (await session.checkAutoClose()) {
        await session.close();
        // Reopen for new message
        await session.reopen();
      }

      // Register message with session
      const messageText = whatsAppMsg.text || "[Media received]";
      await session.receive(messageText);

      // Detect intent
      const intent = await this.intentRouter.detectIntent(messageText);
      await session.startWork(intent.category, intent.suggestedProject);

      // Fase 5: Check PlanMode permissions
      const planCheck = this.planModeManager.checkPermission("bash");
      if (!planCheck.allowed) {
        await this.gateway.sendMessage(
          whatsAppMsg.chatId,
          `⛔ Operação bloqueada pelo modo ${this.planModeManager.getCurrent()}`
        );
        return;
      }

      // Fase 5: Check budget
      const budgetCheck = this.budgetController.canExecute(whatsAppMsg.senderId, "analyze");
      if (!budgetCheck.allowed) {
        await this.gateway.sendMessage(
          whatsAppMsg.chatId,
          `💰 Orçamento diário esgotado. Resete amanhã.`
        );
        return;
      }

      // Build prompt context
      const sessionData = session.getData();
      const context = `
[Context]
User: ${whatsAppMsg.senderName}
Intent: ${intent.category}
Confidence: ${(intent.confidence * 100).toFixed(0)}%
Project: ${intent.suggestedProject || "auto-detect"}
Session duration: ${((Date.now() - sessionData.startTime) / 1000).toFixed(0)}s
      `.trim();

      const prompt = `${context}\n\n${messageText}`;

      // Process via worker
      const workerResponse = await this.worker.processPrompt(prompt, whatsAppMsg.senderId);

      // Update session with cost
      const totalTokens = workerResponse.tokens.input + workerResponse.tokens.output;
      await session.updateCost(totalTokens, workerResponse.cost);

      // Persist to database (Fase 4)
      const dbSessionId = session.getMetadata("dbId") || `${whatsAppMsg.senderId}-${Date.now()}`;
      session.setMetadata("dbId", dbSessionId);

      // Auto-save session and message
      await this.autoSave.enqueue(async () => {
        sessionDb.saveSession(dbSessionId, session);
      });

      await this.autoSave.enqueue(async () => {
        sessionDb.saveMessage(dbSessionId, "user", messageText, 0, 0);
      });

      await this.autoSave.enqueue(async () => {
        sessionDb.saveMessage(dbSessionId, "assistant", workerResponse.reply, totalTokens, workerResponse.cost);
      });

      // Send response
      await this.gateway.sendMessage(whatsAppMsg.chatId, workerResponse.reply);

      // Mark as complete
      await session.complete(workerResponse.reply);

      const duration = Date.now() - startTime;

      // Emit dispatch event
      const event: DispatchEvent = {
        messageId,
        userId: whatsAppMsg.senderId,
        intent: intent.category,
        originalText: messageText,
        response: workerResponse.reply,
        tokens: totalTokens,
        cost: workerResponse.cost,
        duration,
        sessionState: session.state,
        timestamp: Date.now(),
      };

      this.emit("dispatch_complete", event);
    } catch (error) {
      console.error(`[Dispatcher] Error processing message ${messageId}:`, error);
      this.emit("dispatch_error", {
        messageId,
        userId: whatsAppMsg.senderId,
        error: error instanceof Error ? error.message : String(error),
      });

      // Try to send error message to user
      try {
        await this.gateway.sendMessage(
          whatsAppMsg.chatId,
          "❌ Erro ao processar sua mensagem. Tente novamente."
        );
      } catch (sendError) {
        console.error("Failed to send error message:", sendError);
      }
    }
  }

  async shutdown(): Promise<void> {
    // Save all sessions
    for (const session of this.sessions.values()) {
      if (session.isActive) {
        await session.close();
      }
    }

    // Flush auto-save queue (Fase 4)
    await this.autoSave.shutdown();

    // Shutdown cron scheduler (Fase 6)
    this.cronScheduler.shutdownAll();

    // Disconnect gateway
    await this.gateway.disconnect();
    console.log("[Dispatcher] Shutdown complete");
  }

  getSession(userId: string): ChatSession | undefined {
    return this.sessions.get(userId);
  }

  getAllSessions(): ChatSession[] {
    return Array.from(this.sessions.values());
  }

  getStats(): {
    activeSessions: number;
    totalSessions: number;
    totalMessages: number;
    totalTokens: number;
    totalCost: number;
  } {
    let totalMessages = 0;
    let totalTokens = 0;
    let totalCost = 0;

    for (const session of this.sessions.values()) {
      const data = session.getData();
      totalMessages += data.messageCount;
      totalTokens += data.totalTokens;
      totalCost += data.totalCost;
    }

    return {
      activeSessions: Array.from(this.sessions.values()).filter(
        (s) => s.isActive
      ).length,
      totalSessions: this.sessions.size,
      totalMessages,
      totalTokens,
      totalCost,
    };
  }

  private setupGatewayListeners(): void {
    this.gateway.on("message", (msg: WhatsAppMessage) => {
      console.log(`[Dispatcher] Received message from ${msg.senderName}`);
      this.dispatch(msg).catch((error) => {
        console.error("[Dispatcher] Unhandled dispatch error:", error);
      });
    });

    this.gateway.on("connected", () => {
      console.log("[Dispatcher] WhatsApp connected");
      this.emit("connected");
    });

    this.gateway.on("disconnected", () => {
      console.log("[Dispatcher] WhatsApp disconnected");
      this.emit("disconnected");
    });

    this.gateway.on("error", (error: any) => {
      console.error("[Dispatcher] Gateway error:", error);
      this.emit("gateway_error", error);
    });
  }
}
