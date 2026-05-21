import { describe, test, expect, vi, beforeEach } from "vitest";
import { createHealthChecker } from "../src/shared/health";
import type { Transport } from "../src/ov-client/transport";

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
});
