---
labels: ["ready-for-agent"]
---

# PRD: F5 — Tools and Commands

## Problem Statement

The pi-openviking extension has all domain logic, ports, OV adapter, and services implemented (F1–F4, 343 tests), but it is invisible to the Pi agent. There are no tools the LLM can call, no commands the user can run, and no entry point wiring connecting the extension to Pi's session lifecycle. The extension exists but does nothing.

## Solution

Connect the domain to Pi by implementing 6 tools (callable by the LLM), 6 slash commands (callable by the user), a middleware pipeline for cross-cutting concerns, two thin application services, and a bootstrap entry point that wires everything together with a singleton guard.

Every interaction flows through one of two paths:

```
User message → Pi agent decides → tool call → Pipeline → Service → OV adapter → OV server
User input  → /command          → Service → (result shown to user)
```

## User Stories

1. As an LLM agent using Pi, I want to search OpenViking knowledge with `ov_search`, so that I can retrieve semantically relevant memories and documents during a conversation.
2. As an LLM agent, I want to discover files by pattern with `ov_glob`, so that I can find resources without brute-force directory traversal.
3. As an LLM agent, I want to search file contents by regex with `ov_grep`, so that I can locate specific code or configuration in stored resources.
4. As an LLM agent, I want to read file content at any detail level (L0 abstract, L1 overview, L2 full) with `ov_read`, so that I can consume stored knowledge efficiently.
5. As an LLM agent, I want to save, create directories, and move resources with `ov_write`, so that I can persist knowledge into OpenViking during a session.
6. As an LLM agent, I want to explicitly trigger curated recall with `ov_recall`, so that I can inject relevant memories into my context on demand.
7. As a user, I want to toggle auto-recall on and off with `/ov-recall on|off`, so that I control when the extension injects memories.
8. As a user, I want to check OV connection status with `/ov-status`, so that I can diagnose connectivity issues without digging through logs.
9. As a user, I want to browse the OV filesystem tree with `/ov-tree`, so that I can explore stored resources interactively.
10. As a user, I want to commit the current session and trigger memory extraction with `/ov-commit`, so that I can persist conversation insights on demand.
11. As a user, I want to search OV from my terminal with `/ov-search`, so that I can query knowledge without the agent's involvement.
12. As a user, I want to delete resources with confirmation via `/ov-delete`, so that I can clean up stored data safely.
13. As a developer, I want every tool and command to be wrapped in a middleware pipeline, so that cross-cutting concerns (logging, metrics, caching) are added without modifying handlers.
14. As a developer, I want thin application services (SearchService, WriteService) that delegate 1:1 to domain ports, so that tool handlers stay focused on orchestration.
15. As a developer, I want the entry point to initialize once and guard against re-initialization on session lifecycle events, so that the extension handles fork/resume/reload correctly.

## Implementation Decisions

### Modules

The implementation follows a strict dependency order — each module must be testable before the next depends on it:

1. **Middleware Pipeline** — A generic middleware chain (`Pipeline<T>`) that wraps async handlers. Accepts handler and optional `AbortSignal`; middlewares transform the handler in last-registered = outermost-wraps order. Only `LoggingMiddleware` is implemented in F5; `ToolContext` (shared state between middlewares) is deferred to when caching is needed. This is the one deep module in F5 — its interface is simple and the internal chain construction is unlikely to change.

2. **LoggingMiddleware** — Measures handler duration, logs structured info via the Logger port. Transparent to the handler — does not modify results or catch errors.

3. **SearchService** — Thin application service that delegates `find`, `search`, `glob`, and `grep` to the `KnowledgeBase` port. Mode routing (`find` vs `search`) is decided by `RecallConfig.searchMode`. No orchestration logic.

4. **WriteService** — Thin application service that delegates `save`, `mkdir`, and `mv` to the `FsStore` port. Exposed as a single tool with an `action` parameter (`save | mkdir | mv`) rather than three separate tools. No delete — delete is a user-initiated command with confirmation.

5. **Tool handlers (6)** — One file per tool. Each tool:
   - Declares TypeBox parameter schema
   - Calls `pipeline.execute(() => service.method(params), signal)` for tools, or `service.method()` directly for commands
   - Registers via `pi.registerTool()`

6. **Command handlers (6)** — One file per command. Commands bypass the pipeline and call services directly. Destructive commands (`/ov-delete`) use `ctx.ui.confirm()` for safety.

