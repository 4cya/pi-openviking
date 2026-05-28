# pi-openviking — Context

> Pi extension that integrates OpenViking as a long-term memory and resource backend for coding agents.
> Not a generic OV client — a focused memory plugin.

Architecture decisions: see `docs/adr/`.

## Language

### Systems & Actors

**Pi**:
Coding agent harness that owns session history, prompt orchestration, and tool execution.
_Avoid_: pi-coding-agent, harness

**OpenViking (OV)**:
Long-term memory server providing semantic search, resource storage, and memory extraction.
_Avoid_: the server, OV server

**Extension**:
A Pi plugin that registers tools and hooks into session lifecycle events.
_Avoid_: plugin, add-on

**Agent**:
The LLM instance orchestrated by Pi that uses tools and produces responses.
_Avoid_: model, LLM

### Architecture Layers

**Domain**:
Innermost layer containing enterprise logic and port interfaces. Zero external dependencies. Lives under `src/domain/`.
_Avoid_: core, business layer

**Port**:
An interface declared in the domain layer that an adapter must implement.
_Avoid_: contract

**Adapter**:
An implementation of a Port, living in `src/adapters/`. **Driven** adapters implement domain ports (e.g. FileLogger); **Driver** adapters call domain ports (e.g. Pi Event Bridge).
_Avoid_: implementation, plugin

**Infrastructure**:
Cross-cutting concerns: config loading, DI container, lifecycle wiring. Lives under `src/infrastructure/`.
_Avoid_: framework, wiring layer

### Foundation (Config & DI)

**Config Schema**:
The Zod schema that defines, validates, and provides defaults for all plugin configuration. Single source of truth. Exports `PiOVConfig` type inferred via `z.infer`.
_Avoid_: schema, config definition

**OVAdapterConfig**:
A sub-schema of Config Schema (field `ov`) that defines server connection parameters: `endpoint`, `apiKey`, `account`, `user`, `timeout`, `commitTimeout`, `maxRetries`. Validated via Zod with sensible defaults (endpoint = `http://localhost:1933`, timeout = 30s, maxRetries = 3).
_Avoid_: ov config, transport config

**Transport**:
An HTTP client class (`Transport`) that wraps native `fetch()` with auth headers (`X-API-Key`, `X-OpenViking-Account`, `X-OpenViking-User`), exponential backoff retry (5xx/network), configurable timeout, and AbortSignal passthrough. Single method `request<T>(methodLabel, path, opts?, signal?)`. Lives in `adapters/driven/openviking/transport.ts`.
_Avoid_: http client, fetcher

**ErrorMapper**:
A pure function `toDomainError(httpStatus, body, methodLabel)` that translates OV HTTP errors into typed `DomainError` subtypes: 401/403 → `ConnectionError`, 404 → `NotFoundError`, 409/422 → `ValidationError`, 5xx → `ConnectionError`. Lives in `adapters/driven/openviking/mappers/error-mapper.ts`.
_Avoid_: error translator, http error handler

**ContentMapper**:
A pure function `toContent(raw, uri, level?)` that converts OV content endpoint JSON into domain `Content` (typed `Uri` object + `body` string + optional `level`). Handles all three levels (read/abstract/overview). Extracts `body` from response, falls back to empty string on null. Lives in `adapters/driven/openviking/mappers/content-mapper.ts`.
_Avoid_: content parser, response mapper

**FsStoreAdapter**:
A full implementation of the `FsStore` port in `adapters/driven/openviking/fs-store.ts`. `read()` maps level to endpoint segment (`/api/v1/content/{read|abstract|overview}`) with `uri`, `offset`, `limit` query params. `write()` calls `POST /api/v1/content/write` with `wait: true`. Navigation methods (`list`, `tree`, `stat`) call `GET /api/v1/fs/{ls|tree|stat}`. Management methods (`mkdir`, `mv`) use POST with URI payload. `delete()` calls `DELETE /api/v1/fs?uri=` and auto-retries with `recursive=true` on recursive-required errors.

**FsMapper**:
Pure functions in `adapters/driven/openviking/mappers/fs-mapper.ts`: `toFsEntry(raw)` validates type (`file|directory`) and returns domain `FsEntry`; `toFsEntries(raw)` maps arrays; `toWriteResult(raw, expectedUri)` infers success from `success` flag or `status` field.

**SearchMapper**:
Pure functions in `adapters/driven/openviking/mappers/search-mapper.ts`: `toSearchResult(raw)` maps OV search response (memories/resources/skills arrays) into domain `SearchResult`; `toGlobResult(raw)` maps glob entries; `toGrepResult(raw)` maps grep matches with line numbers. All null-safe.
_Avoid_: search parser, search response mapper

