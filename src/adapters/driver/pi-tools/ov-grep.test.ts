import { describe, it, expect } from "vitest";
import type { ToolDefinition } from "@earendil-works/pi-coding-agent";
import { createOvGrepTool } from "./ov-grep";
import type { SearchService } from "../../../domain/services/search-service";
import type { GrepResult } from "../../../domain/ports/knowledge-base";
import { Pipeline } from "../../../domain/pipeline/pipeline";

function makeSearchService(overrides?: Partial<SearchService>): SearchService {
  return {
    search: async () => ({ memories: [], resources: [], skills: [], total: 0 }),
    glob: async () => ({ entries: [], total: 0 }),
    grep: async () => ({ matches: [], total: 0 }),
    ...overrides,
  } as SearchService;
}

function makePipeline() {
  return new Pipeline<GrepResult>();
}

function executeTool(tool: ToolDefinition, params: Record<string, unknown>) {
  return tool.execute("test-call", params as any, undefined, undefined, {
    cwd: "/test",
    hasUI: false,
    ui: {} as any,
    sessionManager: {} as any,
    modelRegistry: {} as any,
    model: undefined,
    isIdle: () => true,
    signal: undefined,
    abort: () => {},
    hasPendingMessages: () => false,
    shutdown: () => {},
    getContextUsage: () => undefined,
    compact: () => {},
    getSystemPrompt: () => "",
  } as any);
}

describe("ov_grep tool", () => {
  it("has correct name and schema", () => {
    const tool = createOvGrepTool(makeSearchService(), makePipeline());
    expect(tool.name).toBe("ov_grep");
    expect(tool.parameters).toBeDefined();
  });

  it("calls grep with pattern and returns matches", async () => {
    const calls: unknown[] = [];
    const svc = makeSearchService({
      grep: async (pattern, opts) => {
        calls.push({ pattern, opts });
        return { matches: [{ uri: "viking://a.md", line: "hello world", lineNumber: 5 }], total: 1 };
      },
    });
    const tool = createOvGrepTool(svc, makePipeline());
    const result = await executeTool(tool, { pattern: "hello", uri: "viking://", caseInsensitive: true });
    expect(calls).toHaveLength(1);
    expect(calls[0]).toMatchObject({ pattern: "hello", opts: { uri: "viking://", caseInsensitive: true } });
    expect(result.content[0]).toMatchObject({ type: "text" });
  });
});
