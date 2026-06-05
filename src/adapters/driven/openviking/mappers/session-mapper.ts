import { SessionId } from "../../../../domain/common/session-id";
import type { CommitResult, TaskStatus } from "../../../../domain/ports/session-store";
import type { Part, TextPart, ToolPart, ContextPart } from "../../../../domain/common/part";
import { getRecord, safeOptionalString, safeString } from "./mapper-utils";

// ── Session Mappers ───────────────────────────────────────────────────────────

export function toSessionId(raw: unknown): SessionId {
  const r = getRecord(raw);
  const id = r.session_id ?? r.id;
  if (typeof id !== "string" || !id) {
    throw new Error("Invalid session create response: missing session_id");
  }
  return new SessionId(id);
}

export function toCommitResult(raw: unknown): CommitResult {
  const r = getRecord(raw);
  const sessionId = toSessionId(raw);
  return {
    sessionId,
    taskId: safeOptionalString(r.task_id),
  };
}

export function toTaskStatus(raw: unknown): TaskStatus {
  const r = getRecord(raw);
  const taskId = safeString(r.task_id);
  return {
    taskId,
    status: (typeof r.status === "string" ? r.status : "unknown") as TaskStatus["status"],
    result: r.result !== undefined ? r.result : undefined,
  };
}

// ── Part Serialization ────────────────────────────────────────────────────────

const CAMEL_TO_SNAKE: Record<string, string> = {
  toolId: "tool_id",
  toolName: "tool_name",
  toolInput: "tool_input",
  toolOutput: "tool_output",
  toolStatus: "tool_status",
  toolOutputTruncated: "tool_output_truncated",
  toolUri: "tool_uri",
  skillUri: "skill_uri",
  durationMs: "duration_ms",
  promptTokens: "prompt_tokens",
  completionTokens: "completion_tokens",
  toolOutputRef: "tool_output_ref",
  contextType: "context_type",
};

function toSnake(key: string): string {
  return CAMEL_TO_SNAKE[key] ?? key;
}

export function serializePart(part: Part): Record<string, unknown> {
  const raw = part as unknown as Record<string, unknown>;
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(raw)) {
    result[toSnake(key)] = value;
  }
  return result;
}

export function serializeParts(parts: Part[]): Record<string, unknown>[] {
  return parts.map(serializePart);
}
