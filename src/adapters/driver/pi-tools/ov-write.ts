import { Type } from "@sinclair/typebox";
import { defineTool, type ToolDefinition } from "@earendil-works/pi-coding-agent";
import type { Pipeline } from "../../../domain/pipeline/pipeline";
import type { FsStoreService } from "../../../domain/services/fs-store-service";

const WriteSchema = Type.Object({
  action: Type.Union(
    [Type.Literal("save"), Type.Literal("mkdir"), Type.Literal("mv")],
    { description: 'Action: "save" writes content, "mkdir" creates directory, "mv" moves/renames' },
  ),
  uri: Type.String({ description: "Source URI (viking://...)" }),
  content: Type.Optional(Type.String({ description: "Content to write (save action only)" })),
  targetUri: Type.Optional(Type.String({ description: "Destination URI (mv action only)" })),
  mode: Type.Optional(
    Type.Union(
      [Type.Literal("replace"), Type.Literal("append"), Type.Literal("create")],
      { description: 'Write mode for save action: "replace" (default), "append", "create"' },
    ),
  ),
});

export function createOvWriteTool(
  svc: FsStoreService,
  pipeline: Pipeline<unknown>,
): ToolDefinition<typeof WriteSchema> {
  return defineTool({
    name: "ov_write",
    label: "Write / Modify Content",
    description: "Write or modify content in the OpenViking knowledge base. Supports save, mkdir, and mv actions.",
    promptSnippet: 'ov_write(action, uri, content?, targetUri?, mode?) — write/mkdir/mv',
    parameters: WriteSchema,
    async execute(_toolCallId, params, signal) {
      try {
        const result = await pipeline.execute(async () => {
          switch (params.action) {
            case "save":
              return svc.save(params.uri!, params.content ?? "", params.mode, signal ?? undefined);
            case "mkdir":
              return svc.mkdir(params.uri!, signal ?? undefined);
            case "mv": {
              if (!params.targetUri) throw new Error("targetUri required for mv action");
              return svc.mv(params.uri!, params.targetUri, signal ?? undefined);
            }
            default:
              throw new Error(`Unknown action: ${params.action}`);
          }
        }, signal ?? undefined);
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
