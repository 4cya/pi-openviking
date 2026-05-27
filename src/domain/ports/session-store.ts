import type { SessionId } from "../common/session-id";
import type { Uri } from "../common/uri";
import type { Part } from "../common/part";

export interface CommitResult {
  sessionId: SessionId;
  taskId?: string;
}

export interface CommitOptions {
  /** Number of most-recent messages to keep live after commit.
   *  Plugin's afterTurn path typically passes 10.
   *  Maps to OV `keep_recent_count`. Default 0 = archive everything. */
  keepRecentCount?: number;
}

export interface TaskStatus {
  taskId: string;
  status: "pending" | "running" | "completed" | "failed";
  result?: unknown;
}

export interface TaskFilter {
  taskType?: string;
  status?: string;
  resourceId?: string;
  limit?: number;
}

export interface SessionStore {
  create(): Promise<SessionId>;
  sendMessage(sessionId: SessionId, role: string, content: Part[]): Promise<void>;
  /** Batch-add multiple messages in one request. OV POST /api/v1/sessions/{id}/messages/batch */
  sendMessages(sessionId: SessionId, messages: { role: string; content: Part[] }[]): Promise<void>;
  commit(sessionId: SessionId, options?: CommitOptions): Promise<CommitResult>;
  getTaskStatus(taskId: string): Promise<TaskStatus>;
  /** List tasks with optional filters. OV GET /api/v1/tasks */
  listTasks(filter?: TaskFilter): Promise<TaskStatus[]>;
  sessionUsed(sessionId: SessionId, contexts: Uri[]): Promise<void>;
  deleteSession(sessionId: SessionId): Promise<void>;
}
