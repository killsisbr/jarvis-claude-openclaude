export interface EventPayload {
  [key: string]: unknown;
}

export interface EventListener {
  (payload: EventPayload): void;
}

interface QueuedEvent {
  name: string;
  payload: EventPayload;
  timestamp: number;
}

export class EventBus {
  private listeners: Map<string, Set<EventListener>> = new Map();
  private onceListeners: Map<string, Set<EventListener>> = new Map();
  private eventHistory: QueuedEvent[] = [];
  private maxHistorySize = 100;

  on(eventName: string, listener: EventListener): void {
    if (!this.listeners.has(eventName)) {
      this.listeners.set(eventName, new Set());
    }
    this.listeners.get(eventName)!.add(listener);
  }

  off(eventName: string, listener: EventListener): void {
    if (this.listeners.has(eventName)) {
      this.listeners.get(eventName)!.delete(listener);
    }
  }

  once(eventName: string, listener: EventListener): void {
    if (!this.onceListeners.has(eventName)) {
      this.onceListeners.set(eventName, new Set());
    }
    this.onceListeners.get(eventName)!.add(listener);
  }

  emit(eventName: string, payload: EventPayload = {}): void {
    this.addToHistory(eventName, payload);

    // Call regular listeners
    if (this.listeners.has(eventName)) {
      for (const listener of this.listeners.get(eventName)!) {
        try {
          listener(payload);
        } catch (error) {
          console.error(`[EventBus] Error in listener for ${eventName}:`, error);
        }
      }
    }

    // Call once listeners
    if (this.onceListeners.has(eventName)) {
      const listeners = this.onceListeners.get(eventName)!;
      for (const listener of listeners) {
        try {
          listener(payload);
        } catch (error) {
          console.error(`[EventBus] Error in once listener for ${eventName}:`, error);
        }
      }
      listeners.clear();
    }
  }

  getHistory(eventName?: string): QueuedEvent[] {
    if (eventName) {
      return this.eventHistory.filter((e) => e.name === eventName);
    }
    return [...this.eventHistory];
  }

  clearHistory(): void {
    this.eventHistory = [];
  }

  listenerCount(eventName: string): number {
    return (
      (this.listeners.get(eventName)?.size ?? 0) +
      (this.onceListeners.get(eventName)?.size ?? 0)
    );
  }

  removeAllListeners(eventName?: string): void {
    if (eventName) {
      this.listeners.delete(eventName);
      this.onceListeners.delete(eventName);
    } else {
      this.listeners.clear();
      this.onceListeners.clear();
    }
  }

  private addToHistory(eventName: string, payload: EventPayload): void {
    this.eventHistory.push({
      name: eventName,
      payload,
      timestamp: Date.now(),
    });

    // Keep history size bounded
    if (this.eventHistory.length > this.maxHistorySize) {
      this.eventHistory.shift();
    }
  }

  getStats(): {
    totalListeners: number;
    events: Map<string, number>;
    historySize: number;
  } {
    const events = new Map<string, number>();

    for (const [eventName, listeners] of this.listeners) {
      events.set(eventName, (events.get(eventName) ?? 0) + listeners.size);
    }

    for (const [eventName, listeners] of this.onceListeners) {
      events.set(eventName, (events.get(eventName) ?? 0) + listeners.size);
    }

    let totalListeners = 0;
    for (const count of events.values()) {
      totalListeners += count;
    }

    return {
      totalListeners,
      events,
      historySize: this.eventHistory.length,
    };
  }
}

// Singleton instance
export const eventBus = new EventBus();
