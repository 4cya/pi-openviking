import { describe, it, expect } from "vitest";
import type { Middleware } from "./pipeline";
import { loggingMiddleware } from "./logging-middleware";
import type { Logger } from "../ports/logger";

function makeLogger() {
  const logs: { level: string; msg: string; ctx?: Record<string, unknown> }[] = [];
  const logger: Logger = {
    info: (msg, ctx) => logs.push({ level: "info", msg, ctx }),
    warn: (msg, ctx) => logs.push({ level: "warn", msg, ctx }),
    error: (msg, ctx) => logs.push({ level: "error", msg, ctx }),
    debug: (msg, ctx) => logs.push({ level: "debug", msg, ctx }),
    isEnabled: () => true,
  };
  return { logger, logs };
}

describe("LoggingMiddleware", () => {
  it("logs handler duration via Logger", async () => {
    const { logger, logs } = makeLogger();
    const mw: Middleware<string> = loggingMiddleware("testOp", logger);
    const result = await mw(() => Promise.resolve("done"));
    expect(result).toBe("done");
    expect(logs).toHaveLength(1);
    expect(logs[0].level).toBe("info");
    expect(logs[0].msg).toContain("testOp");
    expect(logs[0].ctx).toHaveProperty("durationMs");
    expect(typeof logs[0].ctx!.durationMs).toBe("number");
  });

  it("logs error duration when handler throws", async () => {
    const { logger, logs } = makeLogger();
    const mw: Middleware<string> = loggingMiddleware("failOp", logger);
    await expect(mw(() => Promise.reject(new Error("boom")))).rejects.toThrow("boom");
    expect(logs).toHaveLength(1);
    expect(logs[0].level).toBe("error");
    expect(logs[0].ctx).toHaveProperty("durationMs");
  });
});
