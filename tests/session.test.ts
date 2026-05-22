import { describe, test, expect, vi, beforeEach } from "vitest";
import type { SessionClient } from "../src/ov-client/client";
import { SessionSync } from "../src/session-sync/session";
import { createMockClient } from "./mocks";

import type { AgentMessage } from "@mariozechner/pi-agent-core";

function msg(m: Partial<AgentMessage> & { role: string }): AgentMessage {
  return m as AgentMessage;
}

function createSync(sessionClient: SessionClient, opts?: {
  getSessionFile?: () => string | undefined;
  getBranch?: () => any[];
  appendEntry?: (type: string, data: unknown) => void;
}) {
  return new SessionSync(sessionClient, {
    getSessionFile: opts?.getSessionFile ?? (() => "/path/to/session.json"),
    getBranch: opts?.getBranch ?? (() => []),
    appendEntry: opts?.appendEntry ?? (() => {}),
  });
}

describe("SessionSync", () => {
  test("onMessageEnd with user text creates session lazily and sends", async () => {
    const client = createMockClient();
    const sync = createSync(client.session);

    sync.onMessageEnd(msg({
      role: "user",
      content: [{ type: "text", text: "hello world" }],
      timestamp: Date.now(),
    }));

    await vi.waitFor(() => {
      expect(client.session.createSession).toHaveBeenCalledOnce();
      expect(client.session.sendMessage).toHaveBeenCalledWith("ov-sess-1", "user", "hello world");
    });
  });

  test("onMessageEnd with assistant text sends to existing session", async () => {
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
      expect(client.session.sendMessage).toHaveBeenCalledWith("ov-sess-1", "assistant", "response text");
    });
  });

  test("onMessageEnd sends toolResult with metadata prefix", async () => {
    const client = createMockClient();
    const sync = createSync(client.session);

    sync.onMessageEnd(msg({ role: "user", content: "hello", timestamp: Date.now() }));
    await vi.waitFor(() => expect(client.session.createSession).toHaveBeenCalledOnce());

    sync.onMessageEnd(msg({
      role: "toolResult",
      toolCallId: "tc-1",
      toolName: "bash",
      content: [{ type: "text", text: "file1.txt\nfile2.txt" }],
      isError: false,
      timestamp: Date.now(),
    } as any));

    await vi.waitFor(() => {
      expect(client.session.sendMessage).toHaveBeenCalledWith(
        "ov-sess-1",
        "toolResult",
        "[tool: bash, error: false]\nfile1.txt\nfile2.txt",
      );
    });
  });

  test("onMessageEnd truncates toolResult content at 500 chars", async () => {
    const client = createMockClient();
    const sync = createSync(client.session);

    sync.onMessageEnd(msg({ role: "user", content: "hello", timestamp: Date.now() }));
    await vi.waitFor(() => expect(client.session.createSession).toHaveBeenCalledOnce());

    const longContent = "x".repeat(600);
    sync.onMessageEnd(msg({
      role: "toolResult",
      toolCallId: "tc-2",
      toolName: "read",
      content: [{ type: "text", text: longContent }],
      isError: true,
      timestamp: Date.now(),
    } as any));

    await vi.waitFor(() => {
      expect(client.session.sendMessage).toHaveBeenCalledWith(
        "ov-sess-1",
        "toolResult",
        `[tool: read, error: true]\n${"x".repeat(500)}`,
      );
    });
  });

  test("onMessageEnd with assistant text + tool calls sends Part[]", async () => {
    const client = createMockClient();
    const sync = createSync(client.session);

    sync.onMessageEnd(msg({
      role: "user",
      content: "do something",
      timestamp: Date.now(),
    }));
    await vi.waitFor(() => expect(client.session.createSession).toHaveBeenCalledOnce());

    sync.onMessageEnd(msg({
      role: "assistant",
      content: [
        { type: "text", text: "I'll run bash" },
        { type: "toolCall", id: "tc-1", name: "bash", arguments: { command: "ls" } },
      ],
      timestamp: Date.now(),
    }));

    await vi.waitFor(() => {
      expect(client.session.sendMessage).toHaveBeenCalledWith("ov-sess-1", "assistant", [
        { type: "text", text: "I'll run bash" },
        { type: "tool_use", id: "tc-1", name: "bash", input: { command: "ls" } },
      ]);
    });
  });

  test("onMessageEnd with assistant text only still sends string", async () => {
    const client = createMockClient();
    const sync = createSync(client.session);

    sync.onMessageEnd(msg({
      role: "user",
      content: "hello",
      timestamp: Date.now(),
    }));
    await vi.waitFor(() => expect(client.session.createSession).toHaveBeenCalledOnce());

    sync.onMessageEnd(msg({
      role: "assistant",
      content: [
        { type: "text", text: "thinking" },
        { type: "text", text: " more" },
      ],
      timestamp: Date.now(),
    }));

    await vi.waitFor(() => {
      expect(client.session.sendMessage).toHaveBeenCalledWith("ov-sess-1", "assistant", "thinking more");
    });
  });

  test("onMessageEnd skips toolResult with no text content", async () => {
    const client = createMockClient();
    const sync = createSync(client.session);

    sync.onMessageEnd(msg({ role: "user", content: "hello", timestamp: Date.now() }));
    await vi.waitFor(() => expect(client.session.createSession).toHaveBeenCalledOnce());
    const sendCount = (client.session.sendMessage as ReturnType<typeof vi.fn>).mock.calls.length;

    sync.onMessageEnd(msg({
      role: "toolResult",
      toolCallId: "tc-3",
      toolName: "imageTool",
      content: [{ type: "image", data: "abc", mimeType: "image/png" } as any],
      isError: false,
      timestamp: Date.now(),
    } as any));

    await new Promise((r) => setTimeout(r, 50));
    expect(client.session.sendMessage).toHaveBeenCalledTimes(sendCount);
  });

  test("onMessageEnd skips content with only thinking + image (no text, no toolCalls)", async () => {
    const client = createMockClient();
    const sync = createSync(client.session);

    sync.onMessageEnd(msg({
      role: "assistant",
      content: [
        { type: "thinking", thinking: "hmm" } as any,
        { type: "image", data: "abc", mimeType: "image/png" } as any,
      ],
      timestamp: Date.now(),
    }));

    await new Promise((r) => setTimeout(r, 50));
    expect(client.session.createSession).not.toHaveBeenCalled();
    expect(client.session.sendMessage).not.toHaveBeenCalled();
  });

  test("onMessageEnd skips empty text extraction", async () => {
    const client = createMockClient();
    const sync = createSync(client.session);

    sync.onMessageEnd(msg({
      role: "user",
      content: [{ type: "text", text: "" }],
      timestamp: Date.now(),
    }));

    await new Promise((r) => setTimeout(r, 50));
    expect(client.session.createSession).not.toHaveBeenCalled();
  });

  test("onMessageEnd with string content sends directly", async () => {
    const client = createMockClient();
    const sync = createSync(client.session);

    sync.onMessageEnd(msg({
      role: "user",
      content: "plain string message",
      timestamp: Date.now(),
    }));

    await vi.waitFor(() => {
      expect(client.session.createSession).toHaveBeenCalledOnce();
      expect(client.session.sendMessage).toHaveBeenCalledWith("ov-sess-1", "user", "plain string message");
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
        sendMessage: vi.fn(async (_sid: string, _role: string, content: string) => {
          order.push(content);
        }),
      } as any,
    });
    const sync = createSync(client.session);

    sync.onMessageEnd(msg({ role: "user", content: "first", timestamp: Date.now() }));
    sync.onMessageEnd(msg({ role: "assistant", content: [{ type: "text", text: "second" }], timestamp: Date.now() }));
    sync.onMessageEnd(msg({ role: "user", content: "third", timestamp: Date.now() }));

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

    sync.onMessageEnd(msg({
      role: "user",
      content: "hello",
      timestamp: Date.now(),
    }));

    await vi.waitFor(() => {
      expect(appendEntry).toHaveBeenCalledWith("ov-session", { ovSessionId: "ov-sess-1" });
    });
  });

  test("no appendEntry for ephemeral session (getSessionFile returns undefined)", async () => {
    const client = createMockClient();
    const appendEntry = vi.fn();
    const sync = createSync(client.session, {
      getSessionFile: () => undefined,
      appendEntry,
    });

    sync.onMessageEnd(msg({
      role: "user",
      content: "hello",
      timestamp: Date.now(),
    }));

    await vi.waitFor(() => expect(client.session.createSession).toHaveBeenCalledOnce());
    expect(appendEntry).not.toHaveBeenCalled();
  });

  test("onSessionStart restores ovSessionId from getBranch custom entries", () => {
    const client = createMockClient();
    const sync = createSync(client.session, {
      getBranch: () => [
        { type: "message", id: "1", parentId: null, timestamp: "", message: {} },
        { type: "custom", customType: "ov-session", data: { ovSessionId: "restored-sess" } },
        { type: "message", id: "0", parentId: null, timestamp: "", message: {} },
      ] as any,
    });

    sync.onSessionStart();

    sync.onMessageEnd(msg({
      role: "user",
      content: "test",
      timestamp: Date.now(),
    }));

    return vi.waitFor(() => {
      expect(client.session.createSession).not.toHaveBeenCalled();
      expect(client.session.sendMessage).toHaveBeenCalledWith("restored-sess", "user", "test");
    });
  });

  test("onShutdown discards queue and resets session", async () => {
    const client = createMockClient();
    const sync = createSync(client.session);

    sync.onMessageEnd(msg({ role: "user", content: "before", timestamp: Date.now() }));
    await vi.waitFor(() => expect(client.session.sendMessage).toHaveBeenCalledOnce());

    await sync.onShutdown();

    const createSpy = client.session.createSession as ReturnType<typeof vi.fn>;
    sync.onMessageEnd(msg({ role: "user", content: "after", timestamp: Date.now() }));
    await vi.waitFor(() => expect(createSpy).toHaveBeenCalledTimes(2));
  });

  test("onShutdown does not commit (manual only)", async () => {
    const client = createMockClient();
    const sync = createSync(client.session);

    sync.onMessageEnd(msg({ role: "user", content: "hello", timestamp: Date.now() }));
    await vi.waitFor(() => expect(client.session.sendMessage).toHaveBeenCalledOnce());

    await sync.onShutdown();
    expect(client.session.commit).not.toHaveBeenCalled();
  });

  test("commit calls client.commit with ovSessionId and returns result", async () => {
    const client = createMockClient();
    const sync = createSync(client.session);

    sync.onMessageEnd(msg({ role: "user", content: "hello", timestamp: Date.now() }));
    await vi.waitFor(() => expect(client.session.createSession).toHaveBeenCalledOnce());

    const result = await sync.commit();
    expect(client.session.commit).toHaveBeenCalledWith("ov-sess-1");
    expect(result.task_id).toBe("task-1");
    expect(result.archived).toBe(true);
  });

  test("commit throws when no ovSessionId", async () => {
    const client = createMockClient();
    const sync = createSync(client.session);
    await expect(sync.commit()).rejects.toThrow("No OpenViking session mapped");
  });

  test("onMessageEnd does not crash when OV server is down", async () => {
    const client = createMockClient({
      session: {
        createSession: vi.fn(async () => { throw new Error("ECONNREFUSED"); }),
      } as any,
    });
    const sync = createSync(client.session);

    sync.onMessageEnd(msg({ role: "user", content: "hello", timestamp: Date.now() }));
    await vi.waitFor(() => expect(client.session.createSession).toHaveBeenCalledOnce());
  });

  test("onMessageEnd does not crash when sendMessage fails", async () => {
    const client = createMockClient({
      session: {
        sendMessage: vi.fn(async () => { throw new Error("timeout"); }),
      } as any,
    });
    const sync = createSync(client.session);

    sync.onMessageEnd(msg({ role: "user", content: "hello", timestamp: Date.now() }));
    await vi.waitFor(() => {
      expect(client.session.createSession).toHaveBeenCalledOnce();
      expect(client.session.sendMessage).toHaveBeenCalledOnce();
    });
  });

  test("onShutdown returns immediately even when pending chain is slow", async () => {
    const client = createMockClient();
    const sync = createSync(client.session);

    sync.onMessageEnd(msg({ role: "user", content: "hello", timestamp: Date.now() }));
    await vi.waitFor(() => expect(client.session.sendMessage).toHaveBeenCalledOnce());

    (sync as any).pendingChain = new Promise(() => {});

    const start = Date.now();
    await sync.onShutdown();
    const elapsed = Date.now() - start;
    expect(elapsed).toBeLessThan(500);
  });

  test("onShutdown does not call commit when chain has pending work", async () => {
    const client = createMockClient();
    const sync = createSync(client.session);

    sync.onMessageEnd(msg({ role: "user", content: "hello", timestamp: Date.now() }));
    await vi.waitFor(() => expect(client.session.sendMessage).toHaveBeenCalledOnce());

    const start = Date.now();
    await sync.onShutdown();
    const elapsed = Date.now() - start;

    expect(elapsed).toBeLessThan(500);
    expect(client.session.commit).not.toHaveBeenCalled();
  });
});
