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
A sub-schema of Config Schema (field `ov`) that defines server connection parameters: `endpoint`, `apiKey`, `account`, `user`, `agentId`, `timeout`, `commitTimeout`, `maxRetries`. Validated via Zod with sensible defaults (endpoint = `http://localhost:1933`, agentId = `"pi"`, timeout = 30s, maxRetries = 3).
_Avoid_: ov config, transport config

**Transport**:
An HTTP client class (`Transport`) that wraps native `fetch()` with auth headers (`X-API-Key`, `X-OpenViking-Account`, `X-OpenViking-User`, `X-OpenViking-Agent`), exponential backoff retry (5xx/network), configurable timeout, and AbortSignal passthrough. Single method `request<T>(methodLabel, path, opts?, signal?)`. Lives in `adapters/driven/openviking/transport.ts`.
_Avoid_: http client, fetcher

**CircuitBreaker**:
A decorator wrapper inside `Transport` that protects against OV unavailability. States: **CLOSED** (normal) → 3 failures (configurable `threshold`) → **OPEN** (rejects instantly with `ConnectionError`) → `resetTimeoutMs` (default 30s, configurable) → **HALF_OPEN** (allows 1 probe request) → success = back to CLOSED, failure = back to OPEN with `resetTimeoutMs × 2`. Circuit breaker is driven by real request failures — not by health check. Config lives in `OVAdapterConfig.circuitBreaker? { threshold: number, resetTimeoutMs: number }`. Env vars: `OV_CIRCUIT_BREAKER_THRESHOLD`, `OV_CIRCUIT_BREAKER_RESET_TIMEOUT`. Module at `adapters/driven/openviking/circuit-breaker.ts`. 8 pure reducer tests + 3 Transport integration tests. Issue #74.
_Avoid_: cb, breaker, fault tolerance

**HealthCheck**:
An adapter (`adapters/driven/openviking/health.ts`) that probes OV availability via `GET /ready` (no auth required). Method `check(): Promise<HealthStatus>` returns `{ ok: boolean, latencyMs?: number, error?: string }`. Uses direct `fetch()` — does NOT go through the CircuitBreaker-decorated Transport. Results feed `OVWidget.update("conn", ...)`. Called on `session_start` and on-demand. Does NOT drive the CircuitBreaker — the breaker is driven by real request failures. No polling by default. 4 tests.
_Avoid_: health probe, ping, liveness

**ErrorMapper**:
A pure function `toDomainError(httpStatus, body, methodLabel)` that translates OV HTTP errors into typed `DomainError` subtypes: 401/403 → `ConnectionError`, 404 → `NotFoundError`, 409/422 → `ValidationError`, 5xx → `ConnectionError`. Lives in `adapters/driven/openviking/mappers/error-mapper.ts`.
_Avoid_: error translator, http error handler

**ContentMapper**:
A pure function `toContent(raw, uri, level?)` that converts OV content endpoint JSON into domain `Content` (typed `Uri` object + `body` string + optional `level`). Handles all three levels (read/abstract/overview). Extracts `body` from response, falls back to empty string on null. Lives in `adapters/driven/openviking/mappers/content-mapper.ts`.
_Avoid_: content parser, response mapper

**FsStoreAdapter**:
A full implementation of the `FsStore` port in `adapters/driven/openviking/fs-store.ts`. `read()` maps level to endpoint segment (`/api/v1/content/{read|abstract|overview}`) with `uri`, `offset`, `limit` query params. `write()` calls `POST /api/v1/content/write` with `wait: false` (async — OV processes embedding in background). Navigation methods (`list`, `tree`, `stat`) call `GET /api/v1/fs/{ls|tree|stat}`. Management methods (`mkdir`, `mv`) use POST with URI payload. `delete()` calls `DELETE /api/v1/fs?uri=` and auto-retries with `recursive=true` on recursive-required errors. `reindex()` calls `POST /api/v1/content/reindex {uri, mode}` with `mode` defaulting to `"vectors_only"`.

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
Config resolution order: compiled defaults → env vars (`OV_*`) → `.pi/settings.json` → active Profile (merged in `init()`, not `loadConfig()`). Each source overrides the previous via shallow merge.
`.pi/settings.json` is read at the `"pi-openviking"` namespace key — only the sub-tree under that key enters the cascade. Pi-level keys (`extensions`, etc.) are ignored.

