import { describe, it, expect } from "vitest";
import { ZodError } from "zod";
import { ConfigSchema, DEFAULT_CONFIG, BUILTIN_PROFILES } from "./schema";
import type { PiOVConfig } from "./schema";

describe("ConfigSchema", () => {
  it("parse({}) returns valid config with all defaults filled", () => {
    const config = ConfigSchema.parse({});
    expect(config.logger.path).toBe("~/.pi/agent/pi-openviking.log");
    expect(config.logger.level).toBe("info");
    expect(config.logger.maxSize).toBe(10 * 1024 * 1024);
    expect(config.logger.maxFiles).toBe(5);
    expect(config.logger.maxAge).toBe(7 * 24 * 60 * 60 * 1000);
    expect(config.profile.activeProfile).toBe("default");
  });

  it("partial override keeps other defaults", () => {
    const config = ConfigSchema.parse({ logger: { level: "debug" } });
    expect(config.logger.level).toBe("debug");
    expect(config.logger.path).toBe("~/.pi/agent/pi-openviking.log");
    expect(config.logger.maxSize).toBe(10 * 1024 * 1024);
    expect(config.logger.maxFiles).toBe(5);
    expect(config.logger.maxAge).toBe(7 * 24 * 60 * 60 * 1000);
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
  });

  it("logger defaults match expected values", () => {
    expect(DEFAULT_CONFIG.logger.path).toBe("~/.pi/agent/pi-openviking.log");
    expect(DEFAULT_CONFIG.logger.level).toBe("info");
    expect(DEFAULT_CONFIG.logger.maxSize).toBe(10 * 1024 * 1024);
    expect(DEFAULT_CONFIG.logger.maxFiles).toBe(5);
    expect(DEFAULT_CONFIG.logger.maxAge).toBe(7 * 24 * 60 * 60 * 1000);
  });

  it("profile defaults to 'default'", () => {
    expect(DEFAULT_CONFIG.profile.activeProfile).toBe("default");
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
