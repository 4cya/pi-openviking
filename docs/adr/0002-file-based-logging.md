# ADR-002: File-based logging with Logger interface + FileLogger rotation

Declare Logger as a port interface in `domain/ports/logger.ts` so domain code never depends on a concrete logging library. Implement it as FileLogger in `adapters/driven/logger/` using `appendFileSync` with rotation (10MB size, 7-day age, up to 5 gzipped historical files).

**Considered Options:**

- **Console-only logging** — loses persistence for post-mortem debugging.
- **Winston / Bunyan** — heavy external dependency that couples domain to infra.
- **Rotating-file-stream** — single-purpose dep that still needs a wrapping adapter.
- **appendFileSync + manual rotation (chosen)** — pure Node.js, zero deps, trivially testable. FileLogger is the adapter; the Logger interface keeps domain code clean.

**Consequences:** File I/O is synchronous (appendFileSync). Acceptable because logging is fire-and-forget and never on the hot path. If throughput becomes an issue, swap the implementation behind the Logger interface.
