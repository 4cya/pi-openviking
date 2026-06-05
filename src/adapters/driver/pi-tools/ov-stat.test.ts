import { describe, it, expect, vi } from "vitest";
import type { ToolDefinition } from "@earendil-works/pi-coding-agent";
import { createOvStatTool } from "./ov-stat";
import type { FsStoreService } from "../../../domain/services/fs-store-service";
import type { FsEntry } from "../../../domain/ports/fs-store";
import type { Uri } from "../../../domain/common/uri";
import { Pipeline } from "../../../domain/pipeline/pipeline";

const sampleEntry: FsEntry = { uri: { value: "viking://docs/a.md" } as Uri, type: "file", size: 1024, modTime: "2025-01-01" };

function makeFsStoreService(overrides?: Partial<FsStoreService>): FsStoreService {
  return {
    list: vi.fn().mockResolvedValue([]),
    tree: vi.fn().mockResolvedValue([]),
    stat: vi.fn().mockResolvedValue(sampleEntry),
    delete: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  } as unknown as FsStoreService;
}

function makePipeline() {
  return new Pipeline<FsEntry>();
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

describe("ov_stat tool", () => {
  it("has correct name and schema", () => {
    const tool = createOvStatTool(makeFsStoreService(), makePipeline());
    expect(tool.name).toBe("ov_stat");
    expect(tool.parameters).toBeDefined();
  });

  it("delegates to service.stat with uri", async () => {
    const calls: unknown[] = [];
    const svc = makeFsStoreService({
      stat: vi.fn().mockImplementation(async (...args: unknown[]) => {
        calls.push(args);
        return sampleEntry;
      }),
    });
    const tool = createOvStatTool(svc, makePipeline());

    await executeTool(tool, { uri: "viking://docs/a.md" });

    expect(calls).toHaveLength(1);
    expect(calls[0]).toEqual(["viking://docs/a.md", undefined]);
  });

  it("returns entry as JSON", async () => {
    const svc = makeFsStoreService();
    const tool = createOvStatTool(svc, makePipeline());

    const result = await executeTool(tool, { uri: "viking://docs/a.md" });

    const parsed = JSON.parse(getText(result));
    expect(parsed.uri.value).toBe("viking://docs/a.md");
    expect(parsed.type).toBe("file");
    expect(parsed.size).toBe(1024);
  });

  it("returns error on failure", async () => {
    const svc = makeFsStoreService({
      stat: vi.fn().mockRejectedValue(new Error("not found")),
    });
    const tool = createOvStatTool(svc, makePipeline());

    const result = await executeTool(tool, { uri: "viking://missing" });
    expect(getText(result)).toContain("Stat failed");
    expect(getText(result)).toContain("not found");
  });
});