**KnowledgeBaseAdapter**:
An implementation of the `KnowledgeBase` port in `adapters/driven/openviking/knowledge-base.ts`. `find()` calls `POST /api/v1/search/find` (no session). `search()` calls `POST /api/v1/search/search` with optional `session_id`. `glob()` calls `POST /api/v1/search/glob`. `grep()` calls `POST /api/v1/search/grep` with all filter params (`case_insensitive`, `exclude_uri`, `level_limit`, `node_limit`). All methods use `SearchMapper` for response mapping.

**SessionMapper**:
Pure functions in `adapters/driven/openviking/mappers/session-mapper.ts`: `toSessionId(raw)` extracts the session identifier from OV create response; `toCommitResult(raw)` maps commit response to `{ sessionId, taskId? }`; `toTaskStatus(raw)` maps task status (pending/running/completed/failed). Also exports `serializePart(part)` and `serializeParts(parts)` which convert domain `Part` types to OV JSON format with camelCase→snake_case key mapping.
_Avoid_: session parser

**SessionStoreAdapter**:
An implementation of the `SessionStore` port in `adapters/driven/openviking/session-store.ts`. All 8 methods implemented: `create()` → `POST /api/v1/sessions`; `sendMessage()` → `POST /api/v1/sessions/{id}/messages` with serialized `Part[]`; `sendMessages()` → batch endpoint; `commit()` → `POST /api/v1/sessions/{id}/commit` with `keep_recent_count`; `getTaskStatus()` → `GET /api/v1/tasks/{id}`; `listTasks()` → `GET /api/v1/tasks` with optional filters; `sessionUsed()` → `POST /api/v1/sessions/{id}/used`; `deleteSession()` → `DELETE /api/v1/sessions/{id}`.

**RelationMapper**:
Pure functions in `adapters/driven/openviking/mappers/relation-mapper.ts`: `toLinkResult(raw, source, targets, reason?)` constructs a `LinkResult` from domain params; `toRelations(raw)` maps OV graph response (array or `{ relations: [...] }` shape) into domain `Relation[]`.

**GraphStoreAdapter**:
An implementation of the `GraphStore` port in `adapters/driven/openviking/graph-store.ts`. `link()` calls `POST /api/v1/relations/link` with `from_uri`, `to_uris[]`, optional `reason`. `unlink()` calls `DELETE /api/v1/relations/link` with `from_uri`, `to_uri`. `graph()` calls `GET /api/v1/relations?uri=` and maps via `RelationMapper`.

**Config Cascade**:
Config resolution order: compiled defaults → env vars (`OV_*`) → `.pi/settings.json` → active Profile. Each source overrides the previous via shallow merge.
`.pi/settings.json` is read at the `"pi-openviking"` namespace key — only the sub-tree under that key enters the cascade. Pi-level keys (`extensions`, etc.) are ignored.
_Avoid_: merge, resolution chain

**Profile**:
A named config preset. One is always active. Four built-in: `default`, `web-dev`, `docs`, `learning`. Currently carries only `name` + `description`; future phases add behavioral fields (targetUri, searchMode, etc.).
_Avoid_: config profile, named preset

**Logger Interface**:
The `Logger` contract in `domain/ports/logger.ts` with methods `info`, `warn`, `error`, `debug`, `isEnabled`. Pure interface — zero external dependencies.
_Avoid_: log, console

**File Logger**:
JSON lines output via `appendFileSync`. Rotates by size (10MB) and age (7 days), keeps up to 5 gzipped historical files.
_Avoid_: file logging, persistent logger

**DI Container**:
Manual dependency injection container (21 lines). Registers dependencies by string token; supports singleton and factory lifetime. Throws clear error on unregistered token.
_Avoid_: container, ioc

**Lifecycle**:
The `init()` (async, creates logger + container + wires everything) and `shutdown()` (sync, resets state, zero I/O) entry points for the Foundation layer.
Single `init()` in `infrastructure/lifecycle.ts` — F4 services (SearchService, WriteService, SessionService, RecallService) and domain logic (IntentDetector, RecallCurator, scorers) are resolved and registered inside the same `init()`. No separate application lifecycle.
_Avoid_: bootstrap lifecycle, module lifecycle

### Core Domain (future phases)

**KnowledgeItem**:
A unit of persistent knowledge stored in OpenViking. Can be a memory (extracted text with metadata) or a resource (document, file, reference). Has a Uri, content, and optional relations.

**Intent Detector**:
A Chain of Responsibility pipeline that classifies a user prompt to decide whether auto-recall should fire. Handlers: Continuation → ComplexQuery → SimpleQuery → LearnedRejection.
Returns `IntentResult { shouldRecall: boolean; searchMode: 'find' | 'search'; query: string }`.
Caller (RecallService / F6) uses searchMode to choose KnowledgeBase method and handles session availability.

