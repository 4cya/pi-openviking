// ── F6 Prototype — Pure logic module ─────────────────────────────────────────
// Question: Does the F6 hook wiring handle all edge cases correctly?
//   - Auto-recall with circuit breaker protection
//   - Session sync via message mapper (user/assistant text only)
//   - Health check feeding widget (not driving CB)
//
// This module is pure — no I/O, no terminal code. Can be lifted into real codebase.

// ── Simulated types (mirror Pi/domain types for prototype fidelity) ──────────

export interface SimTextContent {
  type: "text";
  text: string;
}

export interface SimImageContent {
  type: "image";
  image: string;
}

export interface SimMessage {
  role: "user" | "assistant" | "tool" | "custom";
  content?: string | (SimTextContent | SimImageContent)[];
  customType?: string;
  display?: boolean;
}

export interface SimPart {
  type: "text";
  content: string;
}

// ── Circuit breaker state machine ───────────────────────────────────────────

export interface CircuitBreakerState {
  status: "CLOSED" | "OPEN" | "HALF_OPEN";
  consecutiveFails: number;
  threshold: number;
  resetTimeoutMs: number;
  /** Timestamp when the breaker transitioned to OPEN (for HALF_OPEN scheduling) */
  openSince: number | null;
  /** Timestamp of the last probe attempt in HALF_OPEN */
  lastProbeTime: number | null;
}

export function createCircuitBreaker(
  threshold = 3,
  resetTimeoutMs = 30_000,
): CircuitBreakerState {
  return {
    status: "CLOSED",
    consecutiveFails: 0,
    threshold,
    resetTimeoutMs,
    openSince: null,
    lastProbeTime: null,
  };
}

export type CBAction =
  | { type: "RECORD_FAILURE"; now: number }
  | { type: "RECORD_SUCCESS" }
  | { type: "PROBE"; success: boolean; now: number }
  | { type: "TICK"; now: number }
  | { type: "RESET" };

export function circuitBreakerReducer(
  state: CircuitBreakerState,
  action: CBAction,
): CircuitBreakerState {
  switch (action.type) {
    case "RECORD_FAILURE": {
      const fails = state.consecutiveFails + 1;
      if (state.status === "CLOSED" && fails >= state.threshold) {
        return {
          ...state,
          status: "OPEN",
          consecutiveFails: fails,
          openSince: action.now,
          lastProbeTime: null,
        };
      }
      if (state.status === "HALF_OPEN") {
        // Probe failed — back to OPEN with doubled reset timeout
        return {
          ...state,
          status: "OPEN",
          consecutiveFails: fails,
          openSince: action.now,
          resetTimeoutMs: state.resetTimeoutMs * 2,
          lastProbeTime: null,
        };
      }
      return { ...state, consecutiveFails: fails };
    }

    case "RECORD_SUCCESS": {
      // Any success in CLOSED resets consecutive fails
      if (state.status === "CLOSED") {
        return { ...state, consecutiveFails: 0 };
      }
      // Success in HALF_OPEN closes the breaker
      if (state.status === "HALF_OPEN") {
        return {
          ...createCircuitBreaker(state.threshold, state.resetTimeoutMs),
          status: "CLOSED",
          consecutiveFails: 0,
        };
      }
      return state;
    }

    case "PROBE": {
      if (state.status !== "HALF_OPEN") return state;
      if (action.success) {
        return {
          ...createCircuitBreaker(state.threshold, state.resetTimeoutMs),
          status: "CLOSED",
          consecutiveFails: 0,
        };
      }
      return circuitBreakerReducer(
        { ...state, lastProbeTime: action.now },
        { type: "RECORD_FAILURE", now: action.now },
      );
    }

    case "TICK": {
      // Check if OPEN timeout elapsed → transition to HALF_OPEN
      if (
        state.status === "OPEN" &&
        state.openSince !== null &&
        action.now - state.openSince >= state.resetTimeoutMs
      ) {
        return {
          ...state,
          status: "HALF_OPEN",
          lastProbeTime: action.now,
        };
      }
      return state;
    }

    case "RESET":
      return createCircuitBreaker(state.threshold, state.resetTimeoutMs);
  }
}

// ── Message mapper — pure function ──────────────────────────────────────────

export interface MessageMapperResult {
  parts: SimPart[];
  shouldSync: boolean;
  reason: string;
}

/** Maps a simulated Pi AgentMessage to domain Part[].
 *  Only user/assistant text content is synced.
 *  Tool calls, custom messages, and empty text are ignored.
 *  This mirrors the future real codebase function `agentMessageToParts()`. */
