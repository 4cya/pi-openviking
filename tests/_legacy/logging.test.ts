import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { SessionClient } from "../../src/_legacy/ov-client/client";
import type { OpenVikingConfig } from "../../src/_legacy/shared/config";

const appendFileSyncMock = vi.fn();

vi.mock("node:fs", () => ({
  appendFileSync: appendFileSyncMock,
}));

function testConfig(): OpenVikingConfig {
  return {
    endpoint: "http://localhost",
    timeout: 5000,
    commitTimeout: 60000,
    apiKey: "key",
    account: "acc",
    user: "u",
    healthPath: "/health",
  };
}

function mockSessionClient(overrides?: Partial<SessionClient>): SessionClient {
  return {
    createSession: vi.fn().mockResolvedValue("sess-123"),
    sendMessage: vi.fn().mockResolvedValue(undefined),
    commit: vi.fn().mockResolvedValue({ session_id: "s1", status: "committed", task_id: "t1", archive_uri: "viking://a/s1", archived: true, trace_id: "tr1" }),
    getTaskStatus: vi.fn().mockResolvedValue({ task_id: "t1", status: "completed" }),
    sessionUsed: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

function mockOpts() {
  return {
    getSessionFile: vi.fn().mockReturnValue(undefined),
    getBranch: vi.fn().mockReturnValue([]),
    appendEntry: vi.fn(),
  };
}

function makeMessage(role: "user" | "assistant", text: string) {
  return {
    role,
    content: [{ type: "text", text }],
  } as any;
}

describe("Logging", () => {
  beforeEach(() => {
    appendFileSyncMock.mockClear();
  });

  describe("Logger module", () => {
    it("debug writes to log file when OV_DEBUG is set", async () => {
      const prev = process.env.OV_DEBUG;
      process.env.OV_DEBUG = "true";
      vi.resetModules();

      const { logger } = await import("../../src/_legacy/shared/logger");
      logger.debug("test message");

      expect(appendFileSyncMock).toHaveBeenCalled();
      const call = appendFileSyncMock.mock.calls[0] as [string, string];
      expect(call[1]).toContain("[DEBUG]");
      expect(call[1]).toContain("test message");

      process.env.OV_DEBUG = prev;
    });

    it("debug is silent when OV_DEBUG is false", async () => {
      const prev = process.env.OV_DEBUG;
      process.env.OV_DEBUG = "false";
      vi.resetModules();

      const { logger } = await import("../../src/_legacy/shared/logger");
      logger.debug("should not appear");

      expect(appendFileSyncMock).not.toHaveBeenCalled();

      process.env.OV_DEBUG = prev;
    });

    it("error always writes to log file", async () => {
      vi.resetModules();
      const { logger } = await import("../../src/_legacy/shared/logger");
      logger.error("something broke");

      expect(appendFileSyncMock).toHaveBeenCalled();
      const call = appendFileSyncMock.mock.calls[0] as [string, string];
      expect(call[1]).toContain("[ERROR]");
      expect(call[1]).toContain("something broke");
    });
  });



  describe("Session Sync: error catch logs", () => {
    it("logs error when createSession throws", async () => {
      const { SessionSync } = await import("../../src/_legacy/session-sync/session");
      const client = mockSessionClient({
        createSession: vi.fn().mockRejectedValue(new Error("connection refused")),
      });
      const sync = new SessionSync(client, mockOpts());

      sync.onMessageEnd(makeMessage("user", "hello"));
      await sync.flush();

      const calls = appendFileSyncMock.mock.calls.map((c: unknown[]) => c[1] as string);
      expect(calls.some((c: string) => c.includes("message send failed: connection refused"))).toBe(true);
    });

    it("logs error when sendMessage throws", async () => {
      const { SessionSync } = await import("../../src/_legacy/session-sync/session");
      const client = mockSessionClient();
      (client.createSession as ReturnType<typeof vi.fn>).mockResolvedValue("sess-err");
      (client.sendMessage as ReturnType<typeof vi.fn>).mockRejectedValue(new Error("timeout"));
      const sync = new SessionSync(client, mockOpts());

      sync.onMessageEnd(makeMessage("user", "hello"));
      await sync.flush();

      const calls = appendFileSyncMock.mock.calls.map((c: unknown[]) => c[1] as string);
      expect(calls.some((c: string) => c.includes("message send failed: timeout"))).toBe(true);
    });
  });

  describe("Client Adapter: commit", () => {
    it("logs commit call and result", async () => {
      const prev = process.env.OV_DEBUG;
      process.env.OV_DEBUG = "true";
      vi.resetModules();

      const { createClient } = await import("../../src/_legacy/ov-client/client");
      const mockTransport = {
        request: vi.fn().mockResolvedValue({ task_id: "t1", archived: true, session_id: "s1" }),
      };
      const client = createClient(testConfig(), mockTransport as any);

      await client.session.commit("sess-abc");

      const calls = appendFileSyncMock.mock.calls.map((c: unknown[]) => c[1] as string);
      expect(calls.some((c: string) => c.includes("commit: sess-abc"))).toBe(true);

      process.env.OV_DEBUG = prev;
    });
  });
});
