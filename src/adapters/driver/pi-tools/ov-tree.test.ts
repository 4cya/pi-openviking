import { describe, it, expect, vi } from "vitest";
import type { ToolDefinition } from "@earendil-works/pi-coding-agent";
import { createOvTreeTool } from "./ov-tree";
import type { FsService } from "../../../domain/services/fs-service";
import type { FsEntry } from "../../../domain/ports/fs-store";
import type { Uri } from "../../../domain/common/uri";
import { Pipeline } from "../../../domain/pipeline/pipeline";

function makeFsService(overrides?: Partial<FsService>): FsService {
  return {
    list: vi.fn().mockResolvedValue([]),
    tree: vi.fn().mockResolvedValue([]),
    stat: vi.fn().mockResolvedValue({ uri: { value: "viking://a" } as Uri, type: "file" }),
    delete: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  } as unknown as FsService;
}

function makePipeline() {
  return new Pipeline<FsEntry[]>();
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

describe("ov_tree tool", () => {
  it("has correct name and schema", () => {
    const tool = createOvTreeTool(makeFsService(), makePipeline());
    expect(tool.name).toBe("ov_tree");
    expect(tool.parameters).toBeDefined();
  });

  it("delegates to service.tree with uri", async () => {
    const calls: unknown[] = [];
    const svc = makeFsService({
      tree: vi.fn().mockImplementation(async (...args: unknown[]) => {
        calls.push(args);
        return [];
      }),
    });
    const tool = createOvTreeTool(svc, makePipeline());

    await executeTool(tool, { uri: "viking://" });

    expect(calls).toHaveLength(1);
    expect(calls[0]).toEqual(["viking://", undefined]);
  });

  it("returns entries as JSON", async () => {
    const entries: FsEntry[] = [
      { uri: { value: "viking://docs" } as Uri, type: "directory" },
      { uri: { value: "viking://docs/a.md" } as Uri, type: "file" },
    ];
    const svc = makeFsService({ tree: vi.fn().mockResolvedValue(entries) });
    const tool = createOvTreeTool(svc, makePipeline());

    const result = await executeTool(tool, { uri: "viking://" });

    const parsed = JSON.parse(getText(result));
    expect(parsed).toHaveLength(2);
  });

  it("returns error on failure", async () => {
    const svc = makeFsService({
      tree: vi.fn().mockRejectedValue(new Error("timeout")),
    });
    const tool = createOvTreeTool(svc, makePipeline());

    const result = await executeTool(tool, { uri: "viking://" });
    expect(getText(result)).toContain("Tree failed");
    expect(getText(result)).toContain("timeout");
  });
});
