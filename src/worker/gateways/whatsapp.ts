import { EventEmitter } from "events";

export interface WhatsAppMessage {
  chatId: string;
  senderId: string;
  senderName: string;
  text?: string;
  mediaType?: "audio" | "image" | "document";
  mediaBuffer?: Buffer;
  mediaUrl?: string;
  timestamp: number;
}

export interface WhatsAppStatus {
  connected: boolean;
  qrCode?: string;
  lastConnectTime?: number;
  lastDisconnectTime?: number;
  reconnectAttempts?: number;
}

export abstract class WhatsAppGateway extends EventEmitter {
  abstract connect(): Promise<void>;
  abstract disconnect(): Promise<void>;
  abstract sendMessage(chatId: string, text: string): Promise<void>;
  abstract sendMedia(
    chatId: string,
    buffer: Buffer,
    mediaType: "audio" | "image" | "document",
    filename?: string
  ): Promise<void>;
  abstract getStatus(): Promise<WhatsAppStatus>;

  on(
    event: "message" | "connected" | "disconnected" | "error",
    listener: (data: any) => void
  ): this {
    return super.on(event, listener);
  }
}
