import { describe, it, expect } from "vitest";
import { Uri } from "./uri";

describe("Uri", () => {
  it("accepts valid viking:// URI", () => {
    const uri = new Uri("viking://resources/docs/api.md");
    expect(uri).toBeInstanceOf(Uri);
  });

  it("throws on missing viking:// prefix", () => {
    expect(() => new Uri("http://example.com")).toThrow();
    expect(() => new Uri("resources/docs")).toThrow();
  });

  it("throws on empty string", () => {
    expect(() => new Uri("")).toThrow();
  });

  it("toString() returns raw value", () => {
    const uri = new Uri("viking://test/path");
    expect(uri.toString()).toBe("viking://test/path");
  });

  it("equals() compares by value", () => {
    const a = new Uri("viking://same/path");
    const b = new Uri("viking://same/path");
    expect(a.equals(b)).toBe(true);
  });

  it("equals() returns false for different values", () => {
    const a = new Uri("viking://path/a");
    const b = new Uri("viking://path/b");
    expect(a.equals(b)).toBe(false);
  });
});
