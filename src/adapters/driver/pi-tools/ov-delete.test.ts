import { describe, it, expect, vi } from "vitest";
import type { ToolDefinition } from "@earendil-works/pi-coding-agent";
import { createOvDeleteTool } from "./ov-delete";
import type { FsService } from "../../../domain/services/fs-service";
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
  return new Pipeline<void>();
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

describe("ov_delete tool", () => {
  it("has correct name and schema", () => {
    const tool = createOvDeleteTool(makeFsService(), makePipeline());
    expect(tool.name).toBe("ov_delete");
    expect(tool.parameters).toBeDefined();
  });

  it("delegates to service.delete with uri", async () => {
    const calls: unknown[] = [];
    const svc = makeFsService({
      delete: vi.fn().mockImplementation(async (...args: unknown[]) => {
        calls.push(args);
      }),
    });
    const tool = createOvDeleteTool(svc, makePipeline());

    const result = await executeTool(tool, { uri: "viking://docs/a.md" });

    expect(calls).toHaveLength(1);
    expect(calls[0]).toEqual(["viking://docs/a.md", undefined, undefined]);
    expect(getText(result)).toContain("Deleted");
  });

  it("passes recursive flag", async () => {
    const calls: unknown[] = [];
    const svc = makeFsService({
      delete: vi.fn().mockImplementation(async (...args: unknown[]) => {
        calls.push(args);
      }),
    });
    const tool = createOvDeleteTool(svc, makePipeline());

    await executeTool(tool, { uri: "viking://docs", recursive: true });

    expect(calls).toHaveLength(1);
    expect(calls[0]).toEqual(["viking://docs", true, undefined]);
  });

  it("returns success message on delete", async () => {
    const svc = makeFsService();
    const tool = createOvDeleteTool(svc, makePipeline());

    const result = await executeTool(tool, { uri: "viking://docs/a.md" });

    const text = getText(result);
    expect(text).toContain("Deleted");
    expect(text).toContain("viking://docs/a.md");
  });

  it("returns error on failure", async () => {
    const svc = makeFsService({
      delete: vi.fn().mockRejectedValue(new Error("permission denied")),
    });
    const tool = createOvDeleteTool(svc, makePipeline());

    const result = await executeTool(tool, { uri: "viking://docs/a.md" });
    expect(getText(result)).toContain("Delete failed");
    expect(getText(result)).toContain("permission denied");
  });
});
