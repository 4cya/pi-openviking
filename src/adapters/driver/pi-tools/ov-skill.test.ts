import { describe, it, expect, vi } from "vitest";
import type { ToolDefinition } from "@earendil-works/pi-coding-agent";
import { createOvSkillTool } from "./ov-skill";
import type { FsStoreService } from "../../../domain/services/fs-store-service";
import type { WriteResult } from "../../../domain/ports/fs-store";
import type { Uri } from "../../../domain/common/uri";
import { Pipeline } from "../../../domain/pipeline/pipeline";

function makeFsStoreService(overrides?: Partial<FsStoreService>): FsStoreService {
  return {
    save: vi.fn().mockResolvedValue({ uri: { value: "viking://skills/test" } as Uri, success: true } as WriteResult),
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

describe("ov_skill tool", () => {
  it("has correct name and schema", () => {
    const tool = createOvSkillTool(makeFsStoreService(), makePipeline());
    expect(tool.name).toBe("ov_skill");
    expect(tool.parameters).toBeDefined();
  });

  it("rejects URI not under viking://skills/", async () => {
    const tool = createOvSkillTool(makeFsStoreService(), makePipeline());
    const result = await executeTool(tool, {
      uri: "viking://resources/test",
      content: "skill content",
    });
    expect(getText(result)).toContain("must start with viking://skills/");
  });

  it("delegates to FsStoreService.save for valid skill URI", async () => {
    const calls: unknown[] = [];
    const svc = makeFsStoreService({
      save: vi.fn().mockImplementation(async (...args: unknown[]) => {
        calls.push(args);
        return { uri: { value: "viking://skills/test.md" } as Uri, success: true };
      }),
    });
    const tool = createOvSkillTool(svc, makePipeline());

    const result = await executeTool(tool, {
      uri: "viking://skills/test.md",
      content: "skill content",
    });

    expect(calls).toHaveLength(1);
    const args = calls[0] as [string, string];
    expect(args[0]).toBe("viking://skills/test.md");
    expect(args[1]).toBe("skill content");
    expect(getText(result)).toContain("success");
  });

  it("returns error message on failure", async () => {
    const svc = makeFsStoreService({
      save: vi.fn().mockRejectedValue(new Error("OV unavailable")),
    });
    const tool = createOvSkillTool(svc, makePipeline());

    const result = await executeTool(tool, {
      uri: "viking://skills/test.md",
      content: "x",
    });

    expect(getText(result)).toContain("failed");
    expect(getText(result)).toContain("OV unavailable");
  });
});
