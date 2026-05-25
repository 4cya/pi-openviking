import { describe, test, expect, vi, beforeEach } from "vitest";
import type { Transport } from "../../src/_legacy/ov-client/transport";
import { createHealthChecker } from "../../src/_legacy/shared/health";
import type { OpenVikingConfig } from "../../src/_legacy/shared/config";
import { loadConfig } from "../../src/_legacy/shared/config";

const defaultConfig: OpenVikingConfig = {
  endpoint: "http://localhost:1933",
  timeout: 5000,
  commitTimeout: 60000,
  apiKey: "dev",
  account: "default",
  user: "default",
  healthPath: "/health",
};

describe("config healthPath", () => {
  test("loadConfig reads OPENVIKING_HEALTH_PATH env var", () => {
    process.env.OPENVIKING_HEALTH_PATH = "/api/healthz";
    try {
      const config = loadConfig("/test");
      expect(config.healthPath).toBe("/api/healthz");
    } finally {
      delete process.env.OPENVIKING_HEALTH_PATH;
    }
  });

  test("loadConfig defaults healthPath to /health", () => {
    delete process.env.OPENVIKING_HEALTH_PATH;
    const config = loadConfig("/test");
    expect(config.healthPath).toBe("/health");
  });
});
