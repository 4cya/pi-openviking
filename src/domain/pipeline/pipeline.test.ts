import { describe, it, expect } from "vitest";
import { Pipeline } from "./pipeline";

describe("Pipeline", () => {
  it("executes handler directly with no middlewares", async () => {
    const pipeline = new Pipeline<string>();
    const result = await pipeline.execute(() => Promise.resolve("ok"));
    expect(result).toBe("ok");
  });

  it("wraps handler with single middleware", async () => {
    const pipeline = new Pipeline<string>();
    pipeline.use(async (next) => {
      const result = await next();
      return `wrapped(${result})`;
    });
    const result = await pipeline.execute(() => Promise.resolve("ok"));
    expect(result).toBe("wrapped(ok)");
  });

  it("composes multiple middlewares outer-to-inner", async () => {
    const pipeline = new Pipeline<string>();
    const order: string[] = [];
    pipeline.use(async (next) => {
      order.push("mw1-before");
      const r = await next();
      order.push("mw1-after");
      return `mw1(${r})`;
    });
    pipeline.use(async (next) => {
      order.push("mw2-before");
      const r = await next();
      order.push("mw2-after");
      return `mw2(${r})`;
    });
    const result = await pipeline.execute(async () => {
      order.push("handler");
      return "ok";
    });
    expect(result).toBe("mw1(mw2(ok))");
    expect(order).toEqual(["mw1-before", "mw2-before", "handler", "mw2-after", "mw1-after"]);
  });

  it("propagates handler errors without swallowing", async () => {
    const pipeline = new Pipeline<string>();
    pipeline.use(async (next) => next()); // middleware doesn't catch
    await expect(
      pipeline.execute(() => Promise.reject(new Error("boom"))),
    ).rejects.toThrow("boom");
  });

  it("passes AbortSignal to middlewares", async () => {
    const pipeline = new Pipeline<string>();
    let receivedSignal: AbortSignal | undefined;
    pipeline.use(async (next, signal) => {
      receivedSignal = signal;
      return next();
    });
    const controller = new AbortController();
    await pipeline.execute(() => Promise.resolve("ok"), controller.signal);
    expect(receivedSignal).toBe(controller.signal);
  });
});
