import { describe, it, expect, vi } from "vitest";
import { SessionStoreAdapter } from "./session-store";
import { SessionId } from "../../../domain/common/session-id";
import { Uri } from "../../../domain/common/uri";
import type { Transport } from "./transport";
import type { Part } from "../../../domain/common/part";

function mockTransport(): Transport {
  return {
    request: vi.fn(),
  } as unknown as Transport;
}

describe("SessionStoreAdapter.create", () => {
  it("calls POST /api/v1/sessions and returns SessionId", async () => {
    const transport = mockTransport();
    (transport.request as ReturnType<typeof vi.fn>).mockResolvedValue({ session_id: "sess-abc" });

    const ss = new SessionStoreAdapter(transport);
    const id = await ss.create();

    const [label, path, opts] = (transport.request as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(label).toBe("SessionStore.create");
    expect(path).toBe("/api/v1/sessions");
    expect(opts.method).toBe("POST");
    expect(id.value).toBe("sess-abc");
  });
});

describe("SessionStoreAdapter.sendMessage", () => {
  const sid = new SessionId("sess-1");

  it("calls POST /api/v1/sessions/{id}/messages with serialized parts", async () => {
    const transport = mockTransport();
    (transport.request as ReturnType<typeof vi.fn>).mockResolvedValue({});

    const ss = new SessionStoreAdapter(transport);
    const parts: Part[] = [{ type: "text", text: "hello" }];
    await ss.sendMessage(sid, "user", parts);

    const [label, path, opts] = (transport.request as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(label).toBe("SessionStore.sendMessage");
    expect(path).toContain("/api/v1/sessions/sess-1/messages");
    expect(opts.method).toBe("POST");
    const body = JSON.parse(opts.body);
    expect(body.role).toBe("user");
    expect(body.content).toHaveLength(1);
    expect(body.content[0].type).toBe("text");
    expect(body.content[0].text).toBe("hello");
  });
});

describe("SessionStoreAdapter.sendMessages", () => {
  const sid = new SessionId("sess-1");

  it("calls POST /api/v1/sessions/{id}/messages/batch", async () => {
    const transport = mockTransport();
    (transport.request as ReturnType<typeof vi.fn>).mockResolvedValue({});

    const ss = new SessionStoreAdapter(transport);
    const msgs = [{ role: "user", content: [{ type: "text" as const, text: "hi" }] }];
    await ss.sendMessages(sid, msgs);

    const [label, path, opts] = (transport.request as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(label).toBe("SessionStore.sendMessages");
    expect(path).toBe("/api/v1/sessions/sess-1/messages/batch");
    expect(opts.method).toBe("POST");
    const body = JSON.parse(opts.body);
    expect(body).toHaveLength(1);
    expect(body[0].role).toBe("user");
  });
});

describe("SessionStoreAdapter.commit", () => {
  const sid = new SessionId("sess-1");

  it("calls POST /api/v1/sessions/{id}/commit", async () => {
    const transport = mockTransport();
    (transport.request as ReturnType<typeof vi.fn>).mockResolvedValue({ session_id: "sess-1", task_id: "task-42" });

    const ss = new SessionStoreAdapter(transport);
    const result = await ss.commit(sid);

    const [label, path, opts] = (transport.request as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(label).toBe("SessionStore.commit");
    expect(path).toContain("/api/v1/sessions/sess-1/commit");
    expect(opts.method).toBe("POST");
    expect(result.sessionId.value).toBe("sess-1");
    expect(result.taskId).toBe("task-42");
  });

  it("passes keep_recent_count from CommitOptions", async () => {
    const transport = mockTransport();
    (transport.request as ReturnType<typeof vi.fn>).mockResolvedValue({ session_id: "sess-1" });

    const ss = new SessionStoreAdapter(transport);
    await ss.commit(sid, { keepRecentCount: 10 });

    const [, , opts] = (transport.request as ReturnType<typeof vi.fn>).mock.calls[0];
    const body = JSON.parse(opts.body);
    expect(body.keep_recent_count).toBe(10);
  });

  it("omits keep_recent_count when not provided", async () => {
    const transport = mockTransport();
    (transport.request as ReturnType<typeof vi.fn>).mockResolvedValue({ session_id: "sess-1" });

    const ss = new SessionStoreAdapter(transport);
    await ss.commit(sid);

    const [, , opts] = (transport.request as ReturnType<typeof vi.fn>).mock.calls[0];
    const body = JSON.parse(opts.body || "{}");
    expect(body.keep_recent_count).toBeUndefined();
  });
});

describe("SessionStoreAdapter.getTaskStatus", () => {
  it("calls GET /api/v1/tasks/{taskId}", async () => {
    const transport = mockTransport();
    (transport.request as ReturnType<typeof vi.fn>).mockResolvedValue({ task_id: "t-1", status: "completed" });

    const ss = new SessionStoreAdapter(transport);
    const status = await ss.getTaskStatus("t-1");

    const [label, path] = (transport.request as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(label).toBe("SessionStore.getTaskStatus");
    expect(path).toContain("/api/v1/tasks/t-1");
    expect(status.taskId).toBe("t-1");
    expect(status.status).toBe("completed");
  });
});

describe("SessionStoreAdapter.listTasks", () => {
  it("calls GET /api/v1/tasks with no filters", async () => {
    const transport = mockTransport();
    (transport.request as ReturnType<typeof vi.fn>).mockResolvedValue([]);

    const ss = new SessionStoreAdapter(transport);
    await ss.listTasks();

    const [label, path] = (transport.request as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(label).toBe("SessionStore.listTasks");
    // Just path, no query params when no filters
    expect(path).toBe("/api/v1/tasks");
  });

  it("applies filter params", async () => {
    const transport = mockTransport();
    (transport.request as ReturnType<typeof vi.fn>).mockResolvedValue([]);

    const ss = new SessionStoreAdapter(transport);
    await ss.listTasks({ taskType: "commit", status: "completed", resourceId: "viking://r", limit: 10 });

    const [, path] = (transport.request as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(path).toContain("task_type=commit");
    expect(path).toContain("status=completed");
    expect(path).toContain("resource_id=" + encodeURIComponent("viking://r"));
    expect(path).toContain("limit=10");
  });
});

describe("SessionStoreAdapter.sessionUsed", () => {
  const sid = new SessionId("sess-1");

  it("calls POST /api/v1/sessions/{id}/used with contexts", async () => {
    const transport = mockTransport();
    (transport.request as ReturnType<typeof vi.fn>).mockResolvedValue({});

    const ss = new SessionStoreAdapter(transport);
    const contexts = [new Uri("viking://mem/1"), new Uri("viking://mem/2")];
    await ss.sessionUsed(sid, contexts);

    const [label, path, opts] = (transport.request as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(label).toBe("SessionStore.sessionUsed");
    expect(path).toBe("/api/v1/sessions/sess-1/used");
    expect(opts.method).toBe("POST");
    const body = JSON.parse(opts.body);
    expect(body.contexts).toEqual(["viking://mem/1", "viking://mem/2"]);
  });
});

describe("SessionStoreAdapter.deleteSession", () => {
  it("calls DELETE /api/v1/sessions/{id}", async () => {
    const transport = mockTransport();
    (transport.request as ReturnType<typeof vi.fn>).mockResolvedValue({});

    const ss = new SessionStoreAdapter(transport);
    await ss.deleteSession(new SessionId("sess-1"));

    const [label, path, opts] = (transport.request as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(label).toBe("SessionStore.deleteSession");
    expect(path).toBe("/api/v1/sessions/sess-1");
    expect(opts.method).toBe("DELETE");
  });
});
