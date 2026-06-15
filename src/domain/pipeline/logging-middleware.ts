import type { Middleware } from "./pipeline";
import type { Logger } from "../ports/logger";

export function loggingMiddleware<T>(label: string, logger: Logger): Middleware<T> {
  return async (next) => {
    const start = Date.now();
    try {
      const result = await next();
      const durationMs = Date.now() - start;
      logger.info(`${label} completed`, { durationMs });
      return result;
    } catch (err) {
      const durationMs = Date.now() - start;
      logger.error(`${label} failed`, { durationMs, error: String(err) });
      throw err;
    }
  };
}
