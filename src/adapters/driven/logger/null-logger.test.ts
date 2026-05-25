import { describe, it, expect } from "vitest";
import { NullLogger } from "./null-logger";

describe("NullLogger", () => {
  it("implements Logger interface without throwing", () => {
    const log = new NullLogger();
    log.info("test");
    log.warn("test");
    log.error("test");
    log.debug("test");
    log.info("with ctx", { key: 42 });
  });

  it("isEnabled returns false for all levels", () => {
    const log = new NullLogger();
    expect(log.isEnabled("debug")).toBe(false);
    expect(log.isEnabled("info")).toBe(false);
    expect(log.isEnabled("warn")).toBe(false);
    expect(log.isEnabled("error")).toBe(false);
  });
});
