import { describe, it, expect } from "vitest";
import type { Part, TextPart, ToolPart, ContextPart } from "./part";

describe("Part", () => {
  it("TextPart works", () => {
    const p: TextPart = { type: "text", text: "hello" };
    expect(p.type).toBe("text");
    expect(p.text).toBe("hello");
  });

  it("ToolPart works with all fields", () => {
    const p: ToolPart = {
      type: "tool",
      toolId: "tool-1",
      toolName: "search",
      toolInput: { query: "test" },
      toolOutput: "result",
      toolStatus: "success",
      toolOutputTruncated: false,
      toolUri: "viking://tools/search",
      skillUri: "viking://skills/search",
      durationMs: 42,
      promptTokens: 100,
      completionTokens: 50,
      toolOutputRef: "ref-1",
    };
    expect(p.type).toBe("tool");
    expect(p.toolName).toBe("search");
    expect(p.toolStatus).toBe("success");
    expect(p.toolOutputTruncated).toBe(false);
    expect(p.durationMs).toBe(42);
    expect(p.promptTokens).toBe(100);
    expect(p.completionTokens).toBe(50);
  });

  it("ToolPart accepts null for nullable fields", () => {
    const p: ToolPart = {
      type: "tool",
      toolId: "tool-2",
      toolName: "read",
      toolInput: {},
      toolOutput: "",
      toolStatus: "error",
      toolOutputTruncated: true,
      toolUri: "viking://tools/read",
      skillUri: "viking://skills/read",
      durationMs: null,
      promptTokens: null,
      completionTokens: null,
      toolOutputRef: "ref-2",
    };
    expect(p.durationMs).toBeNull();
    expect(p.promptTokens).toBeNull();
    expect(p.completionTokens).toBeNull();
  });

  it("discriminates on type field", () => {
    const parts: Part[] = [
      { type: "text", text: "hi" },
      { type: "tool", toolId: "t1", toolName: "n", toolInput: {}, toolOutput: "", toolStatus: "ok", toolOutputTruncated: false, toolUri: "u", skillUri: "s", durationMs: null, promptTokens: null, completionTokens: null, toolOutputRef: "r" },
    ];

    const texts = parts.filter((p): p is TextPart => p.type === "text");
    const tools = parts.filter((p): p is ToolPart => p.type === "tool");

    expect(texts).toHaveLength(1);
    expect(tools).toHaveLength(1);
  });

  it("includes ContextPart in the union", () => {
    const cp: ContextPart = {
      type: "context",
      uri: "viking://resources/doc.md",
      contextType: "resource",
      abstract: "Some doc",
    };
    expect(cp.type).toBe("context");
    expect(cp.uri).toBe("viking://resources/doc.md");
    expect(cp.contextType).toBe("resource");
    expect(cp.abstract).toBe("Some doc");
  });

  it("ContextPart accepts memory and skill types", () => {
    const mem: ContextPart = { type: "context", uri: "viking://mem/1", contextType: "memory", abstract: "mem" };
    const skill: ContextPart = { type: "context", uri: "viking://skills/x", contextType: "skill", abstract: "skill" };
    expect(mem.contextType).toBe("memory");
    expect(skill.contextType).toBe("skill");
  });

  it("discriminates ContextPart from other parts", () => {
    const parts: Part[] = [
      { type: "text", text: "hi" },
      { type: "context", uri: "u", contextType: "resource", abstract: "a" },
      { type: "tool", toolId: "t1", toolName: "n", toolInput: {}, toolOutput: "", toolStatus: "ok", toolOutputTruncated: false, toolUri: "u", skillUri: "s", durationMs: null, promptTokens: null, completionTokens: null, toolOutputRef: "r" },
    ];

    const contexts = parts.filter((p): p is ContextPart => p.type === "context");
    expect(contexts).toHaveLength(1);
    expect(contexts[0].contextType).toBe("resource");
  });

  it("narrows correctly in if/else", () => {
    const parts: Part[] = [
      { type: "text", text: "hello" },
      { type: "context", uri: "u", contextType: "memory", abstract: "a" },
    ];

    for (const p of parts) {
      if (p.type === "context") {
        expect(p.contextType).toBeDefined();
        expect(p.uri).toBeDefined();
      } else if (p.type === "text") {
        expect(p.text).toBeDefined();
      }
    }
  });
});
