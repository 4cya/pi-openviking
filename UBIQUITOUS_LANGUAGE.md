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
| **DI Container** | Manual dependency injection container (21 lines). Registers dependencies by `string` token; supports singleton and factory lifetime. Throws clear error on unregistered token. 4 tests at `container.test.ts` | container, ioc |
| **Lifecycle** | The `init()` (async, creates logger+container+wires everything) and `shutdown()` (sync, resets state) entry points for the Foundation layer | bootstrap lifecycle, module lifecycle |
| **Bootstrap** | One-time startup that runs **Config Cascade**, creates **Logger**, instantiates **DI Container**, registers all dependencies, and returns a ready extension handle | init, startup |

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
| **SessionStore** | Port for OV session lifecycle. Methods: `create`, `sendMessage`, `commit`, `getTaskStatus`, `sessionUsed`, `deleteSession`. Lives in `domain/ports/session-store.ts` | session manager |
| **CacheStore** | Port for caching repeated operations. Methods: `get`, `set`, `invalidate`. Lives in `domain/ports/cache-store.ts` | cache, data store |
| **EventBus** | Port for synchronous domain event dispatch (ADR-011). Methods: `publish`, `subscribe` (returns unsubscribe). Handlers run in the same tick; errors logged but never propagated. Lives in `domain/ports/event-bus.ts` | message bus, event emitter |
| **DomainEvent** | Discriminated union of 5 event types: MEMORY_SAVED, RELATION_LINKED, INTENT_DETECTED, RECALL_EXECUTED, BUDGET_EXCEEDED. No PROFILE_CHANGED or ERROR (infra events stay out). Defined in `domain/ports/event-bus.ts` | event, notification |
| **Logger** | Port for structured logging. Methods: `info`, `warn`, `error`, `debug`, `isEnabled`. Lives in `domain/ports/logger.ts` | log, console |

## Runtime Implementations

| Term | Definition | Aliases to avoid |
| ---- | ---------- | ---------------- |
| **InMemoryEventBus** | Synchronous in-memory EventBus implementation. Handlers execute in same tick as `publish()`. Error isolation: one handler throw does not break others. `subscribe()` returns unsubscribe. Event log accumulates published events (`getLog()`, `clearLog()`). Lives in `src/infrastructure/event-bus/in-memory.ts` | event bus, sync bus |
| **Curate Pipeline** | Pure function `curate(SearchResult, CurateOpts): CuratedResult`. Steps: merge (memories + resources → CuratedItem[]), dedup, score-sort, apply scorers (optional, sum per item, re-sort), threshold filter + topN, trim-to-budget (~130 overhead + ~60 per-item token accounting). `estimateTokens(text): number` helper. Does NOT mutate TokenBudget — caller manages allocation. Lives in `src/domain/recall/curate.ts` | curation, curator |
| **Scorer** | Type alias `(item: CuratedItem, query: string) => number`. Scorers refine base scoring — summed per item after initial sort, then re-sorted. Lives in `src/domain/recall/curate.ts`. | scoring function |
| **relevanceScorer** | Built-in scorer: keyword overlap between query tokens and item text+uri, case-insensitive. Returns `(hits/terms) * 0.5`. Max contribution +0.5. | keyword scorer |
| **temporalScorer** | Built-in scorer: exponential decay on `CuratedItem.modTime`. Formula `0.5 * exp(-daysAgo / 7)`. Half-life 7 days, max +0.5. Returns 0 if no modTime. | recency scorer |
| **CuratedItem** | Interface: `{ uri, text, score, source: "memory" \| "resource", category?, modTime? }`. `modTime` plumbed from `KnowledgeItem.modTime` during merge. Produced by curation pipeline. | curated result |
| **CurateOpts** | Interface: `{ topN, scoreThreshold, maxTokens, scorers?, query? }`. `scorers`: optional `Scorer[]`. `query`: string passed to scorers. Both optional — backward-compatible. | curation options, opts |
| **CuratedResult** | Interface: `{ items: CuratedItem[], tokens: number, dropped: number }`. Output of curation. | curation output |
| **OVAdapterConfig** | Zod sub-schema in `ConfigSchema.ov` (field `ov`). Defines server connection: `endpoint`, `apiKey`, `account`, `user`, `timeout`, `commitTimeout`, `maxRetries`. Defaults: endpoint=`http://localhost:1933`, timeout=30s, maxRetries=3. Lives in `infrastructure/config/schema.ts`. | ov config, transport config |
| **RecallConfig** | Zod sub-schema in `ConfigSchema.recall` (field `recall`). 5 fields: `targetUri` (string?, undefined=global), `topN` (int, default 5), `scoreThreshold` (0-1, default 0.5), `expandGraph` (bool, default false), `searchMode` (`find`\|`search`, default `find`). Env vars: `OV_TOP_N`, `OV_SCORE_THRESHOLD`, `OV_TARGET_URI`, `OV_EXPAND_GRAPH`, `OV_SEARCH_MODE`. Lives in `infrastructure/config/schema.ts`. | recall config, recall options |
| **Transport** | HTTP client class in `adapters/driven/openviking/transport.ts`. Wraps native `fetch()` with auth headers, exp-backoff retry (5xx/network), timeout, AbortSignal passthrough. Single method `request<T>(methodLabel, path, opts?, signal?)`. 13 tests. | http client, fetcher |
| **ErrorMapper** | Pure function `toDomainError(httpStatus, body, methodLabel): DomainError` in `adapters/driven/openviking/mappers/error-mapper.ts`. Maps: 401/403→ConnectionError, 404→NotFoundError, 409/422→ValidationError, 5xx→ConnectionError. 11 tests. | error translator, http error handler |
| **ContentMapper** | Pure function `toContent(raw, uri, level?): Content` in `adapters/driven/openviking/mappers/content-mapper.ts`. Converts OV content JSON to domain `Content` (Uri + body + level). Handles null body, extra fields. 8 tests. | content parser, response mapper |
| **FsStoreAdapter** | Full implementation of `FsStore` port in `adapters/driven/openviking/fs-store.ts`. read+write+list+tree+stat+mkdir+mv+delete implemented. `write()` uses `wait: true`. `delete()` auto-retries with `recursive=true`. 22 tests. | fs adapter, content adapter |
| **FsMapper** | Pure functions in `adapters/driven/openviking/mappers/fs-mapper.ts`: `toFsEntry(raw)` validates type and returns `FsEntry`; `toFsEntries(raw)` maps arrays, null-safe; `toWriteResult(raw, uri)` infers success from `success` flag or `status` field. 15 tests. | fs response mapper |
| **SearchMapper** | Pure functions in `adapters/driven/openviking/mappers/search-mapper.ts`: `toSearchResult(raw)` maps OV search response to domain `SearchResult`; `toGlobResult(raw)` maps glob; `toGrepResult(raw)` maps grep matches. All null-safe. 13 tests. | search parser, search response mapper |
| **KnowledgeBaseAdapter** | Implementation of `KnowledgeBase` port in `adapters/driven/openviking/knowledge-base.ts`. `find()`→`POST /search/find`, `search()`→`POST /search/search` c/ session_id, `glob()`→`POST /search/glob`, `grep()`→`POST /search/grep` c/ all filters. 13 tests. | kb adapter, search adapter |
| **SessionMapper** | Pure functions in `adapters/driven/openviking/mappers/session-mapper.ts`. `toSessionId(raw)` extracts session identifier; `toCommitResult(raw)` maps commit; `toTaskStatus(raw)` maps task status. Includes `serializePart`/`serializeParts` for camelCase→snake_case Part serialization. 15 tests. | session parser |
| **SessionStoreAdapter** | Full implementation of `SessionStore` port in `adapters/driven/openviking/session-store.ts`. All 8 methods: create, sendMessage, sendMessages, commit, getTaskStatus, listTasks, sessionUsed, deleteSession. 11 tests. | session adapter |
| **SessionService** | Stateful domain service in `domain/services/session-service.ts`. Owns the active OV session. Methods: `createAndSet()`, `getActive()`, `sendMessage()`, `commit()`, `waitForCommit()`, `deleteSession()`. Depends on `SessionStore` port + `SessionServiceConfig { commitTimeout, pollInterval? }`. `commit()` returns `{ taskId }` immediately. `waitForCommit()` polls `getTaskStatus()` at configurable interval until completed/failed or timeout. 9 tests. | session manager, session handler |
| **RelationMapper** | Pure functions in `adapters/driven/openviking/mappers/relation-mapper.ts`. `toLinkResult(raw, source, targets, reason?)` builds `LinkResult`; `toRelations(raw)` maps OV graph response (array or `{relations}` shape). 9 tests. | relation parser |
| **GraphStoreAdapter** | Implementation of `GraphStore` port in `adapters/driven/openviking/graph-store.ts`. `link()`→`POST /relations/link`, `unlink()`→`DELETE /relations/link`, `graph()`→`GET /relations?uri=`. 8 tests. | graph adapter |

