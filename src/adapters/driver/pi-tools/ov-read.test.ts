import { describe, it, expect, vi } from "vitest";
import type { ToolDefinition } from "@earendil-works/pi-coding-agent";
import { createOvReadTool } from "./ov-read";
import type { FsStoreService } from "../../../domain/services/fs-store-service";
import type { Content } from "../../../domain/ports/fs-store";
import type { Uri } from "../../../domain/common/uri";
import { Pipeline } from "../../../domain/pipeline/pipeline";

const sampleContent: Content = { uri: { value: "viking://docs/a.md" } as Uri, body: "file content", level: "read" };

function makeFsStoreService(overrides?: Partial<FsStoreService>): FsStoreService {
  return {
    read: vi.fn().mockResolvedValue(sampleContent),
    ...overrides,
  } as unknown as FsStoreService;
}

function makePipeline() {
  return new Pipeline<Content>();
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

describe("ov_read tool", () => {
  it("has correct name and schema", () => {
    const tool = createOvReadTool(makeFsStoreService(), makePipeline());
    expect(tool.name).toBe("ov_read");
    expect(tool.parameters).toBeDefined();
  });

  it("delegates to service.read with defaults", async () => {
    const calls: unknown[] = [];
    const svc = makeFsStoreService({
      read: vi.fn().mockImplementation(async (...args: unknown[]) => {
        calls.push(args);
        return sampleContent;
      }),
    });
    const tool = createOvReadTool(svc, makePipeline());

    const result = await executeTool(tool, { uri: "viking://docs/a.md" });

    expect(calls).toHaveLength(1);
    expect(calls[0]).toEqual(["viking://docs/a.md", undefined, undefined, undefined, undefined]);
    expect(getText(result)).toContain("file content");
  });

  it("passes level, offset, limit to service.read", async () => {
    const calls: unknown[] = [];
    const svc = makeFsStoreService({
      read: vi.fn().mockImplementation(async (...args: unknown[]) => {
        calls.push(args);
        return sampleContent;
      }),
    });
    const tool = createOvReadTool(svc, makePipeline());

    await executeTool(tool, { uri: "viking://docs/a.md", level: "read", offset: 10, limit: 50 });

    expect(calls).toHaveLength(1);
    expect(calls[0]).toEqual(["viking://docs/a.md", "read", 10, 50, undefined]);
  });

  it("returns error text on failure", async () => {
    const svc = makeFsStoreService({
      read: vi.fn().mockRejectedValue(new Error("not found")),
    });
    const tool = createOvReadTool(svc, makePipeline());

    const result = await executeTool(tool, { uri: "viking://missing" });
    expect(getText(result)).toContain("Read failed");
    expect(getText(result)).toContain("not found");
  });
});
