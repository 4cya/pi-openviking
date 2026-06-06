import { Type } from "@sinclair/typebox";
import { defineTool, type ToolDefinition } from "@earendil-works/pi-coding-agent";
import type { Pipeline } from "../../../domain/pipeline/pipeline";
import type { FsStoreService } from "../../../domain/services/fs-store-service";

const SKILL_PREFIX = "viking://user/skills/";

const SkillSchema = Type.Object({
  uri: Type.String({ description: "Skill URI (must start with viking://user/skills/)" }),
  content: Type.String({ description: "Skill content" }),
  mode: Type.Optional(
    Type.Union(
      [Type.Literal("replace"), Type.Literal("append"), Type.Literal("create")],
      { description: 'Write mode: "replace" (default), "append", "create"' },
    ),
  ),
});

export function createOvSkillTool(
  svc: FsStoreService,
  pipeline: Pipeline<unknown>,
): ToolDefinition<typeof SkillSchema> {
  return defineTool({
    name: "ov_skill",
    label: "Save Skill",
    description: "Save a skill definition to the OpenViking knowledge base (viking://user/skills/...). Use ov_write for other URI schemes.",
    promptSnippet: "ov_skill(uri, content, mode?) — save skill definition",
    parameters: SkillSchema,
    async execute(_toolCallId, params, signal) {
      if (!params.uri!.startsWith(SKILL_PREFIX)) {
        return {
          content: [{ type: "text" as const, text: `Skill URI must start with ${SKILL_PREFIX}` }],
          details: undefined,
        };
      }
      try {
        const result = await pipeline.execute(
          () => svc.save(params.uri!, params.content!, params.mode, signal ?? undefined),
          signal ?? undefined,
        );
        return {
          content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) ?? "ok" }],
          details: undefined,
        };
      } catch (err) {
        return {
          content: [{ type: "text" as const, text: `Write failed: ${err instanceof Error ? err.message : String(err)}` }],
          details: undefined,
        };
      }
    },
  });
}
