import { describe, test, expect, vi, beforeEach } from "vitest";
import { createHealthChecker } from "../../src/_legacy/shared/health";
import type { Transport } from "../../src/_legacy/ov-client/transport";

function mockTransport() {
  return {
    request: vi.fn(async () => ({})),
  };
}

describe("HealthChecker", () => {
  test("check returns true when server responds", async () => {
    const transport = mockTransport();
    transport.request.mockResolvedValue({ status: "ok" });

    const hc = createHealthChecker(transport, "/health");
    const result = await hc.check();

    expect(result).toBe(true);
    expect(hc.isAvailable()).toBe(true);
    expect(transport.request).toHaveBeenCalledWith(
      "healthCheck",
      "/health",
      undefined,
      undefined,
    );
  });

  test("check returns false when server unreachable", async () => {
    const transport = mockTransport();
    transport.request.mockRejectedValue(new Error("ECONNREFUSED"));

    const hc = createHealthChecker(transport, "/health");
    const result = await hc.check();

    expect(result).toBe(false);
    expect(hc.isAvailable()).toBe(false);
  });

  test("check returns false on timeout", async () => {
    const transport = mockTransport();
    transport.request.mockRejectedValue(new Error("request timed out"));

    const hc = createHealthChecker(transport, "/health");
    const result = await hc.check();

    expect(result).toBe(false);
    expect(hc.isAvailable()).toBe(false);
  });

  test("recovery: check flips isAvailable from false to true", async () => {
    const transport = mockTransport();
    transport.request.mockRejectedValueOnce(new Error("down"));
    transport.request.mockResolvedValue({ status: "ok" });

    const hc = createHealthChecker(transport, "/health");

    await hc.check();
    expect(hc.isAvailable()).toBe(false);

    await hc.check();
    expect(hc.isAvailable()).toBe(true);
  });

  test("uses custom health path", async () => {
    const transport = mockTransport();
    transport.request.mockResolvedValue({ status: "ok" });

    const hc = createHealthChecker(transport, "/api/healthz");
    await hc.check();

    expect(transport.request).toHaveBeenCalledWith(
      "healthCheck",
      "/api/healthz",
      undefined,
      undefined,
    );
  });

  test("defaults to /health when no path provided", async () => {
    const transport = mockTransport();
    transport.request.mockResolvedValue({ status: "ok" });

    const hc = createHealthChecker(transport);
    await hc.check();

    expect(transport.request).toHaveBeenCalledWith(
      "healthCheck",
      "/health",
      undefined,
      undefined,
    );
  });

  describe("onChange callback", () => {
    test("fires onChange when state transitions from false to true", async () => {
      const transport = mockTransport();
      const onChange = vi.fn();
      transport.request.mockResolvedValue({ status: "ok" });

      const hc = createHealthChecker(transport, "/health", { onChange });
      await hc.check();

      expect(onChange).toHaveBeenCalledWith(true);
    });

    test("fires onChange when state transitions from true to false", async () => {
      const transport = mockTransport();
      const onChange = vi.fn();
      transport.request.mockResolvedValueOnce({ status: "ok" });
      transport.request.mockRejectedValueOnce(new Error("down"));

      const hc = createHealthChecker(transport, "/health", { onChange });
      await hc.check(); // true
      await hc.check(); // false

      expect(onChange).toHaveBeenCalledTimes(2);
      expect(onChange).toHaveBeenNthCalledWith(1, true);
      expect(onChange).toHaveBeenNthCalledWith(2, false);
    });

    test("does not fire onChange when state stays the same", async () => {
      const transport = mockTransport();
      const onChange = vi.fn();
      transport.request.mockResolvedValue({ status: "ok" });

      const hc = createHealthChecker(transport, "/health", { onChange });
      await hc.check(); // false→true: fires
      await hc.check(); // true→true: no fire

      expect(onChange).toHaveBeenCalledTimes(1);
    });
  });
});
