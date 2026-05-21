import { describe, test, expect, vi } from "vitest";
import { commitOp } from "../src/operations/commit";
import type { CommitResult } from "../src/ov-client/client";
import type { SessionSyncLike } from "../src/session-sync/session";
import { createMockClient, createMockSessionSync } from "./mocks";

describe("commitOp", () => {
  test("fire-and-forget returns commit result immediately", async () => {
    const sync = createMockSessionSync();
    const result = await commitOp(sync);
    expect(result.task_id).toBe("task-1");
    expect(result.archived).toBe(true);
    expect(sync.flush).toHaveBeenCalledOnce();
    expect(sync.commit).toHaveBeenCalledOnce();
  });

  test("with wait=true, polls until completed", async () => {
    const sync = createMockSessionSync();
    const client = createMockClient({
      getTaskStatus: vi.fn(async () => ({ task_id: "task-1", status: "completed" })),
    });

    const result = await commitOp(sync, { client, wait: true });
    expect(result.task_id).toBe("task-1");
    expect(result.status).toBe("completed");
    expect(client.getTaskStatus).toHaveBeenCalledWith("task-1", undefined);
  });

  test("with wait=true, polls multiple times until completed", async () => {
    const sync = createMockSessionSync();
    const client = createMockClient({
      getTaskStatus: vi.fn(async () => ({ task_id: "task-1", status: "completed" }))
        .mockResolvedValueOnce({ task_id: "task-1", status: "running" })
        .mockResolvedValueOnce({ task_id: "task-1", status: "running" })
        .mockResolvedValueOnce({ task_id: "task-1", status: "completed" }),
    });

    const result = await commitOp(sync, { client, wait: true, pollInterval: 10 });
    expect(result.status).toBe("completed");
    expect(client.getTaskStatus).toHaveBeenCalledTimes(3);
  });

  test("with wait=true, returns failed status", async () => {
    const sync = createMockSessionSync();
    const client = createMockClient({
      getTaskStatus: vi.fn(async () => ({ task_id: "task-1", status: "failed", error: "boom" })),
    });

    const result = await commitOp(sync, { client, wait: true, pollInterval: 10 });
    expect(result.status).toBe("failed");
    expect(result.error).toBe("boom");
  });

  test("with wait=true, times out after specified duration", async () => {
    const sync = createMockSessionSync();
    const client = createMockClient({
      getTaskStatus: vi.fn(async () => ({ task_id: "task-1", status: "running" })),
    });

    const result = await commitOp(sync, { client, wait: true, pollInterval: 10, timeout: 50 });
    expect(result.status).toBe("timeout");
    expect(result.task_id).toBe("task-1");
  });
});
