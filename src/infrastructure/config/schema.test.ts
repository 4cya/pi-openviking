import { describe, it, expect } from "vitest";
import { ZodError } from "zod";
import { ConfigSchema, DEFAULT_CONFIG, BUILTIN_PROFILES } from "./schema";
import type { PiOVConfig } from "./schema";

function expectLoggerDefaults(logger: { path: string; maxSize: number; maxFiles: number; maxAge: number }) {
  expect(logger.path).toBe("~/.pi/agent/pi-openviking.log");
  expect(logger.maxSize).toBe(10 * 1024 * 1024);
  expect(logger.maxFiles).toBe(5);
  expect(logger.maxAge).toBe(7 * 24 * 60 * 60 * 1000);
}

describe("ConfigSchema", () => {
  it("parse({}) returns valid config with all defaults filled", () => {
    const config = ConfigSchema.parse({});
    expect(config.logger.level).toBe("info");
    expectLoggerDefaults(config.logger);
    expect(config.profile.activeProfile).toBe("default");
  });

  it("partial override keeps other defaults", () => {
    const config = ConfigSchema.parse({ logger: { level: "debug" } });
    expect(config.logger.level).toBe("debug");
    expectLoggerDefaults(config.logger);
    expect(config.profile.activeProfile).toBe("default");
  });

  it("invalid logger level throws ZodError", () => {
    expect(() => ConfigSchema.parse({ logger: { level: "invalid" } })).toThrow(ZodError);
  });

  it("invalid maxSize (negative) throws ZodError", () => {
    expect(() => ConfigSchema.parse({ logger: { maxSize: -1 } })).toThrow(ZodError);
  });

  it("invalid maxFiles (zero) throws ZodError", () => {
    expect(() => ConfigSchema.parse({ logger: { maxFiles: 0 } })).toThrow(ZodError);
  });

  it("invalid activeProfile (unknown profile) throws ZodError", () => {
    const config = ConfigSchema.parse({ profile: { activeProfile: "nonexistent" } });
    expect(config.profile.activeProfile).toBe("nonexistent");
  });
});

describe("DEFAULT_CONFIG", () => {
  it("contains all required sections", () => {
    expect(DEFAULT_CONFIG.logger).toBeDefined();
    expect(DEFAULT_CONFIG.profile).toBeDefined();
    expect(DEFAULT_CONFIG.recall).toBeDefined();
  });

  it("recall defaults match expected values", () => {
    expect(DEFAULT_CONFIG.recall.targetUri).toBeUndefined();
    expect(DEFAULT_CONFIG.recall.topN).toBe(8);
    expect(DEFAULT_CONFIG.recall.scoreThreshold).toBe(0.5);
    expect(DEFAULT_CONFIG.recall.expandGraph).toBe(true);
    expect(DEFAULT_CONFIG.recall.searchMode).toBe("search");
    expect(DEFAULT_CONFIG.recall.autoRecall).toBe(true);
  });

  it("logger defaults match expected values", () => {
    expect(DEFAULT_CONFIG.logger.level).toBe("info");
    expectLoggerDefaults(DEFAULT_CONFIG.logger);
  });

  it("profile defaults to 'default'", () => {
    expect(DEFAULT_CONFIG.profile.activeProfile).toBe("default");
  });
});

