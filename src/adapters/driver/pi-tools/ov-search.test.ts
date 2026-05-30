import { describe, it, expect } from "vitest";
import type { ToolDefinition } from "@earendil-works/pi-coding-agent";
import { createOvSearchTool } from "./ov-search";
import type { SearchService } from "../../../domain/services/search-service";
import type { SearchResult } from "../../../domain/knowledge/model/search-result";
import { Pipeline } from "../../../domain/pipeline/pipeline";

const emptyResult: SearchResult = { memories: [], resources: [], skills: [], total: 0 };

function makeSearchService(overrides?: Partial<SearchService>): SearchService {
  return {
    search: async () => emptyResult,
    glob: async () => ({ entries: [], total: 0 }),
    grep: async () => ({ matches: [], total: 0 }),
    ...overrides,
  } as SearchService;
}

function makePipeline() {
  return new Pipeline<SearchResult>();
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

function getText(result: any): string {
  return result.content[0].text as string;
}

describe("ov_search tool", () => {
  it("has correct name and schema", () => {
    const tool = createOvSearchTool(makeSearchService(), makePipeline());
    expect(tool.name).toBe("ov_search");
    expect(tool.parameters).toBeDefined();
  });

  it("calls search with mode=fast and returns formatted result", async () => {
    const calls: unknown[] = [];
    const svc = makeSearchService({
      search: async (params) => {
        calls.push(params);
        return { memories: [], resources: [], skills: [], total: 5 };
      },
    });
    const tool = createOvSearchTool(svc, makePipeline());
    const result = await executeTool(tool, { query: "test query", mode: "fast" });
    expect(calls).toHaveLength(1);
    expect(calls[0]).toMatchObject({ query: "test query", mode: "fast" });
    expect(result.content[0]).toMatchObject({ type: "text" });
    expect(getText(result)).not.toContain("failed");
  });

  it("calls search with default mode=auto when mode omitted", async () => {
    const calls: unknown[] = [];
    const svc = makeSearchService({
      search: async (params) => {
        calls.push(params);
        return emptyResult;
      },
    });
    const tool = createOvSearchTool(svc, makePipeline());
    const result = await executeTool(tool, { query: "test" });
    expect(calls).toHaveLength(1);
    expect(calls[0]).toMatchObject({ query: "test", mode: "auto" });
  });
});