## Example dialogue

> **Dev:** "How does **Config Cascade** work at startup?"
>
> **Domain expert:** "The **Bootstrap** resolves config in order: compiled defaults → env vars like `OV_LOG_LEVEL` → `.pi/settings.json` → active **Profile**. The **Config Schema** validates the final merged object with Zod. An invalid field like `level: "verbose"` throws a `ZodError` at bootstrap time, not silently at runtime."
>
> **Dev:** "So if I add a new config field, I only touch the **Config Schema**?"
>
> **Domain expert:** "The **Config Schema** is the single source of truth. Update the Zod definition, and the `PiOVConfig` type updates automatically via `z.infer`. The **DI Container** then resolves the validated config as a singleton — every module receives config through the container, not by importing it directly."
>
> **Dev:** "Can I swap the **File Logger** for a different implementation?"
>
> **Domain expert:** "Yes — that's the point of the **Port** interface. The domain code depends only on `Logger` (the interface). As long as the new implementation satisfies that contract, register it in the **DI Container** and the rest of the system doesn't change."
>
> **Dev:** "Where does rotation logic live?"
>
> **Domain expert:** "Inside the **File Logger** — behind the `Logger` interface. The domain layer has zero awareness of rotation, JSON format, or `appendFileSync`. That's what makes the architecture hexagonal: infrastructure details are sealed behind ports."

## Flagged ambiguities

- **"Profile"** is overloaded three ways: (1) **Profile** — a named config preset in the Foundation layer (default, web-dev, docs, learning), (2) OV's internal `cProfile` concept (the server's own profiling mode), (3) a memory category extracted from sessions ("category: profile"). Use **Config Profile** for the Foundation concept, **OV cProfile** for the server concept, and **Memory Profile** for extracted user preferences.
- **"Logger"** can refer either to the `Logger` interface in `domain/ports/` or the `FileLogger` implementation in `adapters/driven/`. Prefer **Logger Interface** vs **File Logger** when disambiguation matters.
- **"Config"** without qualification refers to the plugin's configuration managed by the **Config Schema**. Not to be confused with Pi's own settings (`.pi/settings.json`) or OV's server configuration.
