---
name: pi-openviking-dev
description: Develop features and improve code for pi-openviking plugin. Consults OV documentation from project resources before any implementation. Use when working in pi-openviking project, adding plugin features, refactoring, fixing bugs, or when user mentions "develop", "implement", "refactor", "add feature", "fix bug" in this repo.
---

# pi-openviking Plugin Development

Develop features and improve code for the pi-openviking plugin, following project architecture, OV API docs, and Pi extension best practices.

## Mandatory Pre-Flight

Before writing ANY code, always do this in order:

1. **Read OV docs** — Search `viking://resources/pi-openviking/docs-ov/` for the relevant API/concept using `ov_search`. Read full doc with `ov_read level=read`. Match implementation to OV spec exactly (field names, endpoints, part types, headers).

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

## Architecture Constraints

- **Ports/Adapters**: Domain defines port interfaces. Adapters implement them. Drivers (Pi commands/tools) depend on ports only.
- **DI**: Manual DI container (`src/bootstrap.ts`). No framework. Add new deps there.
- **Mappers**: API responses → domain types via mapper functions. Each mapper type has own file.
- **Tests**: vitest. No mocks for domain services. Adapter tests use real HTTP against `pi-openviking-test` Docker container.
- **OV Resource paths**: Tools write to `viking://resources/pi-openviking/{feature}`. Skills at `viking://agent/{agent_id}/skills/`.

See [REFERENCE.md](REFERENCE.md) for Pi docs paths, OV resource URIs, and key file map.