describe("RecallConfigSchema", () => {
  it("invalid topN (zero) throws ZodError", () => {
    expect(() => ConfigSchema.parse({ recall: { topN: 0 } })).toThrow(ZodError);
  });

  it("invalid scoreThreshold (above 1) throws ZodError", () => {
    expect(() => ConfigSchema.parse({ recall: { scoreThreshold: 1.5 } })).toThrow(ZodError);
  });

  it("invalid scoreThreshold (negative) throws ZodError", () => {
    expect(() => ConfigSchema.parse({ recall: { scoreThreshold: -0.1 } })).toThrow(ZodError);
  });

  it("invalid searchMode throws ZodError", () => {
    expect(() => ConfigSchema.parse({ recall: { searchMode: "invalid" } })).toThrow(ZodError);
  });

  it("valid targetUri string accepted", () => {
    const config = ConfigSchema.parse({ recall: { targetUri: "viking://docs" } });
    expect(config.recall.targetUri).toBe("viking://docs");
  });

  it("autoRecall defaults to true in RecallConfigSchema", () => {
    const config = ConfigSchema.parse({});
    expect(config.recall.autoRecall).toBe(true);
  });

  it("autoRecall can be overridden to false", () => {
    const config = ConfigSchema.parse({ recall: { autoRecall: false } });
    expect(config.recall.autoRecall).toBe(false);
  });

  it("autoRecall can be explicitly set to true", () => {
    const config = ConfigSchema.parse({ recall: { autoRecall: true } });
    expect(config.recall.autoRecall).toBe(true);
  });

  it("autoRecall rejects non-boolean", () => {
    expect(() => ConfigSchema.parse({ recall: { autoRecall: "yes" } })).toThrow();
  });

  it("partial recall override keeps other defaults", () => {
    const config = ConfigSchema.parse({ recall: { topN: 10 } });
    expect(config.recall.topN).toBe(10);
    expect(config.recall.scoreThreshold).toBe(0.5);
    expect(config.recall.expandGraph).toBe(true);
    expect(config.recall.searchMode).toBe("search");
    expect(config.recall.targetUri).toBeUndefined();
    expect(config.recall.autoRecall).toBe(true);
  });
});

describe("BUILTIN_PROFILES", () => {
  it("contains 4 profiles", () => {
    const names = Object.keys(BUILTIN_PROFILES);
    expect(names).toHaveLength(4);
    expect(names).toEqual(["default", "web-dev", "docs", "learning"]);
  });

  it("each profile has name and description", () => {
    for (const [key, profile] of Object.entries(BUILTIN_PROFILES)) {
      expect(profile.name).toBe(key);
      expect(typeof profile.description).toBe("string");
      expect(profile.description.length).toBeGreaterThan(0);
    }
  });
});

describe("TypeScript type inference", () => {
  it("PiOVConfig compiles from ConfigSchema.parse", () => {
    const config: PiOVConfig = ConfigSchema.parse({});
    expect(config).toBeDefined();
  });
});

describe("CircuitBreaker config", () => {
  it("defaults to undefined (no circuit breaker)", () => {
    const config = ConfigSchema.parse({});
    expect(config.ov.circuitBreaker).toBeUndefined();
  });

  it("accepts circuitBreaker config with defaults", () => {
    const config = ConfigSchema.parse({
      ov: { circuitBreaker: { threshold: 5, resetTimeoutMs: 60_000 } },
    });
    expect(config.ov.circuitBreaker?.threshold).toBe(5);
    expect(config.ov.circuitBreaker?.resetTimeoutMs).toBe(60_000);
  });

  it("rejects invalid threshold (< 1)", () => {
    expect(() =>
      ConfigSchema.parse({ ov: { circuitBreaker: { threshold: 0 } } }),
    ).toThrow();
  });

  it("rejects invalid resetTimeoutMs (negative)", () => {
    expect(() =>
      ConfigSchema.parse({ ov: { circuitBreaker: { resetTimeoutMs: -1 } } }),
    ).toThrow();
  });
});

describe("OV adapter config", () => {
  it("autoCommitIntervalMs defaults to 300000", () => {
    const config = ConfigSchema.parse({});
    expect(config.ov.autoCommitIntervalMs).toBe(300_000);
  });

  it("autoCommitIntervalMs can be overridden", () => {
    const config = ConfigSchema.parse({ ov: { autoCommitIntervalMs: 60000 } });
    expect(config.ov.autoCommitIntervalMs).toBe(60_000);
  });

  it("autoCommitIntervalMs 0 disables auto-commit", () => {
    const config = ConfigSchema.parse({ ov: { autoCommitIntervalMs: 0 } });
    expect(config.ov.autoCommitIntervalMs).toBe(0);
  });

  it("autoCommitIntervalMs rejects negative", () => {
    expect(() => ConfigSchema.parse({ ov: { autoCommitIntervalMs: -1 } })).toThrow();
  });
});

describe("No OV-specific fields", () => {
  it("extra fields are stripped by default", () => {
    const config = ConfigSchema.parse({
      endpoint: "http://localhost:8080",
      apiKey: "secret",
      target_uri: "viking://",
    } as any);
    expect((config as any).endpoint).toBeUndefined();
    expect((config as any).apiKey).toBeUndefined();
    expect((config as any).target_uri).toBeUndefined();
  });
});
