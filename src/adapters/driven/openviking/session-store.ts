import type { Transport } from "./transport";
import { toSessionId, toCommitResult, toTaskStatus, serializeParts } from "./mappers/session-mapper";
import type { SessionStore, CommitResult, CommitOptions, TaskStatus, TaskFilter } from "../../../domain/ports/session-store";
import type { SessionId } from "../../../domain/common/session-id";
import type { Uri } from "../../../domain/common/uri";
import type { Part } from "../../../domain/common/part";

export class SessionStoreAdapter implements SessionStore {
  private readonly commitTimeout: number;

  constructor(
    private readonly transport: Transport,
    commitTimeout: number = 120_000,
  ) {
    this.commitTimeout = commitTimeout;
  }

  async create(signal?: AbortSignal): Promise<SessionId> {
    const raw = await this.transport.request<Record<string, unknown>>(
      "SessionStore.create",
      "/api/v1/sessions",
      { method: "POST" },
      signal,
    );
    return toSessionId(raw);
  }

  async sendMessage(sessionId: SessionId, role: string, content: Part[], signal?: AbortSignal): Promise<void> {
    const body = JSON.stringify({
      role,
      content: serializeParts(content),
    });
    await this.transport.request<unknown>(
      "SessionStore.sendMessage",
      `/api/v1/sessions/${sessionId.value}/messages`,
      { method: "POST", body },
      signal,
    );
  }

  async sendMessages(
    sessionId: SessionId,
    messages: { role: string; content: Part[] }[],
    signal?: AbortSignal,
  ): Promise<void> {
    const body = JSON.stringify(
      messages.map((m) => ({
        role: m.role,
        content: serializeParts(m.content),
      })),
    );
    await this.transport.request<unknown>(
      "SessionStore.sendMessages",
      `/api/v1/sessions/${sessionId.value}/messages/batch`,
      { method: "POST", body },
      signal,
    );
  }

  async commit(sessionId: SessionId, options?: CommitOptions, signal?: AbortSignal): Promise<CommitResult> {
    const bodyObj: Record<string, unknown> = {};
    if (options?.keepRecentCount !== undefined) {
      bodyObj.keep_recent_count = options.keepRecentCount;
    }
    const body = Object.keys(bodyObj).length > 0 ? JSON.stringify(bodyObj) : undefined;

    const raw = await this.transport.request<Record<string, unknown>>(
      "SessionStore.commit",
      `/api/v1/sessions/${sessionId.value}/commit`,
      body
        ? { method: "POST", body, timeout: this.commitTimeout }
        : { method: "POST", timeout: this.commitTimeout },
      signal,
    );
    return toCommitResult(raw);
  }

  async getTaskStatus(taskId: string, signal?: AbortSignal): Promise<TaskStatus> {
    const raw = await this.transport.request<Record<string, unknown>>(
      "SessionStore.getTaskStatus",
      `/api/v1/tasks/${taskId}`,
      undefined,
      signal,
    );
    return toTaskStatus(raw);
  }

  async listTasks(filter?: TaskFilter, signal?: AbortSignal): Promise<TaskStatus[]> {
    const params = new URLSearchParams();
    if (filter?.taskType) params.set("task_type", filter.taskType);
    if (filter?.status) params.set("status", filter.status);
    if (filter?.resourceId) params.set("resource_id", filter.resourceId);
    if (filter?.limit !== undefined) params.set("limit", String(filter.limit));

    const query = params.toString();
    const path = query ? `/api/v1/tasks?${query}` : "/api/v1/tasks";

    const raw = await this.transport.request<unknown[]>(
      "SessionStore.listTasks",
      path,
      undefined,
      signal,
    );
    return (Array.isArray(raw) ? raw : []).map((item) => toTaskStatus(item));
  }

  async sessionUsed(sessionId: SessionId, contexts: Uri[], signal?: AbortSignal): Promise<void> {
    const body = JSON.stringify({
      contexts: contexts.map((u) => u.value),
    });
    await this.transport.request<unknown>(
      "SessionStore.sessionUsed",
      `/api/v1/sessions/${sessionId.value}/used`,
      { method: "POST", body },
      signal,
    );
  }

  async deleteSession(sessionId: SessionId, signal?: AbortSignal): Promise<void> {
    await this.transport.request<unknown>(
      "SessionStore.deleteSession",
      `/api/v1/sessions/${sessionId.value}`,
      { method: "DELETE" },
      signal,
    );
  }
}
