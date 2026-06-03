# Ubiquitous Language (expanded reference)

> Canonical glossary: [`CONTEXT.md`](./CONTEXT.md)
> This file is an expanded reference with additional detail and examples. Terms defined in CONTEXT.md are authoritative; this file supplements with deeper explanations.

> Glossário da arquitetura Reborn (Fase 1+). Termos legado em `src/_legacy/` foram omitidos — este documento reflete apenas o novo design hexagonal.

## Systems & Actors

| Term | Definition | Aliases to avoid |
| ---- | ---------- | ---------------- |
| **Pi** | The coding agent harness that owns session history, prompt orchestration, and tool execution | pi-coding-agent, harness |
| **OpenViking** | The long-term memory server providing semantic search, resource storage, and memory extraction | OV, the server |
| **Agent** | The LLM instance orchestrated by Pi that uses tools and produces responses | model, LLM |
| **Extension** | A Pi plugin that registers tools and hooks into session lifecycle events | plugin, add-on |

## Architecture Layers

| Term | Definition | Aliases to avoid |
| ---- | ---------- | ---------------- |
| **Domain** | The innermost layer containing enterprise logic and port interfaces. Zero external dependencies. Lives under `src/domain/` | core, business layer |
| **Port** | An interface declared in the domain layer that an adapter must implement. Examples: `Logger`, `KnowledgeBase`, `SessionStore` | contract, interface |
| **Adapter** | An implementation of a **Port**, living in `src/adapters/`. **Driven** adapters implement domain ports (e.g. `FileLogger`); **Driver** adapters call domain ports (not yet present in Fase 1) | implementation, plugin |
| **Infrastructure** | Cross-cutting concerns: config loading, DI container, lifecycle wiring. Lives under `src/infrastructure/` | framework, wiring layer |

## Foundation (Config & DI)

| Term | Definition | Aliases to avoid |
| ---- | ---------- | ---------------- |
| **Config Schema** | The Zod schema that defines, validates, and provides defaults for all plugin configuration | schema, config definition |
| **Config Cascade** | Config resolution order: compiled defaults → env vars (`OV_*`) → `.pi/settings.json` → active **Profile**. Each source overrides the previous via shallow merge | merge, resolution chain |
| **Profile** | A named config preset containing `name` and `description` in Fase 1 (no OV-specific fields until Fase 4). One is always active | config profile, named preset |
| **Built-in Profile** | One of 4 shipped profiles: `default`, `web-dev`, `docs`, `learning` | stock profile, system profile |
| **Logger** | Interface in `domain/ports/logger.ts` with methods `info`, `warn`, `error`, `debug`. Implemented by `FileLogger` in `adapters/driven/logger/` | log, console |
| **File Logger** | Outputs JSON lines via `appendFileSync`. Rotates by size (10MB) and age (7 days), keeps up to 5 gzipped historical files | file logging, persistent logger |
| **DI Container** | Manual dependency injection container (21 lines). Registers dependencies by `string` token; supports singleton and factory lifetime. Throws clear error on unregistered token. 10 registered singletons: config, logger, knowledgeBase, fsStore, graphStore, sessionStore (F1–F3), recallCurator, sessionService, recallService (F4). 4 tests at `container.test.ts` | container, ioc |
| **Lifecycle** | The `init()` (async, creates logger+container+wires everything) and `shutdown()` (sync, resets state) entry points for the Foundation layer. F4 wiring: creates RecallCurator (no scorers), SessionService (wired to SessionStore adapter), RecallService (wired to KB + curator, enabled=true). All registered as singletons. 16 smoke tests at `lifecycle.test.ts` | bootstrap lifecycle, module lifecycle |
| **Bootstrap** | One-time startup that runs **Config Cascade**, creates **Logger**, instantiates **DI Container**, registers all dependencies (15 singletons across F1–F7b), and returns a ready extension handle | init, startup |

## Relationships

