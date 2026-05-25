import { describe, it, expect } from "vitest";
import { resolveHome } from "./path-resolver";

describe("resolveHome", () => {
  const origHome = process.env.HOME;

  afterEach(() => {
    process.env.HOME = origHome;
  });

  it("replaces ~/ with HOME", () => {
    process.env.HOME = "/home/test";
    expect(resolveHome("~/foo/bar")).toBe("/home/test/foo/bar");
  });

  it("returns path unchanged when no ~", () => {
    expect(resolveHome("/tmp/test.log")).toBe("/tmp/test.log");
  });

  it("does not expand ~ without trailing slash", () => {
    expect(resolveHome("~foo")).toBe("~foo");
  });
});
