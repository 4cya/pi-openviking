# ADR-016: Session context/archive/extract deferred — Pi is source of truth

Defer implementation of `GET /api/v1/sessions/{id}/context`, `GET /api/v1/sessions/{id}/archives/{archive_id}`, and `POST /api/v1/sessions/{id}/extract` until a concrete consumer exists. Do not implement for API parity alone.

## Context

OpenViking's HTTP API exposes three session endpoints that pi-openviking does not implement:

| Endpoint | Purpose |
|----------|---------|
| `GET /api/v1/sessions/{id}/context` | Return assembled session context (all messages + tool calls) |
| `GET /api/v1/sessions/{id}/archives/{archive_id}` | Return messages from a compressed session archive |
| `POST /api/v1/sessions/{id}/extract` | Extract memories without consuming/archiving the session |

These are not complex to implement — each is a single GET/POST with an existing response type. The question is who calls them.

The OpenClaw plugin uses `assemble()` (context engine hook) to reconstruct session context from OV for auto-recall. Pi has no such hook — Pi owns session history entirely (documented in ADR-012, CONTEXT.md).

## Decision

**Do not implement these endpoints.** Documentados como deferidos no código e neste ADR. Revisitar quando houver consumidor concreto.

## Rationale

1. **Pi is source of truth for conversation history.** Session context and archives are used when the agent runtime reconstructs past conversations from OV storage. Pi never does this — it maintains its own session.jsonl. Implementing would produce dead code.

2. **No consumer identified.** The grill session explored three scenarios (crash recovery, audit trail, incremental extraction). None has a concrete consumer in the current or planned Pi integration.

3. **YAGNI applies.** Each endpoint requires: interface declaration in `SessionStore` port, adapter implementation with test, and at least one test per endpoint. Without a consumer, this is speculative complexity.

4. **Easy to add later.** Each endpoint is a straightforward GET/POST with well-defined OV response schema. Adding them later when a consumer exists takes one commit per endpoint.

## Deferred for future review

If any of these conditions arise, revisit:

- **Pi adds a `resume_from_ov` feature** — recovering session state from OV after crash/migration
- **A tool is needed that requires session reconstruction** — e.g. `ov_session_log` for debugging
- **Auto-recall needs incremental extraction** — extracting memories during long sessions before final commit

## Consequences

- SessionStore port stayed at 8 methods when written; later expanded to 10 (`getSession`, `listSessions` added for session info tooling). The three deferred endpoints (context/archive/extract) remain unimplemented.
- No new endpoints exposed via tools or commands
- No test burden for speculative code
- OV API coverage documented in audit as "deferred"
