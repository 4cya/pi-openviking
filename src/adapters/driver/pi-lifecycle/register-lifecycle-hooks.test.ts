import { describe, it, expect, vi } from "vitest";
import { registerLifecycleHooks, handleSessionStart } from "./register-lifecycle-hooks";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import type { LifecycleServices } from "./register-lifecycle-hooks";

// ── Helpers ──────────────────────────────────────────────────────────────────

function createMockPi(): { pi: ExtensionAPI; handlers: Record<string, Function> } {
  const handlers: Record<string, Function> = {};
  const pi = {
    on: (event: string, handler: Function) => {
      handlers[event] = handler;
    },
  } as unknown as ExtensionAPI;
  return { pi, handlers };
}

function createMockServices(overrides?: Partial<LifecycleServices>): LifecycleServices {
  return {
    logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn() } as any,
    sessionService: {
      getActive: vi.fn(),
      sendMessage: vi.fn().mockResolvedValue(undefined),
      createAndSet: vi.fn().mockResolvedValue({ value: "test-session", toString: () => "test-session" }),
      commit: vi.fn().mockResolvedValue({}),
    } as any,
    recallService: {
      isEnabled: vi.fn().mockReturnValue(true),
      recall: vi.fn().mockResolvedValue({ formatted: "memories", timedOut: false, items: [] }),
    } as any,
    adapter: { circuitBreakerOpen: false } as any,
    widget: { update: vi.fn() } as any,
    healthCheck: { check: vi.fn().mockResolvedValue({ ok: true }) } as any,
    profileManager: { apply: vi.fn() } as any,
    autoDetectRules: {},
    ...overrides,
  } as LifecycleServices;
}

type MsgHandler = (event: any) => Promise<any> | any;
type ShutdownHandler = (event: any) => Promise<any> | any;

// ── registerLifecycleHooks ──────────────────────────────────────────────────

