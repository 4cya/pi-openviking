import { describe, it, expect, vi } from "vitest";
import type { SessionStore } from "../ports/session-store";
import type { CommitResult, TaskStatus } from "../ports/session-store";
import type { SessionId } from "../common/session-id";
import { SessionService } from "./session-service";

function createMockStore(overrides?: Partial<SessionStore>): SessionStore {
  return {
    create: vi.fn().mockResolvedValue({ value: "sess_1" } as SessionId),
    sendMessage: vi.fn().mockResolvedValue(undefined),
    sendMessages: vi.fn().mockResolvedValue(undefined),
    commit: vi.fn().mockResolvedValue({ sessionId: { value: "sess_1" }, taskId: "task_1" } as CommitResult),
    getTaskStatus: vi.fn().mockResolvedValue({ taskId: "task_1", status: "completed" } as TaskStatus),
    listTasks: vi.fn().mockResolvedValue([]),
    sessionUsed: vi.fn().mockResolvedValue(undefined),
    getSession: vi.fn().mockResolvedValue({
      sessionId: "sess_1",
      createdAt: "2026-01-01",
      updatedAt: "2026-01-01",
      messageCount: 5,
      commitCount: 2,
    }),
    listSessions: vi.fn().mockResolvedValue([]),
    deleteSession: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

describe("SessionService", () => {
  describe("active session tracking", () => {
    it("createAndSet creates session and getActive returns it", async () => {
      const store = createMockStore();
      const service = new SessionService(store, { commitTimeout: 120_000 });

      const id = await service.createAndSet();

      expect(store.create).toHaveBeenCalledOnce();
      expect(id).toEqual({ value: "sess_1" });
      expect(service.getActive()).toEqual({ value: "sess_1" });
    });

    it("multiple createAndSet calls replace active session", async () => {
      let callCount = 0;
      const store = createMockStore({
        create: vi.fn().mockImplementation(() => {
          callCount++;
          return Promise.resolve({ value: `sess_${callCount}` } as SessionId);
        }),
      });
      const service = new SessionService(store, { commitTimeout: 120_000 });

      await service.createAndSet();
      const second = await service.createAndSet();

      expect(second).toEqual({ value: "sess_2" });
      expect(service.getActive()).toEqual({ value: "sess_2" });
    });

    it("getActive returns null when no session created", () => {
      const store = createMockStore();
      const service = new SessionService(store, { commitTimeout: 120_000 });

      expect(service.getActive()).toBeNull();
    });
  });

  describe("sendMessage", () => {
    it("delegates to store with correct params", async () => {
      const store = createMockStore();
      const service = new SessionService(store, { commitTimeout: 120_000 });
      const sid = { value: "sess_1" } as SessionId;
      const parts = [{ type: "text" as const, text: "hello" }];

      await service.sendMessage(sid, "user", parts);

      expect(store.sendMessage).toHaveBeenCalledWith(sid, "user", parts);
    });
  });

  describe("commit", () => {
    it("returns result immediately without polling", async () => {
      const result: CommitResult = { sessionId: { value: "sess_1" } as SessionId, taskId: "task_1" };
      const store = createMockStore({ commit: vi.fn().mockResolvedValue(result) });
      const service = new SessionService(store, { commitTimeout: 120_000 });
      const sid = { value: "sess_1" } as SessionId;

      const got = await service.commit(sid, { keepRecentCount: 10 });

      expect(got).toEqual(result);
      expect(store.commit).toHaveBeenCalledWith(sid, { keepRecentCount: 10 });
      expect(store.getTaskStatus).not.toHaveBeenCalled();
    });
  });

  describe("waitForCommit", () => {
    it("polls until completed", async () => {
      let pollCount = 0;
      const store = createMockStore({
        getTaskStatus: vi.fn().mockImplementation(() => {
          pollCount++;
          if (pollCount < 3) return Promise.resolve({ taskId: "t1", status: "running" } as TaskStatus);
          return Promise.resolve({ taskId: "t1", status: "completed", result: "ok" } as TaskStatus);
        }),
      });
      const service = new SessionService(store, { commitTimeout: 120_000, pollInterval: 10 });

      const status = await service.waitForCommit("t1");

      expect(status.status).toBe("completed");
      expect(status.result).toBe("ok");
      expect(store.getTaskStatus).toHaveBeenCalledTimes(3);
    });

    it("returns failed status immediately", async () => {
      const store = createMockStore({
        getTaskStatus: vi.fn().mockResolvedValue({ taskId: "t1", status: "failed", result: "error" } as TaskStatus),
      });
      const service = new SessionService(store, { commitTimeout: 120_000 });

      const status = await service.waitForCommit("t1");

      expect(status.status).toBe("failed");
      expect(store.getTaskStatus).toHaveBeenCalledOnce();
    });

    it("times out after configured period", async () => {
      const store = createMockStore({
        getTaskStatus: vi.fn().mockResolvedValue({ taskId: "t1", status: "running" } as TaskStatus),
      });
      const service = new SessionService(store, { commitTimeout: 120_000, pollInterval: 10 });

      await expect(service.waitForCommit("t1", 50)).rejects.toThrow("waitForCommit timed out");
    });
  });

  describe("deleteSession", () => {
    it("delegates to store", async () => {
      const store = createMockStore();
      const service = new SessionService(store, { commitTimeout: 120_000 });
      const sid = { value: "sess_1" } as SessionId;

      await service.deleteSession(sid);

      expect(store.deleteSession).toHaveBeenCalledWith(sid);
    });
  });
});
