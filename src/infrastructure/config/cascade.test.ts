import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { loadConfig } from "./cascade";
import { DEFAULT_CONFIG } from "./schema";

function withTempDir(fn: (dir: string) => void) {
  const dir = join(tmpdir(), `ov-cascade-${Date.now()}`);
  mkdirSync(dir, { recursive: true });
  try {
    fn(dir);
  } finally {
    // cleanup not needed
  }
}

const OLD_ENV = process.env;

describe("loadConfig", () => {
  beforeEach(() => {
    process.env = { ...OLD_ENV };
    for (const key of Object.keys(process.env)) {
      if (key.startsWith("OV_")) delete process.env[key];
    }
  });

  afterEach(() => {
    process.env = OLD_ENV;
  });

  it("returns DEFAULT_CONFIG when no env vars or settings file exist", () => {
    const result = loadConfig("/tmp/nonexistent-cascade-test");
    expect(result).toEqual(DEFAULT_CONFIG);
  });

  it("env OV_LOG_LEVEL=debug overrides default log level", () => {
    process.env.OV_LOG_LEVEL = "debug";
    const result = loadConfig("/tmp/nonexistent-cascade-test");
    expect(result.logger.level).toBe("debug");
    expect(result.logger.maxSize).toBe(DEFAULT_CONFIG.logger.maxSize);
    expect(result.logger.path).toBe(DEFAULT_CONFIG.logger.path);
  });

  it("env OV_LOG_PATH overrides default path", () => {
    process.env.OV_LOG_PATH = "/custom/path.log";
    const result = loadConfig("/tmp/nonexistent-cascade-test");
    expect(result.logger.path).toBe("/custom/path.log");
    expect(result.logger.level).toBe(DEFAULT_CONFIG.logger.level);
  });

  it("env OV_LOG_MAX_SIZE=999999 overrides default maxSize", () => {
    process.env.OV_LOG_MAX_SIZE = "999999";
    const result = loadConfig("/tmp/nonexistent-cascade-test");
    expect(result.logger.maxSize).toBe(999999);
  });

  it("settings.json overrides env var (pi-openviking namespace)", () => {
    withTempDir((dir) => {
      process.env.OV_LOG_LEVEL = "debug";
      const piDir = join(dir, ".pi");
      mkdirSync(piDir, { recursive: true });
      writeFileSync(join(piDir, "settings.json"), JSON.stringify({ "pi-openviking": { logger: { level: "warn" } } }));

      const result = loadConfig(dir);
      expect(result.logger.level).toBe("warn");
    });
  });

  it("settings.json can set activeProfile to a valid built-in profile", () => {
    withTempDir((dir) => {
      const piDir = join(dir, ".pi");
      mkdirSync(piDir, { recursive: true });
      writeFileSync(join(piDir, "settings.json"), JSON.stringify({ "pi-openviking": { profile: { activeProfile: "docs" } } }));

      const result = loadConfig(dir);
      expect(result.profile.activeProfile).toBe("docs");
    });
  });

  it("throws when activeProfile not found in profiles registry", () => {
    withTempDir((dir) => {
      const piDir = join(dir, ".pi");
      mkdirSync(piDir, { recursive: true });
      writeFileSync(join(piDir, "settings.json"), JSON.stringify({ "pi-openviking": { profile: { activeProfile: "nonexistent" } } }));

      expect(() => loadConfig(dir)).toThrow(/nonexistent/);
    });
  });

  it("env OV_TOP_N overrides recall.topN", () => {
    process.env.OV_TOP_N = "10";
    const result = loadConfig("/tmp/nonexistent-cascade-test");
    expect(result.recall.topN).toBe(10);
    expect(result.recall.scoreThreshold).toBe(DEFAULT_CONFIG.recall.scoreThreshold);
  });

  it("env OV_SCORE_THRESHOLD overrides recall.scoreThreshold", () => {
    process.env.OV_SCORE_THRESHOLD = "0.8";
    const result = loadConfig("/tmp/nonexistent-cascade-test");
    expect(result.recall.scoreThreshold).toBe(0.8);
  });

  it("env OV_SEARCH_MODE overrides recall.searchMode", () => {
    process.env.OV_SEARCH_MODE = "search";
    const result = loadConfig("/tmp/nonexistent-cascade-test");
    expect(result.recall.searchMode).toBe("search");
  });

  it("env OV_TARGET_URI overrides recall.targetUri", () => {
    process.env.OV_TARGET_URI = "viking://docs";
    const result = loadConfig("/tmp/nonexistent-cascade-test");
    expect(result.recall.targetUri).toBe("viking://docs");
  });

  it("env OV_EXPAND_GRAPH overrides recall.expandGraph", () => {
    process.env.OV_EXPAND_GRAPH = "true";
    const result = loadConfig("/tmp/nonexistent-cascade-test");
    expect(result.recall.expandGraph).toBe(true);
  });

  it("settings.json can override recall fields", () => {
    withTempDir((dir) => {
      const piDir = join(dir, ".pi");
      mkdirSync(piDir, { recursive: true });
      writeFileSync(join(piDir, "settings.json"), JSON.stringify({ "pi-openviking": { recall: { topN: 3, searchMode: "search" } } }));
      const result = loadConfig(dir);
      expect(result.recall.topN).toBe(3);
      expect(result.recall.searchMode).toBe("search");
      expect(result.recall.scoreThreshold).toBe(DEFAULT_CONFIG.recall.scoreThreshold);
    });
  });
});
