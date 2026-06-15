# ADR-019: `context` hook for recall injection (revisiting ADR-012)

Use the `context` lifecycle event instead of `before_agent_start` for auto-recall
memory injection. Reverses the hook decision in ADR-012 while preserving all other
aspects of that ADR (custom message over system prompt, `display: false`, `customType:
"memory_context"`).

## Context

ADR-012 (2026-05-xx) chose `before_agent_start` for auto-recall injection. The
rationale stated that `context` fires multiple times per turn, making it
unsuitable — recall doesn't change within a turn, so firing per LLM call was
wasteful.

Review of `@tanyouqing/pi-openviking` (v0.1.1), a third-party Pi extension for
OpenViking, revealed a different approach: it uses the `context` hook to inject
`<relevant-memories>` blocks directly into the user message. Two key observations:

1. **Multiple LLM calls per turn is a feature, not a bug.** When the agent makes
   multiple tool calls in one turn, only the **first** LLM call receives memories
   via `before_agent_start`. Subsequent calls (after tool results) have no memory
   context unless the agent explicitly calls `ov_recall`. With `context`, every
   LLM call sees the same memory block — no degradation across tool rounds.

2. **Cache eliminates the waste.** A `Map<queryHash, formattedBlock>` guard returns
   the same cached block on repeated calls within the same turn. Zero OV traffic
   overhead after the first hit.

## Decision

Use `context` hook for auto-recall injection.

### Mechanism

- `pi.on("context", event)` fires before each LLM call in the turn.
- On first call: extract latest user text, run `recallService.recall()`, format
  result as `<relevant-memories>...</relevant-memories>` block.
- Cache result by query hash.
- On subsequent calls in same turn: return cached block directly, no OV call.
- Inject as a **custom message** (`role: "custom"`, `customType: "memory_context"`,
  `display: false`) appended after the user's message.
  - Do NOT modify the user's `message.content` directly — preserves message
    integrity and keeps the custom message identifiable in the message list.
  - Consistent with ADR-012 (memories are data, not instructions).

### Cache invalidation

- Implicit via query hash: cache key is a hash of the latest user message text.
  A new user message produces a different hash → automatic cache miss.
- Simple: `Map<string, { block: string }>`. No explicit invalidation logic needed.
  Same-query across turns is benign — OV results don't change mid-session for
  identical queries.
- Cache cleared on `session_shutdown` to prevent stale data across sessions.

### What stays from ADR-012

- Custom message (`customType: "memory_context"`, `display: false`)
- Session ID forwarding to `kb.search()` when `searchMode === "search"`
- Used context tracking (`sessionService.sessionUsed()`)
- Guard chain (recall toggle → circuit breaker → session creation → recall)
- Cooldown logic when OV times out

### What changes

- Hook from `before_agent_start` → `context`
- Guard chain returns no message on guards — just early return (no `return { message }`)
  since `context` doesn't return `BeforeAgentStartEventResult`
- Guard messages become `logger.warn()` only (not injectable as custom messages)
- Cache layer between `context` event and `recallService.recall()`

## Consequences

- Every LLM call in a turn receives memory context, not just the first one.
- Cache is trivial (in-memory Map, <1KB per entry, max 1 entry active).
- Guard messages (recall off, circuit breaker open, OV timeout) are no longer
  injected as custom messages — only logged. The agent doesn't see "recall is off"
  on every turn. This is acceptable because:
  - Recall toggle is visible via widget status
  - Circuit breaker status is visible via widget status
  - OV timeout is rare and already handled by cooldown
- `context` hook signature differs from `before_agent_start` — handler returns
  `{ messages?: AgentMessage[] } | undefined` instead of `BeforeAgentStartEventResult`.
- ADR-012 remains valid for all non-hook decisions (custom message format, display:false,
  memory-as-data principle).

## Alternatives considered

- **Keep `before_agent_start` + add `context` for subsequent calls** — duplication
  of recall logic across two hooks. Same cache would work but coordination is
  messy (which hook runs first?).

- **Modify user `message.content` inline** (tanyouqing approach) — simpler injection
  (no new message) but breaks message integrity. The original user text is no longer
  recoverable. Custom message is cleaner.

- **Inject as system prompt** — reversed by ADR-012 for semantic reasons. Still
  valid: memories are data, not instructions.
