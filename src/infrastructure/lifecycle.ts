import { DIContainer } from "../infrastructure/di/container";
import { loadConfig } from "../infrastructure/config/cascade";
import { FileLogger } from "../adapters/driven/logger/file-logger";
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

  return { config, logger, container };
}

export function shutdown(): void {
  // zero I/O — reset state only
}
