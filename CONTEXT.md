# pi-openviking — Context

## Purpose

Pi extension that integrates OpenViking as a **long-term memory and resource backend** for coding agents. Not a generic OV client — a focused memory plugin.

Pi owns session history, prompt orchestration, and tool execution. OpenViking owns long-term memory retrieval, resource storage, and memory extraction.

## Core Glossary

| Term | Meaning |
|------|---------|
| **pi** | The coding agent harness (session manager, tools, prompt builder) |
| **OV** | OpenViking server — context database with filesystem paradigm |
| **auto-recall** | Before each agent turn, inject relevant memories into systemPrompt via `<relevant-memories>` block. Deep mode when OV session exists, fast mode otherwise. Token budget ~700 tokens. Configurable per project (`openVikingAutoRecall`). Uses **Recall Curator** for multi-factor ranking, dedup, and budget trimming. |
| **Session Sync** | One-to-one mapping between a pi session and an OV session. Lazily creates OV session, streams user/assistant text-only messages incrementally. |
| **memsearch** | Tool: semantic search across OV memories, resources, and skills. Returns raw JSON (`total`, `memories`, `resources`, `skills`, `query_plan`). Supports `mode` (auto/fast/deep). Auto mode uses `Search Mode Resolver`. |
| **memread** | Tool: read content at a viking:// URI (L0 abstract, L1 overview, L2 full). Auto-detects level from stat (dir → overview, file → read). |
| **membrowse** | Tool: list/tree/stat the viking:// filesystem. |
| **memcommit** | Tool: commit current session to OV, triggering memory extraction. Fire-and-forget (returns task_id). |
| **memimport** | Tool: import resource or skill into OV. Sources: URLs, local files, local directories (via temp_upload + zip). Optional `kind: "resource" \| "skill"`. Fire-and-forget. |
| **memdelete** | Tool: remove by viking:// URI. No search-then-delete. |
| **Operation** | Pure business-logic function in `src/operations/` that calls the Client Adapter and returns raw data. Operations: commit, import. Each written once — tools and commands are thin adapters that call the operation and format the result. Simple passthroughs (search, browse, read) call the Client Adapter directly — no operation wrapper needed. Delete uses `client.verifiedDelete()` which combines delete + post-verification search. |
| **Transport** | Low-level HTTP module for OpenViking. Handles fetch, timeout/abort merge, JSON envelope parsing, and `OpenVikingError` classification. Interface: `request(methodLabel, path, opts?, signal?)`. |
| **Client Adapter** | `createClient` (ov-client/client.ts) + modular operation factories: `createFsOps` (fs-ops.ts) for filesystem ops, `createSessionOps` (session-ops.ts) for session/commit ops. All share a `Transport` instance. Maps domain operations (`search`, `read`, `fsList`, `commit`, etc.) to HTTP calls. |
| **Search Mode Resolver** | `resolveSearchMode` — decides between `fast` and `deep` for auto mode. Deep if session exists, else deep if query is complex (`?`, length ≥ 80, wordCount ≥ 8), else fast. |
| **Tool Definition** | Reusable factory (`defineTool`) for registering OpenViking tools with pi. Handles metadata wiring, optional URI validation, error wrapping, and `ToolResult` assembly. Tool adapters call operations and format output for agent consumption (JSON). |
| **Command** | User-facing CLI adapter (`/ov-search`, `/ov-ls`, etc.). Parses CLI args via `parseArgs`, calls the corresponding operation, formats output for humans via `formatSearch`/`formatBrowse`, and sends via `pi.sendMessage`. |
| **Bootstrap** | `bootstrapExtension` — one-time setup per extension lifetime. Loads config, creates client and sessionSync, registers tools and commands, wires auto-recall. Returns `{ sessionSync }` for lifecycle delegation. |
| **Recall Curator** | `curate` — multi-factor ranking and dedup pipeline for search results. Takes raw `SearchResult` + query + options, produces `RecallItem[]`. Scoring: base + leaf boost (0.12) + temporal boost (0.10) + preference boost (0.08) + lexical overlap (max 0.20). Deduplicates by abstract for non-event categories, by URI for events/cases/resources. Prefers leaf items, truncates content, trims to token budget. Pure function — zero network calls, fully testable. |
| **Auto Recall Config** | `AutoRecallConfig` — structured config object with `{ enabled, limit, timeout, curator }`. Set via `loadAutoRecallConfig()` from `.pi/settings.json` or env vars. Defaults come from `DEFAULT_AUTO_RECALL_CONFIG` (which uses `DEFAULT_CURATE_OPTIONS`). |
| **Resource** | External knowledge (docs, code, URLs) stored under `viking://resources/` |
| **Skill** | Structured agent capability stored under `viking://agent/skills/` |
| **Memory** | Long-term knowledge extracted from sessions (profile, preferences, entities, events, cases, patterns) |
| **Resource Consumption Tracking** | Mechanism to inform OV which resources the agent consumed. Two channels: (1) `ContextPart` in assistant message `Part[]`, (2) `session_used()` HTTP call (`POST /api/v1/sessions/{id}/used`). Both send the same data — URIs + abstracts. Detection: **over-report** — all auto-recall injected items are marked as used (curated by Recall Curator already, score ≥ 0.15). No text scanning, no explicit tool. False positives (mild ranking inflation) cost less than false negatives (permanent ranking degradation). Timing: per assistant turn on `message_end`. Placement: inline in assistant message `Part[]` alongside TextPart/ToolParts. Scope: all types — memories, resources, skills. |