export function agentMessageToParts(msg: SimMessage): MessageMapperResult {
  // Only user and assistant roles are synced
  if (msg.role !== "user" && msg.role !== "assistant") {
    return { parts: [], shouldSync: false, reason: `role "${msg.role}" not synced` };
  }

  // Extract text content
  const parts: SimPart[] = [];

  if (typeof msg.content === "string") {
    // Plain string content (common for user messages)
    if (msg.content.trim().length > 0) {
      parts.push({ type: "text", content: msg.content });
    }
  } else if (Array.isArray(msg.content)) {
    // Content array — extract only TextContent items
    for (const item of msg.content) {
      if (item.type === "text" && item.text.trim().length > 0) {
        parts.push({ type: "text", content: item.text });
      }
    }
  }

  if (parts.length === 0) {
    return { parts: [], shouldSync: false, reason: "no text content found" };
  }

  return { parts, shouldSync: true, reason: `${parts.length} text part(s) synced` };
}

// ── Health check simulation ─────────────────────────────────────────────────

export interface HealthStatus {
  ok: boolean;
  latencyMs: number | null;
  error: string | null;
  timestamp: number;
}

export function simulateHealthCheck(
  mockReady: boolean,
  mockLatency: number,
  now: number,
): HealthStatus {
  if (mockReady) {
    return { ok: true, latencyMs: mockLatency, error: null, timestamp: now };
  }
  return { ok: false, latencyMs: null, error: "OV /ready returned 503", timestamp: now };
}

// ── F6 Hook wiring — the main orchestrator logic ────────────────────────────

export interface RecallResult {
  items: number;
  tokens: number;
  formatted: string;
  skipped: boolean;
  skipReason: string | null;
}

export interface HookFiring {
  event: string;
  timestamp: number;
  result: string;
  details: string;
}

export interface F6State {
  // Recall toggle
  recallEnabled: boolean;

  // Circuit breaker
  cb: CircuitBreakerState;

  // Session
  sessionActive: boolean;
  sessionId: string | null;
  messageLog: Array<{ id: number; role: string; text: string; synced: boolean }>;
  nextMessageId: number;

  // Health
  lastHealth: HealthStatus | null;
  healthMockOk: boolean;
  healthMockLatency: number;

  // Last operations
  lastRecallResult: RecallResult | null;
  lastHookError: string | null;
  hookFirings: HookFiring[];
  simulatedClock: number; // ms since epoch
}

export function createInitialState(): F6State {
  return {
    recallEnabled: true,
    cb: createCircuitBreaker(),
    sessionActive: false,
    sessionId: null,
    messageLog: [],
    nextMessageId: 1,
    lastHealth: null,
    healthMockOk: true,
    healthMockLatency: 12,
    lastRecallResult: null,
    lastHookError: null,
    hookFirings: [],
    simulatedClock: 1000, // start at t=1s
  };
}

export type F6Action =
  | { type: "TOGGLE_RECALL" }
  | { type: "BEFORE_AGENT_START"; prompt: string }
  | { type: "MESSAGE_END"; role: SimMessage["role"]; content: SimMessage["content"] }
  | { type: "SESSION_SHUTDOWN" }
  | { type: "SESSION_START" }
  | { type: "HEALTH_CHECK" }
  | { type: "TOGGLE_HEALTH_MOCK" }
  | { type: "REQUEST_FAIL" }
  | { type: "REQUEST_SUCCESS" }
  | { type: "TICK_CLOCK"; amount: number }
  | { type: "RESET" };

/** Check if the circuit breaker will ALLOW a request through.
 *  OPEN → reject. CLOSED/HALF_OPEN → allow. */
function cbAllowsRequest(state: CircuitBreakerState): boolean {
  return state.status !== "OPEN";
}

function recordHook(
  state: F6State,
  event: string,
  result: string,
  details: string,
): HookFiring {
  return { event, timestamp: state.simulatedClock, result, details };
}

