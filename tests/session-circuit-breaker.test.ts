import { describe, test, expect, vi, beforeEach } from "vitest";
import { SessionSync } from "../src/session-sync/session";
import type { OpenVikingClient } from "../src/ov-client/client";
import { createMockClient } from "./mocks";

import type { AgentMessage } from "@mariozechner/pi-agent-core";

function msg(m: Partial<AgentMessage> & { role: string }): AgentMessage {
  return m as AgentMessage;
}

function createSync(client: OpenVikingClient, opts?: {
  getSessionFile?: () => string | undefined;
  getBranch?: () => any[];
  appendEntry?: (type: string, data: unknown) => void;
  maxConsecutiveFailures?: number;
}) {
  return new SessionSync(client, {
    getSessionFile: opts?.getSessionFile ?? (() => "/path/to/session.json"),
    getBranch: opts?.getBranch ?? (() => []),
    appendEntry: opts?.appendEntry ?? (() => {}),
    maxConsecutiveFailures: opts?.maxConsecutiveFailures,
  });
}

describe("SessionSync circuit breaker", () => {
  test("stops syncing after 3 consecutive failures", async () => {
    const client = createMockClient({
      createSession: vi.fn(async () => { throw new Error("ECONNREFUSED"); }),
    });
    const sync = createSync(client);

    // 3 failures
    sync.onMessageEnd(msg({ role: "user", content: "msg1", timestamp: Date.now() }));
    await vi.waitFor(() => expect(client.createSession).toHaveBeenCalledTimes(1));
    sync.onMessageEnd(msg({ role: "user", content: "msg2", timestamp: Date.now() }));
    await vi.waitFor(() => expect(client.createSession).toHaveBeenCalledTimes(2));
    sync.onMessageEnd(msg({ role: "user", content: "msg3", timestamp: Date.now() }));
    await vi.waitFor(() => expect(client.createSession).toHaveBeenCalledTimes(3));

    // 4th message should be skipped (circuit open)
    sync.onMessageEnd(msg({ role: "user", content: "msg4", timestamp: Date.now() }));
    await new Promise(r => setTimeout(r, 50));
    expect(client.createSession).toHaveBeenCalledTimes(3); // still 3, not 4
  });

  test("resumes syncing after recovery call", async () => {
    let callCount = 0;
    const client = createMockClient({
      createSession: vi.fn(async () => {
        callCount++;
        if (callCount <= 3) throw new Error("down");
        return "ov-sess-recovered";
      }),
      sendMessage: vi.fn(async () => {}),
    });
    const sync = createSync(client);

    // Trip the circuit breaker
    for (let i = 0; i < 3; i++) {
      sync.onMessageEnd(msg({ role: "user", content: `fail-${i}`, timestamp: Date.now() }));
    }
    await vi.waitFor(() => expect(client.createSession).toHaveBeenCalledTimes(3));

    // 4th message skipped
    sync.onMessageEnd(msg({ role: "user", content: "skipped", timestamp: Date.now() }));
    await new Promise(r => setTimeout(r, 50));
    expect(client.createSession).toHaveBeenCalledTimes(3);

    // Recover
    sync.recover();

    // Now messages should go through again
    sync.onMessageEnd(msg({ role: "user", content: "after-recover", timestamp: Date.now() }));
    await vi.waitFor(() => {
      expect(client.createSession).toHaveBeenCalledTimes(4);
      expect(client.sendMessage).toHaveBeenCalledWith("ov-sess-recovered", "user", "after-recover");
    });
  });

  test("configurable max consecutive failures", async () => {
    const client = createMockClient({
      sendMessage: vi.fn(async () => { throw new Error("timeout"); }),
    });
    const sync = createSync(client, { maxConsecutiveFailures: 2 });

    // Session created normally, sendMessage fails
    sync.onMessageEnd(msg({ role: "user", content: "msg1", timestamp: Date.now() }));
    await vi.waitFor(() => expect(client.createSession).toHaveBeenCalledOnce());
    await vi.waitFor(() => expect(client.sendMessage).toHaveBeenCalledTimes(1));

    sync.onMessageEnd(msg({ role: "user", content: "msg2", timestamp: Date.now() }));
    await vi.waitFor(() => expect(client.sendMessage).toHaveBeenCalledTimes(2));

    // 3rd message should be skipped (circuit open after 2 failures)
    sync.onMessageEnd(msg({ role: "user", content: "msg3", timestamp: Date.now() }));
    await new Promise(r => setTimeout(r, 50));
    expect(client.sendMessage).toHaveBeenCalledTimes(2);
  });

  test("successful message resets failure counter", async () => {
    let callCount = 0;
    const client = createMockClient({
      sendMessage: vi.fn(async () => {
        callCount++;
        if (callCount === 1) throw new Error("transient");
      }),
    });
    const sync = createSync(client);

    // First send fails → 1 consecutive failure
    sync.onMessageEnd(msg({ role: "user", content: "fail", timestamp: Date.now() }));
    await vi.waitFor(() => expect(client.sendMessage).toHaveBeenCalledTimes(1));

    // Second send succeeds → resets to 0
    sync.onMessageEnd(msg({ role: "user", content: "ok", timestamp: Date.now() }));
    await vi.waitFor(() => expect(client.sendMessage).toHaveBeenCalledTimes(2));

    // 2 more failures → counter at 2 (not tripped yet, needs 3)
    (client.sendMessage as ReturnType<typeof vi.fn>).mockRejectedValue(new Error("down"));
    sync.onMessageEnd(msg({ role: "user", content: "fail2", timestamp: Date.now() }));
    await vi.waitFor(() => expect(client.sendMessage).toHaveBeenCalledTimes(3));
    sync.onMessageEnd(msg({ role: "user", content: "fail3", timestamp: Date.now() }));
    await vi.waitFor(() => expect(client.sendMessage).toHaveBeenCalledTimes(4));

    // 3rd consecutive failure → trips breaker, 5th call goes through (counter=3 triggers skip)
    sync.onMessageEnd(msg({ role: "user", content: "fail4", timestamp: Date.now() }));
    await vi.waitFor(() => expect(client.sendMessage).toHaveBeenCalledTimes(5));

    // Now counter = 3 → circuit open, 6th message skipped
    sync.onMessageEnd(msg({ role: "user", content: "fail5", timestamp: Date.now() }));
    await new Promise(r => setTimeout(r, 50));
    expect(client.sendMessage).toHaveBeenCalledTimes(5);
  });
});
