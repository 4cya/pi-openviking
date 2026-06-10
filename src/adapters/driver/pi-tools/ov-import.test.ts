import { describe, it, expect, vi } from "vitest";
import type { ToolDefinition } from "@earendil-works/pi-coding-agent";
import { Pipeline } from "../../../domain/pipeline/pipeline";
import { createOvImportTool } from "./ov-import";
import type { ResourceStore, ResourceImportResult } from "../../../domain/ports/resource-store";

function makeStore(overrides?: Partial<ResourceStore>): ResourceStore {
  return {
    importUrl: vi.fn().mockResolvedValue({
      status: "success",
      rootUri: "viking://resources/doc.md",
      sourcePath: "https://example.com/doc.md",
    }),
    ...overrides,
  } as unknown as ResourceStore;
}

function makePipeline() {
  return new Pipeline<unknown>();
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

const TOOL_PARAMS = {
  url: "https://example.com/doc.md",
  targetUri: "viking://resources/custom.md",
  reason: "Importing docs",
  wait: true,
};

describe("ov_import tool", () => {
  it("has correct name and schema", () => {
    const tool = createOvImportTool(makeStore(), makePipeline());
    expect(tool.name).toBe("ov_import");
    expect(tool.parameters).toBeDefined();
  });

  it("calls store.importUrl with url and options", async () => {
    const svc = makeStore();
    const tool = createOvImportTool(svc, makePipeline());

    await executeTool(tool, TOOL_PARAMS);

    expect(svc.importUrl).toHaveBeenCalledWith(
      "https://example.com/doc.md",
      {
        targetUri: "viking://resources/custom.md",
        reason: "Importing docs",
        wait: true,
      },
      undefined,
    );
  });

  it("returns success result as JSON text", async () => {
    const svc = makeStore();
    const tool = createOvImportTool(svc, makePipeline());

    const result = await executeTool(tool, TOOL_PARAMS);

    expect(result.content).toBeDefined();
    expect(result.content[0].type).toBe("text");
    const parsed = JSON.parse(getText(result));
    expect(parsed.status).toBe("success");
    expect(parsed.rootUri).toBe("viking://resources/doc.md");
  });

  it("handles missing optional params gracefully", async () => {
    const svc = makeStore();
    const tool = createOvImportTool(svc, makePipeline());

    await executeTool(tool, { url: "https://example.com/doc.md" });

    expect(svc.importUrl).toHaveBeenCalledWith(
      "https://example.com/doc.md",
      { targetUri: undefined, reason: undefined, wait: undefined },
      undefined,
    );
  });

  it("returns error message on failure", async () => {
    const svc = makeStore({ importUrl: vi.fn().mockRejectedValue(new Error("OV unreachable")) });
    const tool = createOvImportTool(svc, makePipeline());

    const result = await executeTool(tool, TOOL_PARAMS);

    expect(getText(result)).toContain("Import failed: OV unreachable");
  });

  it("handles non-Error rejection", async () => {
    const svc = makeStore({ importUrl: vi.fn().mockRejectedValue("string error") });
    const tool = createOvImportTool(svc, makePipeline());

    const result = await executeTool(tool, TOOL_PARAMS);

    expect(getText(result)).toContain("string error");
  });

  it("returns import result with rootUri and sourcePath", async () => {
    const importResult: ResourceImportResult = {
      status: "success",
      rootUri: "viking://resources/guide.md",
      sourcePath: "https://example.com/guide.md",
    };
    const svc = makeStore({ importUrl: vi.fn().mockResolvedValue(importResult) });
    const tool = createOvImportTool(svc, makePipeline());

    const result = await executeTool(tool, { url: "https://example.com/guide.md" });

    const parsed = JSON.parse(getText(result));
    expect(parsed.rootUri).toBe("viking://resources/guide.md");
    expect(parsed.sourcePath).toBe("https://example.com/guide.md");
  });
});