- The **Config Cascade** resolves config in order: defaults → env vars → `.pi/settings.json` → active **Profile**
- A **Profile** is a named preset in the **Config Schema**'s `profiles` record; exactly one is selected via `activeProfile`
- The **DI Container** is created during **Bootstrap** after **Config Cascade** resolves the final config
- The **Logger** interface lives in `domain/ports/`; the **File Logger** implementation lives in `adapters/driven/logger/`
- The **File Logger** is registered in the **DI Container** as a singleton and consumed by all layers through its **Port** interface
- The **Config Schema** exports `PiOVConfig` type (inferred via `z.infer`) and `DEFAULT_CONFIG` constant — these are used by the **Config Cascade** as the base layer

## Shared Kernel (domain/common)

| Term | Definition | Aliases to avoid |
| ---- | ---------- | ---------------- |
| **Uri** | Value object class representing a `viking://` URI. Validates prefix in constructor, implements `.toString()` and `.equals()` (value comparison). Lives in `domain/common/uri.ts` | path, string identifier |
| **SessionId** | Opaque value object class for an OpenViking session. Guards against empty string, implements `.toString()`. Created by `SessionStore.create()`. Lives in `domain/common/session-id.ts` | session token, session key |
| **ContentLevel** | String literal union: `"abstract" \| "overview" \| "read"`. Used by `FsStore.read()` to control response detail. Lives in `domain/common/content-level.ts` | level, detail |
| **WriteMode** | String literal union: `"replace" \| "append" \| "create"`. Used by `FsStore.write()` to control overwrite behavior. Lives in `domain/common/write-mode.ts` | mode, write strategy |
| **SearchMode** | String literal union: `"auto" \| "fast" \| "deep"`. Used by `SearchQuery.mode`. Lives in `domain/common/search-query.ts` | mode |
| **SearchQuery** | Interface with required `query: string` and optional `limit`, `mode`, `targetUri`, `sessionId`. Data object, no methods. Lives in `domain/common/search-query.ts` | query, search params |
| **Part** | Discriminated union of `TextPart \| ToolPart \| ContextPart`. Represents a piece of content in an OV session message. Lives in `domain/common/part.ts` | message part, content part |
| **TextPart** | Interface `{ type: "text"; text: string }`. A plain text message part. | text segment |
| **ToolPart** | Interface `{ type: "tool"; toolId; toolName; toolInput; toolOutput; toolStatus; toolOutputTruncated; toolUri; skillUri; durationMs | null; promptTokens | null; completionTokens | null; toolOutputRef }`. A tool execution record. `toolStatus` is `string` (not enum) to support future OV values. | tool result |
| **ContextPart** | Interface `{ type: "context"; uri: string; contextType: "memory" \| "resource" \| "skill"; abstract: string }`. A referenced context item. | context reference |

## Domain Errors

| Term | Definition | Aliases to avoid |
| ---- | ---------- | ---------------- |
| **DomainError** | Base class extending `Error`. All domain-layer errors inherit from it. Sets `this.name = this.constructor.name` automatically. Lives in `domain/errors/domain-error.ts` | generic Error |
| **NotFoundError** | Extends `DomainError`. Represents a resource that does not exist. Lives in `domain/errors/not-found-error.ts` | 404, missing |
| **ConnectionError** | Extends `DomainError`. Represents a failure to connect to a remote service (e.g. OV unreachable). Lives in `domain/errors/connection-error.ts` | network error, timeout |
| **ValidationError** | Extends `DomainError`. Carries optional `details: Record<string, unknown>` for structured error info. Lives in `domain/errors/validation-error.ts` | invalid input, bad request |

## Domain Models

| Term | Definition | Aliases to avoid |
| ---- | ---------- | ---------------- |
| **KnowledgeItem** | Interface describing a unit of persistent knowledge in OV. Fields: `uri`, `text`, optional `abstract`, `overview`, `score`, `category`, `level`, `modTime`. Lives in `domain/knowledge/model/knowledge-item.ts` | memory, document |
| **ResourceItem** | Interface for an OV resource reference: `uri`, optional `score`, `abstract`. Lives in `domain/knowledge/model/resource-item.ts` | file, resource |
| **SkillItem** | Interface for an OV skill reference: `uri`, optional `score`, `abstract`. Lives in `domain/knowledge/model/skill-item.ts` | tool, skill |
| **SearchResult** | Interface grouping search output: `memories: KnowledgeItem[]`, `resources: ResourceItem[]`, `skills: SkillItem[]`, `total: number`, optional `queryPlan`. Lives in `domain/knowledge/model/search-result.ts` | search response |
| **Relation** | Interface for a graph edge: `uri`, optional `reason`. Lives in `domain/knowledge/model/relation.ts` | link, edge |
| **RecallItem** | Interface for a curated search result: `item: KnowledgeItem`, `score: number`, `source: "search" | "graph"`. Lives in `domain/recall/model/recall-item.ts` | curated item |
| **TokenBudget** | Class managing token limits for recall. Methods: `remaining()`, `tryAllocate()`, `reset()`. Does NOT throw on insufficient budget — returns false. Lives in `domain/recall/model/token-budget.ts` | budget, token limit |