F7a: Profile merge happens in `init()` via `ProfileManager.resolve(activeProfile)` → `deepMerge(baseConfig, profileOverride)`. `loadConfig()` stays pure — does not create ProfileManager. Services receive merged config at construction; ProfileManager not injected until F7b.
_Avoid_: merge, resolution chain

**Profile**:
A named config preset. One is always active. Four built-in: `default`, `web-dev`, `docs`, `learning`. Carries `name` + `description` + `behavior: ProfileBehavior` (optional, added in F7a). Schema: `ProfileConfigSchema` with `behavior: ProfileBehaviorSchema.default({})`. Built-in profiles carry behavioral overrides (topN, scoreThreshold, etc.) web-dev targetUri placeholder `{workspace}` resolved in F7b via AutoDetect.

**ProfileBehavior**:
6 optional behavioral fields that override `RecallConfig` when a profile is active. Fields are optional — profile só sobrescreve o que define. Defined in `infrastructure/config/profile-schema.ts`:
- `targetUri` (string?): escopo de busca. undefined = global.
- `topN` (number?): max results. undefined = usa default RecallConfig.
- `scoreThreshold` (number 0-1?): relevância mínima.
- `searchMode` (`'find'|'search'`?): modo de busca OV.
- `expandGraph` (boolean?): expandir grafo (F8+).
- `autoRecall` (boolean?): override do toggle default.

Resolved at init via `ProfileManager.resolve()` returning `Partial<Pick<PiOVConfig, "recall">>`. `init()` deep-merges into `RecallConfig` before constructing services. Services receive merged config — no ProfileManager reference until F7b.

**ProfileManager** (stateful, `domain/profile/service/ProfileManager.ts`):
Manages the active profile. Constructor receives `profiles: Record<string, ProfileConfig>` (with behavior sub-objects) and `activeProfile: string`. Methods:
- `getActive(): string` — returns current profile name.
- `resolve(name?): Partial<Pick<PiOVConfig, "recall">>` — returns behavioral fields for merge. Only populated fields override.
- `apply(name): void` — validates name exists, updates state (F7b+).
- `list()` — returns `{name, description}[]`.

Register as singleton in container at init. In F7a, used only at init time (`init()` calls `pm.resolve()` and merges before service construction). In F7b, injected into services for runtime `apply()` support. `activeProfile` lido da config file em F7a; comando `/ov-profile` é F7b.

**AutoDetect** (F7b):
Minimatch rules-based profile detection. `detect(cwd, rules): string | null`. Rules from config: `{ "pattern": "**/web*/**", "profile": "web-dev" }`. Built-in rules: `**/web*/**` → web-dev, `**/doc*/**` → docs. Runs in `session_start` when `activeProfile = "auto"`.
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
Single `init()` in `infrastructure/lifecycle.ts`. Registers 13 singletons: config, logger, knowledgeBase, fsStore, graphStore, sessionStore (F1-F3), plus recallCurator, sessionService, recallService (F4), plus searchService, writeService, readService (F5). No IntentDetector — recall toggle is command-based. Scorers `[relevanceScorer, temporalScorer]` wired in F4. No GraphExpander — absent until F8. 22 lifecycle smoke tests.
_Avoid_: bootstrap lifecycle, module lifecycle

### Core Domain (future phases)

**KnowledgeItem**:
A unit of persistent knowledge stored in OpenViking. Can be a memory (extracted text with metadata) or a resource (document, file, reference). Has a Uri, content, and optional relations.

**Recall Toggle**:
A user-controlled toggle command (`/ov recall on|off`) that enables or disables auto-recall. Initial state from `RecallConfig.autoRecall` (default true). Command overrides runtime state — does not mutate config.
No intent detection — user decides when recall fires. searchMode comes from RecallConfig, overridable via profile.
_Avoid_: intent detector, auto-detect recall

