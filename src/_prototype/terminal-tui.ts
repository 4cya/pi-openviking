// ── F6 Prototype — Terminal TUI ─────────────────────────────────────────────
// Thin shell over f6-logic.ts. Drives the state machine by hand.
// Run: bun src/_prototype/terminal-tui.ts
//
// This file IS throwaway. The real logic lives in f6-logic.ts (portable).

import {
  f6Reducer,
  createInitialState,
  computeWidgetState,
  type F6State,
  type F6Action,
} from "./f6-logic";

// ── ANSI helpers ────────────────────────────────────────────────────────────

const BOLD = "\x1b[1m";
const DIM = "\x1b[2m";
const GREEN = "\x1b[32m";
const YELLOW = "\x1b[33m";
const RED = "\x1b[31m";
const BLUE = "\x1b[34m";
const CYAN = "\x1b[36m";
const RESET = "\x1b[0m";
const CLEAR = "\x1b[2J\x1b[H";

// ── Rendering ───────────────────────────────────────────────────────────────

function fmtTime(ms: number): string {
  const secs = (ms / 1000).toFixed(1);
  return `${secs}s`;
}

function cbColor(status: string): string {
  switch (status) {
    case "CLOSED": return GREEN;
    case "OPEN": return RED;
    case "HALF_OPEN": return YELLOW;
    default: return RESET;
  }
}

function render(state: F6State): string {
  const lines: string[] = [];

  // ── Header ──
  lines.push(`${BOLD}╔══ F6 Prototype — Auto-Recall + Session Sync ══╗${RESET}`);
  lines.push(`${DIM}  Question: Does the hook wiring handle edge cases?${RESET}`);
  lines.push("");

  // ── Widget (top-right style status) ──
  const w = computeWidgetState(state);
  const connIcon = w.conn === "connected" ? "🟢" : w.conn === "disconnected" ? "🔴" : "⚫";
  const recallIcon = w.recall === "on" ? `${GREEN}🔵${RESET}` : `${DIM}⚪${RESET}`;
  lines.push(
    `${BOLD}Widget:${RESET} ${connIcon} ${w.conn}  ${recallIcon} recall:${w.recall}  ${DIM}session:${RESET} ${w.session}`,
  );
  lines.push("");

  // ── Recall toggle ──
  lines.push(
    `${BOLD}Recall:${RESET} ${state.recallEnabled ? `${GREEN}ON${RESET}` : `${DIM}OFF${RESET}`}`,
  );

  // ── Circuit breaker ──
  const cb = state.cb;
  const cbColorStr = cbColor(cb.status);
  lines.push(`${BOLD}Circuit Breaker:${RESET} ${cbColorStr}${cb.status}${RESET}`);
  lines.push(`  ${DIM}fails:${RESET} ${cb.consecutiveFails}/${cb.threshold}`);
  lines.push(`  ${DIM}resetTimeout:${RESET} ${(cb.resetTimeoutMs / 1000).toFixed(0)}s`);
  if (cb.status === "OPEN" && cb.openSince !== null) {
    const elapsed = state.simulatedClock - cb.openSince;
    const remaining = Math.max(0, cb.resetTimeoutMs - elapsed);
    lines.push(`  ${DIM}open for:${RESET} ${fmtTime(elapsed)}  ${DIM}remaining:${RESET} ${fmtTime(remaining)}`);
  }

  // ── Session ──
  lines.push(`${BOLD}Session:${RESET} ${state.sessionActive ? `${GREEN}active${RESET} (${state.sessionId})` : `${DIM}inactive${RESET}`}`);
  lines.push(`${BOLD}Health:${RESET} ${state.lastHealth?.ok ? `${GREEN}OK${RESET}` : `${RED}FAIL${RESET}`} ${state.healthMockOk ? `(mock: healthy)` : `(mock: unhealthy)`}  ${DIM}latency:${RESET} ${state.lastHealth?.latencyMs ?? "-"}ms`);

  // ── Clock ──
  lines.push(`${BOLD}Time:${RESET} ${fmtTime(state.simulatedClock)}`);
  lines.push("");

  // ── Last recall result ──
  const recall = state.lastRecallResult;
  if (recall) {
    if (recall.skipped) {
      lines.push(`${DIM}Last recall:${RESET} ${YELLOW}SKIPPED${RESET} — ${recall.skipReason}`);
    } else {
      lines.push(`${GREEN}Last recall:${RESET} ${recall.items} items, ${recall.tokens} tokens`);
    }
  }

  // ── Last error ──
  if (state.lastHookError) {
    lines.push(`${RED}Last error:${RESET} ${state.lastHookError}`);
  }

  // ── Hook firing history (last 10) ──
  const recent = state.hookFirings.slice(-10);
  if (recent.length > 0) {
    lines.push("");
    lines.push(`${BOLD}Recent hook firings:${RESET}`);
    for (const h of recent) {
      const timeStr = fmtTime(h.timestamp);
      const resultColor = h.result === "injected" || h.result === "synced" || h.result === "committed" || h.result === "healthy" || h.result === "session_created"
        ? GREEN
        : h.result === "skipped" || h.result === "ignored"
          ? DIM
          : h.result.startsWith("CB")
            ? CYAN
            : RESET;
      lines.push(`  ${DIM}${timeStr}${RESET} ${BOLD}${h.event}${RESET} → ${resultColor}${h.result}${RESET}  ${DIM}${h.details}${RESET}`);
    }
  }

  // ── Message log ──
  const lastMsg = state.messageLog.slice(-3);
  if (lastMsg.length > 0) {
    lines.push("");
    lines.push(`${BOLD}Last messages:${RESET}`);
    for (const m of lastMsg) {
      const syncIcon = m.synced ? `${GREEN}✓${RESET}` : `${DIM}✗${RESET}`;
      const preview = m.text.length > 40 ? m.text.substring(0, 40) + "..." : m.text;
      lines.push(`  #${m.id} ${BOLD}${m.role}${RESET} ${syncIcon}  ${DIM}${preview}${RESET}`);
    }
  }

  // ── Keyboard shortcuts ──
  lines.push("");
  lines.push(`${DIM}────────────────────────────────────────────${RESET}`);
  lines.push(
    ` ${BOLD}r${RESET} toggle recall   ${BOLD}e${RESET} before_agent_start  ${BOLD}m${RESET} message_end  ${BOLD}s${RESET} session_shutdown`,
  );
  lines.push(
    ` ${BOLD}n${RESET} session_start   ${BOLD}h${RESET} health_check        ${BOLD}H${RESET} toggle health  ${BOLD}f${RESET} request_fail`,
  );
  lines.push(
    ` ${BOLD}x${RESET} request_success  ${BOLD}t${RESET} tick +10s           ${BOLD}T${RESET} tick +30s      ${BOLD}R${RESET} reset       ${BOLD}q${RESET} quit`,
  );

  return lines.join("\n");
}

