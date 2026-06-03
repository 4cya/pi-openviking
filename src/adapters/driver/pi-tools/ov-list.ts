import { Type } from "@sinclair/typebox";
import { defineTool, type ToolDefinition } from "@earendil-works/pi-coding-agent";
import type { Pipeline } from "../../../domain/pipeline/pipeline";
import type { FsService } from "../../../domain/services/fs-service";
import type { FsEntry } from "../../../domain/ports/fs-store";

const ListSchema = Type.Object({
  uri: Type.String({ description: "URI to list (viking://...)" }),
  recursive: Type.Optional(Type.Boolean({ description: "List recursively" })),
});

export function createOvListTool(
  svc: FsService,
  pipeline: Pipeline<FsEntry[]>,
): ToolDefinition<typeof ListSchema> {
  return defineTool({
    name: "ov_list",
    label: "List Directory",
    description: "List contents of a directory in the OpenViking knowledge base.",
    promptSnippet: "ov_list(uri, recursive?) — list directory contents",
    parameters: ListSchema,
    async execute(_toolCallId, params, signal) {
      try {
        const result = await pipeline.execute(
          () => svc.list(params.uri!, params.recursive, signal ?? undefined),
          signal ?? undefined,
        );
        return {
          content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }],
          details: undefined,
        };
      } catch (err) {
        return {
          content: [{ type: "text" as const, text: `List failed: ${err instanceof Error ? err.message : String(err)}` }],
          details: undefined,
        };
      }
    },
  });
}