**Recall Curator** *(implemented — `domain/recall/recall-curator.ts`)*:
Thin wrapper class over the pure `curate()` function. Constructor takes `RecallConfig`, `Scorer[]`, `Logger`. Single method `curate(results: SearchResult): CuratedResult` reads `topN`, `scoreThreshold`, `maxTokens` from config, builds `CurateOpts`, calls the pure `curate()`, emits log with item/token counts. `GraphExpander` optional — absent in F4, injected in F8. 6 tests.
**Scorers** (`domain/recall/curate.ts`) extend the internal scoring with relevance and temporal signals — they refine, not replace, the base sort. `relevanceScorer`: keyword overlap between query tokens and item text+uri, case-insensitive, max +0.5. `temporalScorer`: exponential decay on `CuratedItem.modTime`, half-life 7 days, max +0.5. Additional scorers (lexical, preference) in future slices.

**Graph Expander**:
Optionally traverses OV relations from seed KnowledgeItems to inject related resources into context.
Injected into RecallService as optional (`GraphExpander?`). Absent until F8 — no-op when undefined.

**Middleware Pipeline** *(implemented — `domain/pipeline/pipeline.ts`)*:
Generic `Pipeline<T>` class that wraps async handlers with a middleware chain. Middlewares compose in last-registered = outermost-wraps order. Supports optional `AbortSignal` passthrough. 5 tests.

**LoggingMiddleware** *(implemented — `domain/pipeline/logging-middleware.ts`)*:
Factory function `loggingMiddleware(label, logger)` that measures handler duration and logs via the Logger port. Logs `info` on success, `error` on failure, with `durationMs` in context. Transparent — does not modify results. 2 tests.

Applied at tool-handler level (F5), not inside services (F4). Services are plain classes; tool handlers call `pipeline.execute(() => service.method(params), signal)` to wrap. ToolContext (shared state between middlewares) deferred — added when cache middleware needs it.

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

**ReindexMode**:
A string literal union: `"vectors_only" | "full"`. Controls reindex scope for `FsStore.reindex()`. Default `"vectors_only"` rebuilds vector embeddings only; `"full"` rebuilds both scalar and vector indexes. Lives in `domain/ports/fs-store.ts` as an exported type alias.



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

**FsStore.delete with glob** (F8.4):
`/ov-delete` command accepts both literal URI and glob pattern (e.g. `viking://resources/temp/*`). Pattern resolution calls `KnowledgeBase.glob()` first, then deletes each match. Confirmation dialog shows matched count before proceeding.



**Uri** (class — value object):
A `viking://` URI identifying a resource or location in the OpenViking filesystem. Used across all bounded contexts. Implemented as class with validation in constructor — not a type alias.
_Avoid_: path, string identifier

**SessionId** (class — value object):
An opaque identifier for an OpenViking session. Created by `SessionStore.create()`, consumed by recall and profile. Implemented as class — type safety vs Uri.
_Avoid_: session token, session key

**DomainError** (class):
Base class for all domain-layer errors. Subtyped as `NotFoundError`, `ConnectionError`, `ValidationError`, etc. Every domain operation that can fail produces a typed DomainError.
_Avoid_: generic Error, exception

### Services

**Recall Service** *(implemented — `domain/recall/recall-service.ts`)*:
Orchestrator tying KnowledgeBase + RecallCurator into a single `recall(prompt)` call. Constructor takes `KnowledgeBase`, `RecallCurator`, `RecallConfig`, `Logger`, `enabled: boolean` (toggle state). Returns `RecallResult { items, tokens, formatted, total }`. 5 tests.

**Interface**: `recall(prompt: string, sessionId?: SessionId): Promise<RecallResult>` — F6 `before_agent_start` handler calls this passing `sessionService.getActive()` as sessionId. SessionId is forwarded to `kb.search()` when `searchMode === "search"` (OV uses session context for intent analysis). Not passed to `kb.find()` — find() doesn't accept sessionId.

**Flow**: (1) Check `enabled` toggle → if false, return empty without calling KB. (2) Route to `kb.find()` or `kb.search()` based on `config.searchMode`, passing `prompt`, `topN`, `targetUri`. (3) Pass raw results through `curator.curate()`. (4) Build `formatted` string from curated items. (5) Return `RecallResult`.

