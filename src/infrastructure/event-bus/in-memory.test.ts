import { describe, it, expect, vi } from "vitest";
import { InMemoryEventBus } from "./in-memory";
import type { DomainEvent } from "../../domain/ports/event-bus";
import type { Logger } from "../../domain/ports/logger";

describe("InMemoryEventBus", () => {
  it("implements publish and subscribe", () => {
    const bus = new InMemoryEventBus();
    const handler = vi.fn();
    bus.subscribe("MEMORY_SAVED", handler);
    bus.publish({ type: "MEMORY_SAVED", uri: "viking://test", source: "test" });
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it("subscribe returns an unsubscribe function", () => {
    const bus = new InMemoryEventBus();
    const handler = vi.fn();
    const unsub = bus.subscribe("MEMORY_SAVED", handler);
    unsub();
    bus.publish({ type: "MEMORY_SAVED", uri: "viking://test", source: "test" });
    expect(handler).not.toHaveBeenCalled();
  });

  it("only dispatches to handlers subscribed to that event type", () => {
    const bus = new InMemoryEventBus();
    const memoryHandler = vi.fn();
    const recallHandler = vi.fn();
    bus.subscribe("MEMORY_SAVED", memoryHandler);
    bus.subscribe("RECALL_EXECUTED", recallHandler);
    bus.publish({ type: "MEMORY_SAVED", uri: "viking://test", source: "test" });
    expect(memoryHandler).toHaveBeenCalledTimes(1);
    expect(recallHandler).not.toHaveBeenCalled();
  });

  it("handler exception does not prevent other handlers from executing", () => {
    const bus = new InMemoryEventBus();
    const goodHandler = vi.fn();
    const badHandler = () => { throw new Error("oops"); };
    bus.subscribe("MEMORY_SAVED", goodHandler);
    bus.subscribe("MEMORY_SAVED", badHandler);
    expect(() => {
      bus.publish({ type: "MEMORY_SAVED", uri: "viking://test", source: "test" });
    }).not.toThrow();
    expect(goodHandler).toHaveBeenCalledTimes(1);
  });

  it("getLog() returns all published events", () => {
    const bus = new InMemoryEventBus();
    bus.publish({ type: "MEMORY_SAVED", uri: "viking://a", source: "s1" });
    bus.publish({ type: "INTENT_DETECTED", category: "q", confidence: 0.9 });
    expect(bus.getLog()).toHaveLength(2);
    expect(bus.getLog()[0].type).toBe("MEMORY_SAVED");
    expect(bus.getLog()[1].type).toBe("INTENT_DETECTED");
  });

  it("clearLog() empties the event log", () => {
    const bus = new InMemoryEventBus();
    bus.publish({ type: "MEMORY_SAVED", uri: "viking://a", source: "s1" });
    expect(bus.getLog()).toHaveLength(1);
    bus.clearLog();
    expect(bus.getLog()).toHaveLength(0);
  });

  it("handlers receive the exact event object", () => {
    const bus = new InMemoryEventBus();
    const handler = vi.fn();
    bus.subscribe("BUDGET_EXCEEDED", handler);
    const event: DomainEvent = { type: "BUDGET_EXCEEDED", budget: 100, attempted: 200 };
    bus.publish(event);
    expect(handler).toHaveBeenCalledWith(event);
  });

  it("multiple handlers for same type all fire", () => {
    const bus = new InMemoryEventBus();
    const h1 = vi.fn();
    const h2 = vi.fn();
    bus.subscribe("MEMORY_SAVED", h1);
    bus.subscribe("MEMORY_SAVED", h2);
    bus.publish({ type: "MEMORY_SAVED", uri: "u", source: "s" });
    expect(h1).toHaveBeenCalledTimes(1);
    expect(h2).toHaveBeenCalledTimes(1);
  });

  it("unsubscribe removes only the specific handler", () => {
    const bus = new InMemoryEventBus();
    const h1 = vi.fn();
    const h2 = vi.fn();
    const unsub = bus.subscribe("MEMORY_SAVED", h1);
    bus.subscribe("MEMORY_SAVED", h2);
    unsub();
    bus.publish({ type: "MEMORY_SAVED", uri: "u", source: "s" });
    expect(h1).not.toHaveBeenCalled();
    expect(h2).toHaveBeenCalledTimes(1);
  });

  it("logs handler error when Logger is provided", () => {
    const errorFn = vi.fn();
    const logger: Logger = {
      info: vi.fn(),
      warn: vi.fn(),
      error: errorFn,
      debug: vi.fn(),
      isEnabled: () => true,
    };
    const bus = new InMemoryEventBus(logger);
    bus.subscribe("MEMORY_SAVED", () => { throw new Error("crash"); });
    bus.publish({ type: "MEMORY_SAVED", uri: "u", source: "s" });
    expect(errorFn).toHaveBeenCalled();
  });

  it("does not crash when no Logger provided and handler throws", () => {
    const bus = new InMemoryEventBus();
    bus.subscribe("MEMORY_SAVED", () => { throw new Error("crash"); });
    expect(() => {
      bus.publish({ type: "MEMORY_SAVED", uri: "u", source: "s" });
    }).not.toThrow();
  });
});
