import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { init } from "./infrastructure/lifecycle";
import type { SearchService } from "./domain/services/search-service";
import type { FsStoreService } from "./domain/services/fs-store-service";
import type { RecallService } from "./domain/recall/recall-service";
import type { SessionService } from "./domain/services/session-service";
import type { ResourceService } from "./domain/services/resource-service";
import type { OVAdapter } from "./adapters/driven/openviking/adapter";
import type { FsStore } from "./domain/ports/fs-store";
import type { KnowledgeBase } from "./domain/ports/knowledge-base";
import type { ProfileManager } from "./domain/profile/service/ProfileManager";
import { registerAllTools } from "./adapters/driver/pi-tools/tool-registry";
import { registerAllCommands } from "./adapters/driver/pi-commands/command-registry";
import { OVWidget } from "./adapters/driver/ov-widget";
import { HealthCheck } from "./adapters/driven/openviking/health";
import {
  registerLifecycleHooks,
  handleSessionStart,
  type LifecycleServices,
} from "./adapters/driver/pi-lifecycle/register-lifecycle-hooks";

let initialized = false;
let lifecycleServices: LifecycleServices;

export default async function openVikingExtension(pi: ExtensionAPI): Promise<void> {
  pi.on("session_start", async (_event, ctx) => {
    // One-time initialization (guard prevents re-init on fork/resume/reload)
    if (!initialized) {
      const result = await init(ctx.cwd);
      const { config, logger, container } = result;

      // Create shared widget instance (Driver adapter, not DI-registered)
      const widget = new OVWidget();

      // Resolve all services from DI container
      const searchService = container.resolve<SearchService>("searchService");
      const fsStoreService = container.resolve<FsStoreService>("fsStoreService");
      const recallService = container.resolve<RecallService>("recallService");
      const sessionService = container.resolve<SessionService>("sessionService");
      const fsStore = container.resolve<FsStore>("fsStore");
      const knowledgeBase = container.resolve<KnowledgeBase>("knowledgeBase");
      const profileManager = container.resolve<ProfileManager>("profileManager");
      const adapter = container.resolve<OVAdapter>("adapter");
      const resourceService = container.resolve<ResourceService>("resourceService");

      const healthCheck = new HealthCheck(config.ov.endpoint);

      // Register tools and commands (once per process)
      registerAllTools(pi, { searchService, fsStoreService, recallService, resourceService }, logger);
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

      // Register lifecycle hooks and store services for per-session handler
      lifecycleServices = {
        logger,
        sessionService,
        recallService,
        adapter,
        widget,
        healthCheck,
        profileManager,
        autoDetectRules: config.profile.autoDetectRules,
      };
      registerLifecycleHooks(pi, lifecycleServices);

      // Reset guard on shutdown so fork/resume gets a fresh init
      pi.on("session_shutdown", () => {
        initialized = false;
      });

      initialized = true;
    }

    // Per-session work (runs on every session_start including fork/resume)
    await handleSessionStart(ctx, lifecycleServices);
  });
}
