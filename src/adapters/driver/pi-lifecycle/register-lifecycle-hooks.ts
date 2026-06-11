import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import type { Logger } from "../../../domain/ports/logger";
import type { RecallService } from "../../../domain/recall/recall-service";
import type { SessionService } from "../../../domain/services/session-service";
import type { OVAdapter } from "../../driven/openviking/adapter";
import type { ProfileManager } from "../../../domain/profile/service/ProfileManager";
import { Uri } from "../../../domain/common/uri";
import { OVWidget } from "../ov-widget";
import { HealthCheck } from "../../driven/openviking/health";
import { RepoContext } from "../../../infrastructure/repo-context";
import { agentMessageToParts } from "./message-mapper";
import { buildTurnParts } from "./build-turn-parts";

// ── Shared bag of services consumed by lifecycle hooks and per-session handler ──

export const DEFAULT_AUTO_COMMIT_INTERVAL_MS = 5 * 60 * 1000;

export interface LifecycleServices {
  logger: Logger;
  sessionService: SessionService;
  recallService: RecallService;
  adapter: OVAdapter;
  widget: OVWidget;
  healthCheck: HealthCheck;
  profileManager: ProfileManager;
  repoContext?: RepoContext;
  autoDetectRules?: Record<string, string>;
  autoCommitIntervalMs?: number;
}

// ── Simple string hash for cache keys ──

function hashString(s: string): string {
  let hash = 0;
  for (let i = 0; i < s.length; i++) {
    const char = s.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash |= 0; // Convert to 32bit integer
  }
  return hash.toString(36);
}

/**
 * Extract the text content of the latest user message from the message array.
 * Returns empty string if no user message found.
 *
 * Accepts AgentMessage[] which may include custom message types (BashExecutionMessage, etc.)
 * that lack a `content` field — handled via the `msg` role guard + optional chaining.
 */
function extractLatestUserText(messages: readonly { role: string; content?: unknown }[]): string {
  for (let i = messages.length - 1; i >= 0; i--) {
    const msg = messages[i];
    if (msg.role === "user") {
      const content = msg.content;
      if (typeof content === "string") return content;
      // If content is an array, concatenate text parts
      if (Array.isArray(content)) {
        return content
          .filter((p: any) => p.type === "text")
          .map((p: any) => p.text)
          .join(" ");
      }
    }
  }
  return "";
}

/**
 * Pure function: commit the active session if one exists.
 *
 * - No active session → returns `{ committed: false }`.
 * - Commit succeeds → starts background polling if taskId returned.
 * - Commit throws → returns `{ committed: false, error }`.
 *
 * Extracted for testability — does NOT own timer lifecycle.
 */
export async function pollCommit(
  sessionService: SessionService,
  logger?: Logger,
): Promise<{ committed: boolean; error?: string }> {
  const active = sessionService.getActive();
  if (!active) {
    logger?.debug("pollCommit: no active session");
    return { committed: false };
  }

  try {
    const result = await sessionService.commit(active);
    if (result.taskId) {
      // Fire-and-forget: poll task status in background
      sessionService.waitForCommit(result.taskId).catch(async (err) => {
        logger?.warn("pollCommit: commit task timed out, retrying commit", {
          taskId: result.taskId,
          error: (err as Error).message,
        });
        // C5: On waitForCommit timeout, try a new commit as fallback
        // OV doc confirms: "Rapid consecutive commits on same session are accepted; each gets own task_id."
        try {
          const retryResult = await sessionService.commit(active);
          logger?.info("pollCommit: retry commit succeeded, new taskId: " + retryResult.taskId);
        } catch (err2) {
          logger?.error("pollCommit: retry commit also failed after waitForCommit timeout", { error: (err2 as Error).message });
        }
      });
    }
    logger?.debug("pollCommit: committed successfully", { sessionId: active.toString() });
    return { committed: true };
  } catch (err) {
    logger?.warn("pollCommit: commit failed", {
      sessionId: active.toString(),
      error: (err as Error).message,
    });
    return { committed: false, error: (err as Error).message };
  }
}

// ── Init-time: register Pi lifecycle hooks (runs once per process) ──

