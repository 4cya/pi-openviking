import { describe, it, expect, vi } from "vitest";
import type { ToolDefinition } from "@earendil-works/pi-coding-agent";
import { createOvListTool } from "./ov-list";
import type { FsStoreService } from "../../../domain/services/fs-store-service";
import type { FsEntry } from "../../../domain/ports/fs-store";
import type { Uri } from "../../../domain/common/uri";
import { Pipeline } from "../../../domain/pipeline/pipeline";

function makeFsStoreService(overrides?: Partial<FsStoreService>): FsStoreService {
  return {
    list: vi.fn().mockResolvedValue([]),
    tree: vi.fn().mockResolvedValue([]),
    stat: vi.fn().mockResolvedValue({ uri: { value: "viking://a" } as Uri, type: "file" }),
    delete: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  } as unknown as FsStoreService;
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

describe("ov_list tool", () => {
  it("has correct name and schema", () => {
    const tool = createOvListTool(makeFsStoreService(), makePipeline());
    expect(tool.name).toBe("ov_list");
    expect(tool.parameters).toBeDefined();
  });

  it("delegates to service.list with uri", async () => {
    const calls: unknown[] = [];
    const svc = makeFsStoreService({
      list: vi.fn().mockImplementation(async (...args: unknown[]) => {
        calls.push(args);
        return [];
      }),
    });
    const tool = createOvListTool(svc, makePipeline());

    const result = await executeTool(tool, { uri: "viking://docs" });

    expect(calls).toHaveLength(1);
    expect(calls[0]).toEqual(["viking://docs", undefined, undefined]);
    const text = getText(result);
    expect(text).toContain("[]");
  });

  it("passes recursive flag", async () => {
    const calls: unknown[] = [];
    const svc = makeFsStoreService({
      list: vi.fn().mockImplementation(async (...args: unknown[]) => {
        calls.push(args);
        return [];
      }),
    });
    const tool = createOvListTool(svc, makePipeline());

    await executeTool(tool, { uri: "viking://docs", recursive: true });

    expect(calls).toHaveLength(1);
    expect(calls[0]).toEqual(["viking://docs", true, undefined]);
  });

  it("returns entries as JSON", async () => {
    const entries: FsEntry[] = [
      { uri: { value: "viking://docs/a.md" } as Uri, type: "file", size: 100 },
      { uri: { value: "viking://docs/sub" } as Uri, type: "directory" },
    ];
    const svc = makeFsStoreService({ list: vi.fn().mockResolvedValue(entries) });
    const tool = createOvListTool(svc, makePipeline());

    const result = await executeTool(tool, { uri: "viking://docs" });

    const parsed = JSON.parse(getText(result));
    expect(parsed).toHaveLength(2);
    expect(parsed[0].uri.value).toBe("viking://docs/a.md");
  });

  it("returns error on failure", async () => {
    const svc = makeFsStoreService({
      list: vi.fn().mockRejectedValue(new Error("access denied")),
    });
    const tool = createOvListTool(svc, makePipeline());

    const result = await executeTool(tool, { uri: "viking://docs" });
    expect(getText(result)).toContain("List failed");
    expect(getText(result)).toContain("access denied");
  });
});
