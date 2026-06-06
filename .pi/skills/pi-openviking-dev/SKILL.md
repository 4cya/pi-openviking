---
name: pi-openviking-dev
description: Develop features and improve code for pi-openviking plugin. Consults OV documentation from project resources before any implementation. Use when working in pi-openviking project, adding plugin features, refactoring, fixing bugs, or when user mentions "develop", "implement", "refactor", "add feature", "fix bug" in this repo.
---

# pi-openviking Plugin Development

Develop features and improve code for the pi-openviking plugin, following project architecture, OV API docs, and Pi extension best practices.

## Mandatory Pre-Flight

Before writing ANY code, always do this in order:

0. **Verify OV docs exist** — Check `viking://resources/pi-openviking/docs-ov/version.md` exists via `ov_stat`. If absent, OV docs not imported yet:
   - Suggest user run `ov-update` skill first (imports OV docs from GitHub)
   - Or fetch directly from GitHub raw as fallback:
     `firecrawl_scrape url="https://raw.githubusercontent.com/volcengine/OpenViking/{DOC_SOURCE}/docs/en/api/05-sessions.md"`
     where `{DOC_SOURCE}` is `main` or latest release tag
   - If docs present but `ov_search` times out, skip search — use direct `ov_read` instead

1. **Read OV docs** — REFERENCE.md lists exact URIs for each doc.

   ⚠️ **OV v0.3.x: content levels work via dotfiles**

   | Level | Works for | OV endpoint |
   |-------|-----------|-------------|
   | `level="read"` | Files + directories | `GET /api/v1/content/read?uri=X&offset=Y&limit=Z` |
   | `level="abstract"` | **Directories only** | `GET /api/v1/content/read?uri=X/.abstract.md` |
   | `level="overview"` | **Directories only** | `GET /api/v1/content/read?uri=X/.overview.md` |

   OV v0.3.24 does NOT have `/api/v1/content/abstract` or `/api/v1/content/overview` endpoints.
   Instead, L0 (abstract) and L1 (overview) are stored as dotfiles (`.abstract.md`, `.overview.md`)
   alongside directories. For files, `level="abstract"`/`"overview"` return body empty gracefully.

   **Preferred:** `ov_read level=read` with the known path (works everywhere).
   - API: `viking://resources/pi-openviking/docs-ov/api/{NN-name}.md`
   - Concepts: `viking://resources/pi-openviking/docs-ov/concepts/{NN-name}.md`
   - Only use `ov_search` when you don't know the exact doc path.
   - If `ov_search` fails/timeouts → fall back to listing the dir (`ov_list`) to find the right doc, then `ov_read` directly.
   - Match implementation to OV spec exactly (field names, endpoints, part types, headers).

   ⚠️ **Batch your `ctx_search` queries**
   - **ALWAYS batch ALL queries in ONE call** — `ctx_search(queries: [q1, q2, q3, q4, q5, q6, q7], limit: 3)` counts as 1 call.
   - Separate calls consume a throttle window (cap 8 calls). After call #3, results shrink (2/query); after #5, only 1/query.
   - Verify OV server version via `GET /health` → returns `{"version":"v0.3.24"}`.

2. **Read Pi extension docs** — See [REFERENCE.md](REFERENCE.md) for which Pi SDK/docs to consult. Check examples/ for existing plugin patterns.

3. **Read project docs** — `CONTEXT.md` (glossary, design decisions), `docs/01-ARQUITETURA.md` (architecture, port/adapter layout), `docs/adr/` (key decisions that constrain design).

## Workflows

### New Feature

1. Check OV docs (step 1-3 above) → confirm API contract exists
2. List the port interface change + adapter change + tool/command surface
3. Grill user with quick Qs: "interface shape? behaviors to test?"
4. TDD: one tracer bullet at a time (RED → GREEN → REFACTOR)
5. Register tool/command in barrel files
6. Run full test suite: `npx vitest run`
7. Update `CONTEXT.md`, `UBIQUITOUS_LANGUAGE.md`, and `docs/01-ARQUITETURA.md`

### Code Review / Refactor

1. Read the code in question + its tests
2. Check against OV docs — does it match the API shape?
3. Check against project patterns (ports/adapters, DI, error handling, logger)
4. Check test quality — behavior-focused, not implementation-coupled
5. Propose changes with edit boundaries clear

### Debug / Diagnose

1. Re-read the OV API doc for the failing endpoint
2. Check the adapter implementation (mappers, transport)
3. Check circuit breaker / health status
4. Run the specific test file: `npx vitest run path/to/test`

5. **Probe OV server directly with curl when adapter returns unexpected errors** —
   Use `curl -s -o /tmp/ov-out.txt -w "%{http_code}" -H "X-API-Key: dev" -H "X-OpenViking-Account: default" -H "X-OpenViking-User: default" "http://localhost:1933/api/v1/..."`,
   then inspect with `ctx_execute_file path=/tmp/ov-out.txt ...` to avoid flooding context.

## Architecture Constraints

- **Ports/Adapters**: Domain defines port interfaces. Adapters implement them. Drivers (Pi commands/tools) depend on ports only.
- **DI**: Manual DI container (`src/bootstrap.ts`). No framework. Add new deps there.
- **Mappers**: API responses → domain types via mapper functions. Each mapper type has own file.
- **Tests**: vitest. No mocks for domain services. Adapter tests use real HTTP against `pi-openviking-test` Docker container.
- **OV Resource paths**: Tools write to `viking://resources/pi-openviking/{feature}`. Skills at `viking://agent/{agent_id}/skills/`.

See [REFERENCE.md](REFERENCE.md) for Pi docs paths, OV resource URIs, and key file map.
