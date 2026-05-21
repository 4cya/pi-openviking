import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { loadConfig } from "./shared/config";
import type { ToolRegisterDeps } from "./shared/tool-def";
import { createClient } from "./ov-client/client";
import { createTransport, type Transport } from "./ov-client/transport";
import { logger } from "./shared/logger";
import { registerMemsearchTool } from "./tools/search";
import { registerMemreadTool } from "./tools/read";
import { registerMembrowseTool } from "./tools/browse";
import { registerMemcommitTool } from "./tools/commit";
import { registerMemdeleteTool } from "./tools/delete";
import { registerMemimportTool } from "./tools/import";
import { registerSearchCommand } from "./commands/search";
import { registerBrowseCommand } from "./commands/browse";
import { registerImportCommand } from "./commands/import";
import { registerDeleteCommand } from "./commands/delete";
import { registerRecallCommand } from "./commands/recall";
import { registerCommitCommand } from "./commands/commit";
import type { CommandRegisterDeps } from "./commands/types";
import { SessionSync } from "./session-sync/session";
import { createAutoRecall } from "./auto-recall/auto-recall";
import { createHealthChecker, type HealthChecker } from "./shared/health";

export const TOOLS = [
  registerMemsearchTool,
  registerMemreadTool,
  registerMembrowseTool,
  registerMemcommitTool,
  registerMemdeleteTool,
  registerMemimportTool,
];

export const COMMANDS = [
  registerSearchCommand,
  registerBrowseCommand,
  registerImportCommand,
  registerDeleteCommand,
  registerRecallCommand,
  registerCommitCommand,
];

export interface BootstrapContext {
  cwd: string;
  sessionManager: {
    getSessionFile(): string | undefined;
    getBranch(): Array<{ type: string; customType?: string; data?: unknown }>;
  };
}

export interface BootstrapResult {
  sessionSync: SessionSync;
  healthChecker: HealthChecker;
}

export function bootstrapExtension(
  pi: ExtensionAPI,
  ctx: BootstrapContext,
  transport?: Transport,
): BootstrapResult {
  const config = loadConfig(ctx.cwd);
  const t = transport ?? createTransport(config);
  const client = createClient(config, t);

  // Health check with graceful degradation
  const healthChecker = createHealthChecker(t, config.healthPath);

  // Fire-and-forget initial health probe
  void healthChecker.check().then((ok) => {
    logger.debug("initial health check:", ok ? "available" : "unavailable");
  });

  const sessionSync = new SessionSync(client, {
    getSessionFile: () => ctx.sessionManager.getSessionFile(),
    getBranch: () => ctx.sessionManager.getBranch(),
    appendEntry: (type, data) => pi.appendEntry(type, data),
  });

  logger.debug("session sync created");

  const toolDeps: ToolRegisterDeps = { client, sync: sessionSync, healthChecker };
  for (const register of TOOLS) register(pi, toolDeps);

  const autoRecallState = { enabled: config.openVikingAutoRecall };

  const cmdDeps: CommandRegisterDeps = { pi, client, sync: sessionSync, autoRecallState };
  for (const register of COMMANDS) register(cmdDeps);

  const autoRecall = createAutoRecall(client, sessionSync, autoRecallState, {
    limit: config.autoRecallLimit,
    timeout: config.autoRecallTimeout,
    topN: config.autoRecallTopN,
    curateOptions: {
      scoreThreshold: config.autoRecallScoreThreshold,
      maxContentChars: config.autoRecallMaxContentChars,
      preferAbstract: config.autoRecallPreferAbstract,
      maxTokens: config.autoRecallTokenBudget,
    },
  });
  pi.on("before_agent_start", async (event) => {
    // On-demand recovery: re-check health if previously unavailable
    if (!healthChecker.isAvailable()) {
      const recovered = await healthChecker.check();
      if (recovered) {
        logger.debug("health check recovered");
        sessionSync.recover();
      }
    }
    if (!healthChecker.isAvailable()) return;
    return autoRecall(event);
  });

  return { sessionSync, healthChecker };
}