export function f6Reducer(state: F6State, action: F6Action): F6State {
  switch (action.type) {
    // ── Recall toggle ─────────────────────────────────────────────────────
    case "TOGGLE_RECALL": {
      return { ...state, recallEnabled: !state.recallEnabled };
    }

    // ── before_agent_start — Auto-recall hook ─────────────────────────────
    case "BEFORE_AGENT_START": {
      const hook: HookFiring = { event: "before_agent_start", timestamp: state.simulatedClock, result: "", details: "" };

      // 1. Check recall toggle
      if (!state.recallEnabled) {
        hook.result = "skipped";
        hook.details = "recall toggle OFF";
        return {
          ...state,
          lastRecallResult: { items: 0, tokens: 0, formatted: "", skipped: true, skipReason: "recall OFF" },
          lastHookError: null,
          hookFirings: [...state.hookFirings, hook],
        };
      }

      // 2. Check circuit breaker
      if (state.cb.status === "OPEN") {
        hook.result = "skipped";
        hook.details = `circuit breaker OPEN (${state.cb.consecutiveFails} fails, reset in ${Math.max(0, state.cb.resetTimeoutMs - (state.simulatedClock - (state.cb.openSince ?? state.simulatedClock)))}ms)`;
        return {
          ...state,
          lastRecallResult: {
            items: 0, tokens: 0, formatted: "", skipped: true,
            skipReason: `CB OPEN — ${hook.details}`,
          },
          lastHookError: null,
          hookFirings: [...state.hookFirings, hook],
        };
      }

      // 3. Check session
      if (!state.sessionActive || !state.sessionId) {
        hook.result = "skipped";
        hook.details = "no active session — cannot provide session context";
        return {
          ...state,
          lastRecallResult: { items: 0, tokens: 0, formatted: "", skipped: true, skipReason: "no session" },
          lastHookError: null,
          hookFirings: [...state.hookFirings, hook],
        };
      }

      // 4. Simulate successful recall
      // Call RecallService.recall(prompt, sessionId)
      // If CB is HALF_OPEN, this is our probe — could fail
      if (state.cb.status === "HALF_OPEN") {
        // Probe request — we need to simulate whether it fails
        // For now, HALF_OPEN probe successes are triggered via REQUEST_SUCCESS
        // This hook fires BEFORE the actual HTTP call, so we let it through
        // and the circuit breaker state is updated by subsequent REQUEST_FAIL/SUCCESS actions
      }

      const mockRecallItems = 3;
      const mockRecallTokens = 1200;
      hook.result = "injected";
      hook.details = `recalled ${mockRecallItems} items (${mockRecallTokens} tokens) from OV for "${action.prompt.substring(0, 40)}${action.prompt.length > 40 ? "..." : ""}"`;
      return {
        ...state,
        lastRecallResult: {
          items: mockRecallItems,
          tokens: mockRecallTokens,
          formatted: `[memory] Entry 1\nContent: relevance to "${action.prompt}"\n\n[memory] Entry 2\nContent: related context\n\n[memory] Entry 3\nContent: supplementary info`,
          skipped: false,
          skipReason: null,
        },
        lastHookError: null,
        hookFirings: [...state.hookFirings, hook],
      };
    }

    // ── message_end — Session sync hook ───────────────────────────────────
    case "MESSAGE_END": {
      const msg: SimMessage = { role: action.role, content: action.content };
      const mapped = agentMessageToParts(msg);

      let text = "";
      if (typeof action.content === "string") {
        text = action.content;
      } else if (Array.isArray(action.content)) {
        text = action.content.filter((c) => c.type === "text").map((c) => c.text).join(" ");
      }

      const entry = {
        id: state.nextMessageId,
        role: action.role,
        text,
        synced: mapped.shouldSync,
      };

      const hook: HookFiring = {
        event: "message_end",
        timestamp: state.simulatedClock,
        result: mapped.shouldSync ? "synced" : "ignored",
        details: mapped.reason + (text ? ` (${text.substring(0, 50)}${text.length > 50 ? "..." : ""})` : ""),
      };

      return {
        ...state,
        messageLog: [...state.messageLog, entry],
        nextMessageId: state.nextMessageId + 1,
        hookFirings: [...state.hookFirings, hook],
        lastHookError: null,
      };
    }

    // ── session_shutdown — Commit hook ────────────────────────────────────
    case "SESSION_SHUTDOWN": {
      if (!state.sessionActive || !state.sessionId) {
        const hook: HookFiring = {
          event: "session_shutdown",
          timestamp: state.simulatedClock,
          result: "skipped",
          details: "no active session",
        };
        return { ...state, hookFirings: [...state.hookFirings, hook] };
      }

      // SessionService.commit() returns { taskId }
      const hook: HookFiring = {
        event: "session_shutdown",
        timestamp: state.simulatedClock,
        result: "committed",
        details: `session ${state.sessionId} committed — OV extracting memories async`,
      };

      return {
        ...state,
        sessionActive: false,
        sessionId: null,
        hookFirings: [...state.hookFirings, hook],
        lastHookError: null,
      };
    }

    // ── session_start — Create session + health check ─────────────────────
    case "SESSION_START": {
      // Creates OV session
      const newId = `ov-sess-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
      const hook: HookFiring = {
        event: "session_start",
        timestamp: state.simulatedClock,
        result: "session_created",
        details: `session ${newId}`,
      };

      // Also run health check on session_start
      const health = simulateHealthCheck(state.healthMockOk, state.healthMockLatency, state.simulatedClock);
      const healthHook: HookFiring = {
        event: "health_check",
        timestamp: state.simulatedClock,
        result: health.ok ? "healthy" : "unhealthy",
        details: health.ok
          ? `OV ready in ${health.latencyMs}ms`
          : `OV /ready failed: ${health.error}`,
      };

      return {
        ...state,
        sessionActive: true,
        sessionId: newId,
        lastHealth: health,
        hookFirings: [...state.hookFirings, hook, healthHook],
        lastHookError: null,
      };
    }

    // ── Health check ──────────────────────────────────────────────────────
    case "HEALTH_CHECK": {
      const health = simulateHealthCheck(state.healthMockOk, state.healthMockLatency, state.simulatedClock);
      const hook: HookFiring = {
        event: "health_check",
        timestamp: state.simulatedClock,
        result: health.ok ? "healthy" : "unhealthy",
        details: health.ok
          ? `OV ready in ${health.latencyMs}ms`
          : `OV /ready failed: ${health.error}`,
      };
      return {
        ...state,
        lastHealth: health,
        hookFirings: [...state.hookFirings, hook],
      };
    }

    // ── Toggle health mock ────────────────────────────────────────────────
    case "TOGGLE_HEALTH_MOCK": {
      return { ...state, healthMockOk: !state.healthMockOk };
    }

    // ── Request failure (drives circuit breaker) ──────────────────────────
    case "REQUEST_FAIL": {
      const newCb = circuitBreakerReducer(state.cb, {
        type: "RECORD_FAILURE",
        now: state.simulatedClock,
      });
      const hook: HookFiring = {
        event: "request_fail",
        timestamp: state.simulatedClock,
        result: `CB ${state.cb.status} → ${newCb.status} (${newCb.consecutiveFails}/${newCb.threshold} fails)`,
        details: newCb.status === "OPEN"
          ? `breaker opened — ${newCb.resetTimeoutMs}ms reset timeout`
          : `fail ${newCb.consecutiveFails}/${newCb.threshold}`,
      };
      return {
        ...state,
        cb: newCb,
        hookFirings: [...state.hookFirings, hook],
        lastHookError: `Request failed (fail ${newCb.consecutiveFails}/${newCb.threshold})`,
      };
    }

    // ── Request success (resets circuit breaker counter) ──────────────────
    case "REQUEST_SUCCESS": {
      const newCb = circuitBreakerReducer(state.cb, {
        type: "RECORD_SUCCESS",
      });
      const hook: HookFiring = {
        event: "request_success",
        timestamp: state.simulatedClock,
        result: `CB ${state.cb.status} → ${newCb.status} (0 fails)`,
        details: newCb.status === "CLOSED" && state.cb.status === "HALF_OPEN"
          ? "probe succeeded — breaker closed"
          : "fails reset to 0",
      };
      return {
        ...state,
        cb: newCb,
        hookFirings: [...state.hookFirings, hook],
        lastHookError: null,
      };
    }

    // ── Tick clock — advance simulated time ──────────────────────────────
    case "TICK_CLOCK": {
      const newTime = state.simulatedClock + action.amount;
      const newCb = circuitBreakerReducer(state.cb, {
        type: "TICK",
        now: newTime,
      });

      let transitionHook: HookFiring | null = null;
      if (newCb.status !== state.cb.status) {
        transitionHook = {
          event: "cb_transition",
          timestamp: newTime,
          result: `CB ${state.cb.status} → ${newCb.status}`,
          details: newCb.status === "HALF_OPEN"
            ? "reset timeout elapsed — ready for probe"
            : "",
        };
      }

      return {
        ...state,
        simulatedClock: newTime,
        cb: newCb,
        hookFirings: transitionHook
          ? [...state.hookFirings, transitionHook]
          : state.hookFirings,
      };
    }

    case "RESET":
      return createInitialState();
  }
}

// ── Derived state helpers ───────────────────────────────────────────────────

export interface WidgetState {
  conn: "connected" | "disconnected" | "unknown";
  recall: "on" | "off";
  session: string;
}

export function computeWidgetState(state: F6State): WidgetState {
  const conn = state.lastHealth
    ? (state.lastHealth.ok ? "connected" : "disconnected")
    : "unknown";
  return {
    conn,
    recall: state.recallEnabled ? "on" : "off",
    session: state.sessionId ?? "-",
  };
}
