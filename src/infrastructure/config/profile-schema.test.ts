import { describe, it, expect } from "vitest";
import { ZodError } from "zod";
import {
  ProfileBehaviorSchema,
  ProfileConfigSchema,
  BUILTIN_PROFILES,
} from "./profile-schema";

describe("ProfileBehaviorSchema", () => {
  it("accepts empty object (all fields undefined)", () => {
    const result = ProfileBehaviorSchema.parse({});
    expect(result).toEqual({});
  });

  it("accepts all 6 fields valid", () => {
    const result = ProfileBehaviorSchema.parse({
      targetUri: "viking://docs/**",
      topN: 10,
      scoreThreshold: 0.7,
      searchMode: "search",
      expandGraph: true,
      autoRecall: false,
    });
    expect(result.targetUri).toBe("viking://docs/**");
    expect(result.topN).toBe(10);
    expect(result.scoreThreshold).toBe(0.7);
    expect(result.searchMode).toBe("search");
    expect(result.expandGraph).toBe(true);
    expect(result.autoRecall).toBe(false);
  });

  it("accepts partial fields", () => {
    const result = ProfileBehaviorSchema.parse({ topN: 5, searchMode: "find" });
    expect(result.topN).toBe(5);
    expect(result.searchMode).toBe("find");
    expect(result.targetUri).toBeUndefined();
    expect(result.scoreThreshold).toBeUndefined();
    expect(result.expandGraph).toBeUndefined();
    expect(result.autoRecall).toBeUndefined();
  });

  it("rejects topN negative", () => {
    expect(() => ProfileBehaviorSchema.parse({ topN: -1 })).toThrow(ZodError);
  });

  it("rejects topN float", () => {
    expect(() => ProfileBehaviorSchema.parse({ topN: 3.5 })).toThrow(ZodError);
  });

  it("rejects topN zero", () => {
    expect(() => ProfileBehaviorSchema.parse({ topN: 0 })).toThrow(ZodError);
  });

  it("rejects scoreThreshold > 1", () => {
    expect(() => ProfileBehaviorSchema.parse({ scoreThreshold: 1.5 })).toThrow(ZodError);
  });

  it("rejects scoreThreshold < 0", () => {
    expect(() => ProfileBehaviorSchema.parse({ scoreThreshold: -0.1 })).toThrow(ZodError);
  });

  it("accepts boundary scoreThreshold 0 and 1", () => {
    expect(ProfileBehaviorSchema.parse({ scoreThreshold: 0 }).scoreThreshold).toBe(0);
    expect(ProfileBehaviorSchema.parse({ scoreThreshold: 1 }).scoreThreshold).toBe(1);
  });

  it("rejects invalid searchMode", () => {
    expect(() => ProfileBehaviorSchema.parse({ searchMode: "hybrid" })).toThrow(ZodError);
  });

  it("rejects targetUri not string", () => {
    expect(() => ProfileBehaviorSchema.parse({ targetUri: 42 })).toThrow(ZodError);
  });

  it("rejects expandGraph not boolean", () => {
    expect(() => ProfileBehaviorSchema.parse({ expandGraph: "yes" })).toThrow(ZodError);
  });

  it("rejects autoRecall not boolean", () => {
    expect(() => ProfileBehaviorSchema.parse({ autoRecall: "true" })).toThrow(ZodError);
  });

  it("accepts topN=1 (boundary)", () => {
    const result = ProfileBehaviorSchema.parse({ topN: 1 });
    expect(result.topN).toBe(1);
  });
});

describe("ProfileConfigSchema with behavior", () => {
  it("accepts profile with empty behavior", () => {
    const result = ProfileConfigSchema.parse({
      name: "test",
      description: "Test profile",
      behavior: {},
    });
    expect(result.name).toBe("test");
    expect(result.behavior).toEqual({});
  });

  it("accepts profile with full behavior", () => {
    const result = ProfileConfigSchema.parse({
      name: "test",
      description: "Test",
      behavior: { topN: 10, searchMode: "search" },
    });
    expect(result.behavior.topN).toBe(10);
    expect(result.behavior.searchMode).toBe("search");
  });

  it("defaults behavior to empty object when omitted", () => {
    const result = ProfileConfigSchema.parse({
      name: "test",
      description: "Test",
    });
    expect(result.behavior).toEqual({});
  });
});

describe("BUILTIN_PROFILES with behaviors", () => {
  it("each builtin has behavior with correct fields per spec", () => {
    const expected = {
      default: { topN: 3, scoreThreshold: 0.5, searchMode: "find", autoRecall: true },
      "web-dev": { topN: 3, scoreThreshold: 0.5, searchMode: "search", autoRecall: true },
      docs: { topN: 5, scoreThreshold: 0.3, searchMode: "find", autoRecall: true },
      learning: { topN: 8, scoreThreshold: 0.2, searchMode: "search", autoRecall: true },
    };

    for (const [name, exp] of Object.entries(expected)) {
      const profile = BUILTIN_PROFILES[name];
      expect(profile).toBeDefined();
      expect(profile.behavior).toBeDefined();
      expect(profile.behavior.topN).toBe(exp.topN);
      expect(profile.behavior.scoreThreshold).toBe(exp.scoreThreshold);
      expect(profile.behavior.searchMode).toBe(exp.searchMode);
      expect(profile.behavior.autoRecall).toBe(exp.autoRecall);
      expect(profile.behavior.targetUri).toBeUndefined();
      expect(profile.behavior.expandGraph).toBeUndefined();
    }
  });

  it("all builtins parse through ProfileConfigSchema without error", () => {
    for (const [name, profile] of Object.entries(BUILTIN_PROFILES)) {
      const result = ProfileConfigSchema.parse(profile);
      expect(result.name).toBe(name);
    }
  });

  it("behavior is never stale — each builtin has a behavior field", () => {
    for (const profile of Object.values(BUILTIN_PROFILES)) {
      expect(profile).toHaveProperty("behavior");
      expect(typeof profile.behavior).toBe("object");
    }
  });
});
