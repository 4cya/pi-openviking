import { describe, it, expect } from "vitest";
import { NullLogger } from "../../adapters/driven/logger/null-logger";

describe("Logger interface contract", () => {
  it("defines all five Logger methods", () => {
    const log = new NullLogger();
    expect(typeof log.info).toBe("function");
    expect(typeof log.warn).toBe("function");
    expect(typeof log.error).toBe("function");
    expect(typeof log.debug).toBe("function");
    expect(typeof log.isEnabled).toBe("function");
  });

  it("accepts ctx as optional second parameter on all methods", () => {
    const log = new NullLogger();
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
    const log = new NullLogger();
    expect(typeof log.isEnabled("info")).toBe("boolean");
    expect(typeof log.isEnabled("debug")).toBe("boolean");
  });
});