export function registerLifecycleHooks(pi: ExtensionAPI, svcs: LifecycleServices): void {
  const { logger, sessionService, recallService, adapter, widget, repoContext } = svcs;

  // ── AutoCommit timer: periodically commits active session ──
  const autoCommitInterval = svcs.autoCommitIntervalMs ?? DEFAULT_AUTO_COMMIT_INTERVAL_MS;
  let autoCommitTimer: ReturnType<typeof setInterval> | null = null;

  if (autoCommitInterval > 0) {
    autoCommitTimer = setInterval(async () => {
      await pollCommit(sessionService, logger);
    }, autoCommitInterval);
    logger?.debug("auto-commit timer started", { intervalMs: autoCommitInterval });
  }

  // before_agent_start: inject repo context into system prompt (separate from memory recall)
  pi.on("before_agent_start", async (event) => {
    if (!repoContext) return;
    const snippet = await repoContext.getSystemPromptSnippet();
    if (snippet) {
      return {
        systemPrompt: event.systemPrompt + "\n\n" + snippet,
      };
    }
  });

  // Context hook: auto-recall with cache, fires before each LLM call
  // Replaces the former before_agent_start approach (see ADR-019).
  interface CacheEntry {
    block: string;
    queryHash: string;
  }
  const recallCache = new Map<string, CacheEntry>();

  pi.on("context", async (event) => {
    // Guard 1: recall toggle
    if (!recallService.isEnabled()) {
      return; // No injection when recall off — guard becomes log-only per ADR-019
    }

    // Guard 2: circuit breaker OPEN
    if (adapter.circuitBreakerOpen) {
      logger?.debug("context: circuit breaker open, skipping recall");
      return;
    }

    // Extract latest user text for the recall query
    const query = extractLatestUserText(event.messages);
    if (!query) {
      logger?.debug("context: no user message text, skipping recall");
      return;
    }

    const queryHash = hashString(query);

    // Check cache: if same query hash exists, return cached block
    const cached = recallCache.get(queryHash);
    if (cached) {
      // Same query in same turn — inject cached block
      logger?.debug("context: recall cache hit", { queryHash });
      return {
        messages: [
          ...event.messages,
          {
            role: "custom" as const,
            customType: "memory_context",
            content: cached.block,
            display: false,
            timestamp: Date.now(),
          },
        ],
      };
    }

    // Guard 3: no active session — auto-create as fallback
    let sessionId = sessionService.getActive();
    if (!sessionId) {
      try {
        sessionId = await sessionService.createAndSet();
        widget.update("session", sessionId.toString());
        logger?.info("context: auto-created OV session", { sessionId: sessionId.toString() });
      } catch {
        logger?.warn("context: failed to auto-create OV session");
        return;
      }
    }

    // Recall — wrap in try/catch so the hook never throws
    let result;
    try {
      result = await recallService.recall(query, sessionId);
    } catch (err) {
      logger?.warn("context: recall threw unexpectedly", { error: (err as Error).message });
      return;
    }

    if (result.timedOut) {
      logger?.debug("context: recall timed out");
      return;
    }
    if (!result.formatted) {
      logger?.debug("context: no relevant memories found");
      return;
    }

    // Track used contexts so OV can improve ranking
    const usedItems = result.items ?? [];
    if (usedItems.length > 0) {
      const usedUris = usedItems.map((item: { uri: string }) => new Uri(item.uri));
      sessionService.sessionUsed(sessionId, usedUris).catch((err) => {
        logger?.warn("context: failed to record used contexts", { error: (err as Error).message });
      });
    }

    // Cache the result by query hash
    recallCache.set(queryHash, { block: result.formatted, queryHash });

    // Inject as a custom message appended after user messages
    return {
      messages: [
        ...event.messages,
        {
          role: "custom" as const,
          customType: "memory_context",
          content: result.formatted,
          display: false,
          timestamp: Date.now(),
        },
      ],
    };
  });

  // message_end: sync user messages to OV session immediately
  pi.on("message_end", async (event) => {
    if (event.message.role !== "user") return;

    // C8: Guard — skip if circuit breaker is OPEN
    if (adapter.circuitBreakerOpen) {
      logger?.debug("message_end: circuit breaker open, skipping sync");
      return;
    }

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
      logger?.warn("message_end: failed to send user message, retrying in 500ms", { error: (err as Error).message });
      // C4: Retry once with 500ms backoff on transient failures
      await new Promise((r) => setTimeout(r, 500));
      try {
        await sessionService.sendMessage(active, "user", parts);
      } catch (err2) {
        logger?.warn("message_end: failed to send user message after retry", { error: (err2 as Error).message });
      }
    }
  });

  // turn_end: sync assistant message + tool results as one structured message
  pi.on("turn_end", async (event) => {
    const active = sessionService.getActive();
    if (!active) {
      logger?.debug("turn_end: no active session, skipping");
      return;
    }

    // C8: Guard — skip if circuit breaker is OPEN
    if (adapter.circuitBreakerOpen) {
      logger?.debug("turn_end: circuit breaker open, skipping sync");
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

  // session_shutdown: commit active session, clear auto-commit timer + recall cache
  pi.on("session_shutdown", async () => {
    // Stop auto-commit timer first
    if (autoCommitTimer !== null) {
      clearInterval(autoCommitTimer);
      autoCommitTimer = null;
      logger?.debug("auto-commit timer stopped");
    }

    const active = sessionService.getActive();
    if (!active) {
      logger?.debug("session_shutdown: no active session, skipping commit");
      return;
    }

    try {
      await sessionService.commit(active);
    } catch (err) {
      logger?.warn("session_shutdown: commit failed, retrying...", { error: (err as Error).message });
      // C3: Retry once on shutdown commit failure to reduce data loss risk
      try {
        await sessionService.commit(active);
      } catch (err2) {
        logger?.error("session_shutdown: commit failed after retry — data may be lost", { error: (err2 as Error).message });
      }
    }

    recallCache.clear();
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
