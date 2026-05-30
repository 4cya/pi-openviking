import { describe, it, expect, vi } from "vitest";
import type { ToolDefinition } from "@earendil-works/pi-coding-agent";
import { createOvWriteTool } from "./ov-write";
import type { WriteService } from "../../../domain/services/write-service";
import type { WriteResult } from "../../../domain/ports/fs-store";
import type { Uri } from "../../../domain/common/uri";
import { Pipeline } from "../../../domain/pipeline/pipeline";

function makeWriteService(overrides?: Partial<WriteService>): WriteService {
  return {
    save: vi.fn().mockResolvedValue({ uri: { value: "viking://a" } as Uri, success: true } as WriteResult),
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

describe("ov_write tool", () => {
  it("has correct name and schema", () => {
    const tool = createOvWriteTool(makeWriteService(), makePipeline());
    expect(tool.name).toBe("ov_write");
    expect(tool.parameters).toBeDefined();
  });

  it("action=save delegates to service.save", async () => {
    const calls: unknown[] = [];
    const svc = makeWriteService({
      save: vi.fn().mockImplementation(async (...args: unknown[]) => {
        calls.push(args);
        return { uri: { value: "viking://docs/a.md" } as Uri, success: true };
      }),
    });
    const tool = createOvWriteTool(svc, makePipeline());

    const result = await executeTool(tool, {
      action: "save",
      uri: "viking://docs/a.md",
      content: "hello",
      mode: "replace",
    });

    expect(calls).toHaveLength(1);
    expect(calls[0]).toEqual(["viking://docs/a.md", "hello", "replace", undefined]);
    expect(getText(result)).not.toContain("failed");
  });

  it("action=mkdir delegates to service.mkdir", async () => {
    const calls: unknown[] = [];
    const svc = makeWriteService({
      mkdir: vi.fn().mockImplementation(async (...args: unknown[]) => {
        calls.push(args);
      }),
    });
    const tool = createOvWriteTool(svc, makePipeline());

    const result = await executeTool(tool, {
      action: "mkdir",
      uri: "viking://docs/new-dir",
    });

    expect(calls).toHaveLength(1);
    expect(calls[0]).toEqual(["viking://docs/new-dir", undefined]);
    expect(getText(result)).toContain("ok");
  });

  it("action=mv delegates to service.mv", async () => {
    const calls: unknown[] = [];
    const svc = makeWriteService({
      mv: vi.fn().mockImplementation(async (...args: unknown[]) => {
        calls.push(args);
      }),
    });
    const tool = createOvWriteTool(svc, makePipeline());

    const result = await executeTool(tool, {
      action: "mv",
      uri: "viking://docs/a.md",
      targetUri: "viking://docs/b.md",
    });

    expect(calls).toHaveLength(1);
    expect(calls[0]).toEqual(["viking://docs/a.md", "viking://docs/b.md", undefined]);
    expect(getText(result)).toContain("ok");
  });

  it("returns error on unknown action", async () => {
    const tool = createOvWriteTool(makeWriteService(), makePipeline());
    const result = await executeTool(tool, { action: "bogus", uri: "viking://x" });
    expect(getText(result)).toContain("failed");
  });

  it("returns error when mv called without targetUri", async () => {
    const tool = createOvWriteTool(makeWriteService(), makePipeline());
    const result = await executeTool(tool, { action: "mv", uri: "viking://x" });
    expect(getText(result)).toContain("failed");
  });
});
