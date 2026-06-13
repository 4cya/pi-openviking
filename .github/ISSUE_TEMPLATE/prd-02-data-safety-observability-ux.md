---
name: "PRD: Phase 2 — Data Safety, Observability, and UX Polish"
about: Architecture grill follow-up — 7 planned items from 2026-06-13 review
title: "PRD: Phase 2 — Data Safety, Observability, and UX Polish"
labels: ["ready-for-agent"]
assignees: []
---

## Problem Statement

An architecture grill on 2026-06-13 identified gaps in the pi-openviking plugin across data safety, observability, test coverage, and tool usability. While the plugin's core functionality is complete (F1–F6), some integration points are fragile or incomplete:

- Rapid session switches (`/new`, `/resume`) can lose uncommitted data
- Resumed or forked Pi sessions start with an empty OV session, losing historical context for memory extraction
- The OV system status endpoint is not exposed, making `/ov-status` rely only on local config
- Search tool schema does not expose OV's advanced filtering parameters
- Widget recall stats have rendering bugs on cache hits and empty results
- Peer ID implementation has dead code (`SearchOptions.peerId`) and zero tests
- sessionUsed() is already wired but lacks hook-level test coverage

## Solution

Implement 7 planned items grouped by theme to close these gaps without redesigning existing architecture.

## User Stories

### Data Safety

1. As a user, I want OV to commit my session before I switch to `/new` or `/resume`, so that no conversation data is lost even if the shutdown hook fails.
2. As a user, I want to be warned if the pre-switch commit fails and be able to cancel the switch, so that I don't accidentally lose context.
3. As a user resuming or forking a session, I want my previous messages to be re-populated in the new OV session, so that OV memory extraction and ranking work correctly from the start.

### Observability

4. As a user, I want to see the live OV server status (initialized, authenticated user) in `/ov-status`, so that I can diagnose connectivity issues without external tools.
5. As a user, I want the widget recall stats to accurately reflect the current recall result in all scenarios, so that I'm not misled by stale data.

### Code Quality

6. As a developer, I want `SearchOptions.peerId` removed or fixed, so that there is no dead code in the API surface.
7. As a developer, I want the peer ID parameter tested at the adapter level, so that the OV API contract is verified.
8. As a developer, I want the `sessionUsed()` call in the `context` hook covered by unit tests, so that regressions are caught.
9. As a developer, I want the `ov_search` tool schema to expose OV's `scoreThreshold`, `since`, `until`, `level`, `timeField`, and `includeProvenance` parameters, so that agents can use advanced search without falling back to raw HTTP.

## Implementation Decisions

### session_before_switch hook

- A new `pi.on("session_before_switch", ...)` handler in `registerLifecycleHooks()`.
- Commits the active OV session synchronously (await) before Pi destroys the extension instance.
- On failure: shows `ctx.ui.confirm("OV commit failed", "...switch anyway?")`. Returns `{ cancel: true }` on user rejection.
- No active session → no-op, return immediately.

### Resume re-hydrate

- `SessionService` gains a `sendMessages()` method (thin wrapper over `SessionStore.sendMessages()`, mirroring existing `sendMessage()` pattern).
- `handleSessionStart()` receives the `session_start` event reason.
- On reason `"resume"` or `"fork"`: reads `ctx.sessionManager.getBranch()` for the last 50 entries.
- Filters to `user` and `assistant` roles only (no system/custom messages).
- Maps each entry via `agentMessageToParts()` (already exists).
- Sends to OV via batch endpoint `POST /api/v1/sessions/{id}/messages/batch`.
- Chunks if more than 50 messages (OV max 100 per batch).
- Logs count of re-hydrated messages.
- Session creation remains `createAndSet()` as today — re-hydration populates the newly created session.

### system/status adapter