## Port Interfaces (domain/ports/)

| Term | Definition | Aliases to avoid |
| ---- | ---------- | ---------------- |
| **KnowledgeBase** | Port for semantic and lexical search. Methods: `search(SearchQuery)`, `glob(pattern, uri?, limit?)`, `grep(pattern, opts?)`. Lives in `domain/ports/knowledge-base.ts` | search engine, KB |
| **FsStore** | Port for filesystem operations on OV virtual filesystem (merged with ContentStore). Methods: `read`, `write`, `list`, `tree`, `stat`, `mkdir`, `mv`, `delete`. No `reindex` (OV v3 has no such endpoint). No `wait` (synchronous wait is OV transport detail, resolved by adapter). Lives in `domain/ports/fs-store.ts` | content store, file system |
| **GraphStore** | Port for navigating relations. Methods: `link`, `unlink`, `graph`. Lives in `domain/ports/graph-store.ts` | relation store, graph db |
| **SessionStore** | Port for OV session lifecycle. Methods: `create`, `sendMessage`, `sendMessages`, `commit`, `getTaskStatus`, `listTasks`, `sessionUsed`, `deleteSession`. Lives in `domain/ports/session-store.ts` | session manager |
| **Logger** | Port for structured logging. Methods: `info`, `warn`, `error`, `debug`, `isEnabled`. Lives in `domain/ports/logger.ts` | log, console |

## Runtime Implementations

