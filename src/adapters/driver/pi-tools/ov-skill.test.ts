import { describe, it, expect, vi } from "vitest";
import type { ToolDefinition } from "@earendil-works/pi-coding-agent";
import { createOvSkillTool } from "./ov-skill";
import type { SkillService } from "../../../domain/services/skill-service";
import type { AddSkillResult } from "../../../domain/ports/skill-store";
import { Pipeline } from "../../../domain/pipeline/pipeline";

function makeSkillService(overrides?: Partial<SkillService>): SkillService {
  return {
    addSkill: vi.fn().mockResolvedValue({
      rootUri: "viking://agent/default/skills/test-skill",
      uri: "viking://agent/default/skills/test-skill",
      name: "test-skill",
      auxiliaryFiles: 0,
    } as AddSkillResult),
    ...overrides,
  } as unknown as SkillService;
}

function makePipeline() {
  return new Pipeline<AddSkillResult>();
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
    const tool = createOvSkillTool(makeSkillService(), makePipeline());
    expect(tool.name).toBe("ov_skill");
    expect(tool.parameters).toBeDefined();
  });

  it("calls SkillService.addSkill with content", async () => {
    const calls: unknown[] = [];
    const svc = makeSkillService({
      addSkill: vi.fn().mockImplementation(async (...args: unknown[]) => {
        calls.push(args);
        return {
          rootUri: "viking://agent/default/skills/my-skill",
          uri: "viking://agent/default/skills/my-skill",
          name: "my-skill",
          auxiliaryFiles: 0,
        } as AddSkillResult;
      }),
    });
    const tool = createOvSkillTool(svc, makePipeline());

    const result = await executeTool(tool, {
      content: "---\nname: my-skill\ndescription: Test\n---\n\nContent here",
    });

    expect(calls).toHaveLength(1);
    const args = calls[0] as [string, object];
    expect(args[0]).toBe("---\nname: my-skill\ndescription: Test\n---\n\nContent here");
    expect(getText(result)).toContain("my-skill");
    expect(getText(result)).toContain("viking://agent/default/skills/my-skill");
  });

  it("accepts structured SkillData with name and description", async () => {
    const calls: unknown[] = [];
    const svc = makeSkillService({
      addSkill: vi.fn().mockImplementation(async (...args: unknown[]) => {
        calls.push(args);
        return {
          rootUri: "viking://agent/default/skills/my-structured-skill",
          uri: "viking://agent/default/skills/my-structured-skill",
          name: "my-structured-skill",
          auxiliaryFiles: 0,
        } as AddSkillResult;
      }),
    });
    const tool = createOvSkillTool(svc, makePipeline());

    const result = await executeTool(tool, {
      content: "# Skill logic",
      name: "my-structured-skill",
      description: "A structured skill for testing",
      allowedTools: ["ov_search", "ov_read"],
      tags: ["test", "structured"],
    });

    expect(calls).toHaveLength(1);
    const [data] = calls[0] as [Record<string, unknown>, object];
    expect(data).toMatchObject({
      name: "my-structured-skill",
      description: "A structured skill for testing",
      content: "# Skill logic",
      allowedTools: ["ov_search", "ov_read"],
      tags: ["test", "structured"],
    });
    expect(getText(result)).toContain("my-structured-skill");
  });

  it("passes wait option when provided", async () => {
    const calls: unknown[] = [];
    const svc = makeSkillService({
      addSkill: vi.fn().mockImplementation(async (...args: unknown[]) => {
        calls.push(args);
        return { rootUri: "", uri: "", name: "", auxiliaryFiles: 0 };
      }),
    });
    const tool = createOvSkillTool(svc, makePipeline());

    await executeTool(tool, {
      content: "# test",
      wait: true,
    });

    const [, options] = calls[0] as [string, { wait?: boolean }];
    expect(options?.wait).toBe(true);
  });

  it("returns error message on failure", async () => {
    const svc = makeSkillService({
      addSkill: vi.fn().mockRejectedValue(new Error("OV unavailable")),
    });
    const tool = createOvSkillTool(svc, makePipeline());

    const result = await executeTool(tool, {
      content: "# test",
    });

    expect(getText(result)).toContain("Skill save failed");
    expect(getText(result)).toContain("OV unavailable");
  });
});
