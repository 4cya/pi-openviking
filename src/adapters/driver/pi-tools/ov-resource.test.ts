import { describe, it, expect, vi } from "vitest";
import type { ToolDefinition } from "@earendil-works/pi-coding-agent";
import { createOvResourceTool } from "./ov-resource";
import type { FsStoreService } from "../../../domain/services/fs-store-service";
import type { WriteResult } from "../../../domain/ports/fs-store";
import type { Uri } from "../../../domain/common/uri";
import { Pipeline } from "../../../domain/pipeline/pipeline";

function makeFsStoreService(overrides?: Partial<FsStoreService>): FsStoreService {
  return {
    save: vi.fn().mockResolvedValue({ uri: { value: "viking://resources/test" } as Uri, success: true } as WriteResult),
    mkdir: vi.fn().mockResolvedValue(undefined),
    mv: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  } as unknown as FsStoreService;
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

describe("ov_resource tool", () => {
  it("has correct name and schema", () => {
    const tool = createOvResourceTool(makeFsStoreService(), makePipeline());
    expect(tool.name).toBe("ov_resource");
    expect(tool.parameters).toBeDefined();
  });

  it("rejects URI not under viking://resources/", async () => {
    const tool = createOvResourceTool(makeFsStoreService(), makePipeline());
    const result = await executeTool(tool, {
      uri: "viking://skills/test",
      content: "some content",
    });
    expect(getText(result)).toContain("must start with viking://resources/");
  });

  it("rejects non-viking URI", async () => {
    const tool = createOvResourceTool(makeFsStoreService(), makePipeline());
    const result = await executeTool(tool, {
      uri: "/tmp/foo",
      content: "content",
    });
    expect(getText(result)).toContain("must start with viking://resources/");
  });

  it("delegates to FsStoreService.save for valid resource URI", async () => {
    const calls: unknown[] = [];
    const svc = makeFsStoreService({
      save: vi.fn().mockImplementation(async (...args: unknown[]) => {
        calls.push(args);
        return { uri: { value: "viking://resources/test.md" } as Uri, success: true };
      }),
    });
    const tool = createOvResourceTool(svc, makePipeline());

    const result = await executeTool(tool, {
      uri: "viking://resources/test.md",
      content: "resource content",
      mode: "replace",
    });

    expect(calls).toHaveLength(1);
    const args = calls[0] as [string, string, string | undefined];
    expect(args[0]).toBe("viking://resources/test.md");
    expect(args[1]).toBe("resource content");
    expect(args[2]).toBe("replace");
    expect(getText(result)).toContain("success");
  });

  it("defaults mode to replace", async () => {
    const calls: unknown[] = [];
    const svc = makeFsStoreService({
      save: vi.fn().mockImplementation(async (...args: unknown[]) => {
        calls.push(args);
        return { uri: { value: "viking://resources/test.md" } as Uri, success: true };
      }),
    });
    const tool = createOvResourceTool(svc, makePipeline());

    await executeTool(tool, {
      uri: "viking://resources/test.md",
      content: "hello",
    });

    expect((calls[0] as [string, string, string | undefined])[2]).toBeUndefined();
  });

  it("returns error message on failure", async () => {
    const svc = makeFsStoreService({
      save: vi.fn().mockRejectedValue(new Error("OV unavailable")),
    });
    const tool = createOvResourceTool(svc, makePipeline());

    const result = await executeTool(tool, {
      uri: "viking://resources/test.md",
      content: "x",
    });

    expect(getText(result)).toContain("failed");
    expect(getText(result)).toContain("OV unavailable");
  });
});
