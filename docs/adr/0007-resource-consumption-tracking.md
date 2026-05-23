# Resource Consumption Tracking: Over-Report, Per-Turn, Dual Channel

When auto-recall injects resources into the system prompt, OV has no signal about which items the agent actually consumed. We send all injected items as "used" via two channels: ContextParts inline in assistant messages and `session_used()` per turn. We over-report rather than detect actual usage, because false positives (mild ranking inflation) cost less than false negatives (permanent ranking degradation).

## Considered Options

**Detection heuristic** — text scanning, explicit tool call, or over-report. Text scanning is fragile (agent paraphrases URIs). Explicit tool requires agent cooperation (coverage drops to zero on most turns). Over-reporting is safe because Recall Curator already filters to score ≥ 0.15, topN=5, token budget 700 — only high-relevance items reach injection.

**Timing** — per-turn vs batch-on-commit. Per-turn enables OV to adjust ranking for subsequent auto-recall searches within the same session. Batch-on-commit is too late for in-session benefit.

**ContextPart placement** — inline in assistant message vs separate tracking message. Inline matches OpenClaw reference implementation and OV's `addSessionMessage` API which accepts mixed part types. Separate messages would create artificial assistant messages with no text, confusing OV's memory extractor.

**Scope** — memories+resources vs resources-only. OV's `ContextPart.context_type` explicitly includes `"memory"`. Excluding memories creates asymmetric blindness — OV learns resource utility but never memory utility.

**Dual channel vs single** — ContextParts feed OV's message-level correlation (memory extractor). `session_used()` feeds OV's session-level ranking engine. They serve different subsystems. OpenClaw only uses ContextParts; Python SDK only uses `session_used()`. We send both for maximum coverage.

**Skills** — deferred. Auto-recall's curator doesn't surface skills yet. API accepts only one skill per call (awkward for batching). Add later with no breaking change.

## Consequences

- Auto-recall return type extended to include `injectedItems: RecallItem[]`. Caller stores in `AutoRecallState.lastInjectedItems`.
- SessionSync gains `AutoRecallState` as constructor dependency. Reads `lastInjectedItems` on assistant `message_end`, clears after.
- `SessionClient` gains `sessionUsed(sessionId, contexts)` method. `session-ops.ts` adds `POST /api/v1/sessions/{id}/used`.
- `serializeContent` unchanged — ContextParts appended separately by SessionSync, not inside content serialization.
- ContextPart abstract uses cascade: `abstract → overview → text` (matches existing curator pattern).
