import { describe, it, expect } from "vitest";
import type { Logger } from "./logger";

const noopLogger = (): Logger => ({
  info() {},
  warn() {},
  error() {},
  debug() {},
  isEnabled() { return true; },
});

describe("Logger interface contract", () => {
  it("defines all five Logger methods", () => {
    const log = noopLogger();
    expect(typeof log.info).toBe("function");
    expect(typeof log.warn).toBe("function");
    expect(typeof log.error).toBe("function");
    expect(typeof log.debug).toBe("function");
    expect(typeof log.isEnabled).toBe("function");
  });

  it("accepts ctx as optional second parameter on all methods", () => {
    const log = noopLogger();
    // Without ctx
    log.info("hello");
    log.warn("warning");
    log.error("error");
    log.debug("debug");
    // With ctx
    log.info("hello", { key: "val" });
    log.warn("warning", { code: 42 });
    log.error("error", { err: new Error("x") });
    log.debug("debug", { detail: "test" });
  });

  it("isEnabled returns boolean", () => {
    const log = noopLogger();
    expect(typeof log.isEnabled("info")).toBe("boolean");
    expect(typeof log.isEnabled("debug")).toBe("boolean");
  });
});