- New file `adapters/driven/openviking/status.ts` with `SystemStatusClient` class, following the `HealthCheck` pattern.
- Method `getStatus()` calls `GET /api/v1/system/status` with auth headers.
- Returns `{ initialized: boolean, user: string }`.
- On failure (non-ok response, fetch error), returns `{ initialized: false, user: "" }` — never throws.
- `/ov-status` command gains a `--live` flag or auto-fetches status on render, showing `OV Status: ✅ initialized (user: alice)` or `OV Status: ❌ unavailable`.

### Widget recall stats bug fixes

- `CacheEntry` interface gains optional `stats: string` to persist across cache hits.
- On cache hit: `widget.update("lastRecall", cached.stats)` instead of skipping.
- On `!result.formatted` (no results): `widget.update("lastRecall", "0it 0tk")`.
- When recall is disabled or circuit breaker is open: `widget.update("lastRecall", "")`.

### Peer ID cleanup

- Remove `SearchOptions.peerId` from `domain/common/search-query.ts` — peer ID is a query-level parameter, not an option. The adapter already reads it from `query.peerId` and `request.peerId`, never from `opts.peerId`.
- Add adapter-level test: `it("passes peer_id in request body")`.

### sessionUsed() hook test

- Add test case in `register-lifecycle-hooks.test.ts`:
  - Mock `RecallService.recall()` to return items with URIs.
  - Mock `SessionService.sessionUsed()`.
  - Fire the `context` hook.
  - Verify `sessionUsed()` was called with the correct URIs and session ID.

### ov_search advanced params

- Extend `SearchSchema` TypeBox object with optional fields: `scoreThreshold`, `since`, `until`, `level`, `timeField`, `includeProvenance`.
- Thread through `SearchService.search()` via existing `SearchOptions` interface (already supported by adapter).
- Update tool `promptSnippet` to reflect new params.

## Testing Decisions

**Good test = external behavior, not implementation.** Tests verify:
- Correct HTTP body is sent (adapter tests)
- Correct domain call is made (service tests)
- Correct tool result is returned (tool tests)
- Hook fires and side effects happen (lifecycle tests)

**Seams used (from highest to lowest):**

| Item | Seam | Prior art |
|---|---|---|
| session_before_switch | Lifecycle hook — mock `SessionService`, verify `commit` called | `register-lifecycle-hooks.test.ts` — context hook tests |
| Resume re-hydrate | Integration: mock `SessionManager.getBranch()`, verify `sendMessages` called | `message-mapper.test.ts` — 9 tests |
| system/status | Adapter test: mock HTTP server, verify `getStatus()` parsing | `health.test.ts` — 4 tests |
| Widget bugs | Lifecycle hook: mock recall returning cache hit / no results / timed out | existing context hook tests |
| Peer ID | Adapter test: verify `peer_id` in POST body | `knowledge-base.test.ts` — 10+ adapter tests |
| sessionUsed test | Lifecycle hook: mock recall + sessionService, verify `sessionUsed` called | existing context hook tests |
| ov_search params | Tool test: verify params passed through to service | `ov-search.test.ts` — 3 unit tests |

No new seams needed. All tests use existing patterns: mock HTTP server, mock services, and vitest `vi.fn()`.

## Out of Scope

- Integration/e2e tests against real Docker container (deferred).
- `session_before_compact` hook (deferred per architecture grill).
- `privacy-configs` endpoint (deferred — no skill consumer yet).
- `system/wait` endpoint (deferred — no pipeline consumer yet).
- TUI custom components (`ov-browser`, `ov-search-dialog`) — discarded as low-value.
- Profile expansion — discarded as adequate for current needs.
- Input hook, keyboard shortcuts, CLI flags — deferred pending user demand.

## Further Notes

- Estimated total implementation effort: ~8 hours across all items.
- session_before_switch and Widget bugs are highest priority (data safety + accurate UX).
- Resume re-hydrate is the most complex item (~2h) and depends on `SessionService.sendMessages()` being added first.
- system/status endpoint integration with `/ov-status` should fallback gracefully if OV is unreachable.
