import type { SessionId } from "../common/session-id";
import type { Uri } from "../common/uri";
import type { Part } from "../common/part";

export interface CommitResult {
  sessionId: SessionId;
  taskId?: string;
}

export interface TaskStatus {
  taskId: string;
  status: "pending" | "running" | "completed" | "failed";
  result?: unknown;
}

export interface SessionStore {
  create(): Promise<SessionId>;
  sendMessage(sessionId: SessionId, role: string, content: Part[]): Promise<void>;
  commit(sessionId: SessionId): Promise<CommitResult>;
  getTaskStatus(taskId: string): Promise<TaskStatus>;
  sessionUsed(sessionId: SessionId, contexts: Uri[]): Promise<void>;
  deleteSession(sessionId: SessionId): Promise<void>;
}
