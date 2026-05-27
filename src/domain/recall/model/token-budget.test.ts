import { describe, it, expect } from "vitest";
import { TokenBudget } from "./token-budget";

describe("TokenBudget", () => {
  it("constructor sets max and defaults used to 0", () => {
    const b = new TokenBudget(500);
    expect(b).toBeInstanceOf(TokenBudget);
  });

  it("remaining() returns max minus used", () => {
    const b = new TokenBudget(1000);
    expect(b.remaining()).toBe(1000);
  });

  it("tryAllocate() returns true when budget suffices", () => {
    const b = new TokenBudget(500);
    const result = b.tryAllocate(200);
    expect(result).toBe(true);
    expect(b.remaining()).toBe(300);
  });

  it("tryAllocate() returns false when budget insufficient", () => {
    const b = new TokenBudget(500);
    b.tryAllocate(400);
    expect(b.tryAllocate(200)).toBe(false);
    expect(b.remaining()).toBe(100);
  });

  it("tryAllocate() does not change used when insufficient", () => {
    const b = new TokenBudget(500);
    b.tryAllocate(600);
    expect(b.remaining()).toBe(500);
  });

  it("reset() sets used back to 0", () => {
    const b = new TokenBudget(500);
    b.tryAllocate(300);
    expect(b.remaining()).toBe(200);
    b.reset();
    expect(b.remaining()).toBe(500);
  });

  it("works with zero max budget", () => {
    const b = new TokenBudget(0);
    expect(b.tryAllocate(1)).toBe(false);
    expect(b.remaining()).toBe(0);
  });

  it("accepts custom used value in constructor", () => {
    const b = new TokenBudget(500, 200);
    expect(b.remaining()).toBe(300);
  });
});