## Tool Surface

| Tool | Action | API Endpoints |
|------|--------|---------------|
| `memsearch` | Semantic search (fast/deep) with optional target_uri | `/api/v1/search/find`, `/api/v1/search/search` |
| `memread` | Read content at URI (L0/L1/L2) | `/api/v1/content/{abstract,overview,read}` |
| `membrowse` | ls, tree, stat | `/api/v1/fs/{ls,tree,stat}` |
| `memcommit` | Commit session, trigger memory extraction | `/api/v1/sessions/{id}/commit` |
| `memimport` | Import resource or skill (URL, file, dir) | `/api/v1/resources`, `/api/v1/skills`, `/api/v1/resources/temp_upload` |
| `memdelete` | Remove by URI | `DELETE /api/v1/fs` |

## Design Decisions

- **Operations layer** (`src/operations/`): business logic written once, called by both tools and commands. All six domain concepts have an Operation module. Deep operations contain multi-step logic: `commitOp` (flush + commit + polling loop + timeout) and `importOp` (source resolution + file/directory branching). Shallow operations are thin wrappers that call the Client Adapter and return raw data: `searchOp`, `browseOp`, `readOp`, `deleteOp`. Tools and commands are thin adapters that call an Operation and format output for their consumer (JSON for agent, text for human).
- Auto-recall and memsearch tool format search results differently **by design**: auto-recall produces compressed XML (`<relevant-memories>`) with dedup and token budget for system prompt injection; memsearch returns full JSON for agent reasoning. No shared formatter.