**Recall Curator**:
A pipeline that scores, ranks, deduplicates, and trims search results to fit a token budget. Operates post-search, locally.
The **RecallCurator** class in `domain/recall/curator/` is a thin wrapper over the pure `curate()` function.
It loads `CurateOpts` from profile config, calls `curate()`, handles expand-graph orchestration, and emits logs/metrics.
**Scorers** (`domain/recall/curate.ts`) extend the internal scoring with relevance and temporal signals — they refine, not replace, the base sort. `relevanceScorer`: keyword overlap between query tokens and item text+uri, case-insensitive, max +0.5. `temporalScorer`: exponential decay on `CuratedItem.modTime`, half-life 7 days, max +0.5. Additional scorers (lexical, preference) in future slices.

**Graph Expander**:
Optionally traverses OV relations from seed KnowledgeItems to inject related resources into context.
Injected into RecallService as optional (`GraphExpander?`). Absent until F8 — no-op when undefined.

**EventBus**:
An in-memory publish/subscribe mechanism that decouples reactions to domain events (SESSION_STARTED, MEMORY_SAVED, INTENT_DETECTED, etc.). Domain events are what cross bounded contexts; infra events stay local.

**Middleware Pipeline**:
A stack of cross-cutting concerns (Logging → Cache → Metrics) that wraps application service calls. Each middleware can inspect or short-circuit a request before reaching the handler.
Applied at tool-handler level (F5), not inside services (F4). Services are plain classes; tool handlers call `pipeline.execute(() => service.method())` to wrap.

### Shared Types (shared kernel)

**Part**:
A discriminated union (`TextPart | ToolPart | ContextPart`) that represents a piece of content in an OV session message.
Maps to OV v3 `part` types. Lives in `domain/common/part.ts`.

**FindQuery**:
A data object with `query`, optional `limit`, `targetUri`. Used for simple search without session context.
Maps to OV `POST /api/v1/search/find`. Lives in `domain/common/search-query.ts`.

**SearchRequest**:
A data object with `query`, optional `limit`, `sessionId`, `targetUri`. Used for deep search
with server-side intent analysis. Maps to OV `POST /api/v1/search/search`.
Lives in `domain/common/search-query.ts`.

**ContentLevel**:
A string literal union: `"abstract" | "overview" | "read"`. Controls response detail level for `FsStore.read()`.
Lives in `domain/common/content-level.ts`.

**WriteMode**:
A string literal union: `"replace" | "append" | "create"`. Controls overwrite behavior for `FsStore.write()`.
Lives in `domain/common/write-mode.ts`.



**EventBus** (synchronous):
An in-memory publish/subscribe mechanism for domain events (ADR-011). Dispatch is synchronous — handlers
run in the same tick. Errors are logged but never propagated (one handler failure does not break others).
Event log accumulated for debugging. Lives in `domain/ports/event-bus.ts` and `infrastructure/event-bus/in-memory.ts`.

**Curate Pipeline**:
A pure function: `(SearchResult, CurateOpts) => CuratedResult`. No side effects, no TokenBudget mutation.
Token count returned but not deducted — caller (`RecallService`, F4) manages budget.
Accepts optional `Scorer[]` and `query` in `CurateOpts`. Each scorer is `(item: CuratedItem, query: string) => number`;
scores summed per item after base sort, then re-sorted. No scorers passed = backward-compatible behavior.
Built-in scorers: `relevanceScorer` (keyword overlap, max +0.5), `temporalScorer` (exponential decay, half-life 7d, max +0.5).
Scorers live in `domain/recall/curate.ts` alongside the pipeline.

**FsStore.write mode**:
Does NOT expose `wait` in the domain interface. Synchronous wait is an OV transport detail resolved
by the adapter with a default timeout. Domain operates on the concept of "write and be done".



**Uri** (class — value object):
A `viking://` URI identifying a resource or location in the OpenViking filesystem. Used across all bounded contexts. Implemented as class with validation in constructor — not a type alias.
_Avoid_: path, string identifier

**SessionId** (class — value object):
An opaque identifier for an OpenViking session. Created by `SessionStore.create()`, consumed by recall and profile. Implemented as class — type safety vs Uri.
_Avoid_: session token, session key

**DomainError** (class):
Base class for all domain-layer errors. Subtyped as `NotFoundError`, `ConnectionError`, `ValidationError`, etc. Every domain operation that can fail produces a typed DomainError.
_Avoid_: generic Error, exception

### Services (future phases)

**Recall Service**:
Orchestrates IntentDetect → KnowledgeBase.search → Curator → GraphExpander. Returns `{ items, tokens, formatted }`. Prompt injection is the caller's responsibility (F6 handler). Receives configuration via DI — raw `RecallConfig` fields before F7a, `ResolvedConfig` after F7a. Does not import ProfileManager.

