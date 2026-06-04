import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { init } from "./infrastructure/lifecycle";
import type { PiOVConfig } from "./infrastructure/config/schema";
import type { DIContainer } from "./infrastructure/di/container";
import type { Logger } from "./domain/ports/logger";
import type { SearchService } from "./domain/services/search-service";
import type { WriteService } from "./domain/services/write-service";
import type { ReadService } from "./domain/services/read-service";
import type { FsService } from "./domain/services/fs-service";
import type { ResourceService } from "./domain/services/resource-service";
import type { RecallService } from "./domain/recall/recall-service";
import type { SessionService } from "./domain/services/session-service";
import type { OVAdapter } from "./adapters/driven/openviking/adapter";
import type { FsStore } from "./domain/ports/fs-store";
import type { KnowledgeBase } from "./domain/ports/knowledge-base";
import type { ProfileManager } from "./domain/profile/service/ProfileManager";
import { registerAllTools } from "./adapters/driver/pi-tools/tool-registry";
import { registerAllCommands } from "./adapters/driver/pi-commands/command-registry";
import { OVWidget } from "./adapters/driver/ov-widget";
import { HealthCheck } from "./adapters/driven/openviking/health";
import { agentMessageToParts } from "./adapters/driver/pi-session-sync/message-mapper";

let initialized = false;
let config: PiOVConfig;
let logger: Logger;
let container: DIContainer;
let widget: OVWidget;
let healthCheck: HealthCheck;
let sessionService: SessionService;
let profileManager: ProfileManager;
let recallService: RecallService;

export default async function openVikingExtension(pi: ExtensionAPI): Promise<void> {
  pi.on("session_start", async (_event, ctx) => {
    // One-time initialization (guard prevents re-init on fork/resume/reload)
    if (!initialized) {
      initialized = true;
      const result = await init(ctx.cwd);
      config = result.config;
      logger = result.logger;
      container = result.container;

      // Create shared widget
      widget = new OVWidget();

      // Resolve services from container
      const searchService = container.resolve<SearchService>("searchService");
      const writeService = container.resolve<WriteService>("writeService");
      const readService = container.resolve<ReadService>("readService");
      const fsService = container.resolve<FsService>("fsService");
      recallService = container.resolve<RecallService>("recallService");
      const fsStore = container.resolve<FsStore>("fsStore");
      const knowledgeBase = container.resolve<KnowledgeBase>("knowledgeBase");
      profileManager = container.resolve<ProfileManager>("profileManager");
      const adapter = container.resolve<OVAdapter>("adapter");

      // Create health check adapter
      healthCheck = new HealthCheck(config.ov.endpoint);

      // Session service — module-level for hooks
      sessionService = container.resolve<SessionService>("sessionService");

      const resourceService = container.resolve<ResourceService>("resourceService");

      // Register all 13 tools (once per process)
      registerAllTools(pi, { searchService, writeService, readService, recallService, fsService, resourceService }, logger);

      // Register all 6 commands (once per process)
      registerAllCommands(pi, {
        recallService,
        sessionService,
        searchService,
        fsStore,
        knowledgeBase,
        profileManager,
        autoDetectRules: config.profile.autoDetectRules,
        ovConfig: config.ov,
        recallConfig: config.recall,
        widgetUpdater: (field, value) => widget.update(field, value),
      });

      // ── message_end: sync user/assistant messages to OV session ──────────
      pi.on("message_end", (event) => {
        const parts = agentMessageToParts(event.message);
        if (parts.length === 0) return;

        const active = sessionService.getActive();
        if (!active) {
          logger?.debug("message_end: no active session, skipping sync");
          return;
        }

        sessionService.sendMessage(active, event.message.role, parts).catch((err) => {
          logger?.warn("message_end: failed to send message", { error: (err as Error).message });
        });
      });

      // ── session_shutdown: commit active session to OV ───────────────────
      pi.on("session_shutdown", () => {
        const active = sessionService.getActive();
        if (!active) {
          logger?.debug("session_shutdown: no active session, skipping commit");
          return;
        }

        sessionService.commit(active).catch((err) => {
          logger?.warn("session_shutdown: failed to commit session", { error: (err as Error).message });
        });
      });

      // ── before_agent_start: auto-recall with guard chain ───────────────
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

        // Recall
        const result = await recallService.recall(event.prompt ?? "", sessionId);
        if (result.timedOut) {
          return { message: { customType: "memory_context", content: "⚠️ OpenViking search timed out — auto-recall skipped. The knowledge base may be busy indexing. Will retry on next turn. Try `ov_search` to query directly.", display: false } };
        }
        if (!result.formatted) {
          return { message: { customType: "memory_context", content: "No relevant memories found by auto-recall. Try `ov_search` to explore the knowledge base or `ov_recall` with a different query.", display: false } };
        }

        return { message: { customType: "memory_context", content: result.formatted, display: false } };
      });
    }

    // F7b: Auto-detect profile from workspace path on every session_start
    if (profileManager && config.profile.autoDetectRules) {
      const { autoDetectProfile } = await import("./domain/profile/service/auto-detect");
      const detected = autoDetectProfile(ctx.cwd, config.profile.autoDetectRules);
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
      // Session creation failed — no session to show
    }
  });
}
