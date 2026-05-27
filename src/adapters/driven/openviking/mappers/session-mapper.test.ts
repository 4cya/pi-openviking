import { describe, it, expect } from "vitest";
import { toSessionId, toCommitResult, toTaskStatus, serializePart, serializeParts } from "./session-mapper";
import { SessionId } from "../../../../domain/common/session-id";
import type { Part, TextPart, ToolPart, ContextPart } from "../../../../domain/common/part";

describe("toSessionId", () => {
  it("extracts session_id from create response", () => {
    const raw = { session_id: "sess-abc-123" };
    const id = toSessionId(raw);
    expect(id).toBeInstanceOf(SessionId);
    expect(id.value).toBe("sess-abc-123");
  });

  it("extracts id from response with 'id' field", () => {
    const raw = { id: "sess-xyz" };
    const id = toSessionId(raw);
    expect(id.value).toBe("sess-xyz");
  });

  it("throws on missing session identifier", () => {
    expect(() => toSessionId({})).toThrow();
    expect(() => toSessionId(null)).toThrow();
    expect(() => toSessionId("invalid")).toThrow();
  });
});

describe("toCommitResult", () => {
  it("maps commit response with sessionId and taskId", () => {
    const raw = { session_id: "sess-1", task_id: "task-42" };
    const result = toCommitResult(raw);
    expect(result.sessionId.value).toBe("sess-1");
    expect(result.taskId).toBe("task-42");
  });

  it("handles missing taskId", () => {
    const raw = { session_id: "sess-1" };
    const result = toCommitResult(raw);
    expect(result.taskId).toBeUndefined();
  });
});

describe("toTaskStatus", () => {
  it("maps completed task", () => {
    const raw = { task_id: "task-1", status: "completed", result: { ok: true } };
    const status = toTaskStatus(raw);
    expect(status.taskId).toBe("task-1");
    expect(status.status).toBe("completed");
    expect(status.result).toEqual({ ok: true });
  });

  it("maps pending task", () => {
    const raw = { task_id: "task-2", status: "pending" };
    const status = toTaskStatus(raw);
    expect(status.status).toBe("pending");
  });

  it("maps failed task", () => {
    const raw = { task_id: "task-3", status: "failed" };
    const status = toTaskStatus(raw);
    expect(status.status).toBe("failed");
  });

  it("maps unknown status safely", () => {
    const raw = { task_id: "task-4", status: "unknown" };
    const status = toTaskStatus(raw);
    expect(status.status).toBe("unknown"); // passthrough — caller validates
  });

  it("handles missing result", () => {
    const raw = { task_id: "task-5", status: "running" };
    const status = toTaskStatus(raw);
    expect(status.result).toBeUndefined();
  });
});

describe("serializePart", () => {
  it("serializes TextPart", () => {
    const part: TextPart = { type: "text", text: "hello" };
    const json = serializePart(part);
    expect(json).toEqual({ type: "text", text: "hello" });
  });

  it("serializes ToolPart with camelCase→snake_case", () => {
    const part: ToolPart = {
      type: "tool",
      toolId: "t1",
      toolName: "search",
      toolInput: { q: "test" },
      toolOutput: "result",
      toolStatus: "success",
      toolOutputTruncated: false,
      toolUri: "viking://tools/search",
      skillUri: "viking://skills/search",
      durationMs: 150,
      promptTokens: 100,
      completionTokens: 50,
      toolOutputRef: "",
    };
    const json = serializePart(part);
    expect(json.type).toBe("tool");
    expect(json.tool_id).toBe("t1");
    expect(json.tool_name).toBe("search");
    expect(json.tool_input).toEqual({ q: "test" });
    expect(json.tool_output).toBe("result");
    expect(json.tool_status).toBe("success");
    expect(json.tool_output_truncated).toBe(false);
    expect(json.tool_uri).toBe("viking://tools/search");
    expect(json.skill_uri).toBe("viking://skills/search");
    expect(json.duration_ms).toBe(150);
    expect(json.prompt_tokens).toBe(100);
    expect(json.completion_tokens).toBe(50);
    expect(json.tool_output_ref).toBe("");
    // Ensure no camelCase keys leak
    expect(json.toolId).toBeUndefined();
    expect(json.durationMs).toBeUndefined();
  });

  it("serializes ToolPart with null numeric fields", () => {
    const part: ToolPart = {
      type: "tool",
      toolId: "t1",
      toolName: "search",
      toolInput: {},
      toolOutput: "",
      toolStatus: "error",
      toolOutputTruncated: false,
      toolUri: "",
      skillUri: "",
      durationMs: null,
      promptTokens: null,
      completionTokens: null,
      toolOutputRef: "",
    };
    const json = serializePart(part);
    expect(json.duration_ms).toBeNull();
    expect(json.prompt_tokens).toBeNull();
    expect(json.completion_tokens).toBeNull();
  });

  it("serializes ContextPart", () => {
    const part: ContextPart = {
      type: "context",
      uri: "viking://docs/arch.md",
      contextType: "memory",
      abstract: "Architecture overview",
    };
    const json = serializePart(part);
    expect(json.type).toBe("context");
    expect(json.uri).toBe("viking://docs/arch.md");
    expect(json.context_type).toBe("memory");
    expect(json.abstract).toBe("Architecture overview");
    expect(json.contextType).toBeUndefined();
  });
});

describe("serializeParts", () => {
  it("serializes array of mixed parts", () => {
    const parts: Part[] = [
      { type: "text", text: "hello" },
      { type: "tool", toolId: "t1", toolName: "s", toolInput: {}, toolOutput: "o", toolStatus: "ok", toolOutputTruncated: false, toolUri: "", skillUri: "", durationMs: null, promptTokens: null, completionTokens: null, toolOutputRef: "" },
      { type: "context", uri: "u", contextType: "resource", abstract: "a" },
    ];
    const json = serializeParts(parts);
    expect(json).toHaveLength(3);
    expect(json[0].type).toBe("text");
    expect(json[1].type).toBe("tool");
    expect(json[1].tool_id).toBe("t1");
    expect(json[2].type).toBe("context");
    expect(json[2].context_type).toBe("resource");
  });
});