**Graceful degradation**: Catches `ConnectionError` from KB → logs warn ("OV unavailable, skipping recall") → returns empty result. All other errors (ValidationError, etc.) propagate — those indicate bugs, not transient failures.

**RecallConfig** (7 fields in ConfigSchema F4+F7a): `targetUri` (optional string, undefined=global), `topN` (number, default 8), `scoreThreshold` (number 0-1, default 0.5), `maxTokens` (int, default 4000), `expandGraph` (boolean, default true), `searchMode` (literal `'find'` | `'search'`, default `'search'`), `autoRecall` (boolean, default true, added F7a).
Lives in `infrastructure/config/schema.ts` as `RecallConfigSchema`. Exported type `RecallConfig` inferred via `z.infer`.
Env vars: `OV_TOP_N`, `OV_SCORE_THRESHOLD`, `OV_TARGET_URI`, `OV_EXPAND_GRAPH`, `OV_SEARCH_MODE`.
ProfileBehavior (6 fields) overrides RecallConfig fields in F7a via merge. Schema in `profile-schema.ts` has `behavior: ProfileBehaviorSchema.default({})`.

**SessionService** *(implemented — `domain/services/session-service.ts`)*:
Stateful service that manages the OV session lifecycle. Owns the active session — callers get the current session via `getActive()` rather than tracking it externally. Depends on `SessionStore` port + `SessionServiceConfig { commitTimeout, pollInterval? }`.

Methods: `createAndSet(): Promise<SessionId>`, `getActive(): SessionId | null`, `sendMessage(sessionId, role, parts)`, `commit(sessionId, options?): Promise<CommitResult>`, `waitForCommit(taskId, timeout?): Promise<TaskStatus>`, `deleteSession(sessionId)`.

Active session is instance-level private state. `createAndSet()` creates via port and stores as active; subsequent calls replace the previous active. `commit()` returns `{ taskId }` immediately — no polling. `waitForCommit()` polls `getTaskStatus()` at `pollInterval` (default 1s) until `completed`/`failed` or timeout (defaults to `commitTimeout` from config, overridable per-call). Throws on timeout.
Bindings: `pi.on('session_start')` → `createAndSet()`.
_Avoid_: session manager, session handler

