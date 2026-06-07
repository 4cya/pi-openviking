import { Type } from "@sinclair/typebox";
import { defineTool, type ToolDefinition } from "@earendil-works/pi-coding-agent";
import type { Pipeline } from "../../../domain/pipeline/pipeline";
import type { SkillService } from "../../../domain/services/skill-service";
import type { AddSkillResult, SkillData } from "../../../domain/ports/skill-store";

const SkillSchema = Type.Object({
  content: Type.String({ description: "Skill content (SKILL.md format with YAML frontmatter, or `content` field when using structured data)" }),
  wait: Type.Optional(Type.Boolean({ description: "Wait for skill processing to complete" })),
  name: Type.Optional(Type.String({ description: "Skill name (required when using structured SkillData)" })),
  description: Type.Optional(Type.String({ description: "Skill description (required when using structured SkillData)" })),
  allowedTools: Type.Optional(Type.Array(Type.String(), { description: "Tools the skill is allowed to use" })),
  tags: Type.Optional(Type.Array(Type.String(), { description: "Tags for categorization" })),
});

export function createOvSkillTool(
  svc: SkillService,
  pipeline: Pipeline<AddSkillResult>,
): ToolDefinition<typeof SkillSchema> {
  return defineTool({
    name: "ov_skill",
    label: "Save Skill",
    description: "Save a skill definition to the OpenViking knowledge base. Uses POST /api/v1/skills which auto-detects MCP tools, SKILL.md format, or structured skill data. Pass raw content as a string, or use name+description fields for structured SkillData.",
    promptSnippet: "ov_skill(content, wait?, name?, description?, allowedTools?, tags?) — save skill definition via OV skills API",
    parameters: SkillSchema,
    async execute(_toolCallId, params, signal) {
      try {
        const data: string | SkillData = params.name || params.description
          ? {
              name: params.name!,
              description: params.description!,
              ...(params.content ? { content: params.content } : {}),
              ...(params.allowedTools ? { allowedTools: params.allowedTools } : {}),
              ...(params.tags ? { tags: params.tags } : {}),
            }
          : params.content!;

        const result = await pipeline.execute(
          () => svc.addSkill(data, { wait: params.wait }, signal ?? undefined),
          signal ?? undefined,
        );
        return {
          content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }],
          details: undefined,
        };
      } catch (err) {
        return {
          content: [{ type: "text" as const, text: `Skill save failed: ${err instanceof Error ? err.message : String(err)}` }],
          details: undefined,
        };
      }
    },
  });
}