| Term | Definition | Aliases to avoid |
| ---- | ---------- | ---------------- |
| **Curate Pipeline** | Pure function `curate(SearchResult, CurateOpts): CuratedResult`. Steps: merge (memories + resources → CuratedItem[]), dedup, score-sort, apply scorers (optional, sum per item, re-sort), threshold filter + topN, trim-to-budget (~130 overhead + ~60 per-item token accounting). `estimateTokens(text): number` helper. Does NOT mutate TokenBudget — caller manages allocation. Lives in `src/domain/recall/curate.ts` | curation, curator |
| **RecallCurator** | Thin wrapper class over pure `curate()` in `src/domain/recall/recall-curator.ts`. Constructor: `(config: RecallConfig, scorers: Scorer[], logger: Logger)`. Method `curate(results: SearchResult): CuratedResult` reads `topN`, `scoreThreshold`, `maxTokens` from config, delegates to pure `curate()`, emits log line. Wired into **GraphExpander** via RecallService in F8. Wired in `init()` as singleton `recallCurator` with empty scorers (F4). 6 tests. | curator, curation wrapper |
| **Scorer** | Type alias `(item: CuratedItem, query: string) => number`. Scorers refine base scoring — summed per item after initial sort, then re-sorted. Lives in `src/domain/recall/curate.ts`. | scoring function |
| **relevanceScorer** | Built-in scorer: keyword overlap between query tokens and item text+uri, case-insensitive. Returns `(hits/terms) * 0.5`. Max contribution +0.5. | keyword scorer |
| **temporalScorer** | Built-in scorer: exponential decay on `CuratedItem.modTime`. Formula `0.5 * exp(-daysAgo / 7)`. Half-life 7 days, max +0.5. Returns 0 if no modTime. | recency scorer |
| **CuratedItem** | Interface: `{ uri, text, score, source: "memory" \| "resource", category?, modTime? }`. `modTime` plumbed from `KnowledgeItem.modTime` during merge. Produced by curation pipeline. | curated result |
| **CurateOpts** | Interface: `{ topN, scoreThreshold, maxTokens, scorers?, query? }`. `scorers`: optional `Scorer[]`. `query`: string passed to scorers. Both optional — backward-compatible. | curation options, opts |
| **CuratedResult** | Interface: `{ items: CuratedItem[], tokens: number, dropped: number }`. Output of curation. | curation output |
| **OVAdapterConfig** | Zod sub-schema in `ConfigSchema.ov` (field `ov`). Defines server connection: `endpoint`, `apiKey`, `account`, `user`, `timeout`, `commitTimeout`, `maxRetries`. Defaults: endpoint=`http://localhost:1933`, timeout=30s, maxRetries=3. Lives in `infrastructure/config/schema.ts`. | ov config, transport config |
| **RecallConfig** | Zod sub-schema in `ConfigSchema.recall` (field `recall`). 7 fields: `targetUri` (string?, undefined=global), `topN` (int, default 5), `scoreThreshold` (0-1, default 0.5), `maxTokens` (int, default 4000), `expandGraph` (bool, default true), `searchMode` (`find`\|`search`, default `search`), `autoRecall` (bool, default true). Env vars: `OV_TOP_N`, `OV_SCORE_THRESHOLD`, `OV_TARGET_URI`, `OV_EXPAND_GRAPH`, `OV_SEARCH_MODE`. Lives in `infrastructure/config/schema.ts`. | recall config, recall options |
| **Transport** | HTTP client class in `adapters/driven/openviking/transport.ts`. Wraps native `fetch()` with auth headers, exp-backoff retry (5xx/network), timeout, AbortSignal passthrough. Single method `request<T>(methodLabel, path, opts?, signal?)`. 13 tests. | http client, fetcher |
| **ErrorMapper** | Pure function `toDomainError(httpStatus, body, methodLabel): DomainError` in `adapters/driven/openviking/mappers/error-mapper.ts`. Maps: 401/403→ConnectionError, 404→NotFoundError, 409/422→ValidationError, 5xx→ConnectionError. 11 tests. | error translator, http error handler |
| **ContentMapper** | Pure function `toContent(raw, uri, level?): Content` in `adapters/driven/openviking/mappers/content-mapper.ts`. Converts OV content JSON to domain `Content` (Uri + body + level). Handles null body, extra fields. 8 tests. | content parser, response mapper |
| **FsStoreAdapter** | Full implementation of `FsStore` port in `adapters/driven/openviking/fs-store.ts`. read+write+list+tree+stat+mkdir+mv+delete implemented. `write()` uses `wait: true`. `delete()` auto-retries with `recursive=true`. 22 tests. | fs adapter, content adapter |
| **FsMapper** | Pure functions in `adapters/driven/openviking/mappers/fs-mapper.ts`: `toFsEntry(raw)` validates type and returns `FsEntry`; `toFsEntries(raw)` maps arrays, null-safe; `toWriteResult(raw, uri)` infers success from `success` flag or `status` field. 15 tests. | fs response mapper |
| **SearchMapper** | Pure functions in `adapters/driven/openviking/mappers/search-mapper.ts`: `toSearchResult(raw)` maps OV search response to domain `SearchResult`; `toGlobResult(raw)` maps glob; `toGrepResult(raw)` maps grep matches. All null-safe. 13 tests. | search parser, search response mapper |
| **KnowledgeBaseAdapter** | Implementation of `KnowledgeBase` port in `adapters/driven/openviking/knowledge-base.ts`. `find()`→`POST /search/find`, `search()`→`POST /search/search` c/ session_id, `glob()`→`POST /search/glob`, `grep()`→`POST /search/grep` c/ all filters. 13 tests. | kb adapter, search adapter |
| **SessionMapper** | Pure functions in `adapters/driven/openviking/mappers/session-mapper.ts`. `toSessionId(raw)` extracts session identifier; `toCommitResult(raw)` maps commit; `toTaskStatus(raw)` maps task status. Includes `serializePart`/`serializeParts` for camelCase→snake_case Part serialization. 15 tests. | session parser |
| **SessionStoreAdapter** | Full implementation of `SessionStore` port in `adapters/driven/openviking/session-store.ts`. All 8 methods: create, sendMessage, sendMessages, commit, getTaskStatus, listTasks, sessionUsed, deleteSession. 11 tests. | session adapter |
| **SessionService** | Stateful domain service in `domain/services/session-service.ts`. Owns the active OV session. Methods: `createAndSet()`, `getActive()`, `sendMessage()`, `commit()`, `waitForCommit()`, `deleteSession()`. Depends on `SessionStore` port + `SessionServiceConfig { commitTimeout, pollInterval? }`. `commit()` returns `{ taskId }` immediately. `waitForCommit()` polls `getTaskStatus()` at configurable interval until completed/failed or timeout. Wired in `init()` as singleton `sessionService` with `commitTimeout` from `config.ov.commitTimeout`. 9 tests. | session manager, session handler |
| **RelationMapper** | Pure functions in `adapters/driven/openviking/mappers/relation-mapper.ts`. `toLinkResult(raw, source, targets, reason?)` builds `LinkResult`; `toRelations(raw)` maps OV graph response (array or `{relations}` shape). 9 tests. | relation parser |
| **GraphStoreAdapter** | Implementation of `GraphStore` port in `adapters/driven/openviking/graph-store.ts`. `link()`→`POST /relations/link`, `unlink()`→`DELETE /relations/link`, `graph()`→`GET /relations?uri=`. 8 tests. | graph adapter |
| **RecallCurator** | Thin wrapper class over pure `curate()` function in `domain/recall/recall-curator.ts`. Constructor: `(config: RecallConfig, scorers: Scorer[], logger: Logger)`. Single method `curate(results: SearchResult): CuratedResult` reads opts from config, builds `CurateOpts`, delegates to pure `curate()`, emits log line. Wired into **GraphExpander** via RecallService in F8. 6 tests. | curator, curation wrapper |
| **GraphExpander** | Concrete class at `domain/recall/graph-expander.ts`. Enriches recall by reading relations + abstracts of top-scoring curated items. Config: `expandGraphMaxRatio` (default 0.2 of budget), `expandGraphMinSeedScore`. Seed selection: items with score ≥ threshold, top 3 by score. Fetches via parallel `graph()` on GraphStore + `read("abstract")` on FsStore. Drops seen URIs across seeds. Max 20% of original budget. Score decayed 0.8×. Items tagged with source `"graph"`. 3 unit + 1 integration test. | graph augmenter, relation expander |
| **Batch Message** | The `sendMessages(parts)` method on `SessionService` → `SessionStore.sendMessages()` → `POST /api/v1/sessions/{id}/messages/batch`. Sends multiple messages in one API call. Body format: `{ messages: [{ role, parts: [...] }] }` (parts replaces legacy content field). Used by F6 session sync for batch archival. | batch send, bulk message |
| **Command Factory Pattern** | Each slash command is a `create*Command(svc, ...)` function returning an options object compatible with `pi.registerCommand()`. Commands bypass the middleware pipeline and call services directly. Files live in `adapters/driver/pi-commands/`. Barrel export `command-registry.ts` provides `registerAllCommands(pi, services)`. 8 commands, 29+ tests. Born in F5.4 (issue #71). | command handler, command factory |
| **/ov-recall command** | Registered via `pi.registerCommand("ov-recall", ...)`. Toggles `RecallService.setEnabled()`. Validates `on|off` arg, provides completions. Lives in `adapters/driver/pi-commands/ov-recall-command.ts`. 6 tests. | recall toggle command |
| **/ov-status command** | Registered via `pi.registerCommand("ov-status", ...)`. Reads OV connection endpoint, active session, recall toggle state, target scope, and search mode from services. Displays via `ctx.ui.notify()`. Lives in `adapters/driver/pi-commands/ov-status-command.ts`. 2 tests. | status command |
| **/ov-tree command** | Registered via `pi.registerCommand("ov-tree", ...)`. Calls `fsStore.tree(parsedUri)`, defaults to `viking://`. Formats result as indented tree with directory/file icons. Lives in `adapters/driver/pi-commands/ov-tree-command.ts`. 5 tests. | tree command |
| **/ov-commit command** | Registered via `pi.registerCommand("ov-commit", ...)`. Calls `sessionService.commit()`. Optional `--wait` flag triggers `sessionService.waitForCommit()`. Shows warning if no active session. Lives in `adapters/driver/pi-commands/ov-commit-command.ts`. 5 tests. | commit command |
| **/ov-search command** | Registered via `pi.registerCommand("ov-search", ...)`. Calls `searchService.search()` in fast mode. Formats results as URI + score + abstract lines. Lives in `adapters/driver/pi-commands/ov-search-command.ts`. 6 tests. | search command |
| **/ov-delete command** | Registered via `pi.registerCommand("ov-delete", ...)`. Shows `ctx.ui.confirm()` before calling `fsStore.delete()`. Validates URI. Lives in `adapters/driver/pi-commands/ov-delete-command.ts`. 5 tests. | delete command |
| **/ov-start command** | Registered via `pi.registerCommand("ov-start", ...)`. Calls `sessionService.createAndSet()`. Notifies user of new session ID. Lives in `adapters/driver/pi-commands/ov-start-command.ts`. | start session command |
| **/ov-profile command** | Registered via `pi.registerCommand("ov-profile", ...)`. Manages profile lifecycle: `show` (active profile + behavior), `list` (all profiles, active marked), `apply <name>` (switch profile), `detect` (auto-detect from cwd). Uses `ProfileManager`. Lives in `adapters/driver/pi-commands/ov-profile-command.ts`. 13 tests. | profile command |
| **CircuitBreaker** | Pure reducer (`circuit-breaker.ts`) + Transport decorator. States: CLOSED → `threshold` (default 3) → OPEN (reject instantly with `ConnectionError`) → `resetTimeoutMs` (default 30s) → HALF_OPEN (probe) → success=CLOSED, failure=OPEN+×2. Driven by real failures (5xx/network/timeout), not health check. Config in `OVAdapterConfig.circuitBreaker? { threshold, resetTimeoutMs }`. Env vars: `OV_CIRCUIT_BREAKER_THRESHOLD`, `OV_CIRCUIT_BREAKER_RESET_TIMEOUT`. 8 reducer tests + 3 Transport integration tests. Issue #74. | cb, breaker |
| **HealthCheck** | Adapter at `adapters/driven/openviking/health.ts`. Probes `GET /ready` via direct `fetch()` (bypasses CircuitBreaker Transport). Method `check(): Promise<HealthStatus>` returns `{ ok, latencyMs?, error? }`. Feeds `OVWidget.update("conn", ...)`. Called on `session_start` and on-demand. Does NOT drive CircuitBreaker. 4 tests. | health probe, ping, liveness |
| **MessageMapper** | Pure function `agentMessageToParts(msg: { role, content? }): Part[]` at `adapters/driver/pi-session-sync/message-mapper.ts`. Converts Pi AgentMessage to domain TextPart[] for session sync. Only user/assistant text parts; ignores ImageContent, tool/custom/bash roles, empty/whitespace content. 9 tests. Issue #76. | message converter |
| **ProfileBehavior** | 6 optional behavioral fields on a Profile: `targetUri`, `topN`, `scoreThreshold`, `searchMode`, `expandGraph`, `autoRecall`. Override RecallConfig when profile active. Added in F7a. | behavioral fields, profile options |
| **ProfileManager** | Stateful service (F7a). Methods: `getActive()`, `resolve(name)`, `apply(name)`. Cascade merges `resolve()` as last override layer. `activeProfile` from config file; `/ov-profile` command in F7b. | profile resolver, profile handler |
| **AutoDetect** | Minimatch rules-based profile detection (F7b). `detect(cwd, rules): string | null`. Built-in rules map project patterns to profiles. Runs when `activeProfile = "auto". Regex-based glob matcher with globstar (`**`) support. No external dependencies. Lives in `domain/profile/service/auto-detect.ts`. | auto profile, profile detection |
| **Session Context** | Deferred concept (ADR-016). Three OV endpoints (`GET /sessions/{id}/context`, `GET /sessions/{id}/archives/{archive_id}`, `POST /sessions/{id}/extract`) deliberately NOT implemented. Pi is source of truth for conversation history — session context serves crash recovery/audit trail, none with concrete consumers. Easy to add later if Pi adds `resume_from_ov` feature. | session archive, session extract |
| **Auto-actions** | Eliminated concept (ADR-015). Originally proposed F8.1 with heuristic regex Analyzer + Proposer + Executor for auto-save. Rejected in favor of OV's native memory extraction (via commit) + explicit `ov_write` tool. OpenClaw pattern: commit → OV server extracts memories into categories. No Analyzer class, no autoSaveMode/autoLinkMode fields. | heuristic auto-save, auto-actions pipeline |

## Example dialogue

> **Dev:** "How does recall use the **GraphExpander**?"
>
> **Domain expert:** "When `expandGraph` is true in **RecallConfig** or the active **Profile**, the **RecallService** passes curated items to **GraphExpander**. It reads each seed's relations via **GraphStore** and fetches their abstracts. New items get score decayed 0.8× and are limited to 20% of the original token budget."
>
> **Dev:** "What happens if I change profiles mid-session?"
>
> **Domain expert:** "Run `/ov-profile apply web-dev` — the **ProfileManager** switches the active profile. The **AutoDetect** can also match your project directory against built-in glob rules. In F7a the merge happens once at init; in F7b the **ProfileManager** is injected into services for runtime mutation."
>
> **Dev:** "Does session sync use **Batch Messages**?"
>
> **Domain expert:** "Yes — the F6 hook calls `SessionService.sendMessages()` which batches multiple messages into one `POST /api/v1/sessions/{id}/messages/batch` call. The old per-message endpoint is still there for individual sends, but batch is preferred for archival efficiency."
>
> **Dev:** "What about auto-save? I saw F8.1 in the old plan."
>
> **Domain expert:** "Eliminated — see ADR-015. **Auto-actions** with heuristic regex patterns were too fragile and redundant with OV's native memory extraction. The pattern is: session commit triggers OV server extraction, and the agent uses explicit `ov_write` tools when it needs to save something. No Analyzer, no Proposer, no autoSaveMode."

## Flagged ambiguities

- **"Profile"** is overloaded three ways: (1) **Profile** — a named config preset in the Foundation layer (default, web-dev, docs, learning), (2) OV's internal `cProfile` concept (the server's own profiling mode), (3) a memory category extracted from sessions ("category: profile"). Use **Config Profile** for the Foundation concept, **OV cProfile** for the server concept, and **Memory Profile** for extracted user preferences.
- **"ProfileBehavior"** is a subset of Profile that overrides `RecallConfig`. Not to be confused with **Memory Profile** (OV's memory category) or **Profile** (the named config itself).
- **"Auto-Recall"** refers to the F6 hook that calls `RecallService.recall()` automatically on `before_agent_start`. Not to be confused with **RecallService** (the domain service class, born in F4) or **RecallCurator** (the curation wrapper).
- **"Logger"** can refer either to the `Logger` interface in `domain/ports/` or the `FileLogger` implementation in `adapters/driven/`. Prefer **Logger Interface** vs **File Logger** when disambiguation matters.
- **"Config"** without qualification refers to the plugin's configuration managed by the **Config Schema**. Not to be confused with Pi's own settings (`.pi/settings.json`) or OV's server configuration.
- **"application/"** layer is empty and will remain empty. Application services live in `domain/services/`. F6 hooks live in `index.ts`.
- **"sendMessages" vs "sendMessage"** — `sendMessages` (batch, plural) sends multiple messages in one API call via `POST /messages/batch`. `sendMessage` (singular) sends one at a time. Both exist on `SessionStore` port; `sendMessages` was added in F5 and is preferred for archival efficiency.
- **"expandGraph"** is both a `RecallConfig` field (boolean, default true) and a `ProfileBehavior` field (boolean override). Same concept — profile overrides config at merge time. No ambiguity between them, but be precise about which layer sets the value.
- **"Auto-actions"** was the eliminated F8.1 concept (heuristic regex auto-save). Not to be confused with **Auto-Recall** (F6 hook, still active) or **AutoDetect** (F7b, profile detection by path). Three different "auto" features, only two remain.