7. **Entry point (`index.ts`)** — Bootstrap wiring:
   - Guard `initialized` flag ensures `init()` runs once
   - `session_start` event triggers `init(ctx.cwd)`, resolves services from DI container, creates Pipeline, registers all tools and commands
   - Every `session_start`: creates OV session via `SessionService.createAndSet()`, registers OVWidget in TUI
   - Graceful degradation if OV is unavailable (session stays null, widget shows disconnected)

### Port modifications

- `RecallService.enabled` changed from `readonly` to mutable, `setEnabled(enabled: boolean)` added. Prototype validated.

### Schema changes

- `SearchService` and `WriteService` registered as 2 new singletons in `lifecycle.ts` (12 total, no circular dependencies).
- No Zod schema changes — existing `RecallConfig.searchMode` (`'find' | 'search'`) already covers the mode routing.

### PiEventBridge elimination

Per ADR-011, infrastructure events (`session_start`, `message_end`, `before_agent_start`) are handled directly via `pi.on()` in the entry point. No `pi-event-bridge.ts` file exists. The domain EventBus only carries domain events (`MEMORY_SAVED`, `RECALL_EXECUTED`, `BUDGET_EXCEEDED`, `RELATION_LINKED`) between bounded contexts.

### Tool and command schemas (from prototype, validated 9/9)

Each tool TypeBox schema (trimmed to the decision-rich shape):

```
ov_search:     { query: string, mode?: "auto"|"fast"|"deep", limit?: number, targetUri?: string }
ov_glob:       { pattern: string, uri?: string, limit?: number }
ov_grep:       { pattern: string, uri?: string, caseInsensitive?: boolean, levelLimit?: number, nodeLimit?: number }
ov_read:       { uri: string, level?: "abstract"|"overview"|"read", offset?: number, limit?: number }
ov_write:      { action: "save"|"mkdir"|"mv", uri: string, content?: string, targetUri?: string, mode?: "replace"|"append"|"create" }
ov_recall:     { prompt: string, limit?: number }
```

Commands are registered via `pi.registerCommand(name, { description, handler })`. No TypeBox schema for commands — arguments come as a single string.

## Testing Decisions

A good test for F5 validates **external behavior**: a tool returns the expected content, the pipeline applies logging transparently, the entry point initializes once. Tests must NOT depend on implementation details of the pipeline chain construction or middleware internals.

### Modules tested

| Module | Test approach | Prior art |
|--------|--------------|-----------|
| Pipeline | Unit: empty chain, single middleware, multiple middleware, error propagation | `domain/ports/knowledge-base.test.ts` (interface conformance) |
| LoggingMiddleware | Unit: logger mock (`NullLogger`), verify duration and log call | `adapters/driven/logger/null-logger.test.ts` |
| SearchService | Unit: `KnowledgeBase` mock, verify delegation per mode (find vs search) | `domain/recall/recall-service.test.ts` (service with port mock) |
| WriteService | Unit: `FsStore` mock, verify delegation per action | Same pattern as SearchService |
| Tool handlers | Integration: OV mock HTTP server in-process (pattern from `transport.test.ts`), pipeline real, service real, verify end-to-end result | `adapters/driven/openviking/transport.test.ts` (Node http mock server) |
| Command handlers | Unit: service mock, verify handler calls correct method | `infrastructure/lifecycle.test.ts` (smoke test pattern) |

### Prior art for integration tests

The OV mock server pattern is well established in `transport.test.ts` — a Node `http.createServer()` handles specific routes and returns controlled responses. The same pattern is reused for tool integration tests, with the addition of a Pipeline wrapper.

## Out of Scope

- **Auto-recall (F6)**: automatic memory injection on `before_agent_start`. F5 tools are manually triggered by the agent or user.
- **Session sync (F6)**: `message_end` → `sessionService.sendMessage()` wiring. F5 creates sessions but does not sync messages.
- **Cache middleware**: deferred until caching requirements emerge.
- **Profiles (F7)**: profile-based config overrides for search mode, scope, and automation levels.
- **OVWidget detailed rendering**: widget is created in F5 with basic info; rich rendering (last recall metrics, icons) is refined in F6.
- **Health checking**: `/ov-status` shows connection state based on the last operation result; continuous health polling is F6.

## Further Notes

- Prototype validated the full design at `src/_prototype/` (deleted after validation). 9/9 checks passed covering pipeline, logging, services, mode routing, OV mock integration, and Pi SDK API compatibility.
- The word "search" is overloaded in this project. In the OV API, `find()` means simple semantic search (no session) and `search()` means deep search with server-side intent analysis (requires session). The `ov_search` tool uses both, decided by the `mode` parameter which the LLM chooses based on the user's query.
- `RecallService.setEnabled()` was added during the grill and is already merged into the codebase.
