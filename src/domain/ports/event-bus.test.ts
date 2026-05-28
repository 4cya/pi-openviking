import { describe, it, expect } from "vitest";
import type { DomainEvent, EventHandler, EventBus } from "./event-bus";

describe("DomainEvent", () => {
  it("MEMORY_SAVED has correct shape", () => {
    const e: DomainEvent = { type: "MEMORY_SAVED", uri: "viking://test", source: "svc" };
    expect(e.type).toBe("MEMORY_SAVED");
  });

  it("RELATION_LINKED has correct shape", () => {
    const e: DomainEvent = { type: "RELATION_LINKED", source: "a", target: "b", predicate: "ref" };
    expect(e.type).toBe("RELATION_LINKED");
  });

  it("RECALL_EXECUTED has correct shape", () => {
    const e: DomainEvent = { type: "RECALL_EXECUTED", itemsCount: 5, durationMs: 42 };
    expect(e.itemsCount).toBe(5);
  });

  it("BUDGET_EXCEEDED has correct shape", () => {
    const e: DomainEvent = { type: "BUDGET_EXCEEDED", budget: 100, attempted: 200 };
    expect(e.attempted).toBe(200);
  });
});

describe("EventBus interface", () => {
  it("can be satisfied by a mock", () => {
    const mock: EventBus = {
      publish: () => {},
      subscribe: () => () => {},
    };
    expect(typeof mock.publish).toBe("function");
    expect(typeof mock.subscribe).toBe("function");
  });

  it("subscribe returns an unsubscribe function", () => {
    const mock: EventBus = {
      publish: () => {},
      subscribe: () => {
        const unsub = () => {};
        return unsub;
      },
    };
    const unsub = mock.subscribe("MEMORY_SAVED", () => {});
    expect(typeof unsub).toBe("function");
    // calling unsubscribe should not throw
    unsub();
  });
});

describe("EventHandler", () => {
  it("can handle any DomainEvent", () => {
    const handler: EventHandler = (e: DomainEvent) => {
      expect(e.type).toBeDefined();
    };
    const event: DomainEvent = { type: "MEMORY_SAVED", uri: "x", source: "y" };
    handler(event);
  });
});
