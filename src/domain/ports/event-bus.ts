export type DomainEvent =
  | { type: "MEMORY_SAVED"; uri: string; source: string }
  | { type: "RELATION_LINKED"; source: string; target: string; predicate: string }
  | { type: "RECALL_EXECUTED"; itemsCount: number; durationMs: number }
  | { type: "BUDGET_EXCEEDED"; budget: number; attempted: number };

export type EventHandler = (event: DomainEvent) => void;

export interface EventBus {
  publish(event: DomainEvent): void;
  subscribe(type: string, handler: EventHandler): () => void;
}
