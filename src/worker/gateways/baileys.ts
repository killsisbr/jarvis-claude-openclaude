import { WhatsAppGateway, WhatsAppMessage, WhatsAppStatus } from "./whatsapp";
import {
  default as makeWASocket,
  useMultiFileAuthState,
  DisconnectReason,
  isJidGroup,
  getBinaryNodeChild,
  proto,
} from "@whiskeysockets/baileys";
import { Boom } from "@hapi/boom";
import path from "path";
import { mkdir } from "fs/promises";

export class BaileysGateway extends WhatsAppGateway {
  private sock: any;
  private authState: any;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private baseReconnectDelay = 1000; // 1s
  private maxReconnectDelay = 30000; // 30s
  private authPath: string;
  private isConnecting = false;
  private adminPhones: Set<string> = new Set();

  constructor(authPath = "~/.jarvis/baileys") {
    super();
    this.authPath = authPath.replace("~", process.env.HOME || "");
  }

  async connect(): Promise<void> {
    if (this.isConnecting) return;
    this.isConnecting = true;

    try {
      await mkdir(this.authPath, { recursive: true });

      const { state, saveCreds } = await useMultiFileAuthState(this.authPath);
      this.authState = { state, saveCreds };

      // Create a compatible logger for Baileys (pino-style)
      const createLogger = () => {
        const logger = {
          log: (msg: any) => console.log(`[Baileys] ${msg}`),
          error: (msg: any) => console.error(`[Baileys ERROR] ${msg}`),
          warn: (msg: any) => console.warn(`[Baileys WARN] ${msg}`),
          debug: (msg: any) => {},
          info: (msg: any) => console.log(`[Baileys INFO] ${msg}`),
          trace: (msg: any) => {},
          child: () => logger, // Return self for chaining
        };
        return logger as any;
      };

      this.sock = makeWASocket({
        auth: state,
        printQRInTerminal: true,
        logger: createLogger(),
      });

      this.sock.ev.on("connection.update", (update: any) =>
        this.handleConnectionUpdate(update)
      );
      this.sock.ev.on("messages.upsert", (m: any) =>
        this.handleMessagesUpsert(m)
      );
      this.sock.ev.on("creds.update", () => this.authState.saveCreds());

      this.reconnectAttempts = 0;
    } catch (error) {
      console.error("Failed to initialize Baileys:", error);
      this.emit("error", error);
      throw error;
    } finally {
      this.isConnecting = false;
    }
  }

  async disconnect(): Promise<void> {
    if (this.sock) {
      await this.sock.logout();
      this.sock = null;
    }
  }

  async sendMessage(chatId: string, text: string): Promise<void> {
    if (!this.sock) throw new Error("Not connected");
    await this.sock.sendMessage(chatId, { text });
  }

  async sendMedia(
    chatId: string,
    buffer: Buffer,
    mediaType: "audio" | "image" | "document",
    filename = "file"
  ): Promise<void> {
    if (!this.sock) throw new Error("Not connected");

    const options: Record<string, any> = {};
    if (mediaType === "audio") {
      options.audio = buffer;
      options.mimetype = "audio/mpeg";
    } else if (mediaType === "image") {
      options.image = buffer;
      options.mimetype = "image/jpeg";
    } else if (mediaType === "document") {
      options.document = buffer;
      options.mimetype = "application/octet-stream";
      options.fileName = filename;
    }

    await this.sock.sendMessage(chatId, options);
  }

  async getStatus(): Promise<WhatsAppStatus> {
    const isConnected = !!this.sock && this.sock.user;
    return {
      connected: isConnected,
      lastConnectTime: isConnected ? Date.now() : undefined,
      reconnectAttempts: this.reconnectAttempts,
    };
  }

  private async handleConnectionUpdate(update: any) {
    const { connection, lastDisconnect, qr } = update;

    if (qr) {
      this.emit("qr", qr);
    }

    if (connection === "open") {
      console.log("[Baileys] Connected successfully");
      this.reconnectAttempts = 0;
      this.emit("connected", this.sock.user);
    } else if (connection === "close") {
      const shouldReconnect =
        (lastDisconnect.error as Boom)?.output?.statusCode !==
        DisconnectReason.loggedOut;

      if (shouldReconnect && this.reconnectAttempts < this.maxReconnectAttempts) {
        this.reconnectAttempts++;
        const delay = Math.min(
          this.baseReconnectDelay * Math.pow(2, this.reconnectAttempts - 1),
          this.maxReconnectDelay
        );
        console.log(
          `[Baileys] Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})`
        );
        setTimeout(() => this.connect().catch(console.error), delay);
      } else {
        console.log("[Baileys] Disconnected permanently");
        this.emit("disconnected", lastDisconnect.error);
      }
    }
  }

  private async handleMessagesUpsert(m: any) {
    const { messages, type } = m;
    if (type !== "notify") return;

    for (const msg of messages) {
      if (!msg.message || msg.key.fromMe) continue;

      const chatId = msg.key.remoteJid;
      const senderId = msg.key.participant || chatId;
      const timestamp = (msg.messageTimestamp as number) * 1000;

      const senderName =
        msg.pushName || senderId.split("@")[0] || "Unknown";

      // Handle first-time users: assign as admin
      if (!this.adminPhones.has(senderId)) {
        this.adminPhones.add(senderId);
        console.log(`[Baileys] Assigned admin: ${senderName} (${senderId})`);
      }

      const whatsAppMsg: WhatsAppMessage = {
        chatId,
        senderId,
        senderName,
        timestamp,
      };

      // Extract message content
      const textMsg =
        msg.message.conversation || msg.message.extendedTextMessage?.text;
      if (textMsg) {
        whatsAppMsg.text = textMsg;
      }

      // Handle media
      if (msg.message.audioMessage) {
        whatsAppMsg.mediaType = "audio";
        // Baileys provides stream; we'll download in dispatcher
        whatsAppMsg.mediaUrl = msg.message.audioMessage.url;
      } else if (msg.message.imageMessage) {
        whatsAppMsg.mediaType = "image";
        whatsAppMsg.mediaUrl = msg.message.imageMessage.url;
      } else if (msg.message.documentMessage) {
        whatsAppMsg.mediaType = "document";
        whatsAppMsg.mediaUrl = msg.message.documentMessage.url;
      }

      this.emit("message", whatsAppMsg);
    }
  }
}
