# F6 Prototype — Auto-Recall + Session Sync Hook Wiring

**Question:** Does the F6 hook wiring — auto-recall with circuit breaker protection,
session sync via message mapper, health check — handle all the edge cases correctly?

## Run

```bash
bun src/_prototype/terminal-tui.ts
```

## What it validates

| Component | Behavior | Edge cases |
|-----------|----------|------------|
| **Auto-recall** (`before_agent_start`) | Calls `RecallService.recall()` when toggle ON. Returns custom message. | Toggle OFF → skip. CB OPEN → skip. No session → skip. |
| **Circuit breaker** (decorator in Transport) | CLOSED → 3 fails → OPEN → 30s → HALF_OPEN → probe success = CLOSED, fail = OPEN (×2 timeout) | Threshold at 1/2/3. Timeout tick exact. Probe success vs failure. |
| **MessageMapper** | Extracts TextContent from user/assistant messages only | Tool/custom roles ignored. Empty content ignored. Image content ignored. |
| **HealthCheck** | `GET /ready` → widget. NOT driving CB. | OV unavailable → widget shows 🔴. Toggle mock health on/off. |

## Controls

| Key | Action |
|-----|--------|
| `r` | Toggle recall on/off |
| `e` | Fire `before_agent_start` (auto-recall) |
| `m` | Fire `message_end` (cycles user→assistant→tool) |
| `s` | Fire `session_shutdown` (commit) |
| `n` | Fire `session_start` (create session + health check) |
| `h` | Fire `health_check` (on-demand) |
| `H` | Toggle health mock (healthy ↔ unhealthy) |
| `f` | Simulate request failure (drives CB) |
| `x` | Simulate request success (resets CB fails / closes probe) |
| `t` | Tick clock +10s |
| `T` | Tick clock +30s |
| `R` | Reset all state |
| `q` | Quit |

## Expected flow to test

1. **`n`** → session_start creates session + runs health check
2. **`e`** → before_agent_start fires auto-recall (should inject 3 items)
3. **`m`** 3× → sync user msg, assistant msg, tool msg (tool = ignored)
4. **`f`** 3× → CB transitions CLOSED→OPEN after 3rd fail
5. **`e`** → recall skipped (CB OPEN)
6. **`t`** 4× → tick 40s → CB transitions OPEN→HALF_OPEN
7. **`x`** → probe succeeds → CB back to CLOSED
8. **`s`** → session_shutdown commits session

## What to lift into real codebase

- `f6-logic.ts`: `circuitBreakerReducer()` → `transport.ts`
- `f6-logic.ts`: `agentMessageToParts()` → `adapters/driver/pi-session-sync/message-mapper.ts`
- `f6-logic.ts`: F6 hook decision tree → `index.ts` comments/implementation
