import { describe, it, expect } from "vitest";
import type { ToolDefinition } from "@earendil-works/pi-coding-agent";
import { createOvGlobTool } from "./ov-glob";
import type { SearchService } from "../../../domain/services/search-service";
import type { GlobResult } from "../../../domain/ports/knowledge-base";
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
  return new Pipeline<GlobResult>();
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

describe("ov_glob tool", () => {
  it("has correct name and schema", () => {
    const tool = createOvGlobTool(makeSearchService(), makePipeline());
    expect(tool.name).toBe("ov_glob");
    expect(tool.parameters).toBeDefined();
  });

  it("calls glob and returns entries", async () => {
    const calls: unknown[] = [];
    const svc = makeSearchService({
      glob: async (pattern, uri, limit) => {
        calls.push({ pattern, uri, limit });
        return { entries: ["viking://a.md", "viking://b.md"], total: 2 };
      },
    });
    const tool = createOvGlobTool(svc, makePipeline());
    const result = await executeTool(tool, { pattern: "viking://**/*.md" });
    expect(calls).toHaveLength(1);
    expect(calls[0]).toMatchObject({ pattern: "viking://**/*.md" });
    expect(result.content[0]).toMatchObject({ type: "text" });
  });
});