**Interface**: `recall(prompt: string): Promise<RecallResult>` — prompt + DI-resolved config. Extends to `RecallInput` in F5/F6 if needed (non-breaking).
SessionId resolved internally via `SessionService.getActive()`. targetUri/topN/scoreThreshold from injected `RecallConfig`.

**Graceful degradation**: RecallService catcha ConnectionError de KnowledgeBase e retorna resultado vazio (log warn). Os demais services (search, write, session) propagam ConnectionError — são operações explícitas do usuário que precisam reportar falha.

**RecallConfig** (5 fields added to ConfigSchema in F4): `targetUri` (optional string, undefined=global), `topN` (number, default 5), `scoreThreshold` (number 0-1, default 0.5), `expandGraph` (boolean, default false), `searchMode` (literal `'find'` | `'search'`, default `'find'`).
Lives in `infrastructure/config/schema.ts` as `RecallConfigSchema`. Exported type `RecallConfig` inferred via `z.infer`.
Env vars: `OV_TOP_N`, `OV_SCORE_THRESHOLD`, `OV_TARGET_URI`, `OV_EXPAND_GRAPH`, `OV_SEARCH_MODE`.
Profile behavioral fields (autoRecall, autoSaveMode, autoLinkMode) added in F7a via ProfileSchema expansion — these 5 RecallConfig fields are birth in F4, Profile overrides them in F7a.

**Session Service**:
Manages OV session lifecycle: create, send messages, commit.
Owns the active OV session — callers get current session via `sessionService.getActive()`.
`createAndSet()` creates a new OV session and sets it as active.
Bindings: `pi.on('session_start')` → `createAndSet()`. SessionId is module-level state inside the service, not in index.ts.

**Commit model split into two methods:** `commit(sessionId)` returns `CommitResult { sessionId, taskId }` immediately (no polling). `waitForCommit(taskId, timeout?)` optionally polls `getTaskStatus()` until complete or timeout. Caller chooses: F6 auto-recall uses both; F5 tools may expose `taskId` to user and skip the wait.

**Write Service**:
Handles content persistence: save, mkdir, mv. Wraps FsStore port. No write-back — OV `write()` modes (replace|append|create) cover all cases.
Deferred to F5 — OV already handles implicit mkdir on create, extension validation, path normalization. Pure delegation, no orchestration logic in F4.

**SearchService** is also deferred to F5 — pure delegation over KnowledgeBase.

**F4 scope (revised)**: Domain logic only (scorers, IntentDetector, RecallCurator) + RecallService + SessionService + RecallConfig in schema. Thin service wrappers (SearchService, WriteService) born in F5 when tools need them.

## Flagged ambiguities

- **"Profile"** is overloaded three ways: (1) **Profile** — a named config preset in the Foundation layer; (2) **OV cProfile** — the server's own profiling mode; (3) **Memory Profile** — extracted user preferences from session memory. Use **Config Profile** for the Foundation concept, **OV cProfile** for the server concept, and **Memory Profile** for extracted preferences.
- **Uri** and **SessionId** live in a shared kernel (`domain/common/`), not inside any single bounded context. Every context imports from `common/`; no context imports from another context.
- **"Logger"** can refer either to the **Logger Interface** in `domain/ports/` or the **File Logger** implementation in `adapters/driven/`. Prefer the qualified name.
- **"Config"** without qualification refers to the plugin's configuration managed by the **Config Schema**. Not to be confused with Pi's own settings (`.pi/settings.json`) or OV's server configuration.

## Example dialogue

> **Dev:** "How does Config Cascade work at startup?"
>
> **Domain expert:** "Bootstrap resolves config in order: compiled defaults → env vars like `OV_LOG_LEVEL` → `.pi/settings.json` → active Profile. Zod validates the final merged object. An invalid field like `level: "verbose"` throws at bootstrap time, not silently at runtime."
>
> **Dev:** "So if I add a new config field, I only touch the Config Schema?"
>
> **Domain expert:** "The Config Schema is the single source of truth. Update the Zod definition, and the `PiOVConfig` type updates automatically via `z.infer`. The DI Container resolves the validated config as a singleton — every module receives config through the container, not by importing it directly."
>
> **Dev:** "Can I swap the File Logger for a different implementation?"
>
> **Domain expert:** "Yes — that's the point of the Port interface. The domain code depends only on Logger Interface. As long as the new implementation satisfies that contract, register it in the DI Container and the rest of the system doesn't change."
>
> **Dev:** "Will Recall Service need to import anything from OV?"
>
> **Domain expert:** "No. Recall Service depends on Port interfaces — KnowledgeBase, Curator, GraphStore. The OV Adapter implements those ports behind the scenes. The domain layer has zero awareness of HTTP, authentication, or the OV API."
