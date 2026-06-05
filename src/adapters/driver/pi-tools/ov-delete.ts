import { Type } from "@sinclair/typebox";
import { defineTool, type ToolDefinition } from "@earendil-works/pi-coding-agent";
import type { Pipeline } from "../../../domain/pipeline/pipeline";
import type { FsStoreService } from "../../../domain/services/fs-store-service";

const DeleteSchema = Type.Object({
  uri: Type.String({ description: "URI to delete (viking://...)" }),
  recursive: Type.Optional(Type.Boolean({ description: "Delete recursively" })),
});

export function createOvDeleteTool(
  svc: FsStoreService,
  pipeline: Pipeline<void>,
): ToolDefinition<typeof DeleteSchema> {
  return defineTool({
    name: "ov_delete",
    label: "Delete Resource",
    description: "Delete a resource from the OpenViking knowledge base. No confirmation — agent owns its tool calls.",
    promptSnippet: "ov_delete(uri, recursive?) — delete resource",
    parameters: DeleteSchema,
    async execute(_toolCallId, params, signal) {
      try {
        await pipeline.execute(
          () => svc.delete(params.uri!, params.recursive, signal ?? undefined),
          signal ?? undefined,
        );
        return {
          content: [{ type: "text" as const, text: `Deleted: ${params.uri}` }],
          details: undefined,
        };
      } catch (err) {
        return {
          content: [{ type: "text" as const, text: `Delete failed: ${err instanceof Error ? err.message : String(err)}` }],
          details: undefined,
        };
      }
    },
  });
}
