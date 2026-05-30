import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { init } from "./infrastructure/lifecycle";
import type { PiOVConfig } from "./infrastructure/config/schema";
import type { DIContainer } from "./infrastructure/di/container";
import type { Logger } from "./domain/ports/logger";
import type { SearchService } from "./domain/services/search-service";
import type { WriteService } from "./domain/services/write-service";
import type { ReadService } from "./domain/services/read-service";
import type { RecallService } from "./domain/recall/recall-service";
import type { SessionService } from "./domain/services/session-service";
import type { FsStore } from "./domain/ports/fs-store";
import { registerAllTools } from "./adapters/driver/pi-tools/tool-registry";
import { registerAllCommands } from "./adapters/driver/pi-commands/command-registry";
import { OVWidget } from "./adapters/driver/ov-widget";
import { HealthCheck } from "./adapters/driven/openviking/health";

let initialized = false;
let config: PiOVConfig;
let logger: Logger;
let container: DIContainer;
let widget: OVWidget;
let healthCheck: HealthCheck;

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
      const recallService = container.resolve<RecallService>("recallService");
      const sessionService = container.resolve<SessionService>("sessionService");
      const fsStore = container.resolve<FsStore>("fsStore");

      // Create health check adapter
      healthCheck = new HealthCheck(config.ov.endpoint);

      // Register all 6 tools (once per process)
      registerAllTools(pi, { searchService, writeService, readService, recallService }, logger);

      // Register all 6 commands (once per process)
      registerAllCommands(pi, {
        recallService,
        sessionService,
        searchService,
        fsStore,
        ovConfig: config.ov,
        recallConfig: config.recall,
        widgetUpdater: (field, value) => widget.update(field, value),
      });
    }

    // Every session_start: attach widget, create session, then check health
    widget.attach(ctx.ui);

    try {
      const sessionService = container.resolve<SessionService>("sessionService");
      await sessionService.createAndSet();
      const active = sessionService.getActive();
      widget.update("session", active?.toString() ?? "-");
      widget.update("scope", config.recall.targetUri ?? "(global)");
    } catch {
      // Session creation failed — widget will show disconnected after health check
    }

    // Health check — probes /ready, does NOT affect CircuitBreaker
    const health = await healthCheck.check();
    widget.update("conn", health.ok ? "connected" : "disconnected");
  });
}
