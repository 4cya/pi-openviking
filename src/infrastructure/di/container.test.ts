import { describe, it, expect } from "vitest";
import { DIContainer } from "./container";

describe("DIContainer", () => {
  it("creates new instance each time for factory registration", () => {
    const container = new DIContainer();
    let callCount = 0;
    container.register("svc", () => { callCount++; return { id: callCount }; }, false);

    const a = container.resolve<{ id: number }>("svc");
    const b = container.resolve<{ id: number }>("svc");

    expect(a).not.toBe(b);
    expect(a.id).toBe(1);
    expect(b.id).toBe(2);
  });

  it("defaults to factory when singleton omitted", () => {
    const container = new DIContainer();
    container.register("svc", () => ({ id: Math.random() }));

    const a = container.resolve<{ id: number }>("svc");
    const b = container.resolve<{ id: number }>("svc");

    expect(a).not.toBe(b);
  });

  it("throws when resolving unregistered token", () => {
    const container = new DIContainer();
    expect(() => container.resolve("ghost")).toThrow("DI: ghost not registered");
  });

  it("returns same instance for singleton registration", () => {
    const container = new DIContainer();
    let callCount = 0;
    container.register("svc", () => { callCount++; return { id: 1 }; }, true);

    const a = container.resolve<{ id: number }>("svc");
    const b = container.resolve<{ id: number }>("svc");

    expect(a).toBe(b);
    expect(callCount).toBe(1);
  });
});
