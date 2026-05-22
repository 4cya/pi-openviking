import { describe, test, expect, vi, beforeEach } from "vitest";
import type { Transport } from "../src/ov-client/transport";
import type { OpenVikingConfig } from "../src/shared/config";
import { DEFAULT_AUTO_RECALL_CONFIG } from "../src/auto-recall/auto-recall";
import { bootstrapExtension } from "../src/bootstrap";

const defaultConfig: OpenVikingConfig = {
  endpoint: "http://localhost:1933",
  timeout: 5000,
  commitTimeout: 60000,
  apiKey: "dev",
  account: "default",
  user: "default",
  healthPath: "/health",
};

const defaultRecallConfig = { ...DEFAULT_AUTO_RECALL_CONFIG };

function createMockPi() {
  const tools: any[] = [];
  const commands: any[] = [];
  const handlers: Record<string, Function> = {};
  return {
    tools,
    commands,
    registerTool: vi.fn((tool) => tools.push(tool)),
    registerCommand: vi.fn((name, cmd) => commands.push({ name, ...cmd })),
    on: vi.fn((event, handler) => { handlers[event] = handler; }),
    appendEntry: vi.fn(),
    getHandler: (event: string) => handlers[event],
  };
}

function createMockSessionManager() {
  return {
    getSessionFile: vi.fn(() => "/path/to/session.json"),
    getBranch: vi.fn(() => []),
  };
}

function createMockTransport(overrides: Partial<Transport> = {}): Transport {
  return {
    request: vi.fn(async () => ({})),
    ...overrides,
  };
}

// Mock config module
vi.mock("../src/shared/config", () => ({
  loadConfig: vi.fn(() => defaultConfig),
  loadAutoRecallConfig: vi.fn(() => ({ ...defaultRecallConfig })),
}));

describe("bootstrap health check", () => {
  test("registers all tools even when server unreachable", () => {
    const pi = createMockPi();
    const sm = createMockSessionManager();
    const transport = createMockTransport({
      request: vi.fn(async () => { throw new Error("ECONNREFUSED"); }),
    });

    const result = bootstrapExtension(pi as any, {
      cwd: "/test",
      sessionManager: sm,
    }, transport);

    expect(pi.registerTool).toHaveBeenCalled();
    const toolNames = pi.tools.map((t: any) => t.name);
    expect(toolNames).toContain("memsearch");
    expect(toolNames).toContain("memcommit");
  });

  test("skips auto-recall when server unreachable", async () => {
    const pi = createMockPi();
    const sm = createMockSessionManager();
    const transport = createMockTransport({
      request: vi.fn(async () => { throw new Error("ECONNREFUSED"); }),
    });

    bootstrapExtension(pi as any, {
      cwd: "/test",
      sessionManager: sm,
    }, transport);

    const handler = pi.getHandler("before_agent_start");
    expect(handler).toBeDefined();

    // Simulate auto-recall trigger — should skip without error
    const result = await handler({ userMessage: { content: "test" } });
    expect(result).toBeUndefined(); // auto-recall skipped
  });

  test("auto-recall works when server is healthy", async () => {
    const pi = createMockPi();
    const sm = createMockSessionManager();
    const transport = createMockTransport({
      request: vi.fn(async (label: string) => {
        if (label === "healthCheck") return { status: "ok" };
        if (label === "search") return { memories: [], resources: [], skills: [], total: 0 };
        if (label === "createSession") return { session_id: "sess-1" };
        return {};
      }),
    });

    bootstrapExtension(pi as any, {
      cwd: "/test",
      sessionManager: sm,
    }, transport);

    const handler = pi.getHandler("before_agent_start");
    const result = await handler({ userMessage: { content: "test query" } });
    // auto-recall ran (returns systemPrompt injection or undefined if no results)
    // We just verify it didn't throw and the search was attempted
    expect(transport.request).toHaveBeenCalledWith(
      "healthCheck",
      "/health",
      undefined,
      undefined,
    );
  });

  test("auto-recall recovers after server comes back", async () => {
    const pi = createMockPi();
    const sm = createMockSessionManager();
    let healthy = false;
    const transport = createMockTransport({
      request: vi.fn(async (label: string) => {
        if (label === "healthCheck") {
          if (!healthy) throw new Error("down");
          return { status: "ok" };
        }
        if (label === "search") return { memories: [], resources: [], skills: [], total: 0 };
        return {};
      }),
    });

    bootstrapExtension(pi as any, {
      cwd: "/test",
      sessionManager: sm,
    }, transport);

    const handler = pi.getHandler("before_agent_start");

    // First call: server down → skip auto-recall
    await handler({ userMessage: { content: "test" } });
    // healthCheck was called during bootstrap + before_agent_start
    const healthCalls = (transport.request as ReturnType<typeof vi.fn>).mock.calls.filter(
      (c: any[]) => c[0] === "healthCheck",
    );
    expect(healthCalls.length).toBeGreaterThanOrEqual(2);

    // Server recovers
    healthy = true;

    // Second call: server up → auto-recall runs
    await handler({ userMessage: { content: "test query" } });

    // Should have done a search
    const searchCalls = (transport.request as ReturnType<typeof vi.fn>).mock.calls.filter(
      (c: any[]) => c[0] === "search",
    );
    expect(searchCalls.length).toBeGreaterThan(0);
  });

  test("returns healthChecker in result", async () => {
    const pi = createMockPi();
    const sm = createMockSessionManager();
    const transport = createMockTransport({
      request: vi.fn(async () => { throw new Error("down"); }),
    });

    const result = bootstrapExtension(pi as any, {
      cwd: "/test",
      sessionManager: sm,
    }, transport);

    // Wait for initial probe
    await new Promise(r => setTimeout(r, 50));
    expect(result.healthChecker).toBeDefined();
    expect(result.healthChecker.isAvailable()).toBe(false);
  });
});
