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

Read a doc:
```
ov_read level=read uri=viking://resources/pi-openviking/docs-ov/api/05-sessions.md
```

Search across docs:
```
ov_search query="ToolPart tool_output tool_status" source="docs-ov"
```

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
| **Bootstrap** | `src/bootstrap.ts` — DI container wiring |
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
- **Health**: `GET /health`
- **Part types**: `text`, `tool` (with `tool_id`, `tool_name`, `tool_input`, `tool_output`, `tool_status`), `context` (with `uri`, `context_type`, `abstract`)
- **Message roles**: `user`, `assistant` only (no `toolResult`)