// ── Input handling ──────────────────────────────────────────────────────────

type Dispatch = (action: F6Action) => void;

function handleKey(key: string, dispatch: Dispatch, state: F6State): boolean {
  switch (key) {
    case "r": dispatch({ type: "TOGGLE_RECALL" }); return true;
    case "R": dispatch({ type: "RESET" }); return true;
    case "e":
      dispatch({
        type: "BEFORE_AGENT_START",
        prompt: "How does the authentication flow work?",
      });
      return true;
    case "m": {
      // Cycle through different message types on each press
      const counts = state.hookFirings.filter((h) => h.event === "message_end").length;
      if (counts % 3 === 0) {
        dispatch({
          type: "MESSAGE_END",
          role: "user",
          content: "Can you explain the config cascade?",
        });
      } else if (counts % 3 === 1) {
        dispatch({
          type: "MESSAGE_END",
          role: "assistant",
          content: [
            { type: "text", text: "The config cascade resolves in order: defaults → env vars → .pi/settings.json → active profile." },
          ],
        });
      } else {
        // Tool call — should NOT be synced (role: tool or custom)
        dispatch({ type: "MESSAGE_END", role: "tool", content: "[tool call result: 3 files found]" });
      }
      return true;
    }
    case "s": dispatch({ type: "SESSION_SHUTDOWN" }); return true;
    case "n": dispatch({ type: "SESSION_START" }); return true;
    case "h": dispatch({ type: "HEALTH_CHECK" }); return true;
    case "H": dispatch({ type: "TOGGLE_HEALTH_MOCK" }); return true;
    case "f": dispatch({ type: "REQUEST_FAIL" }); return true;
    case "x": dispatch({ type: "REQUEST_SUCCESS" }); return true;
    case "t": dispatch({ type: "TICK_CLOCK", amount: 10_000 }); return true;
    case "T": dispatch({ type: "TICK_CLOCK", amount: 30_000 }); return true;
    case "q": return false; // quit
    default: return true; // ignore unknown keys
  }
}

// ── Main loop ───────────────────────────────────────────────────────────────

function assertUnreachable(_x: never): void {
  // noop — exhaustiveness check only
}

function isRunning(action: F6Action | "quit"): action is F6Action {
  return action !== "quit";
}

async function main(): Promise<void> {
  // Set up raw stdin
  if (!process.stdin.setRawMode) {
    console.error("This prototype requires a terminal (TTY).");
    process.exit(1);
  }

  const stdin = process.stdin;
  stdin.setRawMode(true);
  stdin.resume();
  stdin.setEncoding("utf8");

  // State
  let state = createInitialState();

  // Render loop — on each keystroke, handle and re-render
  for await (const chunk of stdin) {
    const key = String(chunk);

    // Handle Ctrl+C gracefully
    if (key === "\x03") break;

    const shouldContinue = handleKey(key, (action) => {
      state = f6Reducer(state, action);
    }, state);

    console.log(CLEAR);
    console.log(render(state));

    if (!shouldContinue) break;
  }

  stdin.setRawMode(false);
  stdin.pause();
  console.log(`${DIM}prototype exited.${RESET}`);
}

main().catch((err) => {
  console.error("prototype crashed:", err);
  process.exit(1);
});
