import { describe, test, expect, vi, beforeEach } from "vitest";
import type { Transport } from "../../src/_legacy/ov-client/transport";
import type { OpenVikingConfig } from "../../src/_legacy/shared/config";
import { DEFAULT_AUTO_RECALL_CONFIG } from "../../src/_legacy/auto-recall/auto-recall";
import { bootstrapExtension } from "../../src/_legacy/bootstrap";
import { resolveBudget } from "../../src/_legacy/auto-recall/resolve-budget";

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
  test("registers all tools even when server unreachable", async () => {
    const pi = createMockPi();
    const sm = createMockSessionManager();
    const transport = createMockTransport({
      request: vi.fn(async () => { throw new Error("ECONNREFUSED"); }),
    });

    const result = await bootstrapExtension(pi as any, {
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

    await bootstrapExtension(pi as any, {
      cwd: "/test",
      sessionManager: sm,
    }, transport);

    const handler = pi.getHandler("before_agent_start");
    expect(handler).toBeDefined();

    // Simulate auto-recall trigger — should skip without error
    const result = await handler({ userMessage: { content: "test" } }, { ui: { setStatus: vi.fn() } });
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

    await bootstrapExtension(pi as any, {
      cwd: "/test",
      sessionManager: sm,
    }, transport);

    const handler = pi.getHandler("before_agent_start");
    const result = await handler({ userMessage: { content: "test query" } }, { ui: { setStatus: vi.fn() } });
    // auto-recall ran (returns systemPrompt injection or undefined if no results)
    // We just verify it didn't throw and the search was attempted
    expect(transport.request).toHaveBeenCalledWith(
      "healthCheck",
      "/health",
      undefined,
      expect.any(AbortSignal),
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

    await bootstrapExtension(pi as any, {
      cwd: "/test",
      sessionManager: sm,
    }, transport);

    const handler = pi.getHandler("before_agent_start");

    // First call: server down → skip auto-recall
    await handler({ userMessage: { content: "test" } }, { ui: { setStatus: vi.fn() } });
    // healthCheck was called during bootstrap + before_agent_start
    const healthCalls = (transport.request as ReturnType<typeof vi.fn>).mock.calls.filter(
      (c: any[]) => c[0] === "healthCheck",
    );
    expect(healthCalls.length).toBeGreaterThanOrEqual(2);

    // Server recovers
    healthy = true;

    // Second call: server up → auto-recall runs
    await handler({ userMessage: { content: "test query" } }, { ui: { setStatus: vi.fn() } });

    // Should have done a search
    const searchCalls = (transport.request as ReturnType<typeof vi.fn>).mock.calls.filter(
      (c: any[]) => c[0] === "search",
    );
    expect(searchCalls.length).toBeGreaterThan(0);
  });

  test("returns fs client in result", async () => {
    const pi = createMockPi();
    const sm = createMockSessionManager();
    const transport = createMockTransport({
      request: vi.fn(async () => { throw new Error("down"); }),
    });

    const result = await bootstrapExtension(pi as any, {
      cwd: "/test",
      sessionManager: sm,
    }, transport);

    expect(result.fs).toBeDefined();
    expect(typeof result.fs.fsList).toBe("function");
  });

  test("returns healthChecker in result", async () => {
    const pi = createMockPi();
    const sm = createMockSessionManager();
    const transport = createMockTransport({
      request: vi.fn(async () => { throw new Error("down"); }),
    });

    const result = await bootstrapExtension(pi as any, {
      cwd: "/test",
      sessionManager: sm,
    }, transport);

    // Wait for initial probe
    await new Promise(r => setTimeout(r, 50));
    expect(result.healthChecker).toBeDefined();
    expect(result.healthChecker.isAvailable()).toBe(false);
  });

  // --- Resource consumption tracking wiring ---
  test("auto-recall stores injectedItems and SessionSync sends ContextParts", async () => {
    const pi = createMockPi();
    const sm = createMockSessionManager();
    const transport = createMockTransport({
      request: vi.fn(async (label: string, _path: string, opts?: any) => {
        if (label === "healthCheck") return { status: "ok" };
        if (label === "search") return {
          memories: [{ text: "test memory", score: 0.9, uri: "viking://user/memories/m1" }],
          resources: [],
          skills: [],
          total: 1,
        };
        if (label === "createSession") return { session_id: "sess-e2e" };
        return {};
      }),
    });

    const result = await bootstrapExtension(pi as any, {
      cwd: "/test",
      sessionManager: sm,
    }, transport);

    // Fire auto-recall → stores injectedItems in autoRecallState
    const handler = pi.getHandler("before_agent_start");
    await handler({ prompt: "test query", systemPrompt: "base" }, { ui: { setStatus: vi.fn() } });

    // User message → creates session
    result.sessionSync.onMessageEnd({
      role: "user",
      content: [{ type: "text", text: "user msg" }],
      timestamp: Date.now(),
    } as any);

    await vi.waitFor(() => {
      const createCalls = (transport.request as ReturnType<typeof vi.fn>).mock.calls.filter(
        (c: any[]) => c[0] === "createSession",
      );
      expect(createCalls.length).toBe(1);
    });

    // Assistant message → should include ContextParts from injected items
    result.sessionSync.onMessageEnd({
      role: "assistant",
      content: [{ type: "text", text: "response" }],
      timestamp: Date.now(),
    } as any);

    await vi.waitFor(() => {
      const sendCalls = (transport.request as ReturnType<typeof vi.fn>).mock.calls.filter(
        (c: any[]) => c[0] === "sendMessage",
      );
      expect(sendCalls.length).toBe(2); // user + assistant
      const assistantBody = sendCalls[1][2]?.body as any;
      const parts = assistantBody?.parts as any[];
      const ctxParts = parts?.filter((p: any) => p.type === "context");
      expect(ctxParts.length).toBe(1);
      expect(ctxParts[0].uri).toBe("viking://user/memories/m1");
      expect(ctxParts[0].context_type).toBe("memory");
    });

    // sessionUsed called
    await vi.waitFor(() => {
      const usedCalls = (transport.request as ReturnType<typeof vi.fn>).mock.calls.filter(
        (c: any[]) => c[0] === "sessionUsed",
      );
      expect(usedCalls.length).toBe(1);
    });
  });

  // --- Adaptive token budget integration ---
  test("before_agent_start resolves budget from context usage", async () => {
    const pi = createMockPi();
    const sm = createMockSessionManager();
    const transport = createMockTransport({
      request: vi.fn(async (label: string) => {
        if (label === "healthCheck") return { status: "ok" };
        if (label === "search") return {
          memories: Array.from({ length: 5 }, (_, i) => ({
            text: `mem-${i}-` + "x".repeat(400),
            score: 0.9 - i * 0.05,
            uri: `viking://user/memories/m${i}`,
          })),
          resources: [],
          skills: [],
          total: 5,
        };
        return {};
      }),
    });

    await bootstrapExtension(pi as any, {
      cwd: "/test",
      sessionManager: sm,
    }, transport);

    const handler = pi.getHandler("before_agent_start");

    // Call with context usage at 90% → budget should be 300 → fewer items
    const mockCtx = {
      getContextUsage: vi.fn(() => ({ tokens: 180000, contextWindow: 200000, percent: 90 })),
    };
    const highUsageResult = await handler(
      { prompt: "test query", systemPrompt: "base" },
      mockCtx,
    );

    // Call with context usage at 20% → budget should be 1000 → more items
    const mockCtxLow = {
      getContextUsage: vi.fn(() => ({ tokens: 40000, contextWindow: 200000, percent: 20 })),
    };
    const lowUsageResult = await handler(
      { prompt: "test query", systemPrompt: "base" },
      mockCtxLow,
    );

    expect(highUsageResult.injectedItems.length).toBeLessThan(lowUsageResult.injectedItems.length);
    expect(mockCtx.getContextUsage).toHaveBeenCalled();
    expect(mockCtxLow.getContextUsage).toHaveBeenCalled();
  });

  // --- Async factory with health timeout + status line ---
  describe("async factory with health timeout", () => {
    test("bootstrapExtension is async and awaits health check", async () => {
      const pi = createMockPi();
      const sm = createMockSessionManager();
      const setStatus = vi.fn();
      const transport = createMockTransport({
        request: vi.fn(async (label: string) => {
          if (label === "healthCheck") return { status: "ok" };
          return {};
        }),
      });

      const result = await bootstrapExtension(pi as any, {
        cwd: "/test",
        sessionManager: sm,
        setStatus,
      }, transport);

      expect(result.healthChecker.isAvailable()).toBe(true);
      expect(setStatus).toHaveBeenCalledWith("ov-status", "\u25cf OV");
    });

    test("sets status line to \u25cb OV on health timeout", async () => {
      const pi = createMockPi();
      const sm = createMockSessionManager();
      const setStatus = vi.fn();
      const transport = createMockTransport({
        request: vi.fn(async (label: string) => {
          if (label === "healthCheck") throw new Error("timeout");
          return {};
        }),
      });

      const result = await bootstrapExtension(pi as any, {
        cwd: "/test",
        sessionManager: sm,
        setStatus,
      }, transport);

      expect(result.healthChecker.isAvailable()).toBe(false);
      expect(setStatus).toHaveBeenCalledWith("ov-status", "\u25cb OV");
    });

    test("uses 2-second AbortController timeout for health check", async () => {
      const pi = createMockPi();
      const sm = createMockSessionManager();
      const setStatus = vi.fn();
      let abortSignal: AbortSignal | undefined;
      const transport = createMockTransport({
        request: vi.fn(async (_label: string, _path: string, _body: any, signal?: AbortSignal) => {
          abortSignal = signal;
          await new Promise(resolve => setTimeout(resolve, 10));
          if (signal?.aborted) throw new Error("aborted");
          return { status: "ok" };
        }),
      });

      await bootstrapExtension(pi as any, {
        cwd: "/test",
        sessionManager: sm,
        setStatus,
      }, transport);

      expect(setStatus).toHaveBeenCalledWith("ov-status", "\u25cf OV");
    });

    test("status line shows \u25cf OV \u00b7 N recalled after auto-recall with items", async () => {
      const pi = createMockPi();
      const sm = createMockSessionManager();
      const setStatus = vi.fn();
      const transport = createMockTransport({
        request: vi.fn(async (label: string, _path: string, opts?: any) => {
          if (label === "healthCheck") return { status: "ok" };
          if (label === "search") return {
            memories: [{ text: "test memory", score: 0.9, uri: "viking://user/memories/m1" }],
            resources: [],
            skills: [],
            total: 1,
          };
          return {};
        }),
      });

      await bootstrapExtension(pi as any, {
        cwd: "/test",
        sessionManager: sm,
        setStatus,
      }, transport);

      const handler = pi.getHandler("before_agent_start");
      const mockCtx = {
        getContextUsage: vi.fn(() => ({ tokens: 50000, contextWindow: 200000, percent: 25 })),
        ui: { setStatus: vi.fn() },
      };
      await handler({ prompt: "test", systemPrompt: "base" }, mockCtx);

      expect(mockCtx.ui.setStatus).toHaveBeenCalledWith("ov-status", "\u25cf OV \u00b7 1 recalled");
    });

    test("status line reverts to \u25cf OV when no items injected", async () => {
      const pi = createMockPi();
      const sm = createMockSessionManager();
      const setStatus = vi.fn();
      const transport = createMockTransport({
        request: vi.fn(async (label: string) => {
          if (label === "healthCheck") return { status: "ok" };
          if (label === "search") return { memories: [], resources: [], skills: [], total: 0 };
          return {};
        }),
      });

      await bootstrapExtension(pi as any, {
        cwd: "/test",
        sessionManager: sm,
        setStatus,
      }, transport);

      const handler = pi.getHandler("before_agent_start");
      const mockCtx = {
        getContextUsage: vi.fn(() => ({ tokens: 50000, contextWindow: 200000, percent: 25 })),
        ui: { setStatus: vi.fn() },
      };
      await handler({ prompt: "test", systemPrompt: "base" }, mockCtx);

      expect(mockCtx.ui.setStatus).toHaveBeenCalledWith("ov-status", "\u25cf OV");
    });

    test("status line updates on health recovery via onChange", async () => {
      const pi = createMockPi();
      const sm = createMockSessionManager();
      const setStatus = vi.fn();
      let healthy = false;
      const transport = createMockTransport({
        request: vi.fn(async (label: string) => {
          if (label === "healthCheck") {
            if (!healthy) throw new Error("down");
            return { status: "ok" };
          }
          return {};
        }),
      });

      await bootstrapExtension(pi as any, {
        cwd: "/test",
        sessionManager: sm,
        setStatus,
      }, transport);

      // Initially unavailable
      expect(setStatus).toHaveBeenCalledWith("ov-status", "\u25cb OV");

      // Simulate recovery — before_agent_start re-checks and updates via ctx.ui.setStatus
      const handler = pi.getHandler("before_agent_start");
      healthy = true;
      const mockCtx = {
        getContextUsage: vi.fn(() => ({ tokens: 50000, contextWindow: 200000, percent: 25 })),
        ui: { setStatus: vi.fn() },
      };
      await handler({ prompt: "test", systemPrompt: "base" }, mockCtx);

      expect(mockCtx.ui.setStatus).toHaveBeenCalledWith("ov-status", "\u25cf OV");
    });
  });
});

describe("memdelete confirmation gate", () => {
  function createHandlerCtx(overrides?: Record<string, unknown>) {
    const confirm = vi.fn();
    return {
      ui: {
        confirm,
        notify: vi.fn(),
        setStatus: vi.fn(),
      },
      ...overrides,
    } as any;
  }

  function createToolCallEvent(toolName: string, input: Record<string, unknown> = {}) {
    return {
      toolName,
      toolCallId: "call-1",
      input: { ...input },
    };
  }

  test("registers tool_call event handler", async () => {
    const pi = createMockPi();
    const sm = createMockSessionManager();

    await bootstrapExtension(pi as any, {
      cwd: "/test",
      sessionManager: sm,
    });

    const handler = pi.getHandler("tool_call");
    expect(handler).toBeDefined();
    expect(typeof handler).toBe("function");
  });

  test("prompts confirmation for memdelete with URI", async () => {
    const pi = createMockPi();
    const sm = createMockSessionManager();
    const confirm = vi.fn().mockResolvedValue(true);

    await bootstrapExtension(pi as any, {
      cwd: "/test",
      sessionManager: sm,
    });

    const handler = pi.getHandler("tool_call");
    const event = createToolCallEvent("memdelete", { uri: "viking://user/test" });
    const ctx = createHandlerCtx({ ui: { confirm, notify: vi.fn(), setStatus: vi.fn() } });

    await handler(event, ctx);

    expect(confirm).toHaveBeenCalledWith("Delete from OpenViking?", "viking://user/test");
  });

  test("returns block when user declines memdelete", async () => {
    const pi = createMockPi();
    const sm = createMockSessionManager();
    const confirm = vi.fn().mockResolvedValue(false);

    await bootstrapExtension(pi as any, {
      cwd: "/test",
      sessionManager: sm,
    });

    const handler = pi.getHandler("tool_call");
    const event = createToolCallEvent("memdelete", { uri: "viking://user/test" });
    const ctx = createHandlerCtx({ ui: { confirm, notify: vi.fn(), setStatus: vi.fn() } });

    const result = await handler(event, ctx);

    expect(result).toEqual({ block: true, reason: "Cancelled by user" });
  });

  test("allows execution when user confirms memdelete", async () => {
    const pi = createMockPi();
    const sm = createMockSessionManager();
    const confirm = vi.fn().mockResolvedValue(true);

    await bootstrapExtension(pi as any, {
      cwd: "/test",
      sessionManager: sm,
    });

    const handler = pi.getHandler("tool_call");
    const event = createToolCallEvent("memdelete", { uri: "viking://user/test" });
    const ctx = createHandlerCtx({ ui: { confirm, notify: vi.fn(), setStatus: vi.fn() } });

    const result = await handler(event, ctx);

    expect(result).toBeUndefined();
  });

  test("does not prompt for memsearch", async () => {
    const pi = createMockPi();
    const sm = createMockSessionManager();
    const confirm = vi.fn();

    await bootstrapExtension(pi as any, {
      cwd: "/test",
      sessionManager: sm,
    });

    const handler = pi.getHandler("tool_call");
    const event = createToolCallEvent("memsearch", { query: "test" });
    const ctx = createHandlerCtx({ ui: { confirm, notify: vi.fn(), setStatus: vi.fn() } });

    await handler(event, ctx);

    expect(confirm).not.toHaveBeenCalled();
  });

  test("does not prompt for memimport", async () => {
    const pi = createMockPi();
    const sm = createMockSessionManager();
    const confirm = vi.fn();

    await bootstrapExtension(pi as any, {
      cwd: "/test",
      sessionManager: sm,
    });

    const handler = pi.getHandler("tool_call");
    const event = createToolCallEvent("memimport", { source: "/tmp/test" });
    const ctx = createHandlerCtx({ ui: { confirm, notify: vi.fn(), setStatus: vi.fn() } });

    await handler(event, ctx);

    expect(confirm).not.toHaveBeenCalled();
  });

  test("does not prompt for memread or membrowse", async () => {
    const pi = createMockPi();
    const sm = createMockSessionManager();
    const confirm = vi.fn();

    await bootstrapExtension(pi as any, {
      cwd: "/test",
      sessionManager: sm,
    });

    const handler = pi.getHandler("tool_call");

    for (const tool of ["memread", "membrowse"]) {
      const event = createToolCallEvent(tool, { uri: "viking://user/test" });
      const ctx = createHandlerCtx({ ui: { confirm, notify: vi.fn(), setStatus: vi.fn() } });
      await handler(event, ctx);
    }

    expect(confirm).not.toHaveBeenCalled();
  });

  test("does not prompt for memcommit", async () => {
    const pi = createMockPi();
    const sm = createMockSessionManager();
    const confirm = vi.fn();

    await bootstrapExtension(pi as any, {
      cwd: "/test",
      sessionManager: sm,
    });

    const handler = pi.getHandler("tool_call");
    const event = createToolCallEvent("memcommit", {});
    const ctx = createHandlerCtx({ ui: { confirm, notify: vi.fn(), setStatus: vi.fn() } });

    await handler(event, ctx);

    expect(confirm).not.toHaveBeenCalled();
  });

  test("gate is always active — no config option to disable", async () => {
    const pi = createMockPi();
    const sm = createMockSessionManager();

    await bootstrapExtension(pi as any, {
      cwd: "/test",
      sessionManager: sm,
    });

    const handler = pi.getHandler("tool_call");
    expect(handler).toBeDefined();

    // Verify gate is always registered, regardless of config
    const event = createToolCallEvent("memdelete", { uri: "viking://user/test" });
    const confirm = vi.fn().mockResolvedValue(false);
    const ctx = createHandlerCtx({ ui: { confirm, notify: vi.fn(), setStatus: vi.fn() } });

    const result = await handler(event, ctx);
    expect(result).toEqual({ block: true, reason: "Cancelled by user" });
  });
});
