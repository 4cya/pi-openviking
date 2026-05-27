# ADR-008: Async init with sync shutdown

Bootstrap must eventually connect to OpenViking (Fase 3), which requires an HTTP handshake and health check — inherently async. Shutdown must be predictable: no I/O after shutdown completes.

`init()` is async — creates the logger, instantiates the DI container, registers all dependencies, and (in future phases) waits for OV health check. `shutdown()` is sync — resets internal state, zero I/O, cannot throw.

**Considered Options:**

- **Sync init** — forces blocking on OV connection, delaying Pi session start.
- **Deferred connect** — init sync, connect lazy; complicates lifecycle because every port call must handle "not yet connected."
- **Async init + sync shutdown (chosen)** — clear contract: init can fail gracefully (timeout), shutdown always succeeds.
