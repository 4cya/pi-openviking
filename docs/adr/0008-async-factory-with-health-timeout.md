# Async factory with health check timeout

Status: accepted

Convert the extension factory from synchronous to `async function`. The factory `await`s the initial OpenViking health check with a 2-second timeout. This guarantees the status line shows the correct OV state (`● OV` or `○ OV`) from the first frame. Without this, the fire-and-forget health probe resolves asynchronously — the status line stays blank for the first turn.

On timeout, behavior is identical to the previous fire-and-forget approach: degraded mode, auto-recall disabled, recovery on next tool call or `before_agent_start`.

The trade-off is a 2-second delay on Pi startup when OV is unreachable. Acceptable because Pi is already loading extensions during this phase — the user sees no perceptible difference. The previous approach of a fire-and-forget probe meant the status line was unreliable on first render, which defeats its purpose.

**Considered options:**
- Sync factory + fire-and-forget (status quo) — status line blank on first frame
- Async factory + no timeout — blocks Pi indefinitely if OV hangs. Rejected.
- Async factory + 2s timeout — chosen. Brief, bounded delay, reliable first-frame state.
