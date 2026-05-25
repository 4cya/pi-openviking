import { describe, test, expect } from "vitest";
import { resolveBudget } from "../../src/_legacy/auto-recall/resolve-budget";

describe("resolveBudget", () => {
  test("returns 700 fallback when usage is undefined", () => {
    expect(resolveBudget(undefined)).toBe(700);
  });

  test("returns 700 fallback when percent is null", () => {
    expect(resolveBudget({ tokens: null, contextWindow: 200000, percent: null })).toBe(700);
  });

  test("returns 1000 when context usage is below 50%", () => {
    expect(resolveBudget({ tokens: 50000, contextWindow: 200000, percent: 25 })).toBe(1000);
  });

  test("returns 1000 at exactly 0% usage", () => {
    expect(resolveBudget({ tokens: 0, contextWindow: 200000, percent: 0 })).toBe(1000);
  });

  test("returns 700 at exactly 50% boundary", () => {
    expect(resolveBudget({ tokens: 100000, contextWindow: 200000, percent: 50 })).toBe(700);
  });

  test("returns 700 at exactly 80% boundary", () => {
    expect(resolveBudget({ tokens: 160000, contextWindow: 200000, percent: 80 })).toBe(700);
  });

  test("returns 300 when context usage exceeds 80%", () => {
    expect(resolveBudget({ tokens: 180000, contextWindow: 200000, percent: 90 })).toBe(300);
  });

  test("returns 300 when usage exceeds 100%", () => {
    expect(resolveBudget({ tokens: 210000, contextWindow: 200000, percent: 105 })).toBe(300);
  });

  test("returns 700 fallback when percent is negative", () => {
    expect(resolveBudget({ tokens: -100, contextWindow: 200000, percent: -5 })).toBe(700);
  });
});
