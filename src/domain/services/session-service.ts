import type { SessionId } from "../common/session-id";
import type { SessionStore, CommitResult, CommitOptions, TaskStatus, SessionInfo } from "../ports/session-store";
import type { Uri } from "../common/uri";
import type { Part } from "../common/part";

interface SessionServiceConfig {
  commitTimeout: number;
  pollInterval?: number;
}

export class SessionService {
  private active: SessionId | null = null;

  constructor(
    private readonly store: SessionStore,
    private readonly config: SessionServiceConfig,
  ) {}

  async createAndSet(): Promise<SessionId> {
    const id = await this.store.create();
    this.active = id;
    return id;
  }

  getActive(): SessionId | null {
    return this.active;
  }

  async sendMessage(sessionId: SessionId, role: string, content: Part[]): Promise<void> {
    return this.store.sendMessage(sessionId, role, content);
  }

  async sendMessages(
    sessionId: SessionId,
    messages: { role: string; content: Part[] }[],
  ): Promise<void> {
    return this.store.sendMessages(sessionId, messages);
  }

  async getSession(sessionId: SessionId): Promise<SessionInfo> {
    return this.store.getSession(sessionId);
  }

  async sessionUsed(sessionId: SessionId, contexts: Uri[]): Promise<void> {
    return this.store.sessionUsed(sessionId, contexts);
  }

  async commit(sessionId: SessionId, options?: CommitOptions): Promise<CommitResult> {
    return this.store.commit(sessionId, options);
  }

  async waitForCommit(taskId: string, timeout?: number): Promise<TaskStatus> {
    const deadline = Date.now() + (timeout ?? this.config.commitTimeout);
    const interval = this.config.pollInterval ?? 1000;

    // eslint-disable-next-line no-constant-condition
    while (true) {
      const status = await this.store.getTaskStatus(taskId);
      if (status.status === "completed" || status.status === "failed") return status;
      if (Date.now() >= deadline) {
        throw new Error(`waitForCommit timed out after ${timeout ?? this.config.commitTimeout}ms (taskId: ${taskId})`);
      }
      await new Promise((r) => setTimeout(r, interval));
    }
  }

  async deleteSession(sessionId: SessionId): Promise<void> {
    return this.store.deleteSession(sessionId);
  }
}
