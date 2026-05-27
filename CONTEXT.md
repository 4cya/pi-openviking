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
_Avoid_: bootstrap lifecycle, module lifecycle

### Core Domain (future phases)

**KnowledgeItem**:
A unit of persistent knowledge stored in OpenViking. Can be a memory (extracted text with metadata) or a resource (document, file, reference). Has a Uri, content, and optional relations.

**Intent Detector**:
A Chain of Responsibility pipeline that classifies a user prompt to decide whether auto-recall should fire. Handlers: Continuation → ComplexQuery → SimpleQuery → LearnedRejection.

**Recall Curator**:
A pipeline that scores, ranks, deduplicates, and trims search results to fit a token budget. Operates post-search, locally.

**Graph Expander**:
Optionally traverses OV relations from seed KnowledgeItems to inject related resources into context.

**EventBus**:
An in-memory publish/subscribe mechanism that decouples reactions to domain events (SESSION_STARTED, MEMORY_SAVED, INTENT_DETECTED, etc.). Domain events are what cross bounded contexts; infra events stay local.

**Middleware Pipeline**:
A stack of cross-cutting concerns (Logging → Cache → Metrics) that wraps application service calls. Each middleware can inspect or short-circuit a request before reaching the handler.

### Shared Types (shared kernel)

**Part**:
A discriminated union (`TextPart | ToolPart | ContextPart`) that represents a piece of content in an OV session message.
Maps to OV v3 `part` types. Lives in `domain/common/part.ts`.

**SearchQuery**:
A data object with `query`, optional `limit`, `mode` (`auto` | `fast` | `deep`), `targetUri`, and `sessionId`.
Lives in `domain/common/search-query.ts`. Mode is resolved by the adapter (F3), not the domain.

**ContentLevel**:
A string literal union: `"abstract" | "overview" | "read"`. Controls response detail level for `FsStore.read()`.
Lives in `domain/common/content-level.ts`.

**WriteMode**:
A string literal union: `"replace" | "append" | "create"`. Controls overwrite behavior for `FsStore.write()`.
Lives in `domain/common/write-mode.ts`.

**SearchMode**:
A string literal union: `"auto" | "fast" | "deep"`. Used by `SearchQuery.mode` to hint search strategy.
Lives in `domain/common/search-query.ts`.

**EventBus** (synchronous):
An in-memory publish/subscribe mechanism for domain events (ADR-011). Dispatch is synchronous — handlers
run in the same tick. Errors are logged but never propagated (one handler failure does not break others).
Event log accumulated for debugging. Lives in `domain/ports/event-bus.ts` and `infrastructure/event-bus/in-memory.ts`.

**Curate Pipeline**:
A pure function: `(SearchResult, CurateOpts) => CuratedResult`. No side effects, no TokenBudget mutation.
Token count returned but not deducted — caller (`RecallService`, F4) manages budget.

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
Orchestrates IntentDetect → KnowledgeBase.search → Curator → GraphExpander → prompt injection. Receives profile config as injected `ResolvedConfig` — does not import ProfileManager.

**Session Service**:
Manages OV session lifecycle: create, send messages, commit.

**Write Service**:
Handles content persistence: save resources, create directories, link relations.

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
