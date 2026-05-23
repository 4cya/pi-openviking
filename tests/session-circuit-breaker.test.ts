import { describe, test, expect, vi, beforeEach } from "vitest";
import { SessionSync } from "../src/session-sync/session";
import type { SessionClient } from "../src/ov-client/client";
import { createMockClient } from "./mocks";

import type { AgentMessage } from "@earendil-works/pi-agent-core";
import type { Part } from "../src/ov-client/types";

function createSync(sessionClient: SessionClient, opts?: {
  getSessionFile?: () => string | undefined;
  getBranch?: () => any[];
  appendEntry?: (type: string, data: unknown) => void;
  maxConsecutiveFailures?: number;
}) {
  return new SessionSync(sessionClient, {
    getSessionFile: opts?.getSessionFile ?? (() => "/path/to/session.json"),
    getBranch: opts?.getBranch ?? (() => []),
    appendEntry: opts?.appendEntry ?? (() => {}),
    maxConsecutiveFailures: opts?.maxConsecutiveFailures,
  });
}

describe("SessionSync circuit breaker", () => {
  test("stops syncing after 3 consecutive failures", async () => {
    const client = createMockClient({ session: { createSession: vi.fn(async () => { throw new Error("ECONNREFUSED"); }) } as any });
    const sync = createSync(client.session);

    sync.onMessageEnd({ role: "user", content: "msg1", timestamp: Date.now() } as any as AgentMessage);
    await vi.waitFor(() => expect(client.session.createSession).toHaveBeenCalledTimes(1));
    sync.onMessageEnd({ role: "user", content: "msg2", timestamp: Date.now() } as any as AgentMessage);
    await vi.waitFor(() => expect(client.session.createSession).toHaveBeenCalledTimes(2));
    sync.onMessageEnd({ role: "user", content: "msg3", timestamp: Date.now() } as any as AgentMessage);
    await vi.waitFor(() => expect(client.session.createSession).toHaveBeenCalledTimes(3));

    sync.onMessageEnd({ role: "user", content: "msg4", timestamp: Date.now() } as any as AgentMessage);
    await new Promise(r => setTimeout(r, 50));
    expect(client.session.createSession).toHaveBeenCalledTimes(3);
  });

  test("resumes syncing after recovery call", async () => {
    let callCount = 0;
    const client = createMockClient({
      session: {
        createSession: vi.fn(async () => {
          callCount++;
          if (callCount <= 3) throw new Error("down");
          return "ov-sess-recovered";
        }),
        sendMessage: vi.fn(async () => {}),
      } as any,
    });
    const sync = createSync(client.session);

    for (let i = 0; i < 3; i++) {
      sync.onMessageEnd({ role: "user", content: `fail-${i}`, timestamp: Date.now() } as any as AgentMessage);
    }
    await vi.waitFor(() => expect(client.session.createSession).toHaveBeenCalledTimes(3));

    sync.onMessageEnd({ role: "user", content: "skipped", timestamp: Date.now() } as any as AgentMessage);
    await new Promise(r => setTimeout(r, 50));
    expect(client.session.createSession).toHaveBeenCalledTimes(3);

    sync.recover();

    sync.onMessageEnd({ role: "user", content: "after-recover", timestamp: Date.now() } as any as AgentMessage);
    await vi.waitFor(() => {
      expect(client.session.createSession).toHaveBeenCalledTimes(4);
      expect(client.session.sendMessage).toHaveBeenCalledWith("ov-sess-recovered", "user", [{ type: "text", text: "after-recover" } satisfies Part]);
    });
  });

  test("configurable max consecutive failures", async () => {
    const client = createMockClient({ session: { sendMessage: vi.fn(async () => { throw new Error("timeout"); }) } as any });
    const sync = createSync(client.session, { maxConsecutiveFailures: 2 });

    sync.onMessageEnd({ role: "user", content: "msg1", timestamp: Date.now() } as any as AgentMessage);
    await vi.waitFor(() => expect(client.session.createSession).toHaveBeenCalledOnce());
    await vi.waitFor(() => expect(client.session.sendMessage).toHaveBeenCalledTimes(1));

    sync.onMessageEnd({ role: "user", content: "msg2", timestamp: Date.now() } as any as AgentMessage);
    await vi.waitFor(() => expect(client.session.sendMessage).toHaveBeenCalledTimes(2));

    sync.onMessageEnd({ role: "user", content: "msg3", timestamp: Date.now() } as any as AgentMessage);
    await new Promise(r => setTimeout(r, 50));
    expect(client.session.sendMessage).toHaveBeenCalledTimes(2);
  });

  test("successful message resets failure counter", async () => {
    let callCount = 0;
    const client = createMockClient({
      session: {
        sendMessage: vi.fn(async () => {
          callCount++;
          if (callCount === 1) throw new Error("transient");
        }),
      } as any,
    });
    const sync = createSync(client.session);

    sync.onMessageEnd({ role: "user", content: "fail", timestamp: Date.now() } as any as AgentMessage);
    await vi.waitFor(() => expect(client.session.sendMessage).toHaveBeenCalledTimes(1));

    sync.onMessageEnd({ role: "user", content: "ok", timestamp: Date.now() } as any as AgentMessage);
    await vi.waitFor(() => expect(client.session.sendMessage).toHaveBeenCalledTimes(2));

    (client.session.sendMessage as ReturnType<typeof vi.fn>).mockRejectedValue(new Error("down"));
    sync.onMessageEnd({ role: "user", content: "fail2", timestamp: Date.now() } as any as AgentMessage);
    await vi.waitFor(() => expect(client.session.sendMessage).toHaveBeenCalledTimes(3));
    sync.onMessageEnd({ role: "user", content: "fail3", timestamp: Date.now() } as any as AgentMessage);
    await vi.waitFor(() => expect(client.session.sendMessage).toHaveBeenCalledTimes(4));

    sync.onMessageEnd({ role: "user", content: "fail4", timestamp: Date.now() } as any as AgentMessage);
    await vi.waitFor(() => expect(client.session.sendMessage).toHaveBeenCalledTimes(5));

    sync.onMessageEnd({ role: "user", content: "fail5", timestamp: Date.now() } as any as AgentMessage);
    await new Promise(r => setTimeout(r, 50));
    expect(client.session.sendMessage).toHaveBeenCalledTimes(5);
  });
});
