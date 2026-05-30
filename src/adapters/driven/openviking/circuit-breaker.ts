export type CBStatus = "CLOSED" | "OPEN" | "HALF_OPEN";

export interface CircuitBreakerState {
  status: CBStatus;
  consecutiveFails: number;
  threshold: number;
  resetTimeoutMs: number;
  openSince: number | null;
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

export function allowsRequest(state: CircuitBreakerState): boolean {
  return state.status !== "OPEN";
}

export type CBAction =
  | { type: "RECORD_FAILURE"; now: number }
  | { type: "RECORD_SUCCESS" }
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
      if (state.status === "CLOSED") {
        return { ...state, consecutiveFails: 0 };
      }
      if (state.status === "HALF_OPEN") {
        return {
          ...createCircuitBreaker(state.threshold, state.resetTimeoutMs),
          status: "CLOSED",
          consecutiveFails: 0,
        };
      }
      return state;
    }

    case "TICK": {
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

    default:
      return state;
  }
}
