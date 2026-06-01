# ADR-015: Eliminate auto-actions — align with OV pattern

Session commit + explicit tools, not heuristic auto-save.

## Context

F8.1 proposed autoSaveMode (off/propose/auto) with an Analyzer using 16 hardcoded regex patterns to detect decisions, findings, notes, and preferences in message text. The prototype showed 100% accuracy on 20 test phrases, but the approach fundamentally conflicts with the OV reference implementation.

The OpenClaw plugin (OV's canonical integration example) does not have heuristic auto-save. Its pattern:

1. `afterTurn()` archives messages into OV session
2. Auto-commit when tokens exceed threshold
3. OV server extracts memories into `identity|preference|context|decision|plan|skill` categories
4. `memory_store` tool for explicit agent-initiated saves
5. `memory_recall` + auto-recall for retrieval

## Decision

Eliminate F8.1 entirely:

- **No Analyzer class** — no regex patterns, no heuristic message analysis
- **No Proposer** — no `ctx.ui.confirm()` for auto-detected actions
- **No AutoActionExecutor** — no automatic `WriteService.save()` or `GraphStore.link()`
- **No autoSaveMode/autoLinkMode/autoSaveTargets** — removed from ProfileBehavior
- **No Base URI resolution** — not needed without auto-save
- **No PatternConfigSchema** — not needed without patterns
- **No ovResourcePatterns** — not needed without patterns
- **Keep `ov_write` tool** (F5.2) — explicit save already exists
- **Keep session sync** (F6) — `message_end` → `sendMessage()`, `session_shutdown` → `commit()`

## Rationale

1. **OV already extracts memories.** Session commit triggers memory extraction on the server (memory_diff.json). Adding heuristic regex on top of this is redundant — patterns would detect the same things OV already classifies semantically.

2. **Explicit tools exist.** `ov_write` (F5.2) already lets the agent save content. `memory_store` in OpenClaw is the same pattern. No auto-save needed.

3. **Zero-config principle.** Every pattern added requires maintenance, translation, and user understanding. OV's memory extraction is zero-config — it works out of the box via commit.

4. **OpenClaw is the reference.** The OV team's own integration for OpenClaw doesn't implement heuristic auto-save. Following their pattern ensures compatibility and reduces divergence.

5. **Determinism.** Heuristic regex is deterministic but limited — it misses implicit patterns, fails on languages without explicit markers, and creates false positives. OV's VLM-based extraction handles semantics, not syntax.

## Consequences

- F8 duration reduced from 15d to 10d (F8.2=4d, F8.4=1d, F8.9=3d, buffer=2d)
- ProfileBehavior loses 3 fields: autoSaveMode, autoLinkMode, autoSaveTargets (remaining: targetUri, topN, scoreThreshold, searchMode, expandGraph, autoRecall)
- Prototype `_prototype/01-analyzer.ts` can be deleted — its patterns will never be implemented as code
- `message_end` hook stays as-is (F6 session sync only, no auto-action expansion)