- Pi keeps its own session history. OV does **not** reassemble it (no `assemble()` / `compact()` pattern).
- Auto-recall runs on `before_agent_start` — searches OV with the user prompt, injects top results into systemPrompt with ~700 token budget.
- Auto-recall uses **deep** mode when OV session exists, **fast** when not.
- Auto-recall is **configurable per project** via `openVikingAutoRecall` setting (default true).
- Recall Curator options: `scoreThreshold` (0.15), `maxContentChars` (500), `preferAbstract` (true), `tokenBudget` (700) — configurable via settings/env vars.
- **Logging**: file-based via `appendFileSync` → `~/.pi/agent/pi-openviking.log` (or `OV_LOG_FILE` env). No `console.*` in `src/` — tests enforce this. (ADR-002)
- **Shutdown**: `onShutdown()` is synchronous, zero I/O — only resets state. Commit is manual-only via `/ov-commit` or `memcommit` tool. (ADR-001)
- **Commands surface**: 6 slash commands (`/ov-search`, `/ov-ls`, `/ov-import`, `/ov-delete`, `/ov-recall`, `/ov-commit`) — each calls the Client Adapter (or operation for commit/import) and formats output for humans.
- **Unified deps**: Tools use `ToolRegisterDeps`, commands use `CommandRegisterDeps`. Bootstrap wires both from shared `client` + `sessionSync` + `autoRecallState`.
- Session sync is incremental: each `message_end` sends enriched content to OV session — text, tool calls as `Part[]`, and truncated tool results with metadata prefix. (ADR-003)
- Tool calls + tool results are merged into a single `assistant` message via **buffer-and-merge** (ADR-006): assistant message with tool calls is buffered until matching `toolResult`(s) arrive (matched by tool call ID), then sent as one `sendMessage` with `Part[]` containing both call and result `ToolPart`s. No more `role: "toolResult"`. (ADR-003, ADR-006)
- Tool output truncation: 2000 chars (up from 500). When exceeded, `tool_output_truncated: true`. Full externalization via `tool_output_ref` deferred. (ADR-006)
- **Incomplete buffer flush**: quando nova assistant message chega enquanto buffer ainda tem tool calls pendentes (resultado não recebido), sintetiza `ToolPart(status: "error", output: "[interrompido]")` para calls pendentes, flusha mensagem inteira (resultados reais + sintéticos), então inicia novo buffer. Zero dados perdidos. `logger.warn` para observabilidade. (ADR-006)
- **Known limitation**: `onShutdown()` é sync zero-I/O (ADR-001) — não faz flush do buffer pendente. Se Pi encerra com tool calls em buffer, dados parciais são perdidos. Aceitável: shutdown é borda rara, commit é manual via `/ov-commit`, e Pi mantém sessão completa — dados podem ser re-sincronizados na próxima sessão.
- Async operations (commit, import) are fire-and-forget by default — return task_id. `memcommit` supports optional `wait: true` to poll `GET /api/v1/tasks/{task_id}` until completed/failed (timeout 15s).
- **Enriched Content Serialization** (`serializeContent`): replaces old `extractText`. All messages sent as `Part[]` — user and assistant alike. `sendMessage` narrowed to `content: Part[]` only (no string). Simplifies client (no type branching), consistency for OV memory extractor, future-proof for ContextPart. User messages → `Part[TextPart]`. Assistant messages (text + tool calls) → buffered whole, flushed as single `Part[TextPart, ToolPart, ...]` when results arrive. Thinking discarded. Truncation: 2000 chars. (ADR-003, ADR-006)
- **Health check with graceful degradation**: bootstrap probes `GET /health`. If unreachable, registers everything but disables auto-recall (`serverAvailable = false`). Recovery is on-demand — next auto-recall or tool call retries health check. Circuit breaker in session sync: 3 consecutive failures → stop trying until next recovery. (ADR-004)
- No reranking in plugin — trust OV's internal pipeline.
- No grep/glob search — semantic search covers coding agent use cases.
- **Peer dependency namespace**: `@earendil-works/pi-coding-agent`, `@earendil-works/pi-ai`, `@earendil-works/pi-tui` — canonical Pi namespace. Legacy `@mariozechner` references in package.json are incorrect and must be fixed.
- **Status line scope**: `ctx.ui.setStatus("ov-status", ...)` shows health + last recall count — e.g. `● OV · 3 recalled` or `○ OV`. Updated on health change and after each `before_agent_start`. Recall count is last-injected count, persists between turns until overwritten.
- **Tool rendering**: generic renderCall/renderResult for 4 tools (browse, commit, delete, import). Custom for memsearch (query + mode) and memread (URI + level). Collapsed: icon + count/status. Expanded: first 3-5 lines of formatted content. Renderers optional in ToolDef — omitted = generic fallback.
- **`/ov-setup` scope**: grouped wizard with 3 sections — (1) Connection: endpoint + apiKey (required), (2) Auto-recall: enabled/limit/token budget (defaults: true/10/700), (3) Log path (default: `~/.pi/agent/pi-openviking.log`). Transport timeout, health path, circuit breaker limits excluded — internal defaults suffice. Persisted to project scope (`{cwd}/.pi/settings.json`).
- **`memdelete` gate**: always block via `tool_call` event — `ctx.ui.confirm("Delete?", uri)` before execution. No config opt-out. Irreversible, no undo, no trash. `memimport` ungated — uploads are non-destructive.
- **Async factory**: convert `index.ts` factory to `async function`. `await healthChecker.check()` with 2s timeout. Blocks Pi startup briefly but guarantees status line shows correct state from first frame. On timeout — degraded mode, same as current fire-and-forget behavior.
- **Autocomplete**: fully recursive `viking://` URI completion via `addAutocompleteProvider`. Each path segment triggers `fsList` on prefix. Aggressive cache: 30s TTL per path, invalidated on `memimport`/`memdelete`. Only triggers when text contains `viking://` — no overhead on normal typing.
- **Adaptive recall**: stepped token budget via `ctx.getContextUsage()`. `<50%` context used → 1000 tokens. `50-80%` → 700 tokens. `>80%` → 300 tokens. No model contextWindow lookup needed — ratios only. Applied in Recall Curator before curation.
- **ADR governance**: new ADRs get `Status: accepted` header. Superseded ADRs get `Status: superseded` + reference to replacement. Existing 7 ADRs left untouched (implicitly accepted). No YAML frontmatter, no tooling.
- **Distribution**: git-only via `pi install git:github.com/dslara/pi-openviking`. No npm publish. Pre-alpha (`0.1.0`), no external users. Migrate to npm when API stabilizes and users exist.

## Audit Resolution (2026-05-23)

All P0/P1 items resolved. Remaining P2 gaps grilled and decided:

