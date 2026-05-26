import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, mkdirSync, rmSync, existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { init, shutdown } from "./lifecycle";
import { FileLogger } from "../adapters/driven/logger/file-logger";
import type { Logger } from "../domain/ports/logger";

const OLD_ENV = process.env;

describe("init", () => {
  let tmpDir: string;

  beforeEach(() => {
    process.env = { ...OLD_ENV };
    for (const key of Object.keys(process.env)) {
      if (key.startsWith("OV_")) delete process.env[key];
    }
    tmpDir = mkdtempSync(join(tmpdir(), "lifecycle-test-"));
    mkdirSync(join(tmpDir, ".pi"), { recursive: true });
  });

  afterEach(() => {
    process.env = OLD_ENV;
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it("returns config, logger and container", async () => {
    const result = await init(tmpDir);
    expect(result).toHaveProperty("config");
    expect(result).toHaveProperty("logger");
    expect(result).toHaveProperty("container");
  });

  it("container resolves config token", async () => {
    const { container } = await init(tmpDir);
    const config = container.resolve("config");
    expect(config).toBeDefined();
    expect(typeof config).toBe("object");
  });

  it("container resolves logger as FileLogger", async () => {
    const { container } = await init(tmpDir);
    const logger = container.resolve<Logger>("logger");
    expect(logger).toBeInstanceOf(FileLogger);
    expect(typeof logger.info).toBe("function");
    expect(typeof logger.isEnabled).toBe("function");
  });

  it("logger uses resolved config — OV_LOG_PATH controls output file", async () => {
    const logFile = join(tmpDir, "custom-test.log");
    process.env.OV_LOG_PATH = logFile;

    const { logger } = await init(tmpDir);
    logger.info("custom path test");

    expect(existsSync(logFile)).toBe(true);
    const content = readFileSync(logFile, "utf-8");
    expect(content).toContain("custom path test");
  });
});

describe("shutdown", () => {
  it("does not throw", () => {
    expect(() => shutdown()).not.toThrow();
  });
});
