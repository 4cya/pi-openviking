import type { DomainEvent, EventHandler, EventBus } from "../../domain/ports/event-bus";

export class InMemoryEventBus implements EventBus {
  private handlers = new Map<string, EventHandler[]>();
  private eventLog: DomainEvent[] = [];

  publish(event: DomainEvent): void {
    this.eventLog.push(event);
    const handlers = this.handlers.get(event.type) ?? [];
    for (const h of handlers) {
      try { h(event); } catch { /* handler error */ }
    }
  }

  subscribe(type: string, handler: EventHandler): () => void {
    if (!this.handlers.has(type)) this.handlers.set(type, []);
    this.handlers.get(type)!.push(handler);
    return () => {
      const arr = this.handlers.get(type);
      if (arr) {
        const idx = arr.indexOf(handler);
        if (idx >= 0) arr.splice(idx, 1);
      }
    };
  }

  getLog(): DomainEvent[] {
    return this.eventLog;
  }

  clearLog(): void {
    this.eventLog = [];
  }
}
