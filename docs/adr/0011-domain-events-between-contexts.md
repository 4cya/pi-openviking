# ADR-011: Domain events between bounded contexts

Domain events carry business-meaningful state changes between bounded contexts. Infra events stay out — those come from `pi.on()` directly.

## Events

| Event | Published by | Consumed by | Payload |
|-------|-------------|-------------|---------|
| `MEMORY_SAVED` | WriteService (knowledge) | GraphExpander cache, ProfileAutoDetect | `{ uri, source }` |
| `RELATION_LINKED` | GraphStore (knowledge) | GraphExpander cache (invalidation) | `{ source, target, predicate }` |
| `RECALL_EXECUTED` | RecallService (recall) | Logger, ProfileAutoDetect | `{ itemsCount, durationMs }` |
| `BUDGET_EXCEEDED` | RecallSession (recall) | Logger | `{ budget, attempted }` |

## Excluded

- `PROFILE_CHANGED` — profile is a value object (replaced, not mutated). Config changes are infra notifications, not domain events.
- `ERROR` — not a domain concept. Errors are diagnostics.
- `SESSION_STARTED`, `MESSAGE_PROCESSED` — infra. Handled by `pi.on()` directly per ADR-008 (async init).

## Rationale

- Events cross bounded contexts or drive async side effects. Intra-context operations that don't need loose coupling stay as direct calls.
- Payloads carry only identifiers and primitives — never domain objects. Consumers must resolve their own references.
- EventBus is in-memory (no durable queue in MVP). Events that must survive restarts are a future concern.
