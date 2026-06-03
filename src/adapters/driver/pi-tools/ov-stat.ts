import { Type } from "@sinclair/typebox";
import { defineTool, type ToolDefinition } from "@earendil-works/pi-coding-agent";
import type { Pipeline } from "../../../domain/pipeline/pipeline";
import type { FsService } from "../../../domain/services/fs-service";
import type { FsEntry } from "../../../domain/ports/fs-store";

const StatSchema = Type.Object({
  uri: Type.String({ description: "URI to stat (viking://...)" }),
});

export function createOvStatTool(
  svc: FsService,
  pipeline: Pipeline<FsEntry>,
): ToolDefinition<typeof StatSchema> {
  return defineTool({
    name: "ov_stat",
    label: "Stat URI",
    description: "Get metadata for a URI in the OpenViking knowledge base.",
    promptSnippet: "ov_stat(uri) — get URI metadata",
    parameters: StatSchema,
    async execute(_toolCallId, params, signal) {
      try {
        const result = await pipeline.execute(
          () => svc.stat(params.uri!, signal ?? undefined),
          signal ?? undefined,
        );
        return {
          content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }],
          details: undefined,
        };
      } catch (err) {
        return {
          content: [{ type: "text" as const, text: `Stat failed: ${err instanceof Error ? err.message : String(err)}` }],
          details: undefined,
        };
      }
    },
  });
}
