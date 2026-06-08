import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import type { Logger } from "../../../domain/ports/logger";
import type { RecallService } from "../../../domain/recall/recall-service";
import type { SessionService } from "../../../domain/services/session-service";
import type { OVAdapter } from "../../driven/openviking/adapter";
import type { ProfileManager } from "../../../domain/profile/service/ProfileManager";
import { Uri } from "../../../domain/common/uri";
import { OVWidget } from "../ov-widget";
import { HealthCheck } from "../../driven/openviking/health";
import { agentMessageToParts } from "./message-mapper";
import { buildTurnParts } from "./build-turn-parts";

// ── Shared bag of services consumed by lifecycle hooks and per-session handler ──

export interface LifecycleServices {
  logger: Logger;
  sessionService: SessionService;
  recallService: RecallService;
  adapter: OVAdapter;
  widget: OVWidget;
  healthCheck: HealthCheck;
  profileManager: ProfileManager;
  autoDetectRules?: Record<string, string>;
}

// ── Init-time: register Pi lifecycle hooks (runs once per process) ──

export function registerLifecycleHooks(pi: ExtensionAPI, svcs: LifecycleServices): void {
  const { logger, sessionService, recallService, adapter, widget } = svcs;

  // message_end: sync user messages to OV session immediately
  // Assistant messages + tool results are merged at turn_end
  pi.on("message_end", async (event) => {
    if (event.message.role !== "user") return;

    const parts = agentMessageToParts(event.message);
    if (parts.length === 0) return;

    const active = sessionService.getActive();
    if (!active) {
      logger?.debug("message_end: no active session, skipping user sync");
      return;
    }

    try {
      await sessionService.sendMessage(active, "user", parts);
    } catch (err) {
      logger?.warn("message_end: failed to send user message", { error: (err as Error).message });
    }
  });

  // turn_end: sync assistant message + tool results as one structured message
  pi.on("turn_end", async (event) => {
    const active = sessionService.getActive();
    if (!active) {
      logger?.debug("turn_end: no active session, skipping");
      return;
    }

    const assistantParts = agentMessageToParts(event.message);
    if (assistantParts.length === 0) return;

    const merged = buildTurnParts(assistantParts, event.toolResults);

    try {
      await sessionService.sendMessage(active, "assistant", merged);
    } catch (err) {
      logger?.warn("turn_end: failed to send message", { error: (err as Error).message });
    }
  });

  // session_shutdown: commit active session to OV
  pi.on("session_shutdown", async () => {
    const active = sessionService.getActive();
    if (!active) {
      logger?.debug("session_shutdown: no active session, skipping commit");
      return;
    }

    try {
      await sessionService.commit(active);
    } catch (err) {
      logger?.warn("session_shutdown: failed to commit session", { error: (err as Error).message });
    }
  });

  // before_agent_start: auto-recall with guard chain
  pi.on("before_agent_start", async (event) => {
    // Guard 1: recall toggle
    if (!recallService.isEnabled()) {
      return { message: { customType: "memory_context", content: "Auto-recall is OFF. Use `ov_recall` explicitly or toggle with `/ov-recall on`.\n---\nOpenViking knowledge base available via `ov_search`.", display: false } };
    }

    // Guard 2: circuit breaker OPEN
    if (adapter.circuitBreakerOpen) {
      return { message: { customType: "memory_context", content: "OpenViking is temporarily unavailable (circuit breaker open). Will retry automatically. Knowledge base tools (`ov_search`, etc.) remain available once connection restores.", display: false } };
    }

    // Guard 3: no active session — auto-create as fallback
    let sessionId = sessionService.getActive();
    if (!sessionId) {
      try {
        sessionId = await sessionService.createAndSet();
        widget.update("session", sessionId.toString());
        logger?.info("before_agent_start: auto-created OV session", { sessionId: sessionId.toString() });
      } catch {
        return { message: { customType: "memory_context", content: "Failed to create OV session. Use `ov_search` to query the knowledge base directly without a session.", display: false } };
      }
    }

    // Recall — wrap in try/catch so the hook never throws
    let result;
    try {
      result = await recallService.recall(event.prompt ?? "", sessionId);
    } catch (err) {
      logger?.warn("before_agent_start: recall threw unexpectedly", { error: (err as Error).message });
      return { message: { customType: "memory_context", content: "Auto-recall encountered an unexpected error. Use `ov_recall` to retry or `ov_search` to query the knowledge base directly.", display: false } };
    }

    if (result.timedOut) {
      return { message: { customType: "memory_context", content: "⚠️ OpenViking search timed out — auto-recall skipped. The knowledge base may be busy indexing. Will retry on next turn. Try `ov_search` to query directly.", display: false } };
    }
    if (!result.formatted) {
      return { message: { customType: "memory_context", content: "No relevant memories found by auto-recall. Try `ov_search` to explore the knowledge base or `ov_recall` with a different query.", display: false } };
    }

    // Track used contexts so OV can improve ranking
    const usedItems = result.items ?? [];
    if (usedItems.length > 0) {
      const usedUris = usedItems.map((item) => new Uri(item.uri));
      sessionService.sessionUsed(sessionId, usedUris).catch((err) => {
        logger?.warn("before_agent_start: failed to record used contexts", { error: (err as Error).message });
      });
    }

    return { message: { customType: "memory_context", content: result.formatted, display: false } };
  });
}

// ── Per-session: run on every session_start (including fork/resume/reload) ──

export async function handleSessionStart(
  ctx: { cwd: string; ui: any },
  svcs: LifecycleServices,
): Promise<void> {
  const { healthCheck, widget, sessionService, recallService, logger, profileManager, autoDetectRules } = svcs;

  // F7b: Auto-detect profile from workspace path
  if (profileManager && autoDetectRules) {
    const { autoDetectProfile } = await import("../../../domain/profile/service/auto-detect");
    const detected = autoDetectProfile(ctx.cwd, autoDetectRules);
    if (detected) {
      profileManager.apply(detected);
      logger.info(`auto-detected profile: ${detected}`);
    }
  }

  // Health check FIRST — widget is attached with correct state from the start
  const health = await healthCheck.check();

  widget.attach(ctx.ui);
  widget.update("conn", health.ok ? "connected" : "disconnected");

  try {
    await sessionService.createAndSet();
    const active = sessionService.getActive();
    widget.update("session", active?.toString() ?? "-");
    widget.update("recall", recallService.isEnabled() ? "on" : "off");
  } catch {
    widget.update("session", "none");
  }
}