describe("registerLifecycleHooks", () => {
  it("registers message_end, turn_end, session_shutdown, before_agent_start hooks", () => {
    const { pi, handlers } = createMockPi();
    const svcs = createMockServices();

    registerLifecycleHooks(pi, svcs);

    expect(handlers["message_end"]).toBeDefined();
    expect(handlers["turn_end"]).toBeDefined();
    expect(handlers["session_shutdown"]).toBeDefined();
    expect(handlers["before_agent_start"]).toBeDefined();
  });

  describe("message_end", () => {
    it("sends user message to OV session", async () => {
      const { pi, handlers } = createMockPi();
      const sendMessage = vi.fn().mockResolvedValue(undefined);
      const getActive = vi.fn().mockReturnValue("session-1");
      const svcs = createMockServices({
        sessionService: { getActive, sendMessage } as any,
      });

      registerLifecycleHooks(pi, svcs);
      const handler = handlers["message_end"] as MsgHandler;

      await handler({
        message: { role: "user", content: "hello", timestamp: 1 },
      });

      expect(sendMessage).toHaveBeenCalledTimes(1);
      // Should send with role "user"
      expect(sendMessage.mock.calls[0][1]).toBe("user");
    });

    it("does NOT send assistant message on message_end (deferred to turn_end)", async () => {
      const { pi, handlers } = createMockPi();
      const sendMessage = vi.fn().mockResolvedValue(undefined);
      const svcs = createMockServices({
        sessionService: { getActive: vi.fn().mockReturnValue("session-1"), sendMessage } as any,
      });

      registerLifecycleHooks(pi, svcs);
      const handler = handlers["message_end"] as MsgHandler;

      await handler({
        message: { role: "assistant", content: [{ type: "text", text: "response" }], timestamp: 2 },
      });

      // Assistant messages are no longer sent on message_end
      // They are merged with tool results and sent via turn_end
      expect(sendMessage).not.toHaveBeenCalled();
    });

    it("skips toolResult messages on message_end (handled via turn_end)", async () => {
      const { pi, handlers } = createMockPi();
      const sendMessage = vi.fn().mockResolvedValue(undefined);
      const svcs = createMockServices({
        sessionService: { getActive: vi.fn().mockReturnValue("session-1"), sendMessage } as any,
      });

      registerLifecycleHooks(pi, svcs);
      const handler = handlers["message_end"] as MsgHandler;

      await handler({
        message: {
          role: "toolResult",
          toolCallId: "call_1",
          toolName: "ov_search",
          content: [{ type: "text", text: "result" }],
          isError: false,
          timestamp: 3,
        },
      });

      // toolResult should NOT be sent to OV
      expect(sendMessage).not.toHaveBeenCalled();
    });

    it("skips unknown role messages", async () => {
      const { pi, handlers } = createMockPi();
      const sendMessage = vi.fn().mockResolvedValue(undefined);
      const svcs = createMockServices({
        sessionService: { getActive: vi.fn().mockReturnValue("session-1"), sendMessage } as any,
      });

      registerLifecycleHooks(pi, svcs);
      const handler = handlers["message_end"] as MsgHandler;

      await handler({
        message: { role: "custom", content: "something", timestamp: 4 },
      });

      expect(sendMessage).not.toHaveBeenCalled();
    });

    it("skips when no active session", async () => {
      const { pi, handlers } = createMockPi();
      const sendMessage = vi.fn().mockResolvedValue(undefined);
      const svcs = createMockServices({
        sessionService: { getActive: vi.fn().mockReturnValue(null), sendMessage } as any,
      });

      registerLifecycleHooks(pi, svcs);
      const handler = handlers["message_end"] as MsgHandler;

      await handler({
        message: { role: "user", content: "hello", timestamp: 1 },
      });

      expect(sendMessage).not.toHaveBeenCalled();
    });
  });

  describe("turn_end", () => {
    it("sends merged assistant parts + tool results to OV session", async () => {
      const { pi, handlers } = createMockPi();
      const sendMessage = vi.fn().mockResolvedValue(undefined);
      const getActive = vi.fn().mockReturnValue("session-1");
      const svcs = createMockServices({
        sessionService: { getActive, sendMessage } as any,
      });

      registerLifecycleHooks(pi, svcs);
      const handler = handlers["turn_end"] as MsgHandler;

      await handler({
        type: "turn_end",
        turnIndex: 1,
        message: {
          role: "assistant",
          content: [
            { type: "text", text: "Let me check:" },
            { type: "toolCall", id: "call_1", name: "ov_search", arguments: { query: "test" } },
          ],
        },
        toolResults: [
          {
            role: "toolResult",
            toolCallId: "call_1",
            toolName: "ov_search",
            content: [{ type: "text", text: '[{ "result": "ok" }]' }],
            isError: false,
            timestamp: 3,
          },
        ],
      });

      expect(sendMessage).toHaveBeenCalledTimes(1);
      expect(sendMessage.mock.calls[0][1]).toBe("assistant");
      const sentParts = sendMessage.mock.calls[0][2];
      expect(sentParts).toHaveLength(2);
      // text part preserved
      expect(sentParts[0].type).toBe("text");
      expect(sentParts[0].text).toBe("Let me check:");
      // tool part now has completed status + output
      expect(sentParts[1].type).toBe("tool");
      expect(sentParts[1].toolId).toBe("call_1");
      expect(sentParts[1].toolStatus).toBe("completed");
      expect(sentParts[1].toolOutput).toBe('[{ "result": "ok" }]');
    });

    it("sends text-only assistant message when no tool calls", async () => {
      const { pi, handlers } = createMockPi();
      const sendMessage = vi.fn().mockResolvedValue(undefined);
      const svcs = createMockServices({
        sessionService: { getActive: vi.fn().mockReturnValue("session-1"), sendMessage } as any,
      });

      registerLifecycleHooks(pi, svcs);
      const handler = handlers["turn_end"] as MsgHandler;

      await handler({
        type: "turn_end",
        turnIndex: 1,
        message: {
          role: "assistant",
          content: [{ type: "text", text: "Just text response" }],
        },
        toolResults: [],
      });

      expect(sendMessage).toHaveBeenCalledTimes(1);
      expect(sendMessage.mock.calls[0][2]).toHaveLength(1);
      expect(sendMessage.mock.calls[0][2][0].type).toBe("text");
      expect(sendMessage.mock.calls[0][2][0].text).toBe("Just text response");
    });

    it("sets toolStatus to error when tool result isError", async () => {
      const { pi, handlers } = createMockPi();
      const sendMessage = vi.fn().mockResolvedValue(undefined);
      const svcs = createMockServices({
        sessionService: { getActive: vi.fn().mockReturnValue("session-1"), sendMessage } as any,
      });

      registerLifecycleHooks(pi, svcs);
      const handler = handlers["turn_end"] as MsgHandler;

      await handler({
        type: "turn_end",
        turnIndex: 1,
        message: {
          role: "assistant",
          content: [{ type: "toolCall", id: "call_err", name: "bash", arguments: { command: "rm -rf" } }],
        },
        toolResults: [
          {
            role: "toolResult",
            toolCallId: "call_err",
            toolName: "bash",
            content: [{ type: "text", text: "Command failed" }],
            isError: true,
            timestamp: 3,
          },
        ],
      });

      const sentParts = sendMessage.mock.calls[0][2];
      expect(sentParts[0].toolStatus).toBe("error");
      expect(sentParts[0].toolOutput).toBe("Command failed");
    });

    it("skips when no active session", async () => {
      const { pi, handlers } = createMockPi();
      const sendMessage = vi.fn().mockResolvedValue(undefined);
      const svcs = createMockServices({
        sessionService: { getActive: vi.fn().mockReturnValue(null), sendMessage } as any,
      });

      registerLifecycleHooks(pi, svcs);
      const handler = handlers["turn_end"] as MsgHandler;

      await handler({
        type: "turn_end",
        turnIndex: 1,
        message: { role: "assistant", content: [{ type: "text", text: "hello" }] },
        toolResults: [],
      });

      expect(sendMessage).not.toHaveBeenCalled();
    });
  });

  describe("session_shutdown", () => {
    it("commits active session", async () => {
      const { pi, handlers } = createMockPi();
      const commit = vi.fn().mockResolvedValue({});
      const getActive = vi.fn().mockReturnValue("session-1");
      const svcs = createMockServices({
        sessionService: { getActive, commit } as any,
      });

      registerLifecycleHooks(pi, svcs);
      const handler = handlers["session_shutdown"] as ShutdownHandler;

      await handler({ type: "session_shutdown", reason: "quit" });

      expect(commit).toHaveBeenCalledWith("session-1");
    });

    it("skips commit when no active session", async () => {
      const { pi, handlers } = createMockPi();
      const commit = vi.fn().mockResolvedValue({});
      const svcs = createMockServices({
        sessionService: { getActive: vi.fn().mockReturnValue(null), commit } as any,
      });

      registerLifecycleHooks(pi, svcs);
      const handler = handlers["session_shutdown"] as ShutdownHandler;

      await handler({ type: "session_shutdown", reason: "quit" });

      expect(commit).not.toHaveBeenCalled();
    });
  });

  describe("before_agent_start", () => {
    it("returns memories when recall is enabled and circuit breaker closed", async () => {
      const { pi, handlers } = createMockPi();
      const recall = vi.fn().mockResolvedValue({ formatted: "relevant memories", timedOut: false, items: [] });
      const svcs = createMockServices({
        recallService: { isEnabled: vi.fn().mockReturnValue(true), recall } as any,
        adapter: { circuitBreakerOpen: false } as any,
        sessionService: {
          getActive: vi.fn().mockReturnValue("session-1"),
          sendMessage: vi.fn(),
        } as any,
      });

      registerLifecycleHooks(pi, svcs);
      const handler = handlers["before_agent_start"] as MsgHandler;

      const result = await handler({ type: "before_agent_start", prompt: "test query" });

      expect(recall).toHaveBeenCalledWith("test query", "session-1");
      expect(result).toBeDefined();
      expect(result.message.content).toContain("relevant memories");
    });

    it("returns off message when recall disabled", async () => {
      const { pi, handlers } = createMockPi();
      const svcs = createMockServices({
        recallService: { isEnabled: vi.fn().mockReturnValue(false) } as any,
      });

      registerLifecycleHooks(pi, svcs);
      const handler = handlers["before_agent_start"] as MsgHandler;

      const result = await handler({ type: "before_agent_start", prompt: "test" });

      expect(result.message.content).toContain("Auto-recall is OFF");
    });

    it("returns unavailable message when circuit breaker open", async () => {
      const { pi, handlers } = createMockPi();
      const svcs = createMockServices({
        recallService: { isEnabled: vi.fn().mockReturnValue(true) } as any,
        adapter: { circuitBreakerOpen: true } as any,
      });

      registerLifecycleHooks(pi, svcs);
      const handler = handlers["before_agent_start"] as MsgHandler;

      const result = await handler({ type: "before_agent_start", prompt: "test" });

      expect(result.message.content).toContain("circuit breaker open");
    });

    it("auto-creates session when none active", async () => {
      const { pi, handlers } = createMockPi();
      const createAndSet = vi.fn().mockResolvedValue({ value: "new-session", toString: () => "new-session" });
      const recall = vi.fn().mockResolvedValue({ formatted: "memories", timedOut: false, items: [] });
      const svcs = createMockServices({
        recallService: { isEnabled: vi.fn().mockReturnValue(true), recall } as any,
        adapter: { circuitBreakerOpen: false } as any,
        sessionService: {
          getActive: vi.fn().mockReturnValue(null),
          createAndSet,
          sendMessage: vi.fn(),
        } as any,
      });

      registerLifecycleHooks(pi, svcs);
      const handler = handlers["before_agent_start"] as MsgHandler;

      await handler({ type: "before_agent_start", prompt: "test" });

      expect(createAndSet).toHaveBeenCalledTimes(1);
    });
  });
});

// ── handleSessionStart ──────────────────────────────────────────────────────

describe("handleSessionStart", () => {
  it("attaches widget and creates session", async () => {
    const check = vi.fn().mockResolvedValue({ ok: true });
    const update = vi.fn();
    const createAndSet = vi.fn().mockResolvedValue({ value: "sess-1", toString: () => "sess-1" });
    const svcs = createMockServices({
      healthCheck: { check } as any,
      widget: { update, attach: vi.fn() } as any,
      sessionService: {
        createAndSet,
        getActive: vi.fn().mockReturnValue("sess-1"),
      } as any,
    });

    await handleSessionStart({ cwd: "/test", ui: {} as any }, svcs);

    expect(createAndSet).toHaveBeenCalled();
    expect(update).toHaveBeenCalledWith("session", "sess-1");
  });
});