| Gap | Decision | Rationale |
|-----|----------|-----------|
| INC-4 (`fsStat` abstract) | **Wontfix** | OV `/api/v1/fs/stat` never returns `abstract`. `raw.name` is correct and best available. Type `OVStatResult` updated with real fields (`isLocked`, `count`). |
| GAP-5 (`query_plan`) | **Wontfix** | Already accessible in memsearch tool JSON output. No human-facing need in `/ov-search`. |
| GAP-2 (grep/lexical) | **Deferred** | Semantic search covers coding agent use case. No user request. |
| GAP-3 (watches) | **Deferred** | `memimport` manual covers common case. No user request. |
| GAP-4 (duration_ms/tokens) | **Deferred** | Requires events not available in plugin hooks. OV ignores null fields. |

## Deferred

- **Resource Consumption Tracking** — **Shipped (ADR-007)**. Over-report all auto-recall injected items via dual channel: ContextParts in assistant `Part[]` + `session_used()` per turn. Abstract cascade `abstract → overview → text`. Scope: memories + resources (skills deferred). Wiring: `autoRecall` returns `injectedItems`, stored in `AutoRecallState.lastInjectedItems`, consumed by `SessionSync` on assistant flush. Prototype files in `prototype/` deleted.
- **`duration_ms` / `prompt_tokens` / `completion_tokens`** — OV ToolPart fields for tool execution metrics. Currently always `null`. Could extract `duration_ms` by hooking `tool_execution_start`/`tool_execution_end` events (requires new event listener, not just `message_end`). Token counts require provider-level access (not available in plugin). Revisit if OV extractor starts using these fields for ranking or if observability becomes a priority.
- `grep`/`glob` search — can add if real need arises.
- Multi-namespace parallel search (user + agent memories) — single global search for now.

## Differences from OpenClaw Plugin

OpenViking ships an official OpenClaw (Claude) plugin. This table documents the architectural split:

| Feature | OpenClaw | pi-openviking | Rationale |
|---------|----------|---------------|----------|
| Session history source | OV reassembles via `assemble`/`compact` | Pi is source of truth | Pi already manages full history; no need to rebuild from OV |
| Auto-commit | Threshold-based, fires when session grows | Manual-only (`/ov-commit`, `memcommit`) | `onShutdown()` must be sync zero-I/O; explicit commit avoids data loss |
| Archive expansion | Reconstructs from compressed archives | Not needed | Pi keeps full branch history natively |
| Multi-agent header | `X-OpenViking-Agent` for routing | Not sent | Single-agent setup; no multi-agent routing |
| Multi-namespace search | Parallel search `user/` + `agent/` memories | Single global search | OV ranks across namespaces; separate searches add latency for marginal gain |
| Tool call sync | Preserves tool calls | Structured `Part[]` (ADR-003) | OV-native format; tool results prefixed with metadata |
| Reranking | Server-side via API | OV pipeline + local curator | No need for plugin-side reranking; curator handles dedup + budget |
| Session used tracking | `session.used()` | **Shipped (ADR-007)** | Dual channel: ContextPart + `session_used()` |

## Out of Scope (from OpenClaw plugin)

- `assemble()` history rebuild — pi manages its own history
- `compact()` synchronous commit + readback — pi uses manual memcommit
- `afterTurn()` auto-commit by token threshold — deferred to explicit user action
- VikingBot interaction endpoints
- WebDAV endpoints
- Admin/multi-tenant management

## Architecture Decision Records

- **ADR-001**: Commit exclusivamente manual via `/ov-commit` — auto-commit on shutdown removed (blocks Pi exit). `onShutdown()` is sync, zero I/O.
- **ADR-002**: Logging file-based — `appendFileSync` to log file. No `console.*` in src/.
- **ADR-003**: Enriched session sync — tool calls as structured `Part[]`, tool results truncated with metadata prefix, thinking discarded. Replaces text-only `extractText` with `serializeContent`.
- **ADR-004**: Health check com graceful degradation — bootstrap probes `/health`, disables auto-recall se server down, recovery on-demand, circuit breaker no session sync (3 falhas).
- **ADR-005**: Embedding `max_input_tokens: 7168` no `ov.conf` — OV trunca internamente antes de embeddar. Previne circuit breaker loop em Docker Model Runner (bge-m3, batch size 8192). Fix server-side only, zero código.
- **ADR-008**: Async factory with health check timeout — 2s await on startup guarantees status line state from first frame.
- **ADR-009**: Adaptive auto-recall budget — stepped thresholds via `getContextUsage()` instead of fixed 700 tokens.
