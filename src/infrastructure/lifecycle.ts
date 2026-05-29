import { DIContainer } from "../infrastructure/di/container";
import { loadConfig } from "../infrastructure/config/cascade";
import { FileLogger } from "../adapters/driven/logger/file-logger";
import { createOVAdapter } from "../adapters/driven/openviking/adapter";
import { RecallCurator } from "../domain/recall/recall-curator";
import { RecallService } from "../domain/recall/recall-service";
import { SessionService } from "../domain/services/session-service";
import type { Logger } from "../domain/ports/logger";
import type { PiOVConfig } from "../infrastructure/config/schema";

export async function init(cwd: string): Promise<{
  config: PiOVConfig;
  logger: Logger;
  container: DIContainer;
}> {
  const config = loadConfig(cwd);
  const logger = new FileLogger(config.logger);
  const container = new DIContainer();

  container.register("config", () => config, true);
  container.register("logger", () => logger, true);

  // Create OV adapter and register all port implementations
  const adapter = createOVAdapter(config.ov, logger);
  container.register("knowledgeBase", () => adapter.knowledgeBase, true);
  container.register("fsStore", () => adapter.fsStore, true);
  container.register("graphStore", () => adapter.graphStore, true);
  container.register("sessionStore", () => adapter.sessionStore, true);

  // F4 — domain services
  const recallCurator = new RecallCurator(config.recall, [], logger);
  container.register("recallCurator", () => recallCurator, true);

  const sessionService = new SessionService(adapter.sessionStore, {
    commitTimeout: config.ov.commitTimeout,
  });
  container.register("sessionService", () => sessionService, true);

  const recallService = new RecallService(
    adapter.knowledgeBase,
    recallCurator,
    config.recall,
    logger,
    true,
  );
  container.register("recallService", () => recallService, true);

  return { config, logger, container };
}

export function shutdown(): void {
  // zero I/O — reset state only
}
