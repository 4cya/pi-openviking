import { describe, test, expect } from "vitest";
import type { Part, TextPart, ToolPart, ContextPart } from "../../src/_legacy/ov-client/types";

describe("Part union narrowing", () => {
  test("type 'text' narrows to TextPart", () => {
    const part: Part = { type: "text", text: "hello" };
    if (part.type === "text") {
      expect(part.text).toBe("hello");
    }
  });

  test("type 'tool' narrows to ToolPart", () => {
    const part: Part = {
      type: "tool",
      tool_id: "tc-1",
      tool_name: "bash",
      tool_input: { command: "ls" },
      tool_output: "",
      tool_status: "success",
      tool_output_truncated: false,
      tool_uri: "",
      skill_uri: "",
      duration_ms: null,
      prompt_tokens: null,
      completion_tokens: null,
      tool_output_ref: "",
    };
    if (part.type === "tool") {
      expect(part.tool_id).toBe("tc-1");
      expect(part.tool_status).toBe("success");
    }
  });

  test("type 'context' narrows to ContextPart", () => {
    const part: Part = {
      type: "context",
      uri: "viking://resources/doc.md",
      context_type: "resource",
      abstract: "some document",
    };
    if (part.type === "context") {
      expect(part.uri).toBe("viking://resources/doc.md");
      expect(part.context_type).toBe("resource");
    }
  });

  test("TextPart has no tool fields", () => {
    const part: TextPart = { type: "text", text: "hello" };
    expect(part.text).toBe("hello");
    expect("tool_id" in (part as any)).toBe(false);
  });

  test("ToolPart has all canonical fields", () => {
    const tp: ToolPart = {
      type: "tool",
      tool_id: "id",
      tool_name: "name",
      tool_input: {},
      tool_output: "out",
      tool_status: "error",
      tool_output_truncated: true,
      tool_uri: "uri",
      skill_uri: "skill",
      duration_ms: 100,
      prompt_tokens: 50,
      completion_tokens: 30,
      tool_output_ref: "ref",
    };
    expect(tp.type).toBe("tool");
    expect(tp.tool_status).toBe("error");
    expect(tp.duration_ms).toBe(100);
  });

  test("Part is a discriminated union of all three types", () => {
    const parts: Part[] = [
      { type: "text", text: "a" },
      {
        type: "tool",
        tool_id: "t1",
        tool_name: "n",
        tool_input: {},
        tool_output: "",
        tool_status: "pending",
        tool_output_truncated: false,
        tool_uri: "",
        skill_uri: "",
        duration_ms: null,
        prompt_tokens: null,
        completion_tokens: null,
        tool_output_ref: "",
      },
      { type: "context", uri: "u", context_type: "memory", abstract: "a" },
    ];

    const typeCounts = { text: 0, tool: 0, context: 0 };
    for (const p of parts) {
      if (p.type === "text") typeCounts.text++;
      else if (p.type === "tool") typeCounts.tool++;
      else if (p.type === "context") typeCounts.context++;
    }

    expect(typeCounts).toEqual({ text: 1, tool: 1, context: 1 });
  });
});
