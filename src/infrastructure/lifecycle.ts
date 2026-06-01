import { DIContainer } from "../infrastructure/di/container";
import { loadConfig, mergeBehaviorIntoRecall } from "../infrastructure/config/cascade";
import { FileLogger } from "../adapters/driven/logger/file-logger";
import { createOVAdapter } from "../adapters/driven/openviking/adapter";
import { RecallCurator } from "../domain/recall/recall-curator";
import { GraphExpander } from "../domain/recall/graph-expander";
import { relevanceScorer, temporalScorer } from "../domain/recall/curate";
import { RecallService } from "../domain/recall/recall-service";
import { SessionService } from "../domain/services/session-service";
import { SearchService } from "../domain/services/search-service";
import { WriteService } from "../domain/services/write-service";
import { ReadService } from "../domain/services/read-service";
import { ProfileManager } from "../domain/profile/service/ProfileManager";
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
  container.register("adapter", () => adapter, true);
  container.register("knowledgeBase", () => adapter.knowledgeBase, true);
  container.register("fsStore", () => adapter.fsStore, true);
  container.register("graphStore", () => adapter.graphStore, true);
  container.register("sessionStore", () => adapter.sessionStore, true);

  // F7a — ProfileManager: create, resolve active profile, merge into recall config
  const profileManager = new ProfileManager(
    config.profile.profiles,
    config.profile.activeProfile,
  );
  container.register("profileManager", () => profileManager, true);

  const mergedRecall = mergeBehaviorIntoRecall(
    config.recall,
    profileManager.resolve(profileManager.getActive()),
  );
  // Mutate config in-place so services receive merged config
  // (config is a fresh Zod-parsed object from loadConfig())
  Object.assign(config.recall, mergedRecall);

  // F4 — domain services
  const graphExpander = config.recall.expandGraph
    ? new GraphExpander(
        adapter.graphStore,
        adapter.fsStore,
        {
          expandGraphMaxRatio: config.recall.expandGraphMaxRatio,
          expandGraphMinSeedScore: config.recall.expandGraphMinSeedScore,
        },
        logger,
      )
    : undefined;
  container.register("graphExpander", () => graphExpander, true);

  const recallCurator = new RecallCurator(config.recall, [relevanceScorer, temporalScorer], logger, graphExpander);
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

  // F5 — application services
  const searchService = new SearchService(adapter.knowledgeBase, config.recall, logger);
  container.register("searchService", () => searchService, true);

  const writeService = new WriteService(adapter.fsStore);
  container.register("writeService", () => writeService, true);

  const readService = new ReadService(adapter.fsStore);
  container.register("readService", () => readService, true);

  return { config, logger, container };
}

export function shutdown(): void {
  // zero I/O — reset state only
}
