import { describe, it, expect, vi } from "vitest";
import type { ToolDefinition } from "@earendil-works/pi-coding-agent";
import { createOvResourceTool } from "./ov-resource";
import type { WriteService } from "../../../domain/services/write-service";
import type { WriteResult } from "../../../domain/ports/fs-store";
import type { Uri } from "../../../domain/common/uri";
import { Pipeline } from "../../../domain/pipeline/pipeline";

function makeWriteService(overrides?: Partial<WriteService>): WriteService {
  return {
    save: vi.fn().mockResolvedValue({ uri: { value: "viking://resources/test" } as Uri, success: true } as WriteResult),
    mkdir: vi.fn().mockResolvedValue(undefined),
    mv: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  } as unknown as WriteService;
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
    const tool = createOvResourceTool(makeWriteService(), makePipeline());
    expect(tool.name).toBe("ov_resource");
    expect(tool.parameters).toBeDefined();
  });

  it("rejects URI not under viking://resources/", async () => {
    const tool = createOvResourceTool(makeWriteService(), makePipeline());
    const result = await executeTool(tool, {
      uri: "viking://skills/test",
      content: "some content",
    });
    expect(getText(result)).toContain("must start with viking://resources/");
  });

  it("rejects non-viking URI", async () => {
    const tool = createOvResourceTool(makeWriteService(), makePipeline());
    const result = await executeTool(tool, {
      uri: "/tmp/foo",
      content: "content",
    });
    expect(getText(result)).toContain("must start with viking://resources/");
  });

  it("delegates to WriteService.save for valid resource URI", async () => {
    const calls: unknown[] = [];
    const svc = makeWriteService({
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
    expect(calls[0][0]).toBe("viking://resources/test.md");
    expect(calls[0][1]).toBe("resource content");
    expect(calls[0][2]).toBe("replace");
    expect(getText(result)).toContain("success");
  });

  it("defaults mode to replace", async () => {
    const calls: unknown[] = [];
    const svc = makeWriteService({
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

    expect(calls[0][2]).toBeUndefined();
  });

  it("returns error message on failure", async () => {
    const svc = makeWriteService({
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
