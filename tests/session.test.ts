import { describe, test, expect, vi, beforeEach } from "vitest";
import type { SessionClient } from "../src/ov-client/client";
import { SessionSync } from "../src/session-sync/session";
import { createMockClient } from "./mocks";

import type { AgentMessage } from "@earendil-works/pi-agent-core";
import type { Part, ContextPart } from "../src/ov-client/types";
import type { RecallItem } from "../src/auto-recall/recall-curator";

function msg(m: Partial<AgentMessage> & { role: string }): AgentMessage {
  return m as AgentMessage;
}

function createSync(sessionClient: SessionClient, opts?: {
  getSessionFile?: () => string | undefined;
  getBranch?: () => any[];
  appendEntry?: (type: string, data: unknown) => void;
  autoRecallState?: { enabled: boolean; lastInjectedItems: RecallItem[] };
}) {
  return new SessionSync(sessionClient, {
    getSessionFile: opts?.getSessionFile ?? (() => "/path/to/session.json"),
    getBranch: opts?.getBranch ?? (() => []),
    appendEntry: opts?.appendEntry ?? (() => {}),
    autoRecallState: opts?.autoRecallState,
  });
}

describe("SessionSync", () => {
  // --- Test 1: Text-only passthrough (D6) ---
  test("user text message sends Part[TextPart]", async () => {
    const client = createMockClient();
    const sync = createSync(client.session);

    sync.onMessageEnd(msg({
      role: "user",
      content: [{ type: "text", text: "hello world" }],
      timestamp: Date.now(),
    }));

    await vi.waitFor(() => {
      expect(client.session.createSession).toHaveBeenCalledOnce();
      expect(client.session.sendMessage).toHaveBeenCalledWith(
        "ov-sess-1",
        "user",
        [{ type: "text", text: "hello world" } satisfies Part],
      );
    });
  });

  test("assistant text-only message sends Part[TextPart]", async () => {
    const client = createMockClient();
    const sync = createSync(client.session);

    sync.onMessageEnd(msg({
      role: "user",
      content: [{ type: "text", text: "hello" }],
      timestamp: Date.now(),
    }));
    await vi.waitFor(() => expect(client.session.createSession).toHaveBeenCalledOnce());

    sync.onMessageEnd(msg({
      role: "assistant",
      content: [{ type: "text", text: "response text" }],
      timestamp: Date.now(),
    }));

    await vi.waitFor(() => {
      expect(client.session.createSession).toHaveBeenCalledOnce();
      expect(client.session.sendMessage).toHaveBeenCalledWith(
        "ov-sess-1",
        "assistant",
        [{ type: "text", text: "response text" } satisfies Part],
      );
    });
  });

  // --- Test 2: Buffer-and-merge happy path (D2) ---
  test("assistant with toolCall buffers, merges results, flushes when complete", async () => {
    const client = createMockClient();
    const sync = createSync(client.session);

    sync.onMessageEnd(msg({
      role: "user",
      content: [{ type: "text", text: "do something" }],
      timestamp: Date.now(),
    }));
    await vi.waitFor(() => expect(client.session.createSession).toHaveBeenCalledOnce());

    // Assistant with 2 tool calls → buffered, NOT sent
    sync.onMessageEnd(msg({
      role: "assistant",
      content: [
        { type: "text", text: "I'll run two tools" },
        { type: "toolCall", id: "tc-1", name: "bash", arguments: { command: "ls" } },
        { type: "toolCall", id: "tc-2", name: "read", arguments: { path: "file.txt" } },
      ],
      timestamp: Date.now(),
    }));

    await new Promise((r) => setTimeout(r, 50));
    const sendCountBefore = (client.session.sendMessage as ReturnType<typeof vi.fn>).mock.calls.length;
    expect(sendCountBefore).toBe(1); // only the user message

    // First tool result arrives, still one pending
    sync.onMessageEnd(msg({
      role: "toolResult",
      toolCallId: "tc-1",
      toolName: "bash",
      content: [{ type: "text", text: "file1.txt\nfile2.txt" }],
      isError: false,
      timestamp: Date.now(),
    } as any));

    await new Promise((r) => setTimeout(r, 50));
    const sendCountAfterOne = (client.session.sendMessage as ReturnType<typeof vi.fn>).mock.calls.length;
    expect(sendCountAfterOne).toBe(1); // still not flushed (tc-2 pending)

    // Second tool result arrives → pending set empty → FLUSHED
    sync.onMessageEnd(msg({
      role: "toolResult",
      toolCallId: "tc-2",
      toolName: "read",
      content: [{ type: "text", text: "file content" }],
      isError: false,
      timestamp: Date.now(),
    } as any));

    await vi.waitFor(() => {
      expect(client.session.sendMessage).toHaveBeenCalledTimes(2); // user + buffered assistant
      expect(client.session.sendMessage).toHaveBeenLastCalledWith(
        "ov-sess-1",
        "assistant",
        expect.arrayContaining([
          { type: "text", text: "I'll run two tools" },
          expect.objectContaining({
            type: "tool",
            tool_id: "tc-1",
            tool_name: "bash",
            tool_output: "file1.txt\nfile2.txt",
            tool_status: "success",
            tool_output_truncated: false,
          } satisfies Partial<Part>),
          expect.objectContaining({
            type: "tool",
            tool_id: "tc-2",
            tool_name: "read",
            tool_output: "file content",
            tool_status: "success",
            tool_output_truncated: false,
          } satisfies Partial<Part>),
        ]),
      );
    });
  });

  // --- Test 3: Reverse order results (D12) ---
  test("tool results arrive out of order — all merged correctly", async () => {
    const client = createMockClient();
    const sync = createSync(client.session);

    sync.onMessageEnd(msg({ role: "user", content: [{ type: "text", text: "hi" }], timestamp: Date.now() }));
    await vi.waitFor(() => expect(client.session.createSession).toHaveBeenCalledOnce());

    // 3 tool calls
    sync.onMessageEnd(msg({
      role: "assistant",
      content: [
        { type: "toolCall", id: "tc-a", name: "a", arguments: {} },
        { type: "toolCall", id: "tc-b", name: "b", arguments: {} },
        { type: "toolCall", id: "tc-c", name: "c", arguments: {} },
      ],
      timestamp: Date.now(),
    }));

    await new Promise((r) => setTimeout(r, 50));
    expect((client.session.sendMessage as ReturnType<typeof vi.fn>).mock.calls.length).toBe(1);

    // Results arrive c → a → b
    sync.onMessageEnd(msg({ role: "toolResult", toolCallId: "tc-c", toolName: "c", content: [{ type: "text", text: "c-result" }], isError: false, timestamp: Date.now() } as any));
    await new Promise((r) => setTimeout(r, 50));
    expect((client.session.sendMessage as ReturnType<typeof vi.fn>).mock.calls.length).toBe(1);

    sync.onMessageEnd(msg({ role: "toolResult", toolCallId: "tc-a", toolName: "a", content: [{ type: "text", text: "a-result" }], isError: false, timestamp: Date.now() } as any));
    await new Promise((r) => setTimeout(r, 50));
    expect((client.session.sendMessage as ReturnType<typeof vi.fn>).mock.calls.length).toBe(1);

    sync.onMessageEnd(msg({ role: "toolResult", toolCallId: "tc-b", toolName: "b", content: [{ type: "text", text: "b-result" }], isError: false, timestamp: Date.now() } as any));

    await vi.waitFor(() => {
      expect(client.session.sendMessage).toHaveBeenCalledTimes(2);
      const call = (client.session.sendMessage as ReturnType<typeof vi.fn>).mock.calls[1];
      expect(call[0]).toBe("ov-sess-1");
      expect(call[1]).toBe("assistant");
      const parts = call[2] as Part[];
      // Order: a, b, c (natural order from content)
      expect(parts[0]).toMatchObject({ type: "tool", tool_id: "tc-a", tool_output: "a-result" });
      expect(parts[1]).toMatchObject({ type: "tool", tool_id: "tc-b", tool_output: "b-result" });
      expect(parts[2]).toMatchObject({ type: "tool", tool_id: "tc-c", tool_output: "c-result" });
    });
  });

  // --- Test 4: Incomplete buffer flush (D2b) ---
  test("new assistant message while buffer pending triggers incomplete flush", async () => {
    const client = createMockClient();
    const sync = createSync(client.session);

    sync.onMessageEnd(msg({ role: "user", content: [{ type: "text", text: "hi" }], timestamp: Date.now() }));
    await vi.waitFor(() => expect(client.session.createSession).toHaveBeenCalledOnce());

    // Assistant with 2 tool calls → buffered
    sync.onMessageEnd(msg({
      role: "assistant",
      content: [
        { type: "toolCall", id: "tc-1", name: "a", arguments: {} },
        { type: "toolCall", id: "tc-2", name: "b", arguments: {} },
      ],
      timestamp: Date.now(),
    }));

    await new Promise((r) => setTimeout(r, 50));
    expect((client.session.sendMessage as ReturnType<typeof vi.fn>).mock.calls.length).toBe(1);

    // Only tc-1 result arrives
    sync.onMessageEnd(msg({ role: "toolResult", toolCallId: "tc-1", toolName: "a", content: [{ type: "text", text: "a-ok" }], isError: false, timestamp: Date.now() } as any));
    await new Promise((r) => setTimeout(r, 50));

    // New assistant message arrives → should flush incomplete first
    sync.onMessageEnd(msg({
      role: "assistant",
      content: [{ type: "text", text: "new response" }],
      timestamp: Date.now(),
    }));

    await sync.flush();

    // Should have sent: user + incomplete flush + new text
    expect(client.session.sendMessage).toHaveBeenCalledTimes(3);
    const flushCall = (client.session.sendMessage as ReturnType<typeof vi.fn>).mock.calls[1];
    expect(flushCall[0]).toBe("ov-sess-1");
    expect(flushCall[1]).toBe("assistant");
    const flushedParts = flushCall[2] as Part[];
    // tc-1 has real result
    expect(flushedParts[0]).toMatchObject({ type: "tool", tool_id: "tc-1", tool_output: "a-ok", tool_status: "success" });
    // tc-2 is synthetic error
    expect(flushedParts[1]).toMatchObject({ type: "tool", tool_id: "tc-2", tool_output: "[interrompido - resultado não recebido]", tool_status: "error" });
  });

  // --- Test 5: Orphan tool result (D9) ---
  test("tool result with no buffer is discarded", async () => {
    const client = createMockClient();
    const sync = createSync(client.session);

    sync.onMessageEnd(msg({ role: "user", content: [{ type: "text", text: "hi" }], timestamp: Date.now() }));
    await vi.waitFor(() => expect(client.session.createSession).toHaveBeenCalledOnce());

    const sendCount = (client.session.sendMessage as ReturnType<typeof vi.fn>).mock.calls.length;

    // toolResult with no buffer
    sync.onMessageEnd(msg({ role: "toolResult", toolCallId: "tc-orphan", toolName: "x", content: [{ type: "text", text: "orphan" }], isError: false, timestamp: Date.now() } as any));

    await new Promise((r) => setTimeout(r, 50));
    expect(client.session.sendMessage).toHaveBeenCalledTimes(sendCount);
  });

  test("tool result with unknown toolCallId in buffer is discarded", async () => {
    const client = createMockClient();
    const sync = createSync(client.session);

    sync.onMessageEnd(msg({ role: "user", content: [{ type: "text", text: "hi" }], timestamp: Date.now() }));
    await vi.waitFor(() => expect(client.session.createSession).toHaveBeenCalledOnce());

    sync.onMessageEnd(msg({
      role: "assistant",
      content: [{ type: "toolCall", id: "tc-1", name: "a", arguments: {} }],
      timestamp: Date.now(),
    }));

    await new Promise((r) => setTimeout(r, 50));
    const sendCount = (client.session.sendMessage as ReturnType<typeof vi.fn>).mock.calls.length;
    expect(sendCount).toBe(1);

    // toolResult with wrong ID
    sync.onMessageEnd(msg({ role: "toolResult", toolCallId: "tc-wrong", toolName: "x", content: [{ type: "text", text: "wrong" }], isError: false, timestamp: Date.now() } as any));

    await new Promise((r) => setTimeout(r, 50));
    expect(client.session.sendMessage).toHaveBeenCalledTimes(sendCount);
  });

  // --- Test 6: Truncation (D3) ---
  test("tool result >2000 chars is truncated with flag", async () => {
    const client = createMockClient();
    const sync = createSync(client.session);

    sync.onMessageEnd(msg({ role: "user", content: [{ type: "text", text: "hi" }], timestamp: Date.now() }));
    await vi.waitFor(() => expect(client.session.createSession).toHaveBeenCalledOnce());

    sync.onMessageEnd(msg({
      role: "assistant",
      content: [{ type: "toolCall", id: "tc-1", name: "bash", arguments: {} }],
      timestamp: Date.now(),
    }));

    await new Promise((r) => setTimeout(r, 50));

    const longResult = "x".repeat(2500);
    sync.onMessageEnd(msg({ role: "toolResult", toolCallId: "tc-1", toolName: "bash", content: [{ type: "text", text: longResult }], isError: false, timestamp: Date.now() } as any));

    await vi.waitFor(() => {
      expect(client.session.sendMessage).toHaveBeenCalledTimes(2);
      const parts = (client.session.sendMessage as ReturnType<typeof vi.fn>).mock.calls[1][2] as Part[];
      const tp = parts[0] as Extract<Part, { type: "tool" }>;
      expect(tp.tool_output.length).toBe(2000);
      expect(tp.tool_output_truncated).toBe(true);
    });
  });

  test("tool result <=2000 chars is not truncated", async () => {
    const client = createMockClient();
    const sync = createSync(client.session);

    sync.onMessageEnd(msg({ role: "user", content: [{ type: "text", text: "hi" }], timestamp: Date.now() }));
    await vi.waitFor(() => expect(client.session.createSession).toHaveBeenCalledOnce());

    sync.onMessageEnd(msg({
      role: "assistant",
      content: [{ type: "toolCall", id: "tc-1", name: "bash", arguments: {} }],
      timestamp: Date.now(),
    }));

    await new Promise((r) => setTimeout(r, 50));

    const shortResult = "hello world";
    sync.onMessageEnd(msg({ role: "toolResult", toolCallId: "tc-1", toolName: "bash", content: [{ type: "text", text: shortResult }], isError: false, timestamp: Date.now() } as any));

    await vi.waitFor(() => {
      const parts = (client.session.sendMessage as ReturnType<typeof vi.fn>).mock.calls[1][2] as Part[];
      const tp = parts[0] as Extract<Part, { type: "tool" }>;
      expect(tp.tool_output).toBe("hello world");
      expect(tp.tool_output_truncated).toBe(false);
    });
  });

  // --- Test 7: tool_status mapping (D11) ---
  test("tool_status success when isError false", async () => {
    const client = createMockClient();
    const sync = createSync(client.session);

    sync.onMessageEnd(msg({ role: "user", content: [{ type: "text", text: "hi" }], timestamp: Date.now() }));
    await vi.waitFor(() => expect(client.session.createSession).toHaveBeenCalledOnce());

    sync.onMessageEnd(msg({
      role: "assistant",
      content: [{ type: "toolCall", id: "tc-1", name: "a", arguments: {} }],
      timestamp: Date.now(),
    }));

    await new Promise((r) => setTimeout(r, 50));

    sync.onMessageEnd(msg({ role: "toolResult", toolCallId: "tc-1", toolName: "a", content: [{ type: "text", text: "ok" }], isError: false, timestamp: Date.now() } as any));

    await vi.waitFor(() => {
      const parts = (client.session.sendMessage as ReturnType<typeof vi.fn>).mock.calls[1][2] as Part[];
      expect((parts[0] as any).tool_status).toBe("success");
    });
  });

  test("tool_status error when isError true", async () => {
    const client = createMockClient();
    const sync = createSync(client.session);

    sync.onMessageEnd(msg({ role: "user", content: [{ type: "text", text: "hi" }], timestamp: Date.now() }));
    await vi.waitFor(() => expect(client.session.createSession).toHaveBeenCalledOnce());

    sync.onMessageEnd(msg({
      role: "assistant",
      content: [{ type: "toolCall", id: "tc-1", name: "a", arguments: {} }],
      timestamp: Date.now(),
    }));

    await new Promise((r) => setTimeout(r, 50));

    sync.onMessageEnd(msg({ role: "toolResult", toolCallId: "tc-1", toolName: "a", content: [{ type: "text", text: "fail" }], isError: true, timestamp: Date.now() } as any));

    await vi.waitFor(() => {
      const parts = (client.session.sendMessage as ReturnType<typeof vi.fn>).mock.calls[1][2] as Part[];
      expect((parts[0] as any).tool_status).toBe("error");
    });
  });

  // --- Test 8: Thinking discarded (D10) ---
  test("thinking blocks are excluded from output", async () => {
    const client = createMockClient();
    const sync = createSync(client.session);

    sync.onMessageEnd(msg({ role: "user", content: [{ type: "text", text: "hi" }], timestamp: Date.now() }));
    await vi.waitFor(() => expect(client.session.createSession).toHaveBeenCalledOnce());

    sync.onMessageEnd(msg({
      role: "assistant",
      content: [
        { type: "thinking", thinking: "I should not appear" } as any,
        { type: "text", text: "visible text" },
        { type: "toolCall", id: "tc-1", name: "bash", arguments: { command: "ls" } },
      ],
      timestamp: Date.now(),
    }));

    await new Promise((r) => setTimeout(r, 50));
    const sendCount = (client.session.sendMessage as ReturnType<typeof vi.fn>).mock.calls.length;
    expect(sendCount).toBe(1); // still buffered (has tool calls)

    sync.onMessageEnd(msg({ role: "toolResult", toolCallId: "tc-1", toolName: "bash", content: [{ type: "text", text: "files" }], isError: false, timestamp: Date.now() } as any));

    await vi.waitFor(() => {
      expect(client.session.sendMessage).toHaveBeenCalledTimes(2);
      const parts = (client.session.sendMessage as ReturnType<typeof vi.fn>).mock.calls[1][2] as Part[];
      // Should have text + tool, NO thinking
      expect(parts.length).toBe(2);
      expect(parts[0]).toMatchObject({ type: "text", text: "visible text" });
      // Verify no text with thinking content
      const hasThinking = parts.some(p => p.type === "text" && (p as any).text?.includes("I should not appear"));
      expect(hasThinking).toBe(false);
    });
  });

  // --- Test 9: message_update ignored (D13) ---
  test("onMessageEnd processes role/user and role/assistant and role/toolResult only", async () => {
    const client = createMockClient();
    const sync = createSync(client.session);

    // Should be no-op — no createSession triggered
    sync.onMessageEnd({ role: "bashExecution", content: "ignored", timestamp: Date.now() } as any as AgentMessage);
    await new Promise((r) => setTimeout(r, 50));
    expect(client.session.createSession).not.toHaveBeenCalled();
    expect(client.session.sendMessage).not.toHaveBeenCalled();
  });

  // --- Test 10: Empty content skipped ---
  test("empty text content returns undefined and skips send", async () => {
    const client = createMockClient();
    const sync = createSync(client.session);

    // Empty string content
    sync.onMessageEnd(msg({ role: "user", content: [{ type: "text", text: "" }], timestamp: Date.now() }));
    await new Promise((r) => setTimeout(r, 50));
    expect(client.session.createSession).not.toHaveBeenCalled();
    expect(client.session.sendMessage).not.toHaveBeenCalled();
  });

  test("content with only thinking+image is skipped", async () => {
    const client = createMockClient();
    const sync = createSync(client.session);

    sync.onMessageEnd(msg({ role: "assistant", content: [
      { type: "thinking", thinking: "hmm" } as any,
      { type: "image", data: "abc", mimeType: "image/png" } as any,
    ], timestamp: Date.now() }));

    await new Promise((r) => setTimeout(r, 50));
    expect(client.session.createSession).not.toHaveBeenCalled();
    expect(client.session.sendMessage).not.toHaveBeenCalled();
  });

  // --- Infrastructure tests ---
  test("onSessionStart restores ovSessionId from getBranch", () => {
    const client = createMockClient();
    const sync = createSync(client.session, {
      getBranch: () => [
        { type: "message", id: "1", parentId: null, timestamp: "", message: {} },
        { type: "custom", customType: "ov-session", data: { ovSessionId: "restored-sess" } },
        { type: "message", id: "0", parentId: null, timestamp: "", message: {} },
      ] as any,
    });

    sync.onSessionStart();

    sync.onMessageEnd(msg({ role: "user", content: [{ type: "text", text: "test" }], timestamp: Date.now() }));

    return vi.waitFor(() => {
      expect(client.session.createSession).not.toHaveBeenCalled();
      expect(client.session.sendMessage).toHaveBeenCalledWith("restored-sess", "user", [{ type: "text", text: "test" } satisfies Part]);
    });
  });

  test("FIFO promise chain preserves message ordering", async () => {
    const order: string[] = [];
    let resolveCreate: () => void;
    const createPromise = new Promise<void>((r) => { resolveCreate = r; });

    const client = createMockClient({
      session: {
        createSession: vi.fn(async () => {
          await createPromise;
          return "ov-sess-1";
        }),
        sendMessage: vi.fn(async (_sid: string, _role: string, content: Part[]) => {
          const text = content.map(p => p.type === "text" ? p.text : "").join("");
          order.push(text);
        }),
      } as any,
    });
    const sync = createSync(client.session);

    sync.onMessageEnd(msg({ role: "user", content: [{ type: "text", text: "first" }], timestamp: Date.now() }));
    sync.onMessageEnd(msg({ role: "assistant", content: [{ type: "text", text: "second" }], timestamp: Date.now() }));
    sync.onMessageEnd(msg({ role: "user", content: [{ type: "text", text: "third" }], timestamp: Date.now() }));

    expect(order).toEqual([]);
    resolveCreate!();
    await vi.waitFor(() => {
      expect(order).toEqual(["first", "second", "third"]);
    });
  });

  test("appendEntry called to persist ov-session mapping", async () => {
    const client = createMockClient();
    const appendEntry = vi.fn();
    const sync = createSync(client.session, { appendEntry });

    sync.onMessageEnd(msg({ role: "user", content: [{ type: "text", text: "hello" }], timestamp: Date.now() }));

    await vi.waitFor(() => {
      expect(appendEntry).toHaveBeenCalledWith("ov-session", { ovSessionId: "ov-sess-1" });
    });
  });

  test("no appendEntry for ephemeral session", async () => {
    const client = createMockClient();
    const appendEntry = vi.fn();
    const sync = createSync(client.session, {
      getSessionFile: () => undefined,
      appendEntry,
    });

    sync.onMessageEnd(msg({ role: "user", content: [{ type: "text", text: "hello" }], timestamp: Date.now() }));

    await vi.waitFor(() => expect(client.session.createSession).toHaveBeenCalledOnce());
    expect(appendEntry).not.toHaveBeenCalled();
  });

  test("commit calls client.commit with ovSessionId", async () => {
    const client = createMockClient();
    const sync = createSync(client.session);

    sync.onMessageEnd(msg({ role: "user", content: [{ type: "text", text: "hello" }], timestamp: Date.now() }));
    await vi.waitFor(() => expect(client.session.createSession).toHaveBeenCalledOnce());

    const result = await sync.commit();
    expect(client.session.commit).toHaveBeenCalledWith("ov-sess-1");
    expect(result.task_id).toBe("task-1");
  });

  test("commit throws when no ovSessionId", async () => {
    const client = createMockClient();
    const sync = createSync(client.session);
    await expect(sync.commit()).rejects.toThrow("No OpenViking session mapped");
  });

  test("onShutdown resets session state", async () => {
    const client = createMockClient();
    const sync = createSync(client.session);

    sync.onMessageEnd(msg({ role: "user", content: [{ type: "text", text: "before" }], timestamp: Date.now() }));
    await vi.waitFor(() => expect(client.session.sendMessage).toHaveBeenCalledOnce());

    await sync.onShutdown();

    const createSpy = client.session.createSession as ReturnType<typeof vi.fn>;
    sync.onMessageEnd(msg({ role: "user", content: [{ type: "text", text: "after" }], timestamp: Date.now() }));
    await vi.waitFor(() => expect(createSpy).toHaveBeenCalledTimes(2));
  });

  test("string content is wrapped in Part[TextPart]", async () => {
    const client = createMockClient();
    const sync = createSync(client.session);

    sync.onMessageEnd(msg({ role: "user", content: "plain string", timestamp: Date.now() }));

    await vi.waitFor(() => {
      expect(client.session.createSession).toHaveBeenCalledOnce();
      expect(client.session.sendMessage).toHaveBeenCalledWith(
        "ov-sess-1",
        "user",
        [{ type: "text", text: "plain string" } satisfies Part],
      );
    });
  });

  // --- Resource consumption tracking ---
  describe("consumption tracking", () => {
    const testItems: RecallItem[] = [
      { type: "memory", score: 0.9, text: "user prefers X", uri: "viking://user/memories/m1", abstract: "pref summary" },
      { type: "resource", score: 0.8, text: "full doc text", uri: "viking://resources/docs/api.md", overview: "api overview" },
    ];

    test("assistant text-only: appends ContextParts, calls sessionUsed, clears items", async () => {
      const client = createMockClient();
      const state = { enabled: true, lastInjectedItems: [...testItems] };
      const sync = createSync(client.session, { autoRecallState: state });

      // Prime session
      sync.onMessageEnd(msg({ role: "user", content: [{ type: "text", text: "hello" }], timestamp: Date.now() }));
      await vi.waitFor(() => expect(client.session.createSession).toHaveBeenCalledOnce());

      // Assistant text-only turn
      sync.onMessageEnd(msg({ role: "assistant", content: [{ type: "text", text: "response" }], timestamp: Date.now() }));

      await vi.waitFor(() => {
        expect(client.session.sendMessage).toHaveBeenCalledTimes(2);
      });

      // Check ContextParts appended to assistant message
      const parts = (client.session.sendMessage as ReturnType<typeof vi.fn>).mock.calls[1][2] as Part[];
      const ctxParts = parts.filter((p): p is ContextPart => p.type === "context");
      expect(ctxParts).toHaveLength(2);
      expect(ctxParts[0]).toEqual({
        type: "context",
        uri: "viking://user/memories/m1",
        context_type: "memory",
        abstract: "pref summary",
      });
      expect(ctxParts[1]).toEqual({
        type: "context",
        uri: "viking://resources/docs/api.md",
        context_type: "resource",
        abstract: "api overview",
      });

      // sessionUsed called
      await vi.waitFor(() => {
        expect(client.session.sessionUsed).toHaveBeenCalledWith(
          "ov-sess-1",
          ["viking://user/memories/m1", "viking://resources/docs/api.md"],
        );
      });

      // Items cleared
      expect(state.lastInjectedItems).toEqual([]);
    });

    test("empty injection: no ContextParts, no sessionUsed call", async () => {
      const client = createMockClient();
      const state = { enabled: true, lastInjectedItems: [] as RecallItem[] };
      const sync = createSync(client.session, { autoRecallState: state });

      sync.onMessageEnd(msg({ role: "user", content: [{ type: "text", text: "hello" }], timestamp: Date.now() }));
      await vi.waitFor(() => expect(client.session.createSession).toHaveBeenCalledOnce());

      sync.onMessageEnd(msg({ role: "assistant", content: [{ type: "text", text: "response" }], timestamp: Date.now() }));

      await vi.waitFor(() => {
        expect(client.session.sendMessage).toHaveBeenCalledTimes(2);
      });

      const parts = (client.session.sendMessage as ReturnType<typeof vi.fn>).mock.calls[1][2] as Part[];
      expect(parts.every(p => p.type !== "context")).toBe(true);
      expect(client.session.sessionUsed).not.toHaveBeenCalled();
    });

    test("abstract cascade: abstract → overview → text", async () => {
      const client = createMockClient();
      const items: RecallItem[] = [
        { type: "resource", score: 0.9, text: "full text", uri: "viking://r1" }, // no abstract, no overview → text
        { type: "resource", score: 0.8, text: "full text", uri: "viking://r2", overview: "ov" }, // overview
        { type: "resource", score: 0.7, text: "full text", uri: "viking://r3", abstract: "abs" }, // abstract wins
      ];
      const state = { enabled: true, lastInjectedItems: items };
      const sync = createSync(client.session, { autoRecallState: state });

      sync.onMessageEnd(msg({ role: "user", content: [{ type: "text", text: "hello" }], timestamp: Date.now() }));
      await vi.waitFor(() => expect(client.session.createSession).toHaveBeenCalledOnce());

      sync.onMessageEnd(msg({ role: "assistant", content: [{ type: "text", text: "response" }], timestamp: Date.now() }));

      await vi.waitFor(() => {
        expect(client.session.sendMessage).toHaveBeenCalledTimes(2);
      });

      const parts = (client.session.sendMessage as ReturnType<typeof vi.fn>).mock.calls[1][2] as Part[];
      const ctxParts = parts.filter((p): p is ContextPart => p.type === "context");
      expect(ctxParts[0].abstract).toBe("full text"); // cascade to text
      expect(ctxParts[1].abstract).toBe("ov"); // overview
      expect(ctxParts[2].abstract).toBe("abs"); // abstract wins
    });

    test("two consecutive turns: items cleared between turns", async () => {
      const client = createMockClient();
      const state = { enabled: true, lastInjectedItems: [...testItems] };
      const sync = createSync(client.session, { autoRecallState: state });

      sync.onMessageEnd(msg({ role: "user", content: [{ type: "text", text: "hello" }], timestamp: Date.now() }));
      await vi.waitFor(() => expect(client.session.createSession).toHaveBeenCalledOnce());

      // Turn 1: assistant with items
      sync.onMessageEnd(msg({ role: "assistant", content: [{ type: "text", text: "response 1" }], timestamp: Date.now() }));
      await vi.waitFor(() => {
        expect(client.session.sendMessage).toHaveBeenCalledTimes(2);
      });
      expect(state.lastInjectedItems).toEqual([]);

      // Simulate new injection for turn 2
      const turn2Items: RecallItem[] = [
        { type: "memory", score: 0.7, text: "new item", uri: "viking://user/memories/m2" },
      ];
      state.lastInjectedItems = turn2Items;

      // Turn 2: new assistant
      sync.onMessageEnd(msg({ role: "assistant", content: [{ type: "text", text: "response 2" }], timestamp: Date.now() }));
      await vi.waitFor(() => {
        expect(client.session.sendMessage).toHaveBeenCalledTimes(3);
      });

      const parts2 = (client.session.sendMessage as ReturnType<typeof vi.fn>).mock.calls[2][2] as Part[];
      const ctxParts2 = parts2.filter((p): p is ContextPart => p.type === "context");
      expect(ctxParts2).toHaveLength(1);
      expect(ctxParts2[0].uri).toBe("viking://user/memories/m2");
    });

    test("buffered tool-call: ContextParts deferred to flush", async () => {
      const client = createMockClient();
      const state = { enabled: true, lastInjectedItems: [...testItems] };
      const sync = createSync(client.session, { autoRecallState: state });

      sync.onMessageEnd(msg({ role: "user", content: [{ type: "text", text: "hello" }], timestamp: Date.now() }));
      await vi.waitFor(() => expect(client.session.createSession).toHaveBeenCalledOnce());

      // Assistant with tool call → buffered
      sync.onMessageEnd(msg({
        role: "assistant",
        content: [
          { type: "text", text: "running tool" },
          { type: "toolCall", id: "tc-1", name: "bash", arguments: {} },
        ],
        timestamp: Date.now(),
      }));

      await new Promise((r) => setTimeout(r, 50));
      // Items NOT cleared yet — still buffered
      expect(state.lastInjectedItems.length).toBe(2);

      // Tool result → flush
      sync.onMessageEnd(msg({ role: "toolResult", toolCallId: "tc-1", toolName: "bash", content: [{ type: "text", text: "output" }], isError: false, timestamp: Date.now() } as any));

      await vi.waitFor(() => {
        expect(client.session.sendMessage).toHaveBeenCalledTimes(2);
      });

      const parts = (client.session.sendMessage as ReturnType<typeof vi.fn>).mock.calls[1][2] as Part[];
      const ctxParts = parts.filter((p): p is ContextPart => p.type === "context");
      expect(ctxParts).toHaveLength(2);

      await vi.waitFor(() => {
        expect(client.session.sessionUsed).toHaveBeenCalled();
      });
      expect(state.lastInjectedItems).toEqual([]);
    });
  });
});