**WriteService** *(implemented — `domain/services/write-service.ts`)*:
Thin service wrapping the `FsStore` port for content mutations. Three methods: `save(uri, content, mode?, signal?)` → `fsStore.write()`, `mkdir(uri, signal?)` → `fsStore.mkdir()`, `mv(from, to, signal?)` → `fsStore.mv()`. Constructor takes `FsStore`. Accepts raw string URIs, wraps them in `Uri` value objects internally. 4 tests. Born in F5.2 (issue #69).
_Avoid_: write handler, persistence service

**ReadService** *(implemented — `domain/services/read-service.ts`)*:
Thin service wrapping the `FsStore` port for content reads. Single method: `read(uri, level?, offset?, limit?, signal?)` → `fsStore.read()`. Constructor takes `FsStore`. Accepts raw string URIs, wraps them in `Uri` value objects internally. 3 tests. Born in F5.2 (issue #69).
_Avoid_: read handler, content reader

**FsService** *(implemented — `domain/services/fs-service.ts`)*:
Thin service wrapping the `FsStore` port for filesystem navigation and management. 5 methods: `list(uri, recursive?, signal?)` → `fsStore.list()`; `tree(uri, signal?)` → `fsStore.tree()`; `stat(uri, signal?)` → `fsStore.stat()`; `delete(uri, recursive?, signal?)` → `fsStore.delete()`; `reindex(uri, mode?, signal?)` → `fsStore.reindex()`. Constructor takes `FsStore`. Accepts raw string URIs, wraps them in `Uri` value objects internally. Following the same thin-service pattern as `ReadService`/`WriteService`. 12 tests.
_Avoid_: fs handler, fs service

**SearchService** *(implemented — `domain/services/search-service.ts`)*:
Thin application service delegating to the `KnowledgeBase` port. Three methods: `search(params, signal?)` routes `mode` param (`fast` → `kb.find()`, `deep` → `kb.search()`, `auto` → `RecallConfig.searchMode`); `glob(pattern, uri?, limit?, signal?)` delegates directly; `grep(pattern, opts?, signal?)` delegates directly. Constructor takes `KnowledgeBase`, `RecallConfig`, `Logger`. 7 tests. Registered as singleton in lifecycle.

**F4 scope (revised)**: Domain logic only (scorers, ~~IntentDetector~~, RecallCurator) + RecallService + SessionService + RecallConfig in schema + lifecycle wiring. IntentDetector eliminated — recall is a toggle command. Lifecycle wiring in `init()` creates and registers RecallCurator (with scorers), SessionService (wired to SessionStore), RecallService (wired to KB + curator, enabled=true), SearchService (wired to KB + config). WriteService born in F5.2 when ov_write tool needs it.

### Tools (F5.1 — first vertical slice)

**ov_search** *(implemented — `adapters/driver/pi-tools/ov-search.ts`)*:
Pi tool registered via `pi.registerTool()`. TypeBox schema: `{ query: string, mode?: "auto"|"fast"|"deep", limit?: number, targetUri?: string }`. Handler calls `pipeline.execute(() => searchService.search(params), signal)`. Returns JSON-formatted `SearchResult`. Error message on failure. 3 unit tests + 2 integration tests.

**ov_glob** *(implemented — `adapters/driver/pi-tools/ov-glob.ts`)*:
Pi tool for URI pattern discovery. Schema: `{ pattern: string, uri?: string, limit?: number }`. Handler wraps `searchService.glob()` via pipeline. Returns `GlobResult` as JSON. 2 unit tests + 1 integration test.

**ov_grep** *(implemented — `adapters/driver/pi-tools/ov-grep.ts`)*:
Pi tool for content regex search. Schema: `{ pattern: string, uri?: string, caseInsensitive?: boolean, levelLimit?: number, nodeLimit?: number }`. Handler wraps `searchService.grep()` via pipeline. Returns `GrepResult` as JSON. 2 unit tests + 1 integration test.



**ov_write** *(implemented — `adapters/driver/pi-tools/ov-write.ts`)*:
Pi tool for content mutations. Single tool with `action` enum to minimize prompt surface area. TypeBox schema: `{ action: "save"|"mkdir"|"mv", uri: string, content?: string, targetUri?: string, mode?: "replace"|"append"|"create" }`. Handler routes action to `WriteService` method via `pipeline.execute()`. Returns JSON result or error. 6 unit tests + 3 integration tests. Born in F5.2 (issue #69).

**ov_read** *(implemented — `adapters/driver/pi-tools/ov-read.ts`)*:
Pi tool for reading content at three depth levels. TypeBox schema: `{ uri: string, level?: "abstract"|"overview"|"read", offset?: number, limit?: number }`. Handler wraps `ReadService.read()` via pipeline. Returns raw `body` string (not JSON) for direct consumption. 4 unit tests + 1 integration test. Born in F5.2 (issue #69).

**ov_recall** *(implemented — `adapters/driver/pi-tools/ov-recall.ts`)*:
Pi tool for explicit recall trigger. TypeBox schema: `{ prompt: string, limit?: number }`. Handler calls `pipeline.execute(() => recallService.recall(params.prompt), signal)`. Returns `RecallResult.formatted` text (items with URI + content). On empty result, returns informative message. Errors caught and reported. 4 unit tests + 1 integration test. Born in F5.3 (issue #70).

**ov_list** *(implemented — `adapters/driver/pi-tools/ov-list.ts`)*:
Pi tool for flat directory listing. TypeBox schema: `{ uri: string, recursive?: boolean }`. Handler wraps `FsService.list()` via pipeline. Returns JSON array of `FsEntry` (uri, type, size?, modTime?). No formatting — raw data for agent programmatic use.

**ov_tree** *(implemented — `adapters/driver/pi-tools/ov-tree.ts`)*:
Pi tool for recursive tree listing. TypeBox schema: `{ uri: string }`. Handler wraps `FsService.tree()` via pipeline. Returns JSON array of `FsEntry` (uri, type). Raw data, no indentation — agent parses paths to infer hierarchy.

**ov_stat** *(implemented — `adapters/driver/pi-tools/ov-stat.ts`)*:
Pi tool for URI metadata. TypeBox schema: `{ uri: string }`. Handler wraps `FsService.stat()` via pipeline. Returns single `FsEntry` as JSON object (uri, type, size?, modTime?).

**ov_delete** *(implemented — `adapters/driver/pi-tools/ov-delete.ts`)*:
Pi tool for resource deletion. TypeBox schema: `{ uri: string, recursive?: boolean }`. Handler wraps `FsService.delete()` via pipeline. No confirmation — agent owns its tool calls. Returns success/error message. No glob support — agent composes with `ov_glob` for batch delete. Contrasts with `/ov-delete` command which shows `ctx.ui.confirm()`.
_Avoid_: ov_delete with glob, delete with confirmation

**ov_resource** *(implemented — `adapters/driver/pi-tools/ov-resource.ts`)*:
Pi tool for saving resources. Validates URI prefix `viking://resources/`, delegates to `WriteService.save()`. TypeBox schema: `{ uri: string, content: string, mode?: "replace"|"append"|"create" }`. Returns JSON result. 6 unit tests.

**ov_skill** *(implemented — `adapters/driver/pi-tools/ov-skill.ts`)*:
Pi tool for saving skills. Validates URI prefix `viking://skills/`, delegates to `WriteService.save()`. TypeBox schema: `{ uri: string, content: string, mode?: "replace"|"append"|"create" }`. Returns JSON result. 4 unit tests.

**ResourceStore** *(port — `domain/ports/resource-store.ts`)*:
Port interface for importing external resources into OpenViking. Single method `importUrl(url, options?, signal?)` → `Promise<ResourceImportResult>`. Options: `targetUri` (custom `viking://` path), `reason` (import motivation), `wait` (block until server processing completes). Return type `ResourceImportResult` carries `status`, `rootUri`, `sourcePath`, optional `errors[]`.

**ResourceStoreAdapter** *(driven adapter — `adapters/driven/openviking/resource-store.ts`)*:
Implements `ResourceStore` port. `importUrl()` calls `POST /api/v1/resources` with `{ path, to?, reason?, wait? }`. Response parsed via `toResourceImportResult()` in `mappers/resource-mapper.ts`. 11 unit tests.

**ResourceService** *(implemented — `domain/services/resource-service.ts`)*:
Thin domain service wrapping `ResourceStore` port. Single method `importUrl(url, options?, signal?)` delegates to store. 4 tests. Registered as singleton in DI.

**ov_import** *(implemented — `adapters/driver/pi-tools/ov-import.ts`)*:
Pi tool for importing external URLs as OV resources. TypeBox schema: `{ url: string, targetUri?: string, reason?: string, wait?: boolean }`. Handler calls `ResourceService.importUrl()` via pipeline. Returns JSON with `status`, `rootUri`, `sourcePath`. OV server-side parses Markdown, PDF, HTML, Word, images, and more. 6 unit tests.
_Avoid_: add_resource, import tool

**Tool factory pattern**: Each tool is a `create*Tool(svc, pipeline)` function returning `ToolDefinition` via `defineTool()`. `index.ts` wires typed pipelines with `LoggingMiddleware` and passes both service and pipeline to each factory. Write/Read tools follow same pattern — `Pipeline<unknown>` for writes (varied return types), `Pipeline<Content>` for reads.

### GraphExpander (F8.2)

**GraphExpander** (optional class):
Injected into `RecallCurator`. Expands recall results by traversing OV relations (`GET /api/v1/relations?uri=`). Reads each relation's abstract (`kb.read(uri, "abstract")`). Results marked `source: "graph"`, score = seed.score × 0.8. Merged into custom message `memory_context` under `[graph]` section.

**Config fields** (in `RecallConfigSchema`):
- `expandGraph` (boolean, default true) — enable expansion
- `expandGraphDepth` (literal 1, default 1) — only direct neighbors in F8
- `expandGraphMaxRatio` (number 0-1, default 0.2) — max additional tokens as fraction of original budget
- `expandGraphMinSeedScore` (number 0-1, default 0.4) — only expand from seeds above this score

**Constraints:**
- Depth = 1 only (no BFS). Relations read in parallel via `Promise.all`.
- Relation already present as seed → skip (no duplicate).
- Budget guard: if insufficient tokens for all relations' abstracts, prioritize those with longer `reason` strings.

### Commands (F5.4 — slash commands)

**Command factory pattern**: Each command is a `create*Command(svc, ...)` function returning an options object compatible with `pi.registerCommand()`. The barrel export `command-registry.ts` provides `registerAllCommands(pi, services)` that registers all 9 commands in one call. Commands bypass the middleware pipeline and call services directly. All commands live in `adapters/driver/pi-commands/`. 34 unit tests total.

**`/ov-recall on|off`** *(implemented — `adapters/driver/pi-commands/ov-recall-command.ts`)*:
Toggles `RecallService.setEnabled()`. Validates arg is `on` or `off`, shows usage on invalid input. Provides argument completions (`on`, `off`). Notifies user of new state. 6 tests.

**`/ov-status`** *(implemented — `adapters/driver/pi-commands/ov-status-command.ts`)*:
Reads current state from `config.ov.endpoint`, `sessionService.getActive()`, `recallService.isEnabled()`, `config.recall.targetUri`, and `config.recall.searchMode`. Formats and displays via `ctx.ui.notify()`. Shows `"(global)"` when no target URI set. Shows `"none"` when no active session. 2 tests.

**`/ov-tree [uri]`** *(implemented — `adapters/driver/pi-commands/ov-tree-command.ts`)*:
Calls `fsStore.tree(parsedUri)` with parsed `Uri` value object. Defaults to `viking://` when no URI provided. Formats result as indented tree with 📁 (directory) and 📄 (file) icons. Computes relative paths via common prefix. Shows `"(empty)"` for empty result. Validates URI, shows error on failure. 5 tests.

**`/ov-commit [--wait]`** *(implemented — `adapters/driver/pi-commands/ov-commit-command.ts`)*:
Calls `sessionService.commit(activeSessionId)`. Shows warning if no active session. When `--wait` flag passed and `taskId` returned, calls `sessionService.waitForCommit(taskId)` and shows task status (completed/failed). 5 tests.

**`/ov-search <query>`** *(implemented — `adapters/driver/pi-commands/ov-search-command.ts`)*:
Calls `searchService.search({ query, mode: "fast" })`. Formats results as readable lines with URI, score (3 decimal places), and abstract. Shows memories, resources, and skills sections. Shows `"No results found."` for empty results. Shows usage on empty query. 6 tests.

**`/ov-delete <uri>`** *(implemented — `adapters/driver/pi-commands/ov-delete-command.ts`)*:
Shows `ctx.ui.confirm()` confirmation dialog before calling `fsStore.delete(parsedUri)`. Validates URI. Cancels gracefully on user rejection. Shows error on failure. 5 tests.

**`/ov-reindex <uri> [--mode vectors_only|full]`** *(implemented — `adapters/driver/pi-commands/ov-reindex-command.ts`)*:
Calls `fsStore.reindex(parsedUri, mode)`. Rebuilds vector embeddings for a URI (default `vectors_only`). Validates URI, shows error on failure. 5 tests.

### OVWidget (F5.5)

**OVWidget** *(implemented — `adapters/driver/ov-widget.ts`)*:
A class that renders an OV status widget via `ctx.ui.setWidget("ov", ...)`. Compact 2-line format with icons:
- Line 1: connection status (🟢/🔴), recall toggle (🔵/⚪ recall:on/off), target scope
- Line 2: session ID

The widget exposes `attach(ui)` (binds to a UI context and renders immediately), `update(field, value)` (changes state and re-renders), and `render()` (returns string[]). Commands that modify state (`/ov-recall`, `/ov-commit`) call `widget.update()` via a `widgetUpdater` callback passed through `CommandServices`. 5 unit tests.

**Guard pattern** in `index.ts`:
An `initialized` flag ensures `init()` runs once per process.

**On first `session_start`:**
- Guard runs `init()`, resolves services from DI container
- Calls `registerAllTools()` and `registerAllCommands()`
- Creates the shared `OVWidget`
- Registers 4 F6 lifecycle hooks (`before_agent_start`, `message_end`, `session_shutdown`, `session_start` health check)

**On every `session_start`** (including fork/resume/reload):
- Widget attached to current UI context
- Health check via `GET /ready` → updates widget connection status
- OV session created via `SessionService.createAndSet()`
- If OV is unavailable, widget shows `🔴 disconnected`, operation continues gracefully

**Tool barrel** (`adapters/driver/pi-tools/tool-registry.ts`): `registerAllTools(pi, services, logger)` creates typed Pipelines with LoggingMiddleware for each tool and registers all 12 in one call.

**F5 complete**: 12 tools (ov_search, ov_glob, ov_grep, ov_write, ov_read, ov_recall, ov_list, ov_tree, ov_stat, ov_delete, ov_resource, ov_skill) + 9 commands (ov-recall, ov-status, ov-tree, ov-commit, ov-search, ov-delete, ov-profile, ov-start, ov-reindex) + OVWidget. Status bar pending.

### F6 — Auto-Recall + Session Sync

**F6 hooks** (in `index.ts`, no `application/` layer):
4 Pi lifecycle hooks that wire the domain services to the agent lifecycle:

- **`before_agent_start`** → `RecallService.recall(prompt, sessionService.getActive())`. Returns custom message `{ customType: "memory_context", content: recallResult.formatted, display: false }`. GraphExpander results (F8+) merge into the same message with `[graph]` prefix. Circuit breaker OPEN → skip recall silently.
- **`message_end`** → `SessionService.sendMessage(sessionId, role, parts)` via MessageMapper. Syncs `user` and `assistant` messages: TextParts from text blocks, ToolParts from toolCalls (assistant) + toolResult messages (tool output + status). Tool calls preserved structurally — not flattened to text.
- **`session_shutdown`** → `SessionService.commit(activeSessionId)`. OV server extracts memories async (memory_diff.json).
- **`session_start`** → health check via `HealthCheck.check()` + widget update.

**MessageMapper** (`adapters/driver/pi-session-sync/message-mapper.ts`):
Pure function `agentMessageToParts(msg: AgentMessage): Part[]`. Converts Pi `AgentMessage` to domain `Part[]`: assistant content blocks → TextPart (text) + ToolPart (toolCall, toolStatus="pending"); toolResult messages → ToolPart (toolOutput, toolStatus="success"|"error"); user text → TextPart. Role `"user"` | `"assistant"` | `"toolResult"` supported.

## Flagged ambiguities

- **"Profile"** is overloaded three ways: (1) **Profile** — a named config preset in the Foundation layer; (2) **OV cProfile** — the server's own profiling mode; (3) **Memory Profile** — extracted user preferences from session memory. Use **Config Profile** for the Foundation concept, **OV cProfile** for the server concept, and **Memory Profile** for extracted preferences.
- **"ProfileBehavior"** is a subset of Profile that overrides `RecallConfig`. Not to be confused with **Memory Profile** (OV's memory category) or **Profile** (the named config itself).
- **"Auto-Recall"** refers to the F6 hook that calls `RecallService.recall()` automatically on `before_agent_start`. Not to be confused with **RecallService** (the domain service class, born in F4) or **RecallCurator** (the curation wrapper).
- **Uri** and **SessionId** live in a shared kernel (`domain/common/`), not inside any single bounded context. Every context imports from `common/`; no context imports from another context.
- **"Logger"** can refer either to the **Logger Interface** in `domain/ports/` or the **File Logger** implementation in `adapters/driven/`. Prefer the qualified name.
- **"Config"** without qualification refers to the plugin's configuration managed by the **Config Schema**. Not to be confused with Pi's own settings (`.pi/settings.json`) or OV's server configuration.
- **"application/"** layer is empty and will remain empty. Application services live in `domain/services/` (SessionService, SearchService, WriteService, ReadService). Middleware pipeline lives in `domain/pipeline/`. Lifecycle hooks live in `index.ts`. No F6 tasks create an `application/` directory.

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
