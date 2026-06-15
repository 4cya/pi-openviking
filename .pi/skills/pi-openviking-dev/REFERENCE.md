# pi-openviking-dev Reference

## Project Docs (local)

| Doc | Path | What it covers |
|-----|------|----------------|
| CONTEXT.md | `./CONTEXT.md` | Glossary, design decisions, deferred items |
| UBIQUITOUS_LANGUAGE.md | `./UBIQUITOUS_LANGUAGE.md` | Domain language |
| Architecture | `./docs/01-ARQUITETURA.md` | Module layout, port/adapter diagram, endpoint table |
| ADR records | `./docs/adr/` | Key decisions (0001-0018) |

## OV Documentation (as OV resources)

All official OV docs are at `viking://resources/pi-openviking/docs-ov/`.

| Area | Resource URI |
|------|-------------|
| Concepts index | `viking://resources/pi-openviking/docs-ov/INDEX.md` |
| Version | `viking://resources/pi-openviking/docs-ov/version.md` |
| Concepts (13) | `viking://resources/pi-openviking/docs-ov/concepts/` |
| API reference (11) | `viking://resources/pi-openviking/docs-ov/api/` |
| Getting started (5) | `viking://resources/pi-openviking/docs-ov/getting-started/` |

Read a doc:
```
ov_read level=read uri=viking://resources/pi-openviking/docs-ov/api/05-sessions.md
```

Search across docs (use only when exact path unknown; `ov_search` may time out if VLM indexing incomplete):
```
ov_search query="ToolPart tool_output tool_status" source="docs-ov"
```

### Fallback: GitHub raw URLs

If OV docs at `viking://resources/pi-openviking/docs-ov/` are missing (step 0 check fails),
fetch directly from GitHub raw. Use `{DOC_SOURCE}` = `main` or release tag (v0.3.x):

```
Base: https://raw.githubusercontent.com/volcengine/OpenViking/{DOC_SOURCE}/docs/en/

Concepts:  {base}concepts/{NN-name}.md
  e.g. https://raw.githubusercontent.com/volcengine/OpenViking/main/docs/en/concepts/08-session.md

API:       {base}api/{NN-name}.md
  e.g. https://raw.githubusercontent.com/volcengine/OpenViking/main/docs/en/api/05-sessions.md

Getting started: {base}getting-started/{NN-name}.md
```

Fetch with `firecrawl_scrape` or `ctx_fetch_and_index`, then read locally.

## Pi Agent Documentation

Pi docs are at `/home/dani/.config/nvm/versions/node/v25.1.0/lib/node_modules/@earendil-works/pi-coding-agent/`.

| Doc | Path | When to read |
|-----|------|-------------|
| README.md | `<pi-dir>/README.md` | Project overview, extension model |
| Extensions | `<pi-dir>/docs/extensions.md` | **Always** — extension lifecycle, hooks, tool/command registration |
| SDK | `<pi-dir>/docs/sdk.md` | SDK types, interfaces for tools/commands |
| Prompt templates | `<pi-dir>/docs/prompt-templates.md` | Custom prompts |
| TUI | `<pi-dir>/docs/tui.md` | Widget API |
| Skills | `<pi-dir>/docs/skills.md` | Skill protocol |
| Examples | `<pi-dir>/examples/extensions/` | Reference extensions |

## Project Key Files

| Category | Files |
|----------|-------|
| **Bootstrap** | `src/infrastructure/lifecycle.ts` — DI container wiring, async init, sync shutdown |
| **Ports** | `src/domain/ports/` — interfaces (FsStore, SessionStore, KnowledgeBase, ResourceStore) |
| **Adapters** | `src/adapters/driven/openviking/` — OV HTTP implementation |
| **Driver** | `src/adapters/driver/pi-tools/` — agent-facing tools |
| **Driver** | `src/adapters/driver/pi-commands/` — user-facing slash commands |
| **Widget** | `src/adapters/driver/ov-widget.ts` — TUI status widget |
| **Services** | `src/domain/` — FsService, RecallService, SessionSync |
| **Auto-recall** | `src/domain/recall/` — recall pipeline, curator, memory injection |
| **Config** | `src/shared/config.ts` — config schema |
| **Mappers** | `src/adapters/driven/openviking/mappers/` — OV response → domain types |

## Testing

```bash
# Run all tests
npx vitest run

# Single file
npx vitest run src/adapters/driven/openviking/fs-store.test.ts

# Watch mode
npx vitest
```

- `vitest.config.ts` at root
- Tests co-located with implementation (`foo.test.ts` next to `foo.ts`)
- Integration tests use `pi-openviking-test` Docker container (port 1934)

## OV API Basics

- **Host**: `http://localhost:1933`
- **Headers**: `X-API-Key: dev`, `X-OpenViking-Account: default`, `X-OpenViking-User: <user>`, `X-OpenViking-Agent: pi`
- **Prefix**: `/api/v1/`
- **Health**: `GET /health` (returns `{"version":"v0.3.24"}` — no `healthy` field)
**Version check**: `GET /health` returns OV version. Plugin's `HealthCheck` uses `GET /ready` (no auth required) for daemon health.
- **Readiness**: `GET /ready` (returns checks: agfs, vectordb, api_key_manager, embedding)
- **Part types**: `text`, `tool` (with `tool_id`, `tool_name`, `tool_input`, `tool_output`, `tool_status`), `context` (with `uri`, `context_type`, `abstract`)
- **Message roles**: `user`, `assistant` only (no `toolResult`)

### ⚠️ OV v0.3.x Content Levels

Three official content endpoints:

| Level | OV endpoint | Works for |
|-------|-------------|-----------|
| `"read"` | `GET /api/v1/content/read?uri=X&offset=Y&limit=Z` | Files + directories |
| `"abstract"` | `GET /api/v1/content/abstract?uri=X` | Directories only (returns 412 on files) |
| `"overview"` | `GET /api/v1/content/overview?uri=X` | Directories only (returns 412 on files) |

Abstract/overview endpoints return 412 FAILED_PRECONDITION on files. FsStoreAdapter.read() propagates this error to caller — it does NOT silently return empty body.
Use search API for file-level abstract/overview.

### ⚠️ OV Response Envelope

Every endpoint wraps in `{"status":"ok"|"error", "result": ..., "error": {...}}`.
The Transport unwraps this automatically — adapters receive `result` directly. Errors carry `error.code` + `error.message`.

### ⚠️ `ctx_search` Throttle

- **ALWAYS batch queries**: `ctx_search(queries: [q1, q2, q3, q4, q5], limit: 3)` = 1 call
- Hard cap: 8 calls per window. After call #3, result limit drops.
- When you need multi-perspective search, compile all questions upfront.


